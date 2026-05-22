"""Public smoke tests. Verify the API surface + tiny end-to-end run.

The hidden suite covers per-benchmark thresholds, determinism, and viz.
"""

import os

import numpy as np
import pytest


def test_imports():
    from ga_solver import GASolver, Problem

    assert Problem is not None
    assert GASolver is not None


def test_problem_is_subclassable():
    from ga_solver import Problem

    class _ToyProblem(Problem):
        def sample_individual(self, rng):
            return rng.integers(0, 2, size=5).tolist()

        def fitness(self, ind):
            return float(sum(ind))

        def crossover(self, a, b, rng):
            return [a[i] if rng.random() < 0.5 else b[i] for i in range(len(a))]

        def mutate(self, ind, rng):
            i = rng.integers(0, len(ind))
            return ind[:i] + [1 - ind[i]] + ind[i + 1 :]

        def encode_for_viz(self, ind):
            return {"bits": ind}

    p = _ToyProblem()
    rng = np.random.default_rng(0)
    ind = p.sample_individual(rng)
    assert len(ind) == 5
    assert p.fitness([1] * 5) == 5.0


def test_solver_has_required_methods():
    from ga_solver import GASolver

    s = GASolver()
    for name in ("select", "crossover_step", "mutate_step", "run"):
        assert hasattr(s, name), f"GASolver missing required method: {name}"
        assert callable(getattr(s, name)), f"GASolver.{name} must be callable"


def test_cli_module_exists():
    """The agent must expose `python -m ga_solver` (see instruction.md)."""
    import importlib

    try:
        importlib.import_module("ga_solver.__main__")
    except ImportError:
        pytest.skip(
            "ga_solver.__main__ not yet implemented (agent may still be working)"
        )


def test_benchmarks_present():
    base = "/workspace/repo/data/benchmarks"
    expected = {
        "tsp30.json",
        "tsp50.json",
        "knapsack50.json",
        "schwefel5.json",
        "rastrigin10.json",
    }
    found = set(os.listdir(base)) if os.path.isdir(base) else set()
    missing = expected - found
    assert not missing, f"benchmark fixtures missing: {missing}"
