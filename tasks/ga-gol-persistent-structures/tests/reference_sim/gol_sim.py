"""Independent GoL simulator — the agent CANNOT see this module.

Used by verify.py to RE-VERIFY each structure.rle the agent produced.
This is the anti-overfitting / anti-misreporting hook: the agent could
report any property in their own results.json, but the verifier trusts
only what this independent implementation confirms.
"""

from __future__ import annotations

import math
import re

import numpy as np


def step(grid: np.ndarray) -> np.ndarray:
    """One Conway step on a finite zero-bounded grid."""
    pad = np.pad(grid, 1, mode="constant", constant_values=0)
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
    out = np.zeros_like(grid)
    out[(grid == 1) & ((n == 2) | (n == 3))] = 1
    out[(grid == 0) & (n == 3)] = 1
    return out


def centroid(grid: np.ndarray):
    ys, xs = np.nonzero(grid)
    if len(ys) == 0:
        return None
    return (float(ys.mean()), float(xs.mean()))


def shape_sig(grid: np.ndarray) -> bytes:
    ys, xs = np.nonzero(grid)
    if len(ys) == 0:
        return b""
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    return grid[y0 : y1 + 1, x0 : x1 + 1].astype(np.int8).tobytes() + bytes(
        [y1 - y0, x1 - x0]
    )


def decode_rle(text: str) -> np.ndarray:
    header_re = re.compile(r"x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)")
    w = h = None
    body_lines: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("x"):
            m = header_re.search(line)
            if not m:
                raise ValueError("bad header")
            w = int(m.group(1))
            h = int(m.group(2))
        else:
            body_lines.append(line)
    if w is None or h is None:
        raise ValueError("missing header")
    body = "".join(body_lines).rstrip("!").rstrip()
    grid = np.zeros((h, w), dtype=np.int8)
    row = 0
    col = 0
    i = 0
    while i < len(body):
        num = 0
        while i < len(body) and body[i].isdigit():
            num = num * 10 + int(body[i])
            i += 1
        count = num if num > 0 else 1
        if i >= len(body):
            break
        ch = body[i]
        i += 1
        if ch == "b":
            col += count
        elif ch == "o":
            grid[row, col : col + count] = 1
            col += count
        elif ch == "$":
            row += count
            col = 0
        else:
            raise ValueError(f"unexpected {ch!r}")
    return grid


def verify_oscillator(grid: np.ndarray, target_period: int, max_steps: int) -> bool:
    if int(grid.sum()) == 0:
        return False
    cur = grid.copy()
    original = grid.copy()
    for s in range(1, max_steps + 1):
        cur = step(cur)
        if np.array_equal(cur, original):
            return s == target_period
        if cur.sum() == 0:
            return False
    return False


def verify_spaceship(grid: np.ndarray, min_translation: float, max_steps: int):
    """Track max translation observed across all shape-matching periods
    within max_steps; succeed if it reaches min_translation."""
    if int(grid.sum()) == 0:
        return False, 0.0
    sig0 = shape_sig(grid)
    c0 = centroid(grid)
    if c0 is None:
        return False, 0.0
    cur = grid.copy()
    best_dist = 0.0
    for s in range(1, max_steps + 1):
        cur = step(cur)
        if cur.sum() == 0:
            break
        if shape_sig(cur) == sig0:
            c1 = centroid(cur)
            if c1 is None:
                break
            dy = c1[0] - c0[0]
            dx = c1[1] - c0[1]
            dist = math.hypot(dy, dx)
            if dist > best_dist:
                best_dist = dist
    return best_dist >= min_translation, best_dist


def verify_methuselah(grid: np.ndarray, min_lifetime: int, max_steps: int):
    if int(grid.sum()) == 0:
        return False, 0
    cur = grid.copy()
    for s in range(max_steps):
        if cur.sum() == 0:
            return s >= min_lifetime, s
        cur = step(cur)
    return max_steps >= min_lifetime, max_steps
