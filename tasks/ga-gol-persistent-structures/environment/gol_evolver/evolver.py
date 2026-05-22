"""GA evolver (skeleton). AST-required: select, crossover, mutate."""

from __future__ import annotations

from typing import Any


class Evolver:
    def __init__(
        self, *, grid_size: int = 20, pop_size: int = 50, elite_frac: float = 0.10
    ) -> None:
        self.grid_size = grid_size
        self.pop_size = pop_size
        self.elite_frac = elite_frac

    def select(self, population, fitnesses, rng):
        raise NotImplementedError

    def crossover(self, parent_a, parent_b, rng):
        raise NotImplementedError

    def mutate(self, individual, rng):
        raise NotImplementedError

    def run(self, task: dict, *, seed: int, max_generations: int) -> dict[str, Any]:
        raise NotImplementedError
