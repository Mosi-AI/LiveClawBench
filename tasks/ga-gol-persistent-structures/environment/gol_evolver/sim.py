"""Conway's Game of Life simulator (skeleton)."""

from __future__ import annotations

import numpy as np


class GoL:
    def __init__(self, grid: np.ndarray) -> None:
        raise NotImplementedError

    def step(self) -> "GoL":
        raise NotImplementedError

    def state_hash(self) -> int:
        raise NotImplementedError

    def centroid(self) -> tuple[float, float]:
        raise NotImplementedError

    def alive_count(self) -> int:
        raise NotImplementedError

    @property
    def grid(self) -> np.ndarray:
        raise NotImplementedError
