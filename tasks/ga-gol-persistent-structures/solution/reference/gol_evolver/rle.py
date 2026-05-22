"""Minimal Run-Length Encoded GoL pattern format.

For our 20×20 grid we don't need a full parser — just a stable, lossless
encode/decode round-trip.
"""

from __future__ import annotations

import re

import numpy as np


def encode_rle(grid: np.ndarray) -> str:
    g = np.asarray(grid, dtype=np.int8)
    h, w = g.shape
    lines = [f"x = {w}, y = {h}, rule = B3/S23"]
    body_parts: list[str] = []
    for row in g:
        # Build run-length tokens
        tokens: list[str] = []
        i = 0
        while i < w:
            j = i
            while j < w and row[j] == row[i]:
                j += 1
            run = j - i
            ch = "o" if row[i] == 1 else "b"
            tokens.append((str(run) if run > 1 else "") + ch)
            i = j
        body_parts.append("".join(tokens))
    body = "$".join(body_parts) + "!"
    lines.append(body)
    return "\n".join(lines) + "\n"


def decode_rle(text: str) -> np.ndarray:
    # Header
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
                raise ValueError(f"bad header: {line}")
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
        # Optional count
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
            raise ValueError(f"unexpected character {ch!r}")
    return grid
