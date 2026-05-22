# Evolve Persistent Structures in Conway's Game of Life

You are tasked with implementing `gol_evolver`, a package that:

1. Implements **Conway's Game of Life** simulator on a finite 20×20 grid with
   zero-boundary (cells outside the grid are dead).
2. Uses a **genetic algorithm** to search the initial-grid space for three
   classes of persistent structures.
3. Verifies findings via independent simulation and emits visualizations.

## What you must deliver

A Python package `gol_evolver/` under `/workspace/repo/`:

### Public API (verifier imports these by name)

```python
# gol_evolver/__init__.py — must re-export
from gol_evolver.sim import GoL
from gol_evolver.detector import StructureDetector
from gol_evolver.evolver import Evolver
```

### GoL simulator (`gol_evolver/sim.py`)

```python
class GoL:
    def __init__(self, grid: np.ndarray): ...     # 2D int8 (0/1), finite grid, zero-boundary
    def step(self) -> "GoL": ...                  # advance 1 generation; returns NEW GoL
    def state_hash(self) -> int: ...              # hash of current grid (for cycle detection)
    def centroid(self) -> tuple[float, float]: ... # weighted (row, col) of alive cells; (nan, nan) if dead
    def alive_count(self) -> int: ...
    @property
    def grid(self) -> np.ndarray: ...             # the current 2D grid

# Standard Conway rules:
#   - any live cell with 2 or 3 live neighbors lives
#   - any dead cell with exactly 3 live neighbors becomes alive
#   - all others die or stay dead
```

### Detector (`gol_evolver/detector.py`)

```python
class StructureDetector:
    @staticmethod
    def detect_oscillator(grid: np.ndarray, *, max_period: int = 10,
                          max_steps: int = 60) -> int | None:
        """Return the period P (≥2) if the pattern repeats with period P
           within max_steps; else None. Period 1 = still life is not an
           oscillator."""

    @staticmethod
    def detect_spaceship(grid: np.ndarray, *, max_steps: int = 100,
                         min_translation: float = 3.0) -> dict | None:
        """Return {period, dx, dy, distance} if the pattern translates
           by ≥ min_translation cells (Euclidean) with shape preserved;
           else None."""

    @staticmethod
    def detect_methuselah(grid: np.ndarray, *, max_steps: int = 500,
                          min_lifetime: int = 30) -> int:
        """Return the largest generation t such that the population is
           still positive at generation t. Cap at max_steps. The grid
           qualifies as a methuselah iff returned t ≥ min_lifetime."""
```

### Evolver (`gol_evolver/evolver.py`)

```python
class Evolver:
    """GoL-aware genetic algorithm. AST-required methods (by name):
       select, crossover, mutate."""

    def __init__(self, *, grid_size: int = 20, pop_size: int = 50,
                 elite_frac: float = 0.10): ...

    def select(self, population, fitnesses, rng): ...
    def crossover(self, parent_a, parent_b, rng): ...
    def mutate(self, individual, rng): ...

    def run(self, task: dict, *, seed: int, max_generations: int) -> dict:
        """task = {'type': 'oscillator'|'spaceship'|'methuselah', ...params}
           Returns {best_grid, fitness_history, found}."""
```

### CLI

```bash
python -m gol_evolver run --task-id <int> --seed <int> --out <dir>
```

### Outputs per run (under `<out_dir>/`)

| File | Purpose |
|---|---|
| `structure.rle` | RLE-encoded best individual (standard GoL format) |
| `structure.txt` | plaintext `O`/`.` grid |
| `evolution.gif` | animated best individual over its sim window (≥10 frames) |
| `fitness.png` | fitness curve (best + avg per generation) |
| `diversity.png` | diversity vs generation |
| `results.json` | `{task_id, seed, found, fitness, gens_used, verified_property}` |

## Tasks (3 total — see `/workspace/repo/data/tasks.json`)

| task_id | type | params | What you must find |
|:---:|---|---|---|
| 0 | oscillator | `target_period: 2` | A pattern that repeats with period 2 (blinker family) |
| 1 | spaceship | `min_translation: 3` | A pattern that translates ≥ 3 cells in ≤ 100 steps (glider family) |
| 2 | methuselah | `min_lifetime: 30` | A pattern that stays alive for ≥ 30 generations |

## Constraints

| Constraint | Reason |
|---|---|
| Allowed deps: `numpy`, `matplotlib`, `imageio` (or `Pillow`), `scipy` | Standard |
| **Forbidden** anywhere under `gol_evolver/`: `import deap`, `import pymoo`, `import golly`, `import lifelib` | You write the GA + sim yourself |
| **Required methods** on `Evolver`: `select`, `crossover`, `mutate` (AST-checked) | Verifier confirms presence |
| Grid size: 20×20 finite with zero-boundary | Matches verifier's independent simulator |
| Determinism: same seed → bit-identical `fitness_history` in results.json | Use `numpy.random.default_rng(seed)` |
| **Self-reported fitness is NOT trusted**: the verifier loads your `structure.rle`, runs it in an INDEPENDENT simulator (under `/tests/reference_sim/`, which your code cannot read), and re-verifies the property | Anti-overfitting / anti-misreporting |

## How the verifier scores you

For each of the 3 tasks:

1. Load your `<out_dir>/task<task_id>/structure.rle`
2. Decode to a 20×20 grid
3. Run an **independent simulator** (verifier-side) for the relevant horizon
4. Confirm the required property (period / translation / lifetime) for the task

The overall score combines:

- Fraction of tasks whose property is verified by the independent simulator
- Determinism of `fitness_history` under repeated seeds
- Validity of the required GIF/PNG outputs per task
- A surface multiplier from the AST scan (forbidden imports or missing required methods heavily penalise the score)

The final score is written to `/logs/verifier/reward.txt`.

## Sanity values

Public smoke tests cover only API surface + a tiny end-to-end run; they are not representative of the hidden suite.
