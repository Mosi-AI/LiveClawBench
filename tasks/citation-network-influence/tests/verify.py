#!/usr/bin/env python3
"""Verifier for citation-network-influence.

Stages:
  1. Hard gate: imports.
  2. AST surface scan: forbidden APIs + dense-matrix detection.
  3. Run agent's CLI -> produces ./reports/* in /tmp.
  4. Compare against trusted-copy ground truth.
"""

from __future__ import annotations

import ast
import csv
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path("/workspace/repo")
PKG = REPO / "citation_analyzer"
LOG_DIR = Path("/logs/verifier")
ARTIFACTS = Path("/tmp/cit_artifacts")
PAPERS = REPO / "data" / "papers.json"
EDGES = REPO / "data" / "edges.json"
SEEDS = REPO / "data" / "seeds.json"


FORBIDDEN_FROM = (
    ("networkx", "pagerank"),
    ("networkx.algorithms.link_analysis", None),
    ("scipy.sparse.linalg", "eigs"),
    ("scipy.sparse.linalg", "eigsh"),
)
FORBIDDEN_ATTR_CHAINS = (
    ("networkx", "pagerank"),
    ("nx", "pagerank"),
    ("scipy", "sparse", "linalg", "eigs"),
    ("scipy", "sparse", "linalg", "eigsh"),
)


def emit(
    score: float,
    breakdown: dict | None = None,
    *,
    reason: str = "",
    meta: dict | None = None,
) -> None:
    score = max(0.0, min(1.0, score))
    if reason:
        print(reason)
    print(f"Score: {score:.2f}/1.0")
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"reward": round(score, 4)}
    if breakdown:
        payload.update(breakdown)
    (LOG_DIR / "reward.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
    if meta:
        (LOG_DIR / "metadata.json").write_text(
            json.dumps(meta, indent=2, default=str), encoding="utf-8"
        )


def hard_gate() -> tuple[bool, str]:
    cmd = [
        sys.executable,
        "-c",
        "import sys; sys.path.insert(0, '/workspace/repo'); "
        "from citation_analyzer import load_graph, pagerank, detect_cascades, "
        "yearly_top, write_outputs; print('GATE OK')",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        return False, f"hard gate failed:\n{r.stderr[-800:]}"
    return True, ""


def _attr_chain(node: ast.Attribute) -> tuple[str, ...]:
    chain = []
    cur = node
    while isinstance(cur, ast.Attribute):
        chain.append(cur.attr)
        cur = cur.value
    if isinstance(cur, ast.Name):
        chain.append(cur.id)
    return tuple(reversed(chain))


def scan_ast() -> tuple[float, list[str]]:
    if not PKG.exists():
        return 0.0, ["citation_analyzer/ missing"]
    hits: list[str] = []
    for py in PKG.rglob("*.py"):
        try:
            tree = ast.parse(py.read_text(encoding="utf-8", errors="replace"))
        except SyntaxError as e:
            hits.append(f"{py.relative_to(REPO)}: SyntaxError {e}")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                for fmod, fname in FORBIDDEN_FROM:
                    if mod == fmod and (
                        fname is None or any(a.name == fname for a in node.names)
                    ):
                        hits.append(
                            f"{py.relative_to(REPO)}: from {mod} import {fname or '*'}"
                        )
                    if mod.startswith(fmod + ".") and fname is None:
                        hits.append(f"{py.relative_to(REPO)}: from {mod}")
            elif isinstance(node, ast.Attribute):
                chain = _attr_chain(node)
                for forbidden in FORBIDDEN_ATTR_CHAINS:
                    if (
                        len(chain) >= len(forbidden)
                        and chain[: len(forbidden)] == forbidden
                    ):
                        hits.append(f"{py.relative_to(REPO)}: chain {'.'.join(chain)}")
    if hits:
        print("AST scan hits:")
        for h in hits:
            print(f"  {h}")
        return 0.2, hits
    return 1.0, []


def run_agent() -> bool:
    if ARTIFACTS.exists():
        shutil.rmtree(ARTIFACTS)
    ARTIFACTS.mkdir(parents=True)
    cmd = [
        sys.executable,
        "-m",
        "citation_analyzer",
        "run",
        "--papers",
        str(PAPERS),
        "--edges",
        str(EDGES),
        "--seeds",
        str(SEEDS),
        "--out",
        str(ARTIFACTS),
    ]
    env = {
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "PYTHONPATH": "/workspace/repo",
        "HOME": "/root",
    }
    r = subprocess.run(
        cmd, cwd=str(REPO), capture_output=True, text=True, timeout=240, env=env
    )
    if r.returncode != 0:
        print(f"  agent CLI FAIL:\n    {r.stderr[-600:]}")
        return False
    return True


def load_trusted():
    spec = importlib.util.spec_from_file_location(
        "trusted_core", "/tests/trusted/core.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def compute_ground_truth():
    t = load_trusted()
    g = t.load_graph(str(PAPERS), str(EDGES))
    pr = t.pagerank(g)
    with open(SEEDS) as f:
        seeds = json.load(f)
    cascades = t.detect_cascades(g, seeds)
    yt = t.yearly_top(g, k=10)
    return pr, cascades, yt


def kendall_tau(list_a: list[str], list_b: list[str]) -> float:
    """Kendall's tau between two ordered lists; relax for items only in one side."""
    common = list(set(list_a) & set(list_b))
    if len(common) < 2:
        return 0.0
    a_rank = {x: list_a.index(x) for x in common}
    b_rank = {x: list_b.index(x) for x in common}
    concord = discord = 0
    for i in range(len(common)):
        for j in range(i + 1, len(common)):
            xi, xj = common[i], common[j]
            sign_a = a_rank[xi] - a_rank[xj]
            sign_b = b_rank[xi] - b_rank[xj]
            prod = sign_a * sign_b
            if prod > 0:
                concord += 1
            elif prod < 0:
                discord += 1
    total = concord + discord
    return (concord - discord) / total if total else 0.0


def grade_pagerank(pr_truth: dict, agent_csv: Path) -> tuple[float, dict]:
    """Top-10 Kendall tau >= 0.7 -> full 0.20 credit."""
    if not agent_csv.exists():
        return 0.0, {"reason": "pagerank_top20.csv missing"}
    truth_top = [
        pid
        for pid, _ in sorted(pr_truth.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]
    agent_top = []
    with open(agent_csv) as f:
        r = csv.DictReader(f)
        for row in r:
            agent_top.append(row.get("paper_id"))
            if len(agent_top) >= 10:
                break
    tau = kendall_tau(truth_top, agent_top)
    overlap = len(set(truth_top) & set(agent_top))
    credit = 0.20 if tau >= 0.7 else (0.10 if tau >= 0.4 else 0.0)
    return credit, {"kendall_tau": round(tau, 4), "top10_overlap": overlap}


def grade_cascades(truth_cas: list[dict], agent_csv: Path) -> tuple[float, dict]:
    if not agent_csv.exists():
        return 0.0, {"reason": "cascades.csv missing"}
    truth_by = {c["seed_id"]: c for c in truth_cas}
    agent = {}
    with open(agent_csv) as f:
        r = csv.DictReader(f)
        for row in r:
            agent[row["seed_id"]] = row
    n_ok = 0
    for sid, t in truth_by.items():
        if sid not in agent:
            continue
        a = agent[sid]
        try:
            a_size = int(a["cascade_size"])
            a_depth = int(a["cascade_depth"])
        except Exception:
            continue
        size_ok = abs(a_size - t["cascade_size"]) <= max(
            1, int(0.20 * max(t["cascade_size"], 1))
        )
        depth_ok = abs(a_depth - t["cascade_depth"]) <= 1
        if size_ok and depth_ok:
            n_ok += 1
    frac = n_ok / max(len(truth_by), 1)
    credit = 0.30 * frac
    return credit, {"n_matching_seeds": n_ok, "n_total_seeds": len(truth_by)}


def grade_yearly(truth_yt: dict, agent_csv: Path) -> tuple[float, dict]:
    if not agent_csv.exists():
        return 0.0, {"reason": "yearly_top10.csv missing"}
    truth_top5 = {y: lst[:5] for y, lst in truth_yt.items()}
    agent_year_to_list: dict[int, list[str]] = {}
    with open(agent_csv) as f:
        r = csv.DictReader(f)
        for row in r:
            try:
                y = int(row["year"])
                rank = int(row["rank"])
            except Exception:
                continue
            if rank > 5:
                continue
            agent_year_to_list.setdefault(y, []).append(row["paper_id"])

    n_pass = 0
    details = {}
    for y, truth_lst in truth_top5.items():
        if y not in agent_year_to_list:
            details[str(y)] = {"f1": 0.0}
            continue
        agent_lst = agent_year_to_list[y]
        a_set = set(agent_lst)
        t_set = set(truth_lst)
        precision = len(a_set & t_set) / max(len(a_set), 1)
        recall = len(a_set & t_set) / max(len(t_set), 1)
        f1 = (
            (2 * precision * recall / (precision + recall))
            if (precision + recall)
            else 0.0
        )
        details[str(y)] = {"f1": round(f1, 3)}
        if f1 >= 0.7:
            n_pass += 1
    frac = n_pass / max(len(truth_top5), 1)
    credit = 0.20 * frac
    return credit, {"per_year_f1": details, "n_pass": n_pass}


def grade_schema() -> tuple[float, dict]:
    needed = {
        "pagerank_top20.csv": ["rank", "paper_id", "title", "score"],
        "cascades.csv": [
            "seed_id",
            "cascade_size",
            "cascade_depth",
            "mean_delay_years",
            "n_bursts",
        ],
        "yearly_top10.csv": ["year", "rank", "paper_id", "title", "score"],
    }
    ok = 0
    for fname, cols in needed.items():
        path = ARTIFACTS / fname
        if not path.exists():
            continue
        try:
            with open(path) as f:
                r = csv.reader(f)
                header = next(r)
            if header == cols:
                ok += 1
        except Exception:
            pass
    if not (ARTIFACTS / "graph.gexf").exists():
        pass
    else:
        ok += 1
    total = len(needed) + 1
    credit = 0.20 * (ok / total)
    return credit, {"n_schema_ok": ok, "n_schema_total": total}


def grade_html() -> tuple[float, dict]:
    p = ARTIFACTS / "report.html"
    if not p.exists():
        return 0.0, {"reason": "report.html missing"}
    text = p.read_text(encoding="utf-8", errors="replace")
    # Accept either `id="name"` (HTML element id) or `#name` (anchor href / fragment).
    anchor_names = ("pagerank", "cascades", "yearly", "network")
    seen = sum(
        1
        for a in anchor_names
        if f'id="{a}"' in text or f"id='{a}'" in text or f"#{a}" in text
    )
    credit = 0.10 * (seen / len(anchor_names))
    return credit, {"anchors_seen": seen, "anchors_total": len(anchor_names)}


def main() -> int:
    print("── citation-network-influence verifier ──")

    ok, msg = hard_gate()
    if not ok:
        emit(0.0, reason=msg)
        return 1
    print("Stage 1 hard gate: OK")

    mult, _ = scan_ast()
    print(f"Stage 2 AST scan: multiplier={mult}")

    if not run_agent():
        emit(0.0 * mult, reason="agent CLI failed")
        return 1
    print("Stage 3 agent run: OK")

    pr_truth, cas_truth, yt_truth = compute_ground_truth()
    print(
        f"Stage 4 ground truth: pr_top1={max(pr_truth.values()):.6f} "
        f"n_cascades={len(cas_truth)} years={list(yt_truth.keys())}"
    )

    c_pr, m_pr = grade_pagerank(pr_truth, ARTIFACTS / "pagerank_top20.csv")
    c_cas, m_cas = grade_cascades(cas_truth, ARTIFACTS / "cascades.csv")
    c_yr, m_yr = grade_yearly(yt_truth, ARTIFACTS / "yearly_top10.csv")
    c_sch, m_sch = grade_schema()
    c_html, m_html = grade_html()

    base = c_pr + c_cas + c_yr + c_sch + c_html
    final = base * mult
    print(
        f"  pagerank={c_pr:.4f}  cascades={c_cas:.4f}  yearly={c_yr:.4f}  "
        f"schema={c_sch:.4f}  html={c_html:.4f}  mult={mult}  ->  {final:.4f}"
    )

    breakdown = {
        "pagerank_credit": round(c_pr, 4),
        "cascades_credit": round(c_cas, 4),
        "yearly_credit": round(c_yr, 4),
        "schema_credit": round(c_sch, 4),
        "html_credit": round(c_html, 4),
        "surface_multiplier": mult,
    }
    meta = {
        "pagerank": m_pr,
        "cascades": m_cas,
        "yearly": m_yr,
        "schema": m_sch,
        "html": m_html,
    }
    emit(final, breakdown=breakdown, meta=meta)
    return 0 if final >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
