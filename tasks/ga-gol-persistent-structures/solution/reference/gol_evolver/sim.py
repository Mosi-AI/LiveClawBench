"""Conway's Game of Life — finite grid, zero-boundary, numpy-vectorized step."""

from __future__ import annotations

import numpy as np


class GoL:
    def __init__(self, grid: np.ndarray) -> None:
        g = np.asarray(grid, dtype=np.int8)
        if g.ndim != 2:
            raise ValueError("grid must be 2D")
        self._grid = g.copy()

    @property
    def grid(self) -> np.ndarray:
        return self._grid

    def step(self) -> "GoL":
        g = self._grid
        # Count neighbors using padded array (zero-boundary)
        pad = np.pad(g, 1, mode="constant", constant_values=0)
        n = (
            pad[:-2, :-2]
            + pad[:-2, 1:-1]
            + pad[:-2, 2:]
            + pad[1:-1, :-2]
            + pad[1:-1, 2:]
            + pad[2:, :-2]
            + pad[2:, 1:-1]
            + pad[2:, 2:]
        )
        next_g = np.zeros_like(g)
        # alive cells with 2 or 3 neighbors stay alive
        next_g[(g == 1) & ((n == 2) | (n == 3))] = 1
        # dead cells with exactly 3 neighbors become alive
        next_g[(g == 0) & (n == 3)] = 1
        return GoL(next_g)

    def state_hash(self) -> int:
        # Hash of bytes — stable across runs / interpreters
        return hash(self._grid.tobytes())

    def centroid(self) -> tuple[float, float]:
        ys, xs = np.nonzero(self._grid)
        if len(ys) == 0:
            return (float("nan"), float("nan"))
        return (float(ys.mean()), float(xs.mean()))

    def alive_count(self) -> int:
        return int(self._grid.sum())
