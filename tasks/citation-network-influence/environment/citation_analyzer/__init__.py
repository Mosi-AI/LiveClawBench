"""citation_analyzer — implement the 5 functions per instruction.md.

Forbidden for the PageRank step: networkx.pagerank, scipy.sparse.linalg.eigs.
Write power iteration yourself.
"""

from citation_analyzer.core import (  # noqa: F401
    detect_cascades,
    load_graph,
    pagerank,
    write_outputs,
    yearly_top,
)

__all__ = ["load_graph", "pagerank", "detect_cascades", "yearly_top", "write_outputs"]
