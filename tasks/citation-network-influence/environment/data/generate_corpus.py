"""Generate a synthetic 500-paper / ~5000-edge citation corpus.

Properties:
  - 3 yearly buckets (2022, 2023, 2024) with roughly equal counts
  - Power-law-like degree distribution (a few "popular" papers, many low-degree)
  - Time-respecting edges (newer paper cites older or same year)
  - 10 hand-selected "seed papers" embedded with elevated outgoing-fanout cascades
"""

import json
import os
import random

OUT = os.path.dirname(__file__)
random.seed(2024)

N_PAPERS = 500
YEARS = [2022, 2023, 2024]
FIELDS = ["ML", "Theory", "CV", "NLP", "RL", "Systems"]
VENUES = ["NeurIPS", "ICLR", "ICML", "AAAI", "ACL", "CVPR", "OSDI"]


def make_papers():
    papers = []
    for i in range(N_PAPERS):
        pid = f"P{i:04d}"
        # Years roughly balanced; later papers slightly more
        year_idx = random.choices([0, 1, 2], weights=[0.25, 0.35, 0.40], k=1)[0]
        year = YEARS[year_idx]
        n_fields = random.choice([1, 1, 2])
        fields = random.sample(FIELDS, n_fields)
        n_authors = random.randint(1, 4)
        authors = [f"A{random.randint(0, 199):04d}" for _ in range(n_authors)]
        papers.append(
            {
                "paper_id": pid,
                "title": f"Paper {i}: {fields[0]} contribution",
                "authors": authors,
                "venue": random.choice(VENUES),
                "year": year,
                "fields_of_study": fields,
            }
        )
    return papers


def make_edges(papers, seeds):
    """Generate citations. Each paper cites k papers from earlier or same year.
    Popular papers (preferential attachment) and seeds get extra inbound."""
    by_year = {y: [p for p in papers if p["year"] == y] for y in YEARS}
    edges = []
    seed_ids = set(seeds)
    # Track inbound count per paper (for preferential attachment)
    inbound = {p["paper_id"]: 1 for p in papers}

    for p in papers:
        cy = p["year"]
        candidates = []
        for y in YEARS:
            if y <= cy:
                candidates.extend(by_year[y])
        candidates = [c for c in candidates if c["paper_id"] != p["paper_id"]]
        k = random.randint(5, 15)
        # Preferential attachment: weight by current inbound + bias toward seeds
        weights = []
        for c in candidates:
            base = inbound[c["paper_id"]]
            if c["paper_id"] in seed_ids:
                base *= 5  # seed papers get more citations
            weights.append(base)
        chosen = set()
        while len(chosen) < min(k, len(candidates)):
            pick = random.choices(candidates, weights=weights, k=1)[0]
            chosen.add(pick["paper_id"])
        for cid in chosen:
            edges.append(
                {
                    "cited_paper": cid,
                    "citing_paper": p["paper_id"],
                    "citing_year": cy,
                }
            )
            inbound[cid] += 1
    return edges


def main():
    papers = make_papers()
    # Pick 10 seeds from year-2022 papers (have time to accumulate citations)
    pool = [p["paper_id"] for p in papers if p["year"] == 2022]
    seeds = sorted(random.sample(pool, 10))
    edges = make_edges(papers, seeds)

    with open(os.path.join(OUT, "papers.json"), "w") as f:
        json.dump(papers, f, indent=2)
    with open(os.path.join(OUT, "edges.json"), "w") as f:
        json.dump(edges, f, indent=2)
    with open(os.path.join(OUT, "seeds.json"), "w") as f:
        json.dump(seeds, f, indent=2)

    print(f"papers={len(papers)} edges={len(edges)} seeds={len(seeds)}")


if __name__ == "__main__":
    main()
