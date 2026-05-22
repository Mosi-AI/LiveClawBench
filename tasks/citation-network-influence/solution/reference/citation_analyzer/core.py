"""Reference citation_analyzer.

PageRank is implemented via plain power iteration on a CSR matrix.
No networkx.pagerank or scipy.sparse.linalg.eigs.
"""

from __future__ import annotations

import collections
import csv
import json
import os
import statistics
from typing import Any

import numpy as np
import scipy.sparse as sp

# ──────────────────────────────────────────────────────────────────────
#   load_graph
# ──────────────────────────────────────────────────────────────────────


def load_graph(papers_path: str, edges_path: str) -> dict[str, Any]:
    with open(papers_path) as f:
        papers = json.load(f)
    with open(edges_path) as f:
        edges = json.load(f)

    paper_ids = [p["paper_id"] for p in papers]
    id_to_idx = {pid: i for i, pid in enumerate(paper_ids)}
    n = len(paper_ids)

    # Build CSR. Edges go from citing to cited (rows = citing, cols = cited).
    rows = []
    cols = []
    edges_with_year = []
    for e in edges:
        ci = id_to_idx.get(e["citing_paper"])
        cj = id_to_idx.get(e["cited_paper"])
        if ci is None or cj is None or ci == cj:
            continue
        rows.append(ci)
        cols.append(cj)
        edges_with_year.append(
            {
                "citing_idx": ci,
                "cited_idx": cj,
                "citing_year": int(e["citing_year"]),
                "citing_paper": e["citing_paper"],
                "cited_paper": e["cited_paper"],
            }
        )
    data = np.ones(len(rows), dtype=np.float64)
    adj_csr = sp.csr_matrix((data, (rows, cols)), shape=(n, n))

    return {
        "n_papers": n,
        "n_edges": len(edges_with_year),
        "adj_csr": adj_csr,
        "paper_ids": paper_ids,
        "id_to_idx": id_to_idx,
        "papers": papers,
        "edges_with_year": edges_with_year,
    }


# ──────────────────────────────────────────────────────────────────────
#   pagerank — power iteration on sparse adjacency
# ──────────────────────────────────────────────────────────────────────


def pagerank(
    graph: dict, *, damping: float = 0.85, tol: float = 1e-8, max_iter: int = 200
) -> dict[str, float]:
    n = graph["n_papers"]
    adj: sp.csr_matrix = graph["adj_csr"]

    # Out-degree
    out_deg = np.asarray(adj.sum(axis=1)).ravel()
    # Build transition matrix P^T such that pr' = damping * P^T @ pr + (1-d)/n
    # P[i,j] = adj[i,j] / out_deg[i] if out_deg[i] > 0
    # We need P^T: rows are destination, cols are source.
    inv_out = np.zeros_like(out_deg)
    nonzero = out_deg > 0
    inv_out[nonzero] = 1.0 / out_deg[nonzero]
    D = sp.diags(inv_out)
    P = D @ adj  # rows = source (citing), cols = dest (cited)
    P_T = P.T.tocsr()  # rows = dest, cols = source

    teleport = (1.0 - damping) / n
    dangling_mass_fn = lambda v: damping * np.sum(v[~nonzero]) / n  # noqa: E731

    pr = np.full(n, 1.0 / n)
    for it in range(max_iter):
        new = damping * (P_T @ pr) + teleport + dangling_mass_fn(pr)
        # Normalize to avoid drift
        new = new / new.sum()
        if np.abs(new - pr).sum() < tol:
            pr = new
            break
        pr = new

    return {graph["paper_ids"][i]: float(pr[i]) for i in range(n)}


# ──────────────────────────────────────────────────────────────────────
#   cascades
# ──────────────────────────────────────────────────────────────────────


def _build_cited_by(graph: dict) -> dict[str, list[dict]]:
    """For each paper p, list of edges where p is the cited paper."""
    cb: dict[str, list[dict]] = collections.defaultdict(list)
    for e in graph["edges_with_year"]:
        cb[e["cited_paper"]].append(e)
    return cb


def detect_cascades(
    graph: dict, seeds: list[str], *, burst_threshold_mult: float = 3.0
) -> list[dict]:
    cited_by = _build_cited_by(graph)
    paper_year = {p["paper_id"]: int(p["year"]) for p in graph["papers"]}

    # Corpus per-year-per-paper median inbound (for burst threshold)
    by_year_count: dict[int, list[int]] = collections.defaultdict(list)
    inbound_by_year: dict[tuple[str, int], int] = collections.defaultdict(int)
    for e in graph["edges_with_year"]:
        inbound_by_year[(e["cited_paper"], e["citing_year"])] += 1
    # For each year, collect counts (only papers that received any citation that year)
    for (pid, y), c in inbound_by_year.items():
        by_year_count[y].append(c)
    median_per_year = {
        y: statistics.median(by_year_count.get(y, [1]) or [1]) for y in by_year_count
    }

    results: list[dict] = []
    for seed in seeds:
        # BFS forward through cited_by
        visited = {seed}
        depth = {seed: 0}
        queue = collections.deque([seed])
        while queue:
            p = queue.popleft()
            for e in cited_by.get(p, []):
                c = e["citing_paper"]
                if c not in visited:
                    visited.add(c)
                    depth[c] = depth[p] + 1
                    queue.append(c)
        cascade_size = len(visited) - 1  # exclude seed itself
        cascade_depth = max(depth.values()) if depth else 0
        # mean delay = mean year-difference of DIRECT citers
        direct = [e for e in cited_by.get(seed, [])]
        if direct:
            seed_year = paper_year.get(seed, 2022)
            mean_delay = sum(e["citing_year"] - seed_year for e in direct) / len(direct)
        else:
            mean_delay = 0.0
        # bursts: years where seed's direct new-citer count > corpus_median × thresh
        per_year_citers: dict[int, int] = collections.defaultdict(int)
        for e in direct:
            per_year_citers[e["citing_year"]] += 1
        n_bursts = 0
        for y, c in per_year_citers.items():
            mp = median_per_year.get(y, 1)
            if c > mp * burst_threshold_mult:
                n_bursts += 1
        results.append(
            {
                "seed_id": seed,
                "cascade_size": int(cascade_size),
                "cascade_depth": int(cascade_depth),
                "mean_delay_years": round(float(mean_delay), 4),
                "n_bursts": int(n_bursts),
            }
        )
    return results


# ──────────────────────────────────────────────────────────────────────
#   yearly_top
# ──────────────────────────────────────────────────────────────────────


def yearly_top(graph: dict, k: int = 10) -> dict[int, list[str]]:
    years = sorted({int(p["year"]) for p in graph["papers"]})
    out: dict[int, list[str]] = {}
    paper_ids = graph["paper_ids"]
    id_to_idx = graph["id_to_idx"]
    n = graph["n_papers"]

    edges = graph["edges_with_year"]
    for y in years:
        sub_edges = [e for e in edges if e["citing_year"] <= y]
        rows = [e["citing_idx"] for e in sub_edges]
        cols = [e["cited_idx"] for e in sub_edges]
        data = np.ones(len(rows))
        sub = sp.csr_matrix((data, (rows, cols)), shape=(n, n))
        sub_graph = {
            **graph,
            "adj_csr": sub,
            "n_papers": n,
            "paper_ids": paper_ids,
            "id_to_idx": id_to_idx,
        }
        pr = pagerank(sub_graph, damping=0.85, tol=1e-7, max_iter=150)
        top = sorted(pr.items(), key=lambda kv: kv[1], reverse=True)[:k]
        out[y] = [pid for pid, _ in top]
    return out


# ──────────────────────────────────────────────────────────────────────
#   write_outputs
# ──────────────────────────────────────────────────────────────────────


def write_outputs(
    graph: dict,
    pr: dict,
    cascades: list[dict],
    yearly: dict[int, list[str]],
    out_dir: str,
) -> None:
    os.makedirs(out_dir, exist_ok=True)
    title_by_id = {p["paper_id"]: p["title"] for p in graph["papers"]}

    # pagerank_top20.csv
    top20 = sorted(pr.items(), key=lambda kv: kv[1], reverse=True)[:20]
    with open(os.path.join(out_dir, "pagerank_top20.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rank", "paper_id", "title", "score"])
        for i, (pid, sc) in enumerate(top20, 1):
            w.writerow([i, pid, title_by_id.get(pid, ""), f"{sc:.8f}"])

    # cascades.csv
    with open(os.path.join(out_dir, "cascades.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            ["seed_id", "cascade_size", "cascade_depth", "mean_delay_years", "n_bursts"]
        )
        for c in cascades:
            w.writerow(
                [
                    c["seed_id"],
                    c["cascade_size"],
                    c["cascade_depth"],
                    c["mean_delay_years"],
                    c["n_bursts"],
                ]
            )

    # yearly_top10.csv
    with open(os.path.join(out_dir, "yearly_top10.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["year", "rank", "paper_id", "title", "score"])
        for y in sorted(yearly):
            for r, pid in enumerate(yearly[y], 1):
                w.writerow(
                    [y, r, pid, title_by_id.get(pid, ""), f"{pr.get(pid, 0.0):.8f}"]
                )

    # graph.gexf — minimal valid GEXF (avoid networkx dependency on writer for trim)
    with open(os.path.join(out_dir, "graph.gexf"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">\n')
        f.write('  <graph mode="static" defaultedgetype="directed">\n')
        f.write("    <nodes>\n")
        for p in graph["papers"]:
            f.write(
                f'      <node id="{p["paper_id"]}" label="{p["title"].replace("&", "&amp;")}"/>\n'
            )
        f.write("    </nodes>\n")
        f.write("    <edges>\n")
        for i, e in enumerate(graph["edges_with_year"]):
            f.write(
                f'      <edge id="{i}" source="{e["citing_paper"]}" target="{e["cited_paper"]}"/>\n'
            )
        f.write("    </edges>\n")
        f.write("  </graph>\n")
        f.write("</gexf>\n")

    # report.html — minimal anchors + a few tables
    rows_top = "".join(
        f"<tr><td>{i}</td><td>{pid}</td><td>{sc:.6f}</td></tr>"
        for i, (pid, sc) in enumerate(top20, 1)
    )
    rows_cascade = "".join(
        f"<tr><td>{c['seed_id']}</td><td>{c['cascade_size']}</td>"
        f"<td>{c['cascade_depth']}</td><td>{c['n_bursts']}</td></tr>"
        for c in cascades
    )
    rows_yearly = "".join(
        f"<tr><td>{y}</td><td>{', '.join(yearly[y][:10])}</td></tr>"
        for y in sorted(yearly)
    )
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>Citation report</title></head>
<body>
<h1>Citation Network Report</h1>
<h2 id="pagerank">PageRank top-20</h2>
<table border="1"><tr><th>rank</th><th>paper_id</th><th>score</th></tr>{rows_top}</table>
<h2 id="cascades">Cascades</h2>
<table border="1"><tr><th>seed</th><th>size</th><th>depth</th><th>bursts</th></tr>{rows_cascade}</table>
<h2 id="yearly">Yearly top-10</h2>
<table border="1"><tr><th>year</th><th>top-10 paper_ids</th></tr>{rows_yearly}</table>
<h2 id="network">Network summary</h2>
<p>nodes={graph["n_papers"]}, edges={graph["n_edges"]}</p>
</body></html>
"""
    with open(os.path.join(out_dir, "report.html"), "w") as f:
        f.write(html)
