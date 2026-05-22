"""RLE (Run-Length Encoded) GoL pattern format (skeleton).

Standard format:
  x = <cols>, y = <rows>, rule = B3/S23
  <run-encoded body, ! terminator>

Body uses 'b' for dead, 'o' for alive, '$' for end-of-row.
"""

from __future__ import annotations

import numpy as np


def encode_rle(grid: np.ndarray) -> str:
    raise NotImplementedError


def decode_rle(text: str) -> np.ndarray:
    raise NotImplementedError
