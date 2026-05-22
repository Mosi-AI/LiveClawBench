# Build a Citation Network & Influence Propagation Analyzer From Scratch

You are given a static dump of 500 academic papers and ~5,000 citation edges.
Your task: implement `citation_analyzer`, a package + CLI that loads the dump
as a directed graph, computes paper-level influence via PageRank (you implement
it yourself), detects citation cascades from seed papers, computes time-sliced
top-K influence rankings, and emits a report.

## Input data (read-only, under /workspace/repo/data/)

```
papers.json     # JSON list, 500 entries:
                #   {paper_id, title, authors[], venue, year, fields_of_study[]}
edges.json      # JSON list, ~5000 entries:
                #   {cited_paper, citing_paper, citing_year}
seeds.json      # JSON list of 10 seed paper_ids — cascades start here
```

`year` ranges over 2022, 2023, 2024 (three yearly buckets).

## What you must deliver

A Python package `citation_analyzer/` under `/workspace/repo/`:

```python
# citation_analyzer/__init__.py must re-export these 4 functions

def load_graph(papers_path: str, edges_path: str) -> dict:
    """Return a dict with at minimum: {n_papers, n_edges, adj_csr, paper_ids,
    id_to_idx, papers, edges_with_year}.
    Storage MUST be sparse (e.g. scipy.sparse.csr_matrix).
    Dense N×N adjacency is forbidden."""

def pagerank(graph: dict, *, damping: float = 0.85, tol: float = 1e-8,
             max_iter: int = 200) -> dict:
    """Power iteration on citation graph.
    Returns {paper_id -> score}, sum ≈ 1.0, must converge in ≤ max_iter.

    FORBIDDEN APIs: networkx.pagerank, networkx.algorithms.link_analysis.*,
    scipy.sparse.linalg.eigs, scipy.sparse.linalg.eigsh.
    You must implement power iteration yourself.
    """

def detect_cascades(graph: dict, seeds: list[str], *,
                    burst_threshold_mult: float = 3.0) -> list[dict]:
    """For each seed, traverse forward in time via outgoing citation edges
    (citing_paper points back to cited_paper). Return one dict per seed:
        {seed_id, cascade_size, cascade_depth, mean_delay_years, n_bursts}
    cascade_size  = total unique descendants reached
    cascade_depth = longest path
    mean_delay_years = mean (citing_year - seed_year) over direct citers
    n_bursts = count of years where new-citer count > corpus median × threshold
    """

def yearly_top(graph: dict, k: int = 10) -> dict[int, list[str]]:
    """For each year y in [min_year, max_year], compute PageRank using ONLY
    edges with citing_year ≤ y. Return {y: [top-k paper_ids ordered by score]}."""

def write_outputs(graph: dict, pr: dict, cascades: list[dict],
                  yearly: dict[int, list[str]], out_dir: str) -> None:
    """Emit:
       - pagerank_top20.csv   columns: rank, paper_id, title, score
       - cascades.csv         columns: seed_id, cascade_size, cascade_depth,
                                       mean_delay_years, n_bursts
       - yearly_top10.csv     columns: year, rank, paper_id, title, score
       - graph.gexf           the full citation graph (GEXF or simple JSON)
       - report.html          anchors: #pagerank, #cascades, #yearly, #network
    """
```

### CLI

```bash
python -m citation_analyzer run \
    --papers /workspace/repo/data/papers.json \
    --edges  /workspace/repo/data/edges.json \
    --seeds  /workspace/repo/data/seeds.json \
    --out    ./reports
```

## Implementation constraints

| Constraint | Reason |
|---|---|
| Allowed deps: `numpy`, `scipy.sparse`, `pandas`, `matplotlib`, `jinja2`, `networkx` (I/O only — `nx.write_gexf` etc.) | Standard scientific stack |
| **Forbidden** for the PageRank computation: `networkx.pagerank`, `networkx.algorithms.link_analysis.*`, `scipy.sparse.linalg.eigs`, `scipy.sparse.linalg.eigsh` | You must write power iteration yourself |
| Dense N×N adjacency forbidden | 500×500 is borderline OK but on real S2 corpus would blow up — practice good habits now |
| PageRank must converge in ≤ 200 iterations at `tol=1e-8` | Sanity-check your normalization |

## How the verifier scores you

The verifier runs (in order):

1. **Hard gate** — `from citation_analyzer import load_graph, pagerank, detect_cascades, yearly_top, write_outputs` must succeed; failure → zero score.
2. **AST surface scan** — forbidden import patterns anywhere under `citation_analyzer/` heavily penalise the score.
3. **Functional checks** against an independently-computed ground truth:
   - PageRank top-K ranking quality (rank-correlation based)
   - Cascade size and depth for the supplied seeds (within an undisclosed tolerance)
   - Per-year top-K rankings (set-overlap based)
   - All required output files present with the documented CSV columns
   - HTML report contains the documented anchors (`pagerank`, `cascades`, `yearly`, `network` — any of `id="..."`, `id='...'`, or `#...` accepted)

The final score is written to `/logs/verifier/reward.txt`.

## Sanity values

| Quantity | Expected |
|---|---|
| Total papers | exactly 500 |
| Total edges | ≈ 5000 (±5%) |
| Year range | 2022..2024 (3 buckets) |
| PageRank scores | sum to ~1.0 (±1%) |
| Top-1 PageRank score | between 0.005 and 0.05 |

Public smoke tests exercise only the API surface + a small end-to-end run.
