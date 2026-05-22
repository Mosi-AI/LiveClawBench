"""Trusted reference algorithm used by verify.py to compute ground truth.

This file lives under /tests/ — the agent cannot read it.
Logic mirrors solution/reference/citation_analyzer/core.py.
"""

from __future__ import annotations

import collections
import json
import statistics
from typing import Any

import numpy as np
import scipy.sparse as sp


def load_graph(papers_path: str, edges_path: str) -> dict[str, Any]:
    with open(papers_path) as f:
        papers = json.load(f)
    with open(edges_path) as f:
        edges = json.load(f)

    paper_ids = [p["paper_id"] for p in papers]
    id_to_idx = {pid: i for i, pid in enumerate(paper_ids)}
    n = len(paper_ids)

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


def pagerank(
    graph: dict, *, damping: float = 0.85, tol: float = 1e-8, max_iter: int = 200
) -> dict[str, float]:
    n = graph["n_papers"]
    adj = graph["adj_csr"]
    out_deg = np.asarray(adj.sum(axis=1)).ravel()
    inv_out = np.zeros_like(out_deg)
    nonzero = out_deg > 0
    inv_out[nonzero] = 1.0 / out_deg[nonzero]
    D = sp.diags(inv_out)
    P = D @ adj
    P_T = P.T.tocsr()
    teleport = (1.0 - damping) / n
    pr = np.full(n, 1.0 / n)
    for _ in range(max_iter):
        new = damping * (P_T @ pr) + teleport + damping * np.sum(pr[~nonzero]) / n
        new = new / new.sum()
        if np.abs(new - pr).sum() < tol:
            pr = new
            break
        pr = new
    return {graph["paper_ids"][i]: float(pr[i]) for i in range(n)}


def detect_cascades(
    graph: dict, seeds: list[str], *, burst_threshold_mult: float = 3.0
) -> list[dict]:
    cited_by = collections.defaultdict(list)
    for e in graph["edges_with_year"]:
        cited_by[e["cited_paper"]].append(e)
    paper_year = {p["paper_id"]: int(p["year"]) for p in graph["papers"]}

    by_year_count = collections.defaultdict(list)
    inbound_by_year = collections.defaultdict(int)
    for e in graph["edges_with_year"]:
        inbound_by_year[(e["cited_paper"], e["citing_year"])] += 1
    for (pid, y), c in inbound_by_year.items():
        by_year_count[y].append(c)
    median_per_year = {
        y: statistics.median(by_year_count.get(y, [1]) or [1]) for y in by_year_count
    }

    results = []
    for seed in seeds:
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
        cascade_size = len(visited) - 1
        cascade_depth = max(depth.values()) if depth else 0
        direct = list(cited_by.get(seed, []))
        if direct:
            sy = paper_year.get(seed, 2022)
            mean_delay = sum(e["citing_year"] - sy for e in direct) / len(direct)
        else:
            mean_delay = 0.0
        per_year_citers = collections.defaultdict(int)
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


def yearly_top(graph: dict, k: int = 10) -> dict[int, list[str]]:
    years = sorted({int(p["year"]) for p in graph["papers"]})
    out = {}
    n = graph["n_papers"]
    edges = graph["edges_with_year"]
    for y in years:
        sub_edges = [e for e in edges if e["citing_year"] <= y]
        rows = [e["citing_idx"] for e in sub_edges]
        cols = [e["cited_idx"] for e in sub_edges]
        data = np.ones(len(rows))
        sub = sp.csr_matrix((data, (rows, cols)), shape=(n, n))
        sub_graph = {**graph, "adj_csr": sub}
        pr = pagerank(sub_graph, damping=0.85, tol=1e-7, max_iter=150)
        top = sorted(pr.items(), key=lambda kv: kv[1], reverse=True)[:k]
        out[y] = [pid for pid, _ in top]
    return out
