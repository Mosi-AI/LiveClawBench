"""Persistent-structure detectors (skeleton)."""

from __future__ import annotations

import numpy as np


class StructureDetector:
    @staticmethod
    def detect_oscillator(
        grid: np.ndarray, *, max_period: int = 10, max_steps: int = 60
    ) -> int | None:
        raise NotImplementedError

    @staticmethod
    def detect_spaceship(
        grid: np.ndarray, *, max_steps: int = 100, min_translation: float = 3.0
    ) -> dict | None:
        raise NotImplementedError

    @staticmethod
    def detect_methuselah(
        grid: np.ndarray, *, max_steps: int = 500, min_lifetime: int = 30
    ) -> int:
        raise NotImplementedError
