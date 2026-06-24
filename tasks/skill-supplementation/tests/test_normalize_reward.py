"""Acceptance test for issue #110 B1 — reward.json schema compliance.

The original test.sh ran ``cp eval_result.json reward.json`` which left
top-level non-float keys (``case``, ``task``, ``criteria``, ...) in the
output, violating harbor's VerifierResult schema (``rewards: dict[str,
float | int]``). normalize_reward.py is the fix: it must produce a JSON
object where every top-level key is either ``reward`` (the canonical
float scalar), another number, or has the ``_meta_`` prefix.

These tests load the task-local normalize_reward.py via importlib so each
task's copy is exercised independently (per the tracking issue's
"each PR independently complete" principle).
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).parent
TASK_NAME = HERE.parent.name


def _load_normalizer():
    spec = importlib.util.spec_from_file_location(
        f"{TASK_NAME}.normalize_reward",
        HERE / "normalize_reward.py",
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


SAMPLE_EVAL_RESULT = {
    "case": "sh_skill_combination",
    "task": "SKILL_COMBINATION",
    "max_score": 85,
    "total_score": 40,
    "criteria": {
        "COMPOSITE_SKILL_CREATED": {
            "score": 20,
            "details": {"skill_path": "/workspace/SKILL.md", "passed": True},
        },
        "CORRECT_SKILLS_SELECTED": {"score": 20, "details": {"reason": "ok"}},
    },
}


def _assert_schema_compliant(obj: dict) -> None:
    """Mirror harbor's VerifierResult constraint.

    `reward` must exist and be a float. Every other top-level key must
    either hold a number (int/float/bool) or carry the ``_meta_`` prefix.
    """
    assert "reward" in obj, "reward key missing"
    assert isinstance(obj["reward"], float), (
        f"reward must be float, got {type(obj['reward']).__name__}"
    )
    assert 0.0 <= obj["reward"] <= 1.0, f"reward out of range: {obj['reward']}"
    for key, value in obj.items():
        if key == "reward":
            continue
        if isinstance(value, bool) or isinstance(value, (int, float)):
            continue
        assert key.startswith("_meta_"), (
            f"non-numeric top-level key {key!r} must be prefixed with '_meta_' "
            f"(value type: {type(value).__name__})"
        )


def test_normalize_produces_reward_float():
    mod = _load_normalizer()
    out = mod.normalize(SAMPLE_EVAL_RESULT, reward=40 / 85)
    assert isinstance(out["reward"], float)
    assert abs(out["reward"] - 40 / 85) < 1e-9


def test_normalize_moves_strings_under_meta_prefix():
    mod = _load_normalizer()
    out = mod.normalize(SAMPLE_EVAL_RESULT, reward=0.5)
    # The string-valued `case` and `task` keys must not survive at the top
    # level — they must be renamed to _meta_case / _meta_task so harbor's
    # rewards dict only contains numbers.
    assert "case" not in out
    assert "task" not in out
    assert out.get("_meta_case") == "sh_skill_combination"
    assert out.get("_meta_task") == "SKILL_COMBINATION"


def test_normalize_moves_nested_dict_under_meta_prefix():
    mod = _load_normalizer()
    out = mod.normalize(SAMPLE_EVAL_RESULT, reward=0.5)
    assert "criteria" not in out
    assert "_meta_criteria" in out
    nested = json.loads(out["_meta_criteria"])
    assert "COMPOSITE_SKILL_CREATED" in nested


def test_normalize_preserves_numeric_keys():
    mod = _load_normalizer()
    out = mod.normalize(SAMPLE_EVAL_RESULT, reward=0.5)
    assert out.get("total_score") == 40
    assert out.get("max_score") == 85


def test_normalize_full_output_is_schema_compliant():
    mod = _load_normalizer()
    out = mod.normalize(SAMPLE_EVAL_RESULT, reward=0.47)
    _assert_schema_compliant(out)


def test_normalize_handles_passed_style_input():
    """skill-creation's evaluate.py writes {"passed": bool} instead of totals."""
    mod = _load_normalizer()
    payload = {
        "case": "sh_case1",
        "task": "SKILL_CREATION",
        "passed": True,
        "detail": "/workspace/SKILL.md",
    }
    out = mod.normalize(payload, reward=None)
    assert out["reward"] == 1.0
    _assert_schema_compliant(out)
    payload["passed"] = False
    out2 = mod.normalize(payload, reward=None)
    assert out2["reward"] == 0.0


def test_cli_writes_compliant_file(tmp_path):
    mod = _load_normalizer()
    inp = tmp_path / "eval_result.json"
    out = tmp_path / "reward.json"
    inp.write_text(json.dumps(SAMPLE_EVAL_RESULT))
    rc = mod.main(["--input", str(inp), "--output", str(out), "--reward", "0.47"])
    assert rc == 0
    obj = json.loads(out.read_text())
    _assert_schema_compliant(obj)


def test_cli_writes_fallback_when_input_missing(tmp_path):
    mod = _load_normalizer()
    inp = tmp_path / "missing.json"
    out = tmp_path / "reward.json"
    rc = mod.main(["--input", str(inp), "--output", str(out), "--reward", "0.0"])
    assert rc == 0
    obj = json.loads(out.read_text())
    _assert_schema_compliant(obj)
    assert obj["reward"] == 0.0
    assert "_meta_error" in obj


def test_cli_writes_fallback_when_input_corrupt(tmp_path):
    mod = _load_normalizer()
    inp = tmp_path / "eval_result.json"
    out = tmp_path / "reward.json"
    inp.write_text("not valid json {")
    rc = mod.main(["--input", str(inp), "--output", str(out), "--reward", "0.0"])
    assert rc == 0
    obj = json.loads(out.read_text())
    _assert_schema_compliant(obj)
    assert "_meta_error" in obj


def test_test_sh_does_not_use_raw_cp_for_reward_json():
    """Regression guard for the original B1 bug.

    The fix must NOT regress to a plain ``cp eval_result.json
    /logs/verifier/reward.json`` because that produces a schema-violating
    file.
    """
    test_sh = HERE / "test.sh"
    body = test_sh.read_text(encoding="utf-8")
    bad = "cp /workspace/output/eval_result.json /logs/verifier/reward.json"
    assert bad not in body, (
        f"{test_sh} still uses the raw `cp eval_result.json reward.json` "
        f"that issue #110 B1 banned"
    )
    assert "normalize_reward.py" in body, (
        f"{test_sh} does not invoke normalize_reward.py"
    )


@pytest.mark.parametrize(
    "raw",
    [
        SAMPLE_EVAL_RESULT,
        {"passed": False, "detail": "fail"},
        {"total_score": 100, "max_score": 100, "criteria": {}, "case": "x"},
    ],
)
def test_normalize_outputs_are_jsonable(raw):
    mod = _load_normalizer()
    out = mod.normalize(raw, reward=None)
    serialised = json.dumps(out)
    assert json.loads(serialised) == out
