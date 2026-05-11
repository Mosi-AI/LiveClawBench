#!/usr/bin/env python3
"""
Generate a clean multi-attempt Harbor parity comparison table from an explicit
evidence root. Only reads trials under the specified directory; does NOT scan
broad historical roots.

Expected layout:
  <evidence_root>/
    baseline/
      <task>__<id>/
        config.json
        result.json
        verifier/reward.txt
    migrated/
      <task>__<id>/
        config.json
        result.json
        verifier/reward.txt

Usage:
  python3 generate-parity-table.py <evidence_root>
"""

import json
import sys
from pathlib import Path
from statistics import mean

# 30 tasks — full LiveClawBench dataset (registry: liveclawbench@0.1.0)
TASKS = [
    # mock-affected cohort (17): tasks whose mock binary or task Dockerfile changed
    # between main and plan3-spec-refine. Cohort rule (≤1 fail) applies here.
    "baggage-tracking-application",
    "conflict-repair-acb",
    "email-reply",
    "email-washer-change",
    "email-watch-shop",
    "email-writing",
    "flight-booking",
    "flight-cancel-claim",
    "flight-info-change-notice",
    "flight-seat-selection",
    "flight-seat-selection-failed",
    "info-change",
    "mixed-tool-memory",
    "schedule-change-request",
    "washer-change",
    "washer-shop",
    "watch-shop",
    # mock-independent cohort (13): zero diff in tasks/<name>/ and no mock binaries.
    # Used as noise floor calibration; not gating for the verdict.
    "blog-site-completion-from-starter",
    "blog-site-from-scratch",
    "incremental-update-ctp",
    "live-web-research-sqlite-fts5",
    "noise-filtering",
    "skill-combination",
    "skill-conflict-resolution",
    "skill-creation",
    "skill-dependency-fix",
    "skill-repository-curation",
    "skill-supplementation",
    "vue-build-fix-chain",
    "vue-build-fix-single",
]

MOCK_AFFECTED = {
    "baggage-tracking-application",
    "conflict-repair-acb",
    "email-reply",
    "email-washer-change",
    "email-watch-shop",
    "email-writing",
    "flight-booking",
    "flight-cancel-claim",
    "flight-info-change-notice",
    "flight-seat-selection",
    "flight-seat-selection-failed",
    "info-change",
    "mixed-tool-memory",
    "schedule-change-request",
    "washer-change",
    "washer-shop",
    "watch-shop",
}

MOCK_INDEPENDENT = {
    "blog-site-completion-from-starter",
    "blog-site-from-scratch",
    "incremental-update-ctp",
    "live-web-research-sqlite-fts5",
    "noise-filtering",
    "skill-combination",
    "skill-conflict-resolution",
    "skill-creation",
    "skill-dependency-fix",
    "skill-repository-curation",
    "skill-supplementation",
    "vue-build-fix-chain",
    "vue-build-fix-single",
}

MEAN_DELTA_THRESH = 0.10
MAX_DELTA_THRESH = 0.50
NOISE_FLOOR_P75_THRESH = 0.10
COHORT_FAIL_LIMIT = 1


def parse_task_from_dirname(name: str) -> str | None:
    """Extract task name from directory like 'email-reply__abc123'.

    Harbor truncates dir prefixes to 32 chars, so 'blog-site-completion-from-starter'
    appears on disk as 'blog-site-completion-from-starte'. Match by exact name first,
    then fall back to a unique 32-char prefix match against TASKS.
    """
    if "__" not in name:
        return None
    task_prefix = name.split("__", 1)[0]
    if task_prefix in TASKS:
        return task_prefix
    if len(task_prefix) == 32:
        candidates = [t for t in TASKS if t.startswith(task_prefix)]
        if len(candidates) == 1:
            return candidates[0]
    return None


def collect_trials(evidence_root: str, side: str):
    """Collect valid trials for one side (baseline or migrated)."""
    side_dir = Path(evidence_root) / side
    trials = []
    if not side_dir.exists():
        return trials

    for subdir in sorted(side_dir.iterdir()):
        if not subdir.is_dir():
            continue
        task = parse_task_from_dirname(subdir.name)
        if task is None:
            continue

        reward_path = subdir / "verifier" / "reward.txt"
        result_path = subdir / "result.json"
        config_path = subdir / "config.json"

        if not reward_path.exists():
            continue

        try:
            score = float(reward_path.read_text().strip())
        except Exception:
            continue

        result = {}
        if result_path.exists():
            try:
                result = json.loads(result_path.read_text())
            except Exception:
                pass

        config = {}
        if config_path.exists():
            try:
                config = json.loads(config_path.read_text())
            except Exception:
                pass

        exception_info = result.get("exception_info")
        model = config.get("agent", {}).get("model_name", "unknown")
        timeout_multiplier = config.get("timeout_multiplier", "unknown")

        trials.append(
            {
                "path": str(subdir),
                "side": side,
                "task": task,
                "reward": score,
                "exception_info": exception_info,
                "model": model,
                "timeout_multiplier": timeout_multiplier,
            }
        )

    return trials


def validate_cohort(trials, required_model: str | None, required_timeout: float | None):
    """Filter to valid trials and report excluded ones."""
    valid = []
    excluded = []
    for t in trials:
        reasons = []
        if t["exception_info"] is not None:
            reasons.append(f"exception_info={t['exception_info']}")
        if required_model and t["model"] != required_model:
            reasons.append(f"model={t['model']}")
        if required_timeout is not None and t["timeout_multiplier"] != required_timeout:
            reasons.append(f"timeout_multiplier={t['timeout_multiplier']}")
        if reasons:
            excluded.append({**t, "exclude_reasons": "; ".join(reasons)})
        else:
            valid.append(t)
    return valid, excluded


def main():
    if len(sys.argv) < 2:
        print(
            f"Usage: {sys.argv[0]} <evidence_root> [required_model] [required_timeout_multiplier]",
            file=sys.stderr,
        )
        sys.exit(1)

    evidence_root = sys.argv[1]
    required_model = sys.argv[2] if len(sys.argv) > 2 else None
    required_timeout = float(sys.argv[3]) if len(sys.argv) > 3 else None

    baseline_trials = collect_trials(evidence_root, "baseline")
    migrated_trials = collect_trials(evidence_root, "migrated")
    all_trials = baseline_trials + migrated_trials

    valid_trials, excluded_trials = validate_cohort(
        all_trials, required_model, required_timeout
    )

    # Print excluded trials
    if excluded_trials:
        print("## Excluded Trials")
        print("")
        print("| Path | Side | Task | Reward | Exclude Reasons |")
        print("|------|------|------|--------|-----------------|")
        for t in excluded_trials:
            print(
                f"| {t['path']} | {t['side']} | {t['task']} | {t['reward']} | {t['exclude_reasons']} |"
            )
        print("")

    # Print all valid trials
    print("## Valid Trials")
    print("")
    print("| Path | Side | Task | Reward | Model | Timeout Multiplier |")
    print("|------|------|------|--------|-------|--------------------|")
    for t in valid_trials:
        print(
            f"| {t['path']} | {t['side']} | {t['task']} | {t['reward']} | {t['model']} | {t['timeout_multiplier']} |"
        )
    print("")

    # Group by task and side
    baseline_by_task: dict[str, list[float]] = {t: [] for t in TASKS}
    migrated_by_task: dict[str, list[float]] = {t: [] for t in TASKS}

    for t in valid_trials:
        if t["side"] == "baseline":
            baseline_by_task[t["task"]].append(t["reward"])
        else:
            migrated_by_task[t["task"]].append(t["reward"])

    def percentile(xs: list[float], p: float) -> float:
        if not xs:
            return float("nan")
        s = sorted(xs)
        if len(s) == 1:
            return s[0]
        k = (len(s) - 1) * p
        lo, hi = int(k), min(int(k) + 1, len(s) - 1)
        return s[lo] + (s[hi] - s[lo]) * (k - lo)

    def render_cohort(
        cohort_name: str,
        cohort_tasks: list[str],
        apply_cohort_rule: bool,
    ) -> tuple[list[str], list[dict]]:
        """Render a cohort section. Returns (failed_tasks, per_task_rows)."""
        print(f"## Cohort: {cohort_name}")
        print("")
        print(
            "| Task | B n | M n | B avg | M avg | B max | M max | Mean Δ | Max Δ | Mean Pass | Max Pass |"
        )
        print(
            "|------|-----|-----|-------|-------|-------|-------|--------|-------|-----------|----------|"
        )

        failed: list[str] = []
        rows: list[dict] = []

        for task in cohort_tasks:
            bs = baseline_by_task[task]
            ms = migrated_by_task[task]

            b_avg = round(mean(bs), 3) if bs else None
            m_avg = round(mean(ms), 3) if ms else None
            b_max_v = round(max(bs), 3) if bs else None
            m_max_v = round(max(ms), 3) if ms else None

            if bs and ms:
                mean_delta = round(m_avg - b_avg, 3)
                max_delta = round(m_max_v - b_max_v, 3)
                mean_pass = m_avg >= b_avg - MEAN_DELTA_THRESH
                max_pass = m_max_v >= b_max_v - MAX_DELTA_THRESH
                if not (mean_pass and max_pass):
                    failed.append(task)
                rows.append(
                    {
                        "task": task,
                        "b_avg": b_avg,
                        "m_avg": m_avg,
                        "mean_delta": mean_delta,
                    }
                )
                cells = [
                    task,
                    str(len(bs)),
                    str(len(ms)),
                    f"{b_avg}",
                    f"{m_avg}",
                    f"{b_max_v}",
                    f"{m_max_v}",
                    f"{mean_delta:+.3f}",
                    f"{max_delta:+.3f}",
                    "PASS" if mean_pass else "FAIL",
                    "PASS" if max_pass else "FAIL",
                ]
            else:
                failed.append(task)
                cells = [
                    task,
                    str(len(bs)),
                    str(len(ms)),
                    str(b_avg) if b_avg is not None else "N/A",
                    str(m_avg) if m_avg is not None else "N/A",
                    str(b_max_v) if b_max_v is not None else "N/A",
                    str(m_max_v) if m_max_v is not None else "N/A",
                    "N/A",
                    "N/A",
                    "N/A",
                    "N/A",
                ]
            print("| " + " | ".join(cells) + " |")

        print("")

        if apply_cohort_rule:
            verdict = "PASS" if len(failed) <= COHORT_FAIL_LIMIT else "FAIL"
            print(
                f"**Cohort rule (≤{COHORT_FAIL_LIMIT} task may fail among {len(cohort_tasks)}):** "
                f"**{verdict}** ({len(failed)} failed: {', '.join(failed) if failed else 'none'})"
            )
        else:
            print(
                f"**Failed/incomplete tasks ({len(failed)}/{len(cohort_tasks)}):** "
                f"{', '.join(failed) if failed else 'none'}"
            )
        print("")
        return failed, rows

    # ----- Mock-Independent (noise floor) FIRST -----
    indep_tasks = [t for t in TASKS if t in MOCK_INDEPENDENT]
    indep_failed, indep_rows = render_cohort(
        "Mock-Independent (Noise Floor Calibration)",
        indep_tasks,
        apply_cohort_rule=False,
    )

    # Compute noise floor stats on |Δ mean| of mock-independent tasks with data
    abs_deltas = [abs(r["mean_delta"]) for r in indep_rows]
    if abs_deltas:
        nf_p50 = round(percentile(abs_deltas, 0.50), 3)
        nf_p75 = round(percentile(abs_deltas, 0.75), 3)
        nf_max = round(max(abs_deltas), 3)
        nf_pass = nf_p75 <= NOISE_FLOOR_P75_THRESH
        print(
            f"**Noise floor (mock-independent |Δ mean|):** "
            f"P50={nf_p50}, P75={nf_p75}, max={nf_max} — "
            f"P75 threshold ≤{NOISE_FLOOR_P75_THRESH}: **{'PASS' if nf_pass else 'FAIL — increase n_attempts before judging mock-affected'}**"
        )
    else:
        print("**Noise floor:** N/A (no mock-independent trials with both sides).")
    print("")

    # ----- Mock-Affected (regression signal) -----
    affected_tasks = [t for t in TASKS if t in MOCK_AFFECTED]
    affected_failed, _ = render_cohort(
        "Mock-Affected (Regression Signal)",
        affected_tasks,
        apply_cohort_rule=True,
    )

    # ----- Final verdict -----
    print("## Final Verdict")
    print("")
    if not abs_deltas:
        print("- Noise floor: **N/A** (insufficient data)")
        final_pass = False
    else:
        final_pass_nf = percentile(abs_deltas, 0.75) <= NOISE_FLOOR_P75_THRESH
        print(
            f"- Noise floor (mock-independent P75 |Δ mean| ≤{NOISE_FLOOR_P75_THRESH}): **{'PASS' if final_pass_nf else 'FAIL'}**"
        )
        final_pass_cohort = len(affected_failed) <= COHORT_FAIL_LIMIT
        print(
            f"- Mock-affected cohort rule (≤{COHORT_FAIL_LIMIT} fail among {len(affected_tasks)}): **{'PASS' if final_pass_cohort else 'FAIL'}**"
        )
        final_pass = final_pass_nf and final_pass_cohort

    print("")
    print(f"**Migration {'PASSES' if final_pass else 'FAILS'} regression check.**")


if __name__ == "__main__":
    main()
