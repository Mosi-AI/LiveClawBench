"""Public smoke tests."""

import os


def test_imports():
    from citation_analyzer import (
        detect_cascades,
        load_graph,
        pagerank,
        write_outputs,
        yearly_top,
    )

    assert all(
        callable(f)
        for f in [load_graph, pagerank, detect_cascades, yearly_top, write_outputs]
    )


def test_data_files_exist():
    for name in ("papers.json", "edges.json", "seeds.json"):
        assert os.path.exists(f"/workspace/repo/data/{name}"), f"missing {name}"
