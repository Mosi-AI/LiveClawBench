#!/usr/bin/env python3
"""Verifier for swe-pro-element-web-unverified-device-stripped (case_id 111).

Scoring follows the SWE-bench Pro f2p / p2p pattern with the adversarial hooks
defined in plans/04-final-6-case-distribution.md:

  1. Hard gate: repo + node_modules intact.
  2. Two-tier scoring (canonical gold overlay + agent-own fallback at 0.5x).
     When agent's runtime crashes during test setup (eg ``cli.getStoredDevicesForUser
     is not a function``) the verifier rolls back the overlay so the failure
     mode is visible separately and credits any tests that DID pass under
     the agent-own path.
  3. Surface check: agent touched at least one of the gold-patch source files.
  4. Adversarial: detect dispatcher-broadcast workaround.
  5. Behavioural: agent's tests must cover 2+ transition paths.
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
    overlay_gold_tests,
    parse_jest_json,
    run,
    stage_agent_changes,
    two_tier_score,
    undo_overlay,
)


def is_test_path(p: str) -> bool:
    s = p.lower()
    return any(t in s for t in ("test/", "tests/", ".test.", ".spec.", "/__tests__/"))


def jest_run(
    test_paths: list[str], out_path: Path = Path("/tmp/jest.json"), timeout: int = 1500
) -> tuple[int, int, bool, str]:
    """Run jest on given paths. Returns (passed, total, ran_ok, raw_text).

    ``ran_ok`` is True iff jest emitted at least one test event. Setup-time
    crashes (``TypeError`` etc.) leave ``total == 0`` → ran_ok = False.
    """
    if not test_paths:
        return 0, 0, False, ""
    try:
        out_path.unlink()
    except FileNotFoundError:
        pass
    args = [
        "yarn",
        "test",
        "--watchAll=false",
        "--json",
        f"--outputFile={out_path}",
        "--testPathPattern",
        "|".join(re.escape(p) for p in test_paths[:12]),
    ]
    r = run(args, timeout=timeout)
    text = r.stdout + "\n" + r.stderr
    passed, total = parse_jest_json(out_path, text)
    return passed, total, total > 0, text


def evaluate() -> float:
    if not (REPO / "package.json").exists():
        return emit(0.0, reason="FAIL: package.json missing")
    if not (REPO / "node_modules").exists():
        return emit(0.0, reason="FAIL: node_modules missing — image build incomplete")

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

    # Tier A: agent's own tests, no overlay.
    a_paths = [p for p in agent_tests_before if (REPO / p).exists()]
    a_passed, a_total, a_ran, a_text = jest_run(a_paths)
    echo_dual("agent-own", a_passed, a_total, a_ran or not a_paths)
    if not a_ran and a_paths:
        # Show last lines so the agent's runtime error is in the verifier log
        print(f"agent-own jest tail: {a_text[-500:]}")

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
        print(f"Overlaid {len(overlaid)} gold test files")
        b_passed, b_total, b_ran, b_text = jest_run(overlaid)
        echo_dual("gold-overlay", b_passed, b_total, b_ran)
        if not b_ran:
            undo_overlay(originals)
            print("NOTE: gold-overlay jest yielded 0 events; rolled back")
            print(f"gold-overlay jest tail: {b_text[-500:]}")
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
        print(
            f"PENALTY: agent did not touch any of the {len(gold_sources)} "
            f"gold source files (x0.3)"
        )
    else:
        print(f"Agent touched {len(touched_gold_source)} gold source files")

    # Adversarial — dispatcher-broadcast shortcut.
    shell_patterns = (
        "MatrixChat",
        "structures/MatrixChat",
        "components/structures/App",
    )
    shell_files_touched = [
        p for p in agent_modified if any(sp in p for sp in shell_patterns)
    ]
    if shell_files_touched:
        diff_full = run(
            ["git", "diff", "base-commit", "--", *shell_files_touched]
        ).stdout
        broadcast_signal = re.search(
            r"dispatch\s*\(\s*\{[^}]*(notif|unverif)",
            diff_full,
            re.IGNORECASE,
        )
        if broadcast_signal and not touched_gold_source:
            pass_ratio *= 0.4
            print("PENALTY: app-shell dispatcher-broadcast shortcut detected (x0.4)")

    # Behavioural — agent's own tests must reference 2+ transition paths.
    if agent_tests_before:
        bodies = []
        for p in agent_tests_before:
            tp = REPO / p
            if tp.exists():
                bodies.append(tp.read_text(encoding="utf-8", errors="replace"))
        text = "\n".join(bodies)
        path_patterns = [
            re.compile(r"new.{0,3}log.?in|fresh.?sign.?in|first.?time", re.IGNORECASE),
            re.compile(r"rotat|cross.?sign", re.IGNORECASE),
            re.compile(r"server.?reset|password.?reset|identity.?reset", re.IGNORECASE),
            re.compile(r"manual.?unverify|setUnverif|markUnverif", re.IGNORECASE),
        ]
        covered = sum(1 for p in path_patterns if p.search(text))
        print(f"Agent tests reference {covered}/4 transition paths")
        if covered < 2:
            pass_ratio *= 0.6
            print("PENALTY: agent tests cover <2 transition paths (x0.6)")
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
