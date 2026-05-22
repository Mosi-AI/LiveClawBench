# Build a Genetic Algorithm Framework + Solve 5 Classic Benchmarks

You are tasked with building `ga_solver`, a Python package that implements a
**general-purpose Genetic Algorithm** and applies it to five classical
optimization benchmarks. You must reach the per-benchmark fitness thresholds
on enough seeds, and produce a 3-panel visualization for each run.

## What you must deliver

A Python package `ga_solver/` under `/workspace/repo/`. The skeleton with
required class/method names is already there; you fill in the bodies.

### Public API (must exist exactly as named — verifier imports them)

```python
# ga_solver/__init__.py — exports the two classes below
from ga_solver.base import Problem, GASolver

# ga_solver/base.py
class Problem:
    """Abstract problem. Each benchmark is a subclass implementing:
       - sample_individual(rng) -> any
       - fitness(individual) -> float    # higher is better
       - crossover(parent_a, parent_b, rng) -> child
       - mutate(individual, rng) -> individual'
       - encode_for_viz(individual) -> dict
    """

class GASolver:
    """The framework. MUST implement three methods called by `run`:
       - select(population, fitnesses, rng) -> parents
       - crossover_step(parents, rng) -> children
       - mutate_step(children, rng) -> children'
       Plus elitism, diversity tracking, convergence detection.
    """
    def run(self, problem: Problem, *, seed: int, max_generations: int,
            population_size: int) -> dict:
        """Returns {best_individual, best_fitness, history: [...]}
           history[g] = {gen, best, avg, diversity}."""
```

### CLI entry point

```bash
python -m ga_solver run --problem <name> --seed <int> --out <dir>
# names: tsp30 | tsp50 | knapsack50 | schwefel5 | rastrigin10
```

### Outputs (under `<out_dir>/` per run)

| File | Purpose |
|---|---|
| `results.json` | `{problem, seed, best_fitness, n_gens_used, threshold_passed}` |
| `history.csv` | per-generation `gen, best, avg, diversity` |
| `fitness_curve.png` | best + avg vs generation |
| `diversity.png` | diversity vs generation |
| `solution.png` | TSP tour / knapsack picks / 2D contour for continuous |

## Benchmarks (5 total)

Input JSON for each lives at `/workspace/repo/data/benchmarks/<name>.json`.
Higher fitness is better (minimization problems negate the objective).

| Name | Problem |
|---|---|
| `tsp30` | 30-city Euclidean TSP, fitness = -tour_length |
| `tsp50` | 50-city Euclidean TSP, fitness = -tour_length |
| `knapsack50` | 50-item 0-1 knapsack, fitness = value (0 if infeasible) |
| `schwefel5` | Schwefel d=5, fitness = -f(x), x ∈ [-500,500]^5 |
| `rastrigin10` | Rastrigin d=10, fitness = -f(x), x ∈ [-5.12,5.12]^10 |

Each JSON file contains its `ref_optimum` field for reference. The verifier compares your `best_fitness` to this reference using an undisclosed per-benchmark tolerance.

## Implementation constraints

| Constraint | Reason |
|---|---|
| All code under `ga_solver/`; deps allowed: `numpy`, `matplotlib`, `pandas` | Standard stack |
| **Forbidden** anywhere under `ga_solver/`: `from deap`, `import deap`, `from pymoo`, `import pymoo`, `scipy.optimize.differential_evolution`, `scipy.optimize.dual_annealing`, `scipy.optimize.shgo`, `scipy.optimize.basinhopping` | You must implement the GA yourself |
| **Required**: `GASolver` class must have methods named exactly `select`, `crossover_step`, `mutate_step` | AST-checked |
| Determinism: same seed → bit-identical `history.csv` | Use `numpy.random.default_rng(seed)` |
| Per-run wall time ≤ 90 seconds | Verifier kills slow runs |

## How the verifier scores you

1. **Hard gate** — `from ga_solver import Problem, GASolver` must work; both classes must be present.
2. **AST surface scan** — forbidden imports or missing required method names (`select`, `crossover_step`, `mutate_step`) heavily penalise the score.
3. **Functional** — for each of the 5 benchmarks the verifier runs your CLI on 3 seeds (0, 1, 2) and compares average `best_fitness` against the reference optimum.
4. **Determinism** — the verifier re-runs one benchmark with the same seed and checks the recorded history is byte-identical.
5. **Visualization** — each benchmark must emit the 3 documented PNGs as non-trivially sized files.

The final score is written to `/logs/verifier/reward.txt`.

## Iteration tips

- Public smoke tests at `/workspace/repo/public_tests/` only verify the API surface
  and tiny smoke runs. They are NOT representative of the hidden suite.
- Run them with: `cd /workspace/repo && python -m pytest public_tests/ -v`
- Try a reference-quality config first:
  - Population 100, generations 200, elitism 5%, tournament selection (k=3)
  - For TSP: OX crossover + 2-opt local search after mutation
  - For knapsack: uniform crossover + bit flip + greedy repair when over capacity
  - For continuous: BLX-α (α=0.5) + Gaussian mutation (σ adapted)

Good luck.
