#!/usr/bin/env python3
"""
Collect all Harbor scores (existing + new) and generate the multi-attempt
parity comparison table with mean/max threshold evaluation.
"""

import os
import json
from pathlib import Path
from statistics import mean

tasks = [
    "email-reply", "email-watch-shop", "email-washer-change", "email-writing",
    "schedule-change-request", "flight-info-change-notice",
    "flight-seat-selection", "flight-seat-selection-failed", "flight-cancel-claim"
]

def collect_scores(root_dir):
    scores = {t: [] for t in tasks}
    if not os.path.exists(root_dir):
        return scores
    for root, dirs, files in os.walk(root_dir):
        if "reward.txt" in files:
            for task in tasks:
                if f"/{task}__" in root or f"/{task}_" in root:
                    try:
                        with open(f"{root}/reward.txt") as f:
                            score = float(f.read().strip())
                            scores[task].append(score)
                    except:
                        pass
    return scores

# Collect from all known locations
migrated = {t: [] for t in tasks}
baseline = {t: [] for t in tasks}

worktree = "/Users/swordfaith/Documents/workspace/ClawBench/LiveClawBench/.claude/worktrees/plan3-spec-refine"
main = "/Users/swordfaith/Documents/workspace/ClawBench/LiveClawBench"

# Migrated sources
for src in [f"{worktree}/jobs", f"{worktree}/jobs-migrated", f"{worktree}/jobs-migrated-round6"]:
    s = collect_scores(src)
    for t in tasks:
        migrated[t].extend(s[t])

# Baseline sources
for src in [f"{main}/jobs-baseline", f"{main}/jobs-baseline-round6"]:
    s = collect_scores(src)
    for t in tasks:
        baseline[t].extend(s[t])

# Generate table
print("# Multi-Attempt Harbor Parity Comparison")
print("")
print("| Task | Migrated Scores | Baseline Scores | M Mean | B Mean | M Max | B Max | Mean Delta | Max Delta | Mean Pass | Max Pass |")
print("|------|-----------------|-----------------|--------|--------|-------|-------|------------|-----------|-----------|----------|")

all_mean_pass = True
all_max_pass = True

for task in tasks:
    ms = migrated[task]
    bs = baseline[task]
    m_mean = mean(ms) if ms else "N/A"
    b_mean = mean(bs) if bs else "N/A"
    m_max = max(ms) if ms else "N/A"
    b_max = max(bs) if bs else "N/A"

    if ms and bs:
        mean_delta = round(float(m_mean) - float(b_mean), 3)
        max_delta = round(float(m_max) - float(b_max), 3)
        mean_pass = "PASS" if float(m_mean) >= float(b_mean) - 0.1 else "FAIL"
        max_pass = "PASS" if float(m_max) >= float(b_max) - 0.5 else "FAIL"
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

    print(f"| {task} | {ms} | {bs} | {m_mean} | {b_mean} | {m_max} | {b_max} | {mean_delta} | {max_delta} | {mean_pass} | {max_pass} |")

print("")
print(f"**Mean threshold pass (mean(Bun) >= mean(Flask) - 0.1):** {'ALL PASS' if all_mean_pass else 'PENDING/FAIL'}")
print(f"**Max threshold pass (max(Bun) >= max(Flask) - 0.5):** {'ALL PASS' if all_max_pass else 'PENDING/FAIL'}")
