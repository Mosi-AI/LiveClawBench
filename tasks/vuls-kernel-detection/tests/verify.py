#!/usr/bin/env python3
"""Verifier for swe-pro-vuls-kernel-detection-stripped (case_id 116).

Adversarial hooks per plan 04:
  - Reject single-distro patches (e.g. fixing only Red Hat path; leaving
    duplicate string-replace in Debian/Ubuntu scanners).
  - Require centralisation: a shared kernel-variant resolver, not three
    parallel branches that each carry their own kernel logic.
  - Behavioural: tests must reference the running-kernel vs installed-kernel
    distinction on more than one distro.

Two-tier scoring: canonical gold-overlay first (`go test` on overlaid pkgs);
if compile fails because agent's signatures diverge from gold, fall back to
`go test` on agent's own tests at 0.5x cap. This avoids hard-zero on
in-good-faith fixes that don't match upstream's exact API shape.
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
    pkgs: list[str], timeout: int = 600
) -> tuple[int, int, bool, list[str], str]:
    """Returns (passed, failed, built_ok, failing_names, stderr_tail)."""
    if not pkgs:
        return 0, 0, False, [], ""
    # Pre-compile probe: `go vet` is faster than `go test -c` and catches the
    # same signature/type errors that would break overlay.
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

    # Full-project compile must succeed before either tier — agent's source must
    # at minimum be internally consistent. (Permissive: if some unrelated
    # package fails, that's still a fail because regression risk.)
    build = run(["go", "build", "./..."], timeout=600)
    if build.returncode != 0:
        return emit(
            0.0, reason=f"FAIL: project does not compile\n{build.stderr[-800:]}"
        )

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

    # Tier A: agent's own tests (no overlay).
    a_pkgs = affected_pkgs(agent_tests_before)
    a_passed, a_failed, a_ok, a_names, a_err = go_test_run(a_pkgs)
    a_total = a_passed + a_failed
    echo_dual("agent-own", a_passed, a_total, a_ok or not a_pkgs)
    if not a_ok and a_pkgs:
        print(f"agent-own go vet/test stderr: {a_err}")

    # Tier B: overlay gold tests then re-run.
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
        print(f"Overlaid {len(overlaid)} gold test files")
        b_pkgs = affected_pkgs(overlaid)
        b_passed, b_failed, b_ok, b_names, b_err = go_test_run(b_pkgs)
        b_total = b_passed + b_failed
        echo_dual("gold-overlay", b_passed, b_total, b_ok)
        if not b_ok:
            print(f"gold-overlay vet/test stderr: {b_err}")
            undo_overlay(originals)
            print(
                "NOTE: gold-overlay broke compile (likely signature mismatch); rolled back"
            )
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
        print("PENALTY: agent did not touch any gold source file (x0.3)")

    # Adversarial — multi-distro coverage required, but only when the GOLD patch
    # itself spans 2+ distinct distros (some real upstream fixes are RHEL-only
    # because the bug only manifests there; penalising single-distro then would
    # break oracle parity).
    distros = {
        "redhat": re.compile(
            r"redhat|rhel|centos|/rhel|rh\.go|redhat\.go|redhatBase", re.IGNORECASE
        ),
        "debian": re.compile(
            r"debian|ubuntu|debian\.go|debianBase|/deb_", re.IGNORECASE
        ),
    }
    distro_coverage = {
        name: any(rx.search(p) for p in agent_modified) for name, rx in distros.items()
    }
    distros_touched = sum(distro_coverage.values())
    print(f"Distro coverage in agent diff: {distro_coverage}")
    gold_distros = {
        name for name, rx in distros.items() if any(rx.search(p) for p in gold_sources)
    }
    print(f"Distros spanned by gold patch: {sorted(gold_distros)}")
    if distros_touched < 2 and len(gold_distros) >= 2:
        pass_ratio *= 0.4
        print(
            "PENALTY: gold patch spans multiple distro adapters; agent touched <2 (x0.4)"
        )

    # Centralisation check — gold patch usually adds a shared helper.
    diff_full = run(["git", "diff", "base-commit"]).stdout
    shared_signal = re.search(
        r"diff --git a/(?!.*?(redhat|debian|ubuntu)).+?(pkg/scanner|pkg/models|util)",
        diff_full,
        re.IGNORECASE,
    )
    if not shared_signal and distros_touched >= 2:
        pass_ratio *= 0.7
        print(
            "PENALTY: distro adapters touched but no shared resolver added — "
            "duplication retained (x0.7)"
        )

    # Behavioural — agent tests reference running-kernel concept and ≥2 distros.
    if agent_tests_before:
        text = "\n".join(
            (REPO / p).read_text(encoding="utf-8", errors="replace")
            for p in agent_tests_before
            if (REPO / p).exists()
        )
        if not re.search(
            r"running.?kernel|uname|kernel.?core|booted|isRunningKernel",
            text,
            re.IGNORECASE,
        ):
            pass_ratio *= 0.6
            print("PENALTY: agent tests don't reference running-kernel concept (x0.6)")
        # Multi-distro test check only when gold patch itself spans 2+ distros.
        if (
            len(gold_distros) >= 2
            and sum(1 for rx in distros.values() if rx.search(text)) < 2
        ):
            pass_ratio *= 0.7
            print("PENALTY: agent tests cover <2 distros (x0.7)")
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
