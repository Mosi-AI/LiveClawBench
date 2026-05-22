"""Generate 5 benchmark fixtures deterministically.

Runs once at Docker build time, then is removed from the image.
Outputs JSON files under /workspace/repo/data/benchmarks/.
"""

import json
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), "benchmarks")
os.makedirs(OUT, exist_ok=True)


def nn_tour_length(coords):
    """Nearest-neighbor + 2-opt heuristic for a TSP reference optimum."""
    n = len(coords)
    visited = [0]
    remaining = set(range(1, n))
    while remaining:
        last = visited[-1]
        nxt = min(
            remaining,
            key=lambda j: (
                (coords[last][0] - coords[j][0]) ** 2
                + (coords[last][1] - coords[j][1]) ** 2
            ),
        )
        visited.append(nxt)
        remaining.remove(nxt)

    def length(tour):
        s = 0.0
        for i in range(len(tour)):
            a, b = coords[tour[i]], coords[tour[(i + 1) % len(tour)]]
            s += math.hypot(a[0] - b[0], a[1] - b[1])
        return s

    # 2-opt
    improved = True
    while improved:
        improved = False
        for i in range(1, n - 1):
            for j in range(i + 1, n):
                if j - i == 1:
                    continue
                new_tour = visited[:i] + visited[i:j][::-1] + visited[j:]
                if length(new_tour) < length(visited) - 1e-9:
                    visited = new_tour
                    improved = True
        # one full pass is usually enough for small n; for safety do at most 5 passes
    return length(visited)


def make_tsp(n, seed):
    rng = random.Random(seed)
    coords = [(rng.uniform(0, 100), rng.uniform(0, 100)) for _ in range(n)]
    ref = nn_tour_length(coords)
    return {
        "name": f"tsp{n}",
        "type": "tsp",
        "n_cities": n,
        "coords": coords,
        "ref_optimum": ref,
    }


def make_knapsack(n, seed):
    rng = random.Random(seed)
    weights = [rng.randint(1, 30) for _ in range(n)]
    values = [rng.randint(1, 100) for _ in range(n)]
    capacity = sum(weights) // 2
    # DP exact optimum
    dp = [0] * (capacity + 1)
    for i in range(n):
        w, v = weights[i], values[i]
        for c in range(capacity, w - 1, -1):
            if dp[c - w] + v > dp[c]:
                dp[c] = dp[c - w] + v
    return {
        "name": f"knapsack{n}",
        "type": "knapsack",
        "n_items": n,
        "weights": weights,
        "values": values,
        "capacity": capacity,
        "ref_optimum": dp[capacity],
    }


def make_continuous(name, dim, lo, hi):
    return {
        "name": name,
        "type": "continuous",
        "subtype": name.split("_")[0] if "_" in name else name,
        "dim": dim,
        "lo": lo,
        "hi": hi,
        "ref_optimum": 0.0,
    }


def main():
    fixtures = {
        "tsp30.json": make_tsp(30, seed=42),
        "tsp50.json": make_tsp(50, seed=43),
        "knapsack50.json": make_knapsack(50, seed=44),
        "schwefel5.json": {
            **make_continuous("schwefel5", 5, -500.0, 500.0),
            "subtype": "schwefel",
        },
        "rastrigin10.json": {
            **make_continuous("rastrigin10", 10, -5.12, 5.12),
            "subtype": "rastrigin",
        },
    }
    for fname, data in fixtures.items():
        path = os.path.join(OUT, fname)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"wrote {path}: ref_optimum={data['ref_optimum']:.4f}")


if __name__ == "__main__":
    main()
