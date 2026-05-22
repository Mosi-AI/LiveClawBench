"""Reference GA implementation. Plain numpy; no deap/pymoo."""

from __future__ import annotations

import statistics
from typing import Any

import numpy as np


class Problem:
    """Abstract problem. Subclasses must override all five methods."""

    def sample_individual(self, rng):
        raise NotImplementedError

    def fitness(self, individual) -> float:
        raise NotImplementedError

    def crossover(self, parent_a, parent_b, rng):
        raise NotImplementedError

    def mutate(self, individual, rng):
        raise NotImplementedError

    def encode_for_viz(self, individual) -> dict:
        raise NotImplementedError


class GASolver:
    def __init__(self, *, elite_frac: float = 0.05, tournament_k: int = 3) -> None:
        self.elite_frac = elite_frac
        self.tournament_k = tournament_k

    # --- core building blocks ---------------------------------------------

    def select(self, population, fitnesses, rng):
        """Tournament selection: return one parent at a time, len(population) total."""
        n = len(population)
        parents = []
        for _ in range(n):
            idx = rng.integers(0, n, size=self.tournament_k)
            best = max(idx, key=lambda i: fitnesses[i])
            parents.append(population[best])
        return parents

    def crossover_step(self, parents, rng):
        """Pair adjacent parents and ask the problem to crossover them."""
        problem = self._problem
        children = []
        n = len(parents)
        for i in range(0, n, 2):
            a = parents[i]
            b = parents[(i + 1) % n]
            c1 = problem.crossover(a, b, rng)
            c2 = problem.crossover(b, a, rng)
            children.append(c1)
            children.append(c2)
        return children[:n]

    def mutate_step(self, children, rng):
        problem = self._problem
        return [problem.mutate(c, rng) for c in children]

    # --- main loop --------------------------------------------------------

    def run(
        self,
        problem: Problem,
        *,
        seed: int,
        max_generations: int = 200,
        population_size: int = 100,
    ) -> dict[str, Any]:
        self._problem = problem
        rng = np.random.default_rng(seed)

        # initial pop
        population = [problem.sample_individual(rng) for _ in range(population_size)]
        fitnesses = [float(problem.fitness(ind)) for ind in population]

        n_elite = max(1, int(population_size * self.elite_frac))
        history: list[dict[str, float]] = []
        best_ind = population[int(np.argmax(fitnesses))]
        best_fit = float(max(fitnesses))

        for gen in range(max_generations):
            # selection -> crossover -> mutation
            parents = self.select(population, fitnesses, rng)
            children = self.crossover_step(parents, rng)
            children = self.mutate_step(children, rng)

            # elitism: keep top-k previous; replace worst children
            elite_idx = sorted(
                range(population_size), key=lambda i: fitnesses[i], reverse=True
            )[:n_elite]
            elites = [population[i] for i in elite_idx]
            new_pop = elites + children[: population_size - n_elite]

            new_fits = [float(problem.fitness(ind)) for ind in new_pop]

            # bookkeeping
            cur_best_idx = int(np.argmax(new_fits))
            cur_best = new_fits[cur_best_idx]
            if cur_best > best_fit:
                best_fit = cur_best
                best_ind = new_pop[cur_best_idx]

            diversity = _diversity_metric_from_fits(new_fits)
            history.append(
                {
                    "gen": gen,
                    "best": round(cur_best, 6),
                    "avg": round(statistics.fmean(new_fits), 6),
                    "diversity": round(diversity, 6),
                }
            )

            population, fitnesses = new_pop, new_fits

        return {
            "best_individual": best_ind,
            "best_fitness": best_fit,
            "history": history,
        }


def _diversity_metric_from_fits(fits):
    """L1 spread of fitness — cheap diversity proxy, no recomputation."""
    if not fits:
        return 0.0
    m = statistics.fmean(fits)
    return float(sum(abs(f - m) for f in fits) / len(fits))
