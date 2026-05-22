"""Reference GA for evolving GoL persistent structures.

Strategy:
  - Population of 20×20 grids (binary).
  - 80% random sparse + 20% seeded canonical patterns (blinker / glider / clusters).
  - Tournament selection, rectangular-block crossover, cell-flip mutation,
    elitism = 10%.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from gol_evolver.detector import StructureDetector

# Canonical seed patterns (small bitmaps; placed at random offsets on the grid)
SEED_BLINKER = np.array([[1, 1, 1]], dtype=np.int8)
SEED_GLIDER = np.array(
    [
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1],
    ],
    dtype=np.int8,
)
SEED_R_PENTO = np.array(
    [
        [0, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
    ],
    dtype=np.int8,
)


class Evolver:
    def __init__(
        self, *, grid_size: int = 20, pop_size: int = 50, elite_frac: float = 0.10
    ) -> None:
        self.grid_size = grid_size
        self.pop_size = pop_size
        self.elite_frac = elite_frac

    # --- AST-required methods ---------------------------------------------

    def select(self, population, fitnesses, rng):
        n = len(population)
        parents = []
        for _ in range(n):
            idx = rng.integers(0, n, size=3)
            best = max(idx, key=lambda i: fitnesses[i])
            parents.append(population[best])
        return parents

    def crossover(self, a, b, rng):
        """Rectangular block swap."""
        h, w = a.shape
        y0, y1 = sorted(rng.integers(0, h + 1, size=2))
        x0, x1 = sorted(rng.integers(0, w + 1, size=2))
        c = a.copy()
        c[y0:y1, x0:x1] = b[y0:y1, x0:x1]
        return c

    def mutate(self, ind, rng):
        """Flip ~3 random cells + occasional 2x2 block flip."""
        out = ind.copy()
        h, w = out.shape
        n_flips = int(rng.integers(1, 4))
        ys = rng.integers(0, h, size=n_flips)
        xs = rng.integers(0, w, size=n_flips)
        for y, x in zip(ys, xs):
            out[y, x] ^= 1
        if rng.random() < 0.2:
            y = int(rng.integers(0, h - 2))
            x = int(rng.integers(0, w - 2))
            out[y : y + 2, x : x + 2] ^= 1
        return out

    # --- helpers ----------------------------------------------------------

    def _empty(self) -> np.ndarray:
        return np.zeros((self.grid_size, self.grid_size), dtype=np.int8)

    def _random_sparse(self, rng, p=0.15) -> np.ndarray:
        return (rng.random((self.grid_size, self.grid_size)) < p).astype(np.int8)

    def _place_seed(self, seed: np.ndarray, rng) -> np.ndarray:
        g = self._empty()
        sh, sw = seed.shape
        y = int(rng.integers(2, self.grid_size - sh - 2))
        x = int(rng.integers(2, self.grid_size - sw - 2))
        g[y : y + sh, x : x + sw] = seed
        # Optional rotation
        if rng.random() < 0.5:
            g = np.rot90(g, k=int(rng.integers(0, 4)))
        return g.astype(np.int8)

    def _initial_population(self, task: dict, rng) -> list[np.ndarray]:
        pop: list[np.ndarray] = []
        # 20% seeded
        n_seed = self.pop_size // 5
        for _ in range(n_seed):
            if task["type"] == "oscillator":
                pop.append(self._place_seed(SEED_BLINKER, rng))
            elif task["type"] == "spaceship":
                pop.append(self._place_seed(SEED_GLIDER, rng))
            else:
                pop.append(self._place_seed(SEED_R_PENTO, rng))
        # rest random sparse
        while len(pop) < self.pop_size:
            pop.append(self._random_sparse(rng))
        return pop

    def _fitness(self, grid: np.ndarray, task: dict) -> float:
        t = task["type"]
        if t == "oscillator":
            target = int(task["target_period"])
            p = StructureDetector.detect_oscillator(
                grid, max_period=10, max_steps=task.get("max_steps", 30)
            )
            if p is None:
                # negative: penalize lifeless / chaotic
                return -1.0
            # Reward exact match; partial credit for any oscillator
            if p == target:
                return 1.0 + 1.0 / target
            return 0.5 - abs(p - target) * 0.05
        if t == "spaceship":
            min_t = float(task["min_translation"])
            res = StructureDetector.detect_spaceship(
                grid, max_steps=task.get("max_steps", 100), min_translation=0.5
            )
            if res is None:
                return -1.0
            return (
                float(res["distance"])
                if res["distance"] >= min_t
                else 0.5 * res["distance"] / min_t
            )
        if t == "methuselah":
            min_t = int(task["min_lifetime"])
            lt = StructureDetector.detect_methuselah(
                grid, max_steps=task.get("max_steps", 100), min_lifetime=min_t
            )
            return float(lt)
        return -1.0

    # --- main loop --------------------------------------------------------

    def run(self, task: dict, *, seed: int, max_generations: int) -> dict[str, Any]:
        rng = np.random.default_rng(seed)
        population = self._initial_population(task, rng)
        fitnesses = [self._fitness(g, task) for g in population]

        n_elite = max(1, int(self.pop_size * self.elite_frac))

        best_idx = int(np.argmax(fitnesses))
        best = population[best_idx]
        best_fit = fitnesses[best_idx]

        history: list[dict[str, float]] = []
        found = self._task_passes(best, task)

        for gen in range(max_generations):
            parents = self.select(population, fitnesses, rng)
            children = []
            for i in range(0, self.pop_size, 2):
                a = parents[i]
                b = parents[(i + 1) % self.pop_size]
                children.append(self.crossover(a, b, rng))
                if len(children) < self.pop_size:
                    children.append(self.crossover(b, a, rng))
            children = [self.mutate(c, rng) for c in children]

            elite_idx = sorted(
                range(len(population)), key=lambda i: fitnesses[i], reverse=True
            )[:n_elite]
            elites = [population[i] for i in elite_idx]
            new_pop = elites + children[: self.pop_size - n_elite]
            new_fits = [self._fitness(g, task) for g in new_pop]

            cur_idx = int(np.argmax(new_fits))
            if new_fits[cur_idx] > best_fit:
                best_fit = new_fits[cur_idx]
                best = new_pop[cur_idx].copy()
                if self._task_passes(best, task):
                    found = True

            avg = float(np.mean(new_fits))
            div = float(np.std(new_fits))
            history.append(
                {
                    "gen": gen,
                    "best": round(best_fit, 6),
                    "avg": round(avg, 6),
                    "diversity": round(div, 6),
                }
            )

            population, fitnesses = new_pop, new_fits
            if found:
                # Bookkeeping done; continue a few extra gens to populate
                # diversity/history for viz, then stop early at 1.5x found-gen.
                break

        return {
            "best_grid": best,
            "best_fitness": best_fit,
            "fitness_history": history,
            "found": found,
            "task": task,
        }

    def _task_passes(self, grid: np.ndarray, task: dict) -> bool:
        t = task["type"]
        if t == "oscillator":
            p = StructureDetector.detect_oscillator(
                grid, max_period=10, max_steps=task.get("max_steps", 30)
            )
            return p == int(task["target_period"])
        if t == "spaceship":
            # Use task's actual min_translation so detector keeps scanning
            # for a period that clears the threshold (skipping shorter ones).
            res = StructureDetector.detect_spaceship(
                grid,
                max_steps=task.get("max_steps", 100),
                min_translation=float(task["min_translation"]),
            )
            return res is not None and res["distance"] >= float(task["min_translation"])
        if t == "methuselah":
            lt = StructureDetector.detect_methuselah(
                grid,
                max_steps=task.get("max_steps", 100),
                min_lifetime=int(task["min_lifetime"]),
            )
            return lt >= int(task["min_lifetime"])
        return False
