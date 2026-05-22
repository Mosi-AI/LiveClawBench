#!/usr/bin/env python3
"""Verifier for swe-pro-openlibrary-3rd-metadata-source-stripped (case_id 114).

Adversarial hooks per plan 04:
  - Reject a 3rd hard-coded `if google_books:` branch alongside the two
    existing sources. The fix must extend the resolver abstraction so the
    pipeline accepts a list of self-describing source plugins.
  - Behavioural: tests reference the resolver abstraction, not just the
    Google Books client in isolation; existing two sources still pass.

Two-tier scoring: canonical gold-overlay first; if it can't run, fall back
to agent's own tests at 0.5x. Avoids hard-zeroing fixes that diverge from
gold's exact module layout but still implement the feature.
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


def is_test_path(p: str) -> bool:
    s = p.lower()
    return any(t in s for t in ("test_", "_test.py", "/tests/", "test.py"))


def find_pytest_or_fail() -> list[str] | None:
    cmd = find_pytest()
    if cmd is None:
        print(
            "FAIL: pytest is not importable from any python interpreter and the "
            "fallback `pip install pytest` failed"
        )
    return cmd


def run_pytest(
    pytest_cmd: list[str], paths: list[str], timeout: int = 900
) -> tuple[int, int, bool, str]:
    if not paths:
        return 0, 0, False, ""
    r = run(pytest_cmd + ["--tb=short", "-q", "--no-header", *paths], timeout=timeout)
    text = r.stdout + "\n" + r.stderr
    passed, failed = parse_pytest_summary(text)
    return passed, failed, (passed + failed) > 0, text


def evaluate() -> float:
    if not (REPO / "openlibrary").exists():
        return emit(0.0, reason="FAIL: openlibrary package missing")

    pytest_cmd = find_pytest_or_fail()
    if pytest_cmd is None:
        return emit(0.0, reason="FAIL: no usable pytest")

    # Stage all working-tree changes so untracked NEW files (which agents
    # commonly create without `git add` — observed for openlibrary's new
    # metadata_sources/google_books.py etc) appear in subsequent `git diff
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

    # Tier A: agent's own tests.
    a_paths = [p for p in agent_tests_before if (REPO / p).exists()]
    a_passed, a_failed, a_ran, _ = run_pytest(pytest_cmd, a_paths)
    a_total = a_passed + a_failed
    echo_dual("agent-own", a_passed, a_total, a_ran or len(a_paths) == 0)

    # Tier B: gold overlay.
    overlaid, originals = overlay_gold_tests(is_test_path)
    if not overlaid:
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

    # Surface check.
    touched_gold_source = set(agent_modified) & set(gold_sources)
    if not touched_gold_source:
        pass_ratio *= 0.3
        print("PENALTY: agent did not touch gold source files (x0.3)")

    # Adversarial — 3rd-bespoke-branch detection. Only fires when the gold patch
    # ITSELF uses an abstraction pattern; some real upstream fixes (like this
    # openlibrary instance) extend an existing dispatch table rather than
    # introducing a class hierarchy, in which case expecting agent to do so is
    # over-constrained and would zero the oracle.
    diff_full = run(["git", "diff", "base-commit"]).stdout
    diff_gold = run(["git", "diff", "base-commit", "gold-fix-commit"]).stdout
    abstraction_re = re.compile(
        r"\+\s*(class|def)\s+\w*MetadataSource|\+\s*metadata_sources\s*=\s*\[|\+\s*METADATA_SOURCES",
    )
    gold_uses_abstraction = bool(abstraction_re.search(diff_gold))
    branch_pattern = re.compile(
        r"(\+\s*elif\s+[^:]*google|\+\s*if\s+[^:]*google_books)",
        re.IGNORECASE,
    )
    if gold_uses_abstraction and branch_pattern.search(diff_full):
        agent_has_abstraction = bool(abstraction_re.search(diff_full))
        if not agent_has_abstraction:
            pass_ratio *= 0.4
            print(
                "PENALTY: 3rd-bespoke-branch detected without extending the "
                "resolver abstraction (x0.4)"
            )

    # Behavioural — tests must reference Google Books AND at least one existing source.
    if agent_tests_before:
        text = "\n".join(
            (REPO / p).read_text(encoding="utf-8", errors="replace")
            for p in agent_tests_before
            if (REPO / p).exists()
        )
        if not re.search(r"google.?books|googleapis", text, re.IGNORECASE):
            pass_ratio *= 0.6
            print("PENALTY: agent tests don't reference Google Books (x0.6)")
        if not re.search(r"amazon|isbndb", text, re.IGNORECASE):
            pass_ratio *= 0.7
            print(
                "PENALTY: agent tests don't reference existing sources for "
                "cross-source invariant (x0.7)"
            )
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
