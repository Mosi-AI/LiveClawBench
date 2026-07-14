#!/usr/bin/env python3
"""Normalize a skill-* task's eval_result.json into a harbor-compliant reward.json.

Harbor's VerifierResult model enforces ``rewards: dict[str, float | int]``
on the top level of /logs/verifier/reward.json. Any non-numeric top-level
field must be prefixed with ``_meta_``, otherwise harbor raises a Pydantic
ValidationError when it parses the reward file. See
docs/en/guide/adding-tasks.md → "`reward.json` rules" (issue #110, B1).

This helper:

1. Reads the verbose ``eval_result.json`` written by evaluate.py.
2. Computes the canonical ``reward`` scalar (float in [0.0, 1.0]) as
   ``total_score / max_score`` (or uses ``--reward`` when the caller
   already derived it from stdout, e.g. via a ``TOTAL:`` line).
3. Rewrites every top-level key so the output is schema-compliant:

   - ``reward`` is added/overridden with the float scalar.
   - Numeric (int/float/bool) keys are passed through unchanged.
   - Every other key is renamed with a ``_meta_`` prefix and the value is
     serialised as a JSON string (so nested objects / arrays / strings
     are all schema-legal under ``dict[str, float | int]`` — they live
     under keys harbor explicitly ignores).

4. Writes the result to the requested output path.

Used by tasks/skill-*/tests/test.sh in place of a raw
``cp eval_result.json reward.json`` which produces a schema-violating
file.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def _coerce_reward(data: dict[str, Any], explicit: float | None) -> float:
    """Pick the canonical reward scalar."""
    if explicit is not None:
        return max(0.0, min(1.0, float(explicit)))
    total = data.get("total_score")
    maximum = data.get("max_score")
    if (
        isinstance(total, (int, float))
        and isinstance(maximum, (int, float))
        and maximum
    ):
        return max(0.0, min(1.0, float(total) / float(maximum)))
    # passed-style scoring (skill-creation).
    passed = data.get("passed")
    if isinstance(passed, bool):
        return 1.0 if passed else 0.0
    return 0.0


def normalize(data: dict[str, Any], reward: float | None = None) -> dict[str, Any]:
    """Return a schema-compliant copy of ``data`` for /logs/verifier/reward.json.

    Top-level guarantees:
      * ``reward`` is present and is a ``float``.
      * Every other top-level key is either a number (int/float/bool) or
        has the ``_meta_`` prefix with a string value.
    """
    out: dict[str, Any] = {}
    out["reward"] = float(_coerce_reward(data, reward))

    for key, value in data.items():
        if key == "reward":
            # already handled above; ignore any conflicting source value.
            continue
        if isinstance(value, bool) or isinstance(value, (int, float)):
            # Numeric scalar — safe to keep as-is.
            out[key] = value
            continue
        meta_key = key if key.startswith("_meta_") else f"_meta_{key}"
        if isinstance(value, str):
            out[meta_key] = value
        else:
            # nested dict/list/None/etc → JSON-serialise to a string.
            out[meta_key] = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return out


def _load(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    obj = json.loads(raw)
    if not isinstance(obj, dict):
        raise ValueError(f"{path}: expected a JSON object, got {type(obj).__name__}")
    return obj


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Normalize eval_result.json into a harbor-compliant reward.json "
            "(see issue #110 B1 / docs/en/guide/adding-tasks.md)."
        )
    )
    parser.add_argument("--input", required=True, help="Path to eval_result.json")
    parser.add_argument("--output", required=True, help="Path to write reward.json")
    parser.add_argument(
        "--reward",
        type=float,
        default=None,
        help=(
            "Optional canonical reward scalar (float in [0,1]). When omitted, "
            "derived from total_score/max_score or `passed` in the input."
        ),
    )
    args = parser.parse_args(argv)

    in_path = Path(args.input)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if not in_path.exists():
        # eval_result.json wasn't produced (e.g. evaluate.py crashed before
        # writing it). Still write a schema-compliant reward.json so harbor
        # doesn't fail with ValidationError on the missing file.
        fallback = {
            "reward": float(args.reward) if args.reward is not None else 0.0,
            "_meta_error": f"eval_result.json not generated at {in_path}",
        }
        out_path.write_text(json.dumps(fallback, indent=2, ensure_ascii=False))
        print(
            f"normalize_reward: input missing ({in_path}); wrote fallback reward.json",
            file=sys.stderr,
        )
        return 0

    try:
        data = _load(in_path)
    except (json.JSONDecodeError, ValueError) as exc:
        fallback = {
            "reward": float(args.reward) if args.reward is not None else 0.0,
            "_meta_error": f"failed to parse {in_path}: {exc}",
        }
        out_path.write_text(json.dumps(fallback, indent=2, ensure_ascii=False))
        print(f"normalize_reward: parse error: {exc}", file=sys.stderr)
        return 0

    normalized = normalize(data, args.reward)
    out_path.write_text(json.dumps(normalized, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
