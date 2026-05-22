"""Public smoke tests for gol_evolver."""


def test_imports():
    from gol_evolver import Evolver, GoL, StructureDetector  # noqa: F401


def test_evolver_has_required_methods():
    from gol_evolver import Evolver

    e = Evolver()
    for name in ("select", "crossover", "mutate", "run"):
        assert hasattr(e, name), f"Evolver missing required method: {name}"
        assert callable(getattr(e, name))


def test_tasks_json_present():
    import json

    with open("/workspace/repo/data/tasks.json") as f:
        d = json.load(f)
    assert d["grid_size"] == 20
    assert len(d["tasks"]) == 3
    types = {t["type"] for t in d["tasks"]}
    assert types == {"oscillator", "spaceship", "methuselah"}
