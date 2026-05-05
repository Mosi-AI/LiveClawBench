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
import os
import sys
from pathlib import Path
from statistics import mean

TASKS = [
    "email-reply",
    "email-watch-shop",
    "email-washer-change",
    "email-writing",
    "schedule-change-request",
    "flight-info-change-notice",
    "flight-seat-selection",
    "flight-seat-selection-failed",
    "flight-cancel-claim",
]


def parse_task_from_dirname(name: str) -> str | None:
    """Extract task name from directory like 'email-reply__abc123'."""
    if "__" not in name:
        return None
    task = name.split("__", 1)[0]
    return task if task in TASKS else None


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
        print(f"Usage: {sys.argv[0]} <evidence_root> [required_model] [required_timeout_multiplier]", file=sys.stderr)
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

    # Per-task summary
    print("## Per-Task Threshold Evaluation")
    print("")
    print("| Task | B Count | M Count | B Mean | M Mean | B Max | M Max | Mean Delta | Max Delta | Mean Pass | Max Pass |")
    print("|------|---------|---------|--------|--------|-------|-------|------------|-----------|-----------|----------|")

    all_mean_pass = True
    all_max_pass = True
    failed_tasks = []

    for task in TASKS:
        bs = baseline_by_task[task]
        ms = migrated_by_task[task]

        b_mean = round(mean(bs), 3) if bs else "N/A"
        m_mean = round(mean(ms), 3) if ms else "N/A"
        b_max = round(max(bs), 3) if bs else "N/A"
        m_max = round(max(ms), 3) if ms else "N/A"

        if bs and ms:
            mean_delta = round(float(m_mean) - float(b_mean), 3)
            max_delta = round(float(m_max) - float(b_max), 3)
            mean_pass = "PASS" if float(m_mean) >= float(b_mean) - 0.1 else "FAIL"
            max_pass = "PASS" if float(m_max) >= float(b_max) - 0.5 else "FAIL"
            if mean_pass == "FAIL" or max_pass == "FAIL":
                failed_tasks.append(task)
            if mean_pass == "FAIL":
                all_mean_pass = False
            if max_pass == "FAIL":
                all_max_pass = False
        else:
            mean_delta = "N/A"
            max_delta = "N/A"
            mean_pass = "N/A"
            max_pass = "N/A"
            all_mean_pass = False
            all_max_pass = False
            failed_tasks.append(task)

        print(
            f"| {task} | {len(bs)} | {len(ms)} | {b_mean} | {m_mean} | {b_max} | {m_max} | {mean_delta} | {max_delta} | {mean_pass} | {max_pass} |"
        )

    print("")
    print(f"**Mean threshold pass (mean(Migrated) >= mean(Baseline) - 0.1):** {'ALL PASS' if all_mean_pass else 'PENDING/FAIL'}")
    print(f"**Max threshold pass (max(Migrated) >= max(Baseline) - 0.5):** {'ALL PASS' if all_max_pass else 'PENDING/FAIL'}")
    print(f"**Failed or incomplete tasks:** {', '.join(failed_tasks) if failed_tasks else 'None'}")
    print("")

    # Cohort rule
    if len(failed_tasks) <= 1:
        print(f"**Cohort rule (≤1 task may fail):** PASS ({len(failed_tasks)} task(s) failed/incomplete)")
    else:
        print(f"**Cohort rule (≤1 task may fail):** FAIL ({len(failed_tasks)} tasks failed/incomplete)")


if __name__ == "__main__":
    main()
