"""Reference problem subclasses for the 5 benchmarks."""

from __future__ import annotations

import json
import math
import os

import numpy as np

from ga_solver.base import Problem

# ──────────────────────────────────────────────────────────────────────
#   TSP
# ──────────────────────────────────────────────────────────────────────


class TSPProblem(Problem):
    def __init__(self, fixture: dict) -> None:
        self.coords = np.asarray(fixture["coords"], dtype=float)
        self.n = len(self.coords)
        diff = self.coords[:, None, :] - self.coords[None, :, :]
        self.dist = np.sqrt((diff * diff).sum(axis=-1))

    def sample_individual(self, rng):
        tour = np.arange(self.n)
        rng.shuffle(tour)
        return tour.tolist()

    def fitness(self, tour):
        a = np.asarray(tour, dtype=int)
        b = np.roll(a, -1)
        return float(-self.dist[a, b].sum())

    def crossover(self, p1, p2, rng):
        """Order Crossover (OX)."""
        n = len(p1)
        i, j = sorted(rng.choice(n, size=2, replace=False))
        child = [-1] * n
        child[i : j + 1] = p1[i : j + 1]
        fill_pos = (j + 1) % n
        for x in p2[j + 1 :] + p2[: j + 1]:
            if x not in child:
                child[fill_pos] = x
                fill_pos = (fill_pos + 1) % n
        return child

    def mutate(self, tour, rng):
        """Light 2-opt move with prob 0.5; else swap 2 cities."""
        n = len(tour)
        if rng.random() < 0.5:
            i, j = sorted(rng.choice(n, size=2, replace=False))
            if j - i > 1:
                return tour[:i] + tour[i:j][::-1] + tour[j:]
        i, j = rng.choice(n, size=2, replace=False)
        t = list(tour)
        t[i], t[j] = t[j], t[i]
        return t

    def encode_for_viz(self, tour):
        return {"tour": list(tour), "coords": self.coords.tolist()}


# ──────────────────────────────────────────────────────────────────────
#   Knapsack
# ──────────────────────────────────────────────────────────────────────


class KnapsackProblem(Problem):
    def __init__(self, fixture: dict) -> None:
        self.weights = np.asarray(fixture["weights"], dtype=float)
        self.values = np.asarray(fixture["values"], dtype=float)
        self.capacity = float(fixture["capacity"])
        self.n = len(self.weights)

    def sample_individual(self, rng):
        return rng.integers(0, 2, size=self.n).tolist()

    def _repair(self, bits):
        b = np.asarray(bits, dtype=int)
        # If over capacity, greedily drop worst value/weight ratio
        if (b * self.weights).sum() <= self.capacity:
            return b.tolist()
        ratios = self.values / np.maximum(self.weights, 1e-9)
        order = np.argsort(ratios)  # worst first
        for idx in order:
            if (b * self.weights).sum() <= self.capacity:
                break
            if b[idx] == 1:
                b[idx] = 0
        return b.tolist()

    def fitness(self, bits):
        b = np.asarray(bits, dtype=int)
        if (b * self.weights).sum() > self.capacity:
            return 0.0
        return float((b * self.values).sum())

    def crossover(self, a, b, rng):
        mask = rng.integers(0, 2, size=self.n)
        child = [int(a[i] if mask[i] else b[i]) for i in range(self.n)]
        return self._repair(child)

    def mutate(self, bits, rng):
        b = list(bits)
        for i in range(self.n):
            if rng.random() < 1.0 / self.n:
                b[i] = 1 - b[i]
        return self._repair(b)

    def encode_for_viz(self, bits):
        return {
            "bits": list(bits),
            "values": self.values.tolist(),
            "weights": self.weights.tolist(),
        }


# ──────────────────────────────────────────────────────────────────────
#   Continuous: Schwefel + Rastrigin
# ──────────────────────────────────────────────────────────────────────


class ContinuousProblem(Problem):
    def __init__(self, fixture: dict) -> None:
        self.dim = int(fixture["dim"])
        self.lo = float(fixture["lo"])
        self.hi = float(fixture["hi"])
        self.subtype = fixture.get("subtype", "rastrigin")
        # adaptive Gaussian sigma in init
        self.sigma = (self.hi - self.lo) * 0.05

    def _objective(self, x):
        x = np.asarray(x, dtype=float)
        if self.subtype == "schwefel":
            return 418.9829 * self.dim - float(np.sum(x * np.sin(np.sqrt(np.abs(x)))))
        # rastrigin
        return float(10 * self.dim + np.sum(x**2 - 10 * np.cos(2 * math.pi * x)))

    def sample_individual(self, rng):
        return rng.uniform(self.lo, self.hi, size=self.dim).tolist()

    def fitness(self, x):
        return -self._objective(x)

    def crossover(self, a, b, rng):
        """BLX-α with α=0.5."""
        alpha = 0.5
        a = np.asarray(a)
        b = np.asarray(b)
        lo = np.minimum(a, b)
        hi = np.maximum(a, b)
        d = hi - lo
        c = rng.uniform(lo - alpha * d, hi + alpha * d)
        return np.clip(c, self.lo, self.hi).tolist()

    def mutate(self, x, rng):
        x = np.asarray(x, dtype=float).copy()
        noise = rng.normal(0, self.sigma, size=self.dim)
        x = np.clip(x + noise, self.lo, self.hi)
        return x.tolist()

    def encode_for_viz(self, x):
        return {
            "x": list(x),
            "subtype": self.subtype,
            "dim": self.dim,
            "bounds": [self.lo, self.hi],
        }


# ──────────────────────────────────────────────────────────────────────
#   Loader
# ──────────────────────────────────────────────────────────────────────


def load_problem(name: str, data_root: str) -> Problem:
    path = os.path.join(data_root, f"{name}.json")
    with open(path, encoding="utf-8") as f:
        fixture = json.load(f)
    t = fixture["type"]
    if t == "tsp":
        return TSPProblem(fixture)
    if t == "knapsack":
        return KnapsackProblem(fixture)
    if t == "continuous":
        return ContinuousProblem(fixture)
    raise ValueError(f"unknown problem type: {t}")


def load_fixture(name: str, data_root: str) -> dict:
    path = os.path.join(data_root, f"{name}.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)
