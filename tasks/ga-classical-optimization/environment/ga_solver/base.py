"""Skeleton API for ga_solver. Fill in the bodies per instruction.md."""

from __future__ import annotations

from typing import Any


class Problem:
    """Abstract optimization problem. Subclass per benchmark.

    Required methods (override all):
        sample_individual(rng) -> Any
        fitness(individual) -> float                       # higher is better
        crossover(parent_a, parent_b, rng) -> child
        mutate(individual, rng) -> individual'
        encode_for_viz(individual) -> dict                 # used by report
    """

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
    """Generic Genetic Algorithm.

    Required methods (used internally by run; the verifier AST-checks names):
        select(population, fitnesses, rng) -> parents
        crossover_step(parents, rng) -> children
        mutate_step(children, rng) -> children'
    """

    def __init__(self, *, elite_frac: float = 0.05, tournament_k: int = 3) -> None:
        self.elite_frac = elite_frac
        self.tournament_k = tournament_k

    def select(self, population, fitnesses, rng):
        raise NotImplementedError

    def crossover_step(self, parents, rng):
        raise NotImplementedError

    def mutate_step(self, children, rng):
        raise NotImplementedError

    def run(
        self, problem: Problem, *, seed: int, max_generations: int, population_size: int
    ) -> dict[str, Any]:
        """Returns {best_individual, best_fitness, history}.

        history is a list of {gen, best, avg, diversity} dicts, one per generation.
        """
        raise NotImplementedError
