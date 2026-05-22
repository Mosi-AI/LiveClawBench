"""gol_evolver — GA-driven search for Game of Life persistent structures.

Implement GoL, StructureDetector, and Evolver per instruction.md.
"""

from gol_evolver.detector import StructureDetector  # noqa: F401
from gol_evolver.evolver import Evolver  # noqa: F401
from gol_evolver.sim import GoL  # noqa: F401

__all__ = ["GoL", "StructureDetector", "Evolver"]
