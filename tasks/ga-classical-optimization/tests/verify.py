#!/usr/bin/env python3
"""Verifier for ga-classical-optimization.

Scoring:
  1. Hard gate: ga_solver.Problem + GASolver importable.
  2. AST surface scan: forbidden imports + required method names. Hit → × 0.2.
  3. Functional: run each benchmark × 3 seeds; benchmark passes if mean
     best_fitness over seeds ≥ threshold. Each benchmark → 0.18 base.
  4. Determinism: re-run tsp30 seed=0, history.csv must be byte-identical → 0.05.
  5. Viz: each PNG present and ≥ 1 KB → up to 0.05 total.
Final = base × surface_multiplier.
"""

from __future__ import annotations

import ast
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path("/workspace/repo")
PKG = REPO / "ga_solver"
LOG_DIR = Path("/logs/verifier")
ARTIFACTS = Path("/tmp/ga_artifacts")

BENCHMARKS = ["tsp30", "tsp50", "knapsack50", "schwefel5", "rastrigin10"]
SEEDS = (0, 1, 2)


FORBIDDEN_IMPORT_QUALIFIED = (
    "deap",
    "pymoo",
)
FORBIDDEN_FROM_IMPORTS = (
    ("scipy.optimize", "differential_evolution"),
    ("scipy.optimize", "dual_annealing"),
    ("scipy.optimize", "shgo"),
    ("scipy.optimize", "basinhopping"),
)

REQUIRED_METHODS = ("select", "crossover_step", "mutate_step")


def emit(score: float, breakdown: dict | None = None, *, reason: str = "") -> None:
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


# ──────────────────────────────────────────────────────────────────────
#   Stage 1: hard gate
# ──────────────────────────────────────────────────────────────────────


def hard_gate() -> tuple[bool, str]:
    cmd = [
        sys.executable,
        "-c",
        "import sys; sys.path.insert(0, '/workspace/repo'); "
        "from ga_solver import Problem, GASolver; "
        "assert Problem is not None and GASolver is not None; "
        "print('GATE OK')",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        return False, f"hard gate failed:\n{r.stderr[-800:]}"
    return True, ""


# ──────────────────────────────────────────────────────────────────────
#   Stage 2: AST surface scan
# ──────────────────────────────────────────────────────────────────────


def scan_ast() -> tuple[float, list[str]]:
    if not PKG.exists():
        return 0.0, ["ga_solver/ missing"]

    hits: list[str] = []
    method_seen: set[str] = set()

    for py in PKG.rglob("*.py"):
        try:
            tree = ast.parse(py.read_text(encoding="utf-8", errors="replace"))
        except SyntaxError as e:
            hits.append(f"{py.relative_to(REPO)}: SyntaxError: {e}")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.split(".")[0] in FORBIDDEN_IMPORT_QUALIFIED:
                        hits.append(f"{py.relative_to(REPO)}: import {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                if mod.split(".")[0] in FORBIDDEN_IMPORT_QUALIFIED:
                    hits.append(f"{py.relative_to(REPO)}: from {mod}")
                for fmod, fname in FORBIDDEN_FROM_IMPORTS:
                    if mod == fmod and any(a.name == fname for a in node.names):
                        hits.append(
                            f"{py.relative_to(REPO)}: from {mod} import {fname}"
                        )
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name in REQUIRED_METHODS:
                    method_seen.add(node.name)

    missing_methods = sorted(set(REQUIRED_METHODS) - method_seen)
    if missing_methods:
        hits.append(f"missing required methods: {missing_methods}")

    if hits:
        print("AST scan hits:")
        for h in hits:
            print(f"  {h}")
        return 0.2, hits
    return 1.0, []


# ──────────────────────────────────────────────────────────────────────
#   Stage 3+: functional runs
# ──────────────────────────────────────────────────────────────────────


def run_one(problem: str, seed: int, out: Path) -> dict | None:
    out.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "ga_solver",
        "run",
        "--problem",
        problem,
        "--seed",
        str(seed),
        "--out",
        str(out),
    ]
    env = {
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "PYTHONPATH": "/workspace/repo",
        "HOME": "/root",
    }
    r = subprocess.run(
        cmd, cwd=str(REPO), capture_output=True, text=True, timeout=120, env=env
    )
    if r.returncode != 0:
        print(f"  RUN FAIL {problem} seed={seed}\n    {r.stderr[-400:]}")
        return None
    results_path = out / "results.json"
    if not results_path.exists():
        print(f"  RUN MISSING results.json: {problem} seed={seed}")
        return None
    try:
        return json.loads(results_path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"  RUN BAD results.json: {problem} seed={seed}: {e}")
        return None


def fixture_threshold(problem: str) -> float:
    path = REPO / "data" / "benchmarks" / f"{problem}.json"
    fx = json.loads(path.read_text(encoding="utf-8"))
    if problem == "tsp30":
        return -1.50 * float(fx["ref_optimum"])
    if problem == "tsp50":
        return -2.00 * float(fx["ref_optimum"])
    if problem == "knapsack50":
        return 0.90 * float(fx["ref_optimum"])
    return {"schwefel5": -500.0, "rastrigin10": -50.0}[problem]


def grade_functional() -> tuple[float, dict, dict]:
    """Run each benchmark × 3 seeds; benchmark passes if MEAN best_fitness ≥ threshold."""
    if ARTIFACTS.exists():
        shutil.rmtree(ARTIFACTS)
    ARTIFACTS.mkdir(parents=True)

    per_bench: dict[str, dict] = {}
    n_passed = 0
    for bench in BENCHMARKS:
        thr = fixture_threshold(bench)
        fits: list[float] = []
        for seed in SEEDS:
            res = run_one(bench, seed, ARTIFACTS / bench / f"seed{seed}")
            if res is None:
                fits.append(float("-inf"))
            else:
                fits.append(float(res["best_fitness"]))
        mean_fit = sum(fits) / len(fits)
        passed = mean_fit >= thr
        if passed:
            n_passed += 1
        per_bench[bench] = {
            "threshold": round(thr, 4),
            "best_per_seed": [round(f, 4) for f in fits],
            "mean": round(mean_fit, 4),
            "passed": passed,
        }
        print(f"  [{bench}] mean={mean_fit:.4f}  threshold={thr:.4f}  passed={passed}")

    base = n_passed * 0.18  # 5 × 0.18 = 0.90 max functional
    return base, per_bench, {"n_passed": n_passed, "n_total": len(BENCHMARKS)}


def grade_determinism() -> float:
    """Re-run tsp30 seed=0 once more; history.csv must be byte-identical."""
    first = ARTIFACTS / "tsp30" / "seed0" / "history.csv"
    if not first.exists():
        return 0.0
    second_dir = ARTIFACTS / "tsp30_det"
    if run_one("tsp30", 0, second_dir) is None:
        return 0.0
    second = second_dir / "history.csv"
    if not second.exists():
        return 0.0
    a = first.read_bytes()
    b = second.read_bytes()
    if a == b:
        print("  determinism: OK")
        return 0.05
    print(f"  determinism: MISMATCH ({len(a)} vs {len(b)} bytes)")
    return 0.0


def grade_viz() -> float:
    """For each benchmark seed=0 run, check 3 PNGs exist + ≥ 1 KB each."""
    needed = ("fitness_curve.png", "diversity.png", "solution.png")
    ok_count = 0
    for bench in BENCHMARKS:
        d = ARTIFACTS / bench / "seed0"
        all_ok = True
        for n in needed:
            p = d / n
            if not p.exists() or p.stat().st_size < 1024:
                all_ok = False
                break
        if all_ok:
            ok_count += 1
    return (ok_count / len(BENCHMARKS)) * 0.05


# ──────────────────────────────────────────────────────────────────────
#   Main
# ──────────────────────────────────────────────────────────────────────


def main() -> int:
    print("── ga-classical-optimization verifier ──")

    ok, msg = hard_gate()
    if not ok:
        emit(0.0, reason=msg)
        return 1
    print("Stage 1 hard gate: OK")

    mult, _ = scan_ast()
    print(f"Stage 2 AST scan: multiplier={mult}")

    base, per_bench, bench_meta = grade_functional()
    print(f"Stage 3 functional: base={base:.4f}")

    det = grade_determinism()
    print(f"Stage 4 determinism: +{det:.4f}")

    viz = grade_viz()
    print(f"Stage 5 viz: +{viz:.4f}")

    sub_total = base + det + viz
    final = sub_total * mult

    # Harbor's VerifierResult requires `_meta_*` fields to be float|int.
    # Stringify the nested per_benchmark dict via a JSON-encoded debug log.
    log_path = LOG_DIR / "per_benchmark.json"
    log_path.write_text(json.dumps(per_bench, indent=2), encoding="utf-8")
    breakdown = {
        "functional_base": round(base, 4),
        "determinism": round(det, 4),
        "viz": round(viz, 4),
        "surface_multiplier": mult,
        "_meta_n_passed": bench_meta["n_passed"],
        "_meta_n_total": bench_meta["n_total"],
    }
    emit(final, breakdown=breakdown)
    return 0 if final >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
