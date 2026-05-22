#!/usr/bin/env python3
"""Verifier for swe-pro-teleport-gcp-cert-identity-stripped (case_id 115).

Adversarial hooks per plan 04:
  - Reject a 3rd bespoke code branch (copy-paste of AWS/Azure with mutated
    strings). The fix must extend the CloudIdentityProvider abstraction
    that AWS and Azure already implement.
  - Behavioural: tests reference the GCP workload-identity flow AND the
    AWS/Azure abstraction (to confirm cross-provider parity isn't broken).

Two-tier scoring: canonical gold-overlay first; if gold tests can't compile
against agent's interface (e.g. missing struct fields like ``GCPServiceAccount``),
fall back to agent-own tests at 0.5x. Avoids hard-zero on partial fixes.
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
    parse_go_test_json,
    run,
    stage_agent_changes,
    two_tier_score,
    undo_overlay,
)


def is_test_path(p: str) -> bool:
    return p.endswith("_test.go")


def affected_pkgs(paths: list[str]) -> list[str]:
    pkgs: set[str] = set()
    for p in paths:
        pkgs.add("./" + str(Path(p).parent) + "/...")
    return sorted(pkgs)


def go_test_run(
    pkgs: list[str], timeout: int = 900
) -> tuple[int, int, bool, list[str], str]:
    """Returns (passed, failed, built_ok, failing_names, stderr_tail)."""
    if not pkgs:
        return 0, 0, False, [], ""
    vet = run(["go", "vet", *pkgs], timeout=300)
    if vet.returncode != 0:
        return 0, 0, False, [], vet.stderr[-400:]
    r = run(
        ["go", "test", "-json", "-count=1", "-timeout=180s", *pkgs], timeout=timeout
    )
    passed, failed, names = parse_go_test_json(r.stdout)
    return passed, failed, True, names, r.stderr[-400:]


def evaluate() -> float:
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

    # Scoped build gate over affected packages (full teleport build too expensive).
    if gold_sources:
        scoped_pkgs = affected_pkgs(gold_sources)
        build = run(["go", "build", *scoped_pkgs], timeout=900)
        if build.returncode != 0:
            return emit(
                0.0,
                reason=f"FAIL: affected packages do not compile\n{build.stderr[-800:]}",
            )

    # Tier A: agent's own tests (no overlay).
    a_pkgs = affected_pkgs(agent_tests_before)
    a_passed, a_failed, a_ok, _, a_err = go_test_run(a_pkgs)
    a_total = a_passed + a_failed
    echo_dual("agent-own", a_passed, a_total, a_ok or not a_pkgs)
    if not a_ok and a_pkgs:
        print(f"agent-own vet/test stderr: {a_err}")

    # Tier B: gold overlay.
    overlaid, originals = overlay_gold_tests(is_test_path)
    if not overlaid:
        ratio, source = two_tier_score(
            overlay_pass=0,
            overlay_total=0,
            overlay_compiled=False,
            agent_pass=a_passed,
            agent_total=a_total,
            agent_compiled=a_ok,
        )
    else:
        print(f"Overlaid {len(overlaid)} gold tests")
        b_pkgs = affected_pkgs(overlaid)
        b_passed, b_failed, b_ok, b_names, b_err = go_test_run(b_pkgs)
        b_total = b_passed + b_failed
        echo_dual("gold-overlay", b_passed, b_total, b_ok)
        if not b_ok:
            print(f"gold-overlay vet/test stderr: {b_err}")
            undo_overlay(originals)
            print("NOTE: gold-overlay broke compile; rolled back overlay")
        if b_names:
            print(f"gold-overlay failing: {b_names[:5]}")
        ratio, source = two_tier_score(
            overlay_pass=b_passed,
            overlay_total=b_total,
            overlay_compiled=b_ok,
            agent_pass=a_passed,
            agent_total=a_total,
            agent_compiled=a_ok,
        )

    pass_ratio = ratio
    print(f"Base score = {pass_ratio:.3f} (source: {source})")

    # Surface anti-cheat.
    touched_gold_source = set(agent_modified) & set(gold_sources)
    if not touched_gold_source:
        pass_ratio *= 0.3
        print("PENALTY: agent did not touch gold source files (x0.3)")

    # Adversarial — 3rd bespoke branch detection.
    diff_full = run(["git", "diff", "base-commit"]).stdout
    new_gcp_file = (
        re.search(r"\+\+\+ b/.+gcp.+\.go", diff_full, re.IGNORECASE) is not None
    )
    abstraction_touched = any(
        re.search(r"(aws|azure).+/.+\.go", p, re.IGNORECASE) and not is_test_path(p)
        for p in agent_modified
    )
    if new_gcp_file and not abstraction_touched:
        pass_ratio *= 0.4
        print(
            "PENALTY: new GCP file added but shared abstraction not touched — "
            "sibling-branch shortcut (x0.4)"
        )

    # Behavioural — tests reference GCP + abstraction parity.
    if agent_tests_before:
        text = "\n".join(
            (REPO / p).read_text(encoding="utf-8", errors="replace")
            for p in agent_tests_before
            if (REPO / p).exists()
        )
        if not re.search(
            r"gcp|google.?cloud|workload.?identity|gserviceaccount", text, re.IGNORECASE
        ):
            pass_ratio *= 0.6
            print("PENALTY: tests don't reference GCP (x0.6)")
        # GCP-cert flow uses ServiceAccount tokens (not the AWS-STS-style federation
        # vocabulary). The actual upstream gold test calls them
        # ``GCPServiceAccount`` / ``GCPServiceAccounts``; accept either.
        if not re.search(
            r"workload.?identity|federat|sts\.|exchangeToken|"
            r"GCPServiceAccounts?|gserviceaccount|GCPExtensions",
            text,
            re.IGNORECASE,
        ):
            pass_ratio *= 0.7
            print(
                "PENALTY: tests don't reference workload-identity / service-account "
                "specifics (x0.7)"
            )
        # AWS/Azure parity check: only enforce when gold patch itself touches those.
        gold_has_aws_azure = any(
            re.search(r"aws|azure", p, re.IGNORECASE) for p in gold_sources
        )
        if gold_has_aws_azure and not re.search(r"aws|azure", text, re.IGNORECASE):
            pass_ratio *= 0.8
            print("PENALTY: tests don't reference AWS/Azure parity (x0.8)")
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
