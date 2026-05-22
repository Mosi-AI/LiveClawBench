#!/usr/bin/env python3
"""Verifier for swe-pro-ansible-iptables-ipset-stripped (case_id 109).

Adversarial hooks per plan 04:
  - Reject rule strings that fail the second check_mode (non-idempotent
    under iptables-save round-trip). Heuristic via argspec inspection.
  - Reject argspecs without the mutually_exclusive constraints for the
    new flag pair.
  - Behavioural: agent tests reference idempotency + new parameter names.

Two-tier scoring (see ``_swe_pro_lib.two_tier_score``): canonical gold-overlay
test run if it compiles and yields events; otherwise agent's own tests at 0.5x.
This means kimi gets partial credit for an in-good-faith ipset patch that uses
different param names than upstream's gold patch, rather than a hard 0.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _swe_pro_lib import (  # noqa: E402
    REPO_DEFAULT as REPO,
)
from _swe_pro_lib import (
    diff_paths,
    echo_dual,
    emit,
    find_pytest,
    overlay_gold_tests,
    parse_pytest_summary,
    run,
    stage_agent_changes,
    two_tier_score,
    undo_overlay,
)

IPTABLES_MODULE = REPO / "lib" / "ansible" / "modules" / "iptables.py"


def is_test_path(p: str) -> bool:
    s = p.lower()
    return (
        s.startswith("test/")
        or "/tests/" in s
        or s.startswith("test_")
        or "test_iptables" in s
    )


def find_pytest_or_fail() -> list[str] | None:
    cmd = find_pytest()
    if cmd is None:
        print(
            "FAIL: pytest is not importable from any python interpreter and the "
            "fallback `pip install pytest` failed (no network or pip broken)"
        )
    return cmd


def run_pytest(
    pytest_cmd: list[str], paths: list[str], timeout: int = 600
) -> tuple[int, int, bool, str]:
    """Returns (passed, failed, ran_ok, raw_text). ran_ok=True iff pytest exited cleanly enough to read a summary."""
    if not paths:
        return 0, 0, False, ""
    r = run(pytest_cmd + ["--tb=short", "-q", "--no-header", *paths], timeout=timeout)
    text = r.stdout + "\n" + r.stderr
    passed, failed = parse_pytest_summary(text)
    ran_ok = (passed + failed) > 0
    return passed, failed, ran_ok, text


def evaluate() -> float:
    if not IPTABLES_MODULE.exists():
        return emit(
            0.0, reason=f"FAIL: {IPTABLES_MODULE} missing — repo structure wrong"
        )

    pytest_cmd = find_pytest_or_fail()
    if pytest_cmd is None:
        return emit(0.0, reason="FAIL: no usable pytest")

    # Stage all working-tree changes so untracked NEW files (which agents
    # commonly create without `git add`) appear in subsequent `git diff
    # base-commit` calls. See _swe_pro_lib.stage_agent_changes for rationale.
    stage_agent_changes()

    agent_modified = diff_paths("base-commit")
    agent_tests_before = [p for p in agent_modified if is_test_path(p)]
    gold_modified = diff_paths("base-commit", "gold-fix-commit")
    gold_sources = [p for p in gold_modified if not is_test_path(p)]
    gold_tests = [p for p in gold_modified if is_test_path(p)]
    print(
        f"Agent modified {len(agent_modified)} files ({len(agent_tests_before)} tests)"
    )
    print(
        f"Gold patch changed {len(gold_modified)} files "
        f"({len(gold_sources)} sources, {len(gold_tests)} tests)"
    )

    # Module must contain match_set surface area.
    module_src = IPTABLES_MODULE.read_text(encoding="utf-8", errors="replace")
    if not re.search(r"match.?set", module_src, re.IGNORECASE):
        return emit(
            0.0,
            reason="FAIL: iptables module has no match_set reference — "
            "agent did not add the feature",
        )

    # Tier A: run agent's own tests first (no overlay).
    a_paths = [p for p in agent_tests_before if (REPO / p).exists()]
    a_passed, a_failed, a_ran, _ = run_pytest(pytest_cmd, a_paths)
    a_total = a_passed + a_failed
    echo_dual("agent-own", a_passed, a_total, a_ran or len(a_paths) == 0)

    # Tier B: overlay gold tests + run.
    overlaid, originals = overlay_gold_tests(is_test_path)
    if not overlaid:
        # No gold tests at all — degrade to agent-own only.
        ratio, source = two_tier_score(
            overlay_pass=0,
            overlay_total=0,
            overlay_compiled=False,
            agent_pass=a_passed,
            agent_total=a_total,
            agent_compiled=True,
        )
    else:
        print(f"Overlaid {len(overlaid)} gold tests")
        b_passed, b_failed, b_ran, b_text = run_pytest(pytest_cmd, overlaid)
        b_total = b_passed + b_failed
        echo_dual("gold-overlay", b_passed, b_total, b_ran)
        if not b_ran:
            # Overlay broke compile/collection → undo so penalties below see clean diff.
            undo_overlay(originals)
            print("NOTE: gold-overlay produced no test events; rolled back overlay")
            print(b_text[-500:])
        ratio, source = two_tier_score(
            overlay_pass=b_passed,
            overlay_total=b_total,
            overlay_compiled=b_ran,
            agent_pass=a_passed,
            agent_total=a_total,
            agent_compiled=True,
        )

    pass_ratio = ratio
    print(f"Base score = {pass_ratio:.3f} (source: {source})")

    # Surface anti-cheat.
    touched_gold_source = set(agent_modified) & set(gold_sources)
    if not touched_gold_source:
        pass_ratio *= 0.3
        print("PENALTY: agent did not touch gold source files (x0.3)")

    # Note: the upstream gold patch (be59caa5) does NOT add a mutually_exclusive
    # constraint for the new match_set flag — verified via oracle inspection. The
    # case-study's expectation that "argspec must declare mutually_exclusive" was
    # speculative and would penalise the gold fix itself. The penalty is dropped.

    # Adversarial — idempotency via canonical -m set --match-set ordering.
    # Real fix uses the existing append_match()/append_param() helpers, not raw
    # strings. Accept either the helper-pattern (`append_match(..., 'set')` +
    # `'--match-set'`) or the literal `-m set --match-set` form.
    helper_pattern = re.search(
        r"append_match\([^)]*['\"]set['\"]", module_src
    ) and re.search(r"['\"]--match-set['\"]", module_src)
    rule_construct = (
        helper_pattern
        or re.search(r"['\"]-m['\"]\s*,\s*['\"]set['\"]", module_src)
        or re.search(r"-m\s+set\s+--match-set", module_src)
    )
    if not rule_construct:
        pass_ratio *= 0.6
        print(
            "PENALTY: rule-string construction does not follow `-m set --match-set` ordering (x0.6)"
        )

    # Behavioural — tests reference idempotency + new params.
    if agent_tests_before:
        ttext = "\n".join(
            (REPO / p).read_text(encoding="utf-8", errors="replace")
            for p in agent_tests_before
            if (REPO / p).exists()
        )
        if not re.search(r"match.?set", ttext, re.IGNORECASE):
            pass_ratio *= 0.6
            print("PENALTY: tests don't reference match_set parameter (x0.6)")
        if not re.search(
            r"idempoten|check_mode|second.?run|no.?change|unchanged",
            ttext,
            re.IGNORECASE,
        ):
            pass_ratio *= 0.7
            print("PENALTY: tests don't reference idempotency invariant (x0.7)")
    else:
        pass_ratio *= 0.7
        print("PENALTY: agent added no tests (x0.7)")

    return emit(pass_ratio)


def main() -> int:
    try:
        score = evaluate()
    except Exception as e:  # noqa: BLE001
        print(f"VERIFIER CRASH: {type(e).__name__}: {e}")
        emit(0.0)
        return 1
    return 0 if score >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
