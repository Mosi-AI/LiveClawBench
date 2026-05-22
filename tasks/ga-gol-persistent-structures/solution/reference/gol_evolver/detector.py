"""Detectors for oscillator / spaceship / methuselah."""

from __future__ import annotations

import math

import numpy as np

from gol_evolver.sim import GoL


def _bounding_box(g: np.ndarray):
    ys, xs = np.nonzero(g)
    if len(ys) == 0:
        return None
    return (int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max()))


def _shape_signature(g: np.ndarray) -> bytes:
    """Bytes of the tight bounding-box crop. Used for shape-equality across translation."""
    bb = _bounding_box(g)
    if bb is None:
        return b""
    y0, y1, x0, x1 = bb
    return g[y0 : y1 + 1, x0 : x1 + 1].astype(np.int8).tobytes() + bytes(
        [y1 - y0, x1 - x0]
    )


class StructureDetector:
    @staticmethod
    def detect_oscillator(
        grid: np.ndarray, *, max_period: int = 10, max_steps: int = 60
    ) -> int | None:
        """Return P (≥2) if the grid is a P-oscillator within max_steps."""
        gol = GoL(grid)
        # Take a snapshot, then evolve. If state repeats EXACTLY (same grid)
        # at step P, period = P. Still life = period 1 is NOT an oscillator.
        original = gol.grid.copy()
        for step in range(1, max_steps + 1):
            gol = gol.step()
            if np.array_equal(gol.grid, original):
                if step == 1:
                    return None  # still life
                if step <= max_period:
                    return step
                return None
            if gol.alive_count() == 0:
                return None
        return None

    @staticmethod
    def detect_spaceship(
        grid: np.ndarray, *, max_steps: int = 100, min_translation: float = 3.0
    ) -> dict | None:
        """Return {period, dx, dy, distance} where distance = max cumulative
        translation observed across all shape-matching periods within
        max_steps.

        Returns None if the pattern dies or the maximum observed
        translation is below `min_translation`.
        """
        gol = GoL(grid)
        orig_sig = _shape_signature(gol.grid)
        c0 = gol.centroid()
        if math.isnan(c0[0]):
            return None
        best = None
        for step in range(1, max_steps + 1):
            gol = gol.step()
            if gol.alive_count() == 0:
                break
            sig = _shape_signature(gol.grid)
            if sig == orig_sig:
                c1 = gol.centroid()
                dy = c1[0] - c0[0]
                dx = c1[1] - c0[1]
                dist = math.hypot(dy, dx)
                if best is None or dist > best["distance"]:
                    best = {"period": step, "dy": dy, "dx": dx, "distance": dist}
        if best is None or best["distance"] < min_translation:
            return None
        return best

    @staticmethod
    def detect_methuselah(
        grid: np.ndarray, *, max_steps: int = 500, min_lifetime: int = 30
    ) -> int:
        gol = GoL(grid)
        for step in range(max_steps):
            if gol.alive_count() == 0:
                return step
            gol = gol.step()
        return max_steps
