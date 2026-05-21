#!/usr/bin/env python3
"""
Verification for log-triage-incident-report task (elevated difficulty v2).

Gate check (must pass for any score):
  - Root cause basic: report mentions database/connection issues

Scored dimensions (1.0 total, only evaluated if gate passes):
  - timeline        (0.35): causal ordering DB → App → Frontend
  - evidence        (0.20): log line citations (timestamps, levels, files)
  - noise_exclusion (0.25): explicitly identifies noise/misleading errors
  - root_cause_deep (0.20): trigger + mechanism + propagation path
"""

import json
import os
import re
import sys

REPORT_PATH = "/workspace/output/incident_report.md"


def baseline_guard():
    if not os.path.exists(REPORT_PATH):
        print("BASELINE GUARD: No report found — agent did not produce output")
        print("Score: 0.00/1.0")
        sys.exit(1)
    with open(REPORT_PATH) as f:
        content = f.read()
    if len(content.split()) < 30:
        print("BASELINE GUARD: Report too short to be meaningful")
        print("Score: 0.00/1.0")
        sys.exit(1)
    print("BASELINE GUARD: Report found")


# === Gate check ===============================================================


def gate_root_cause_basic() -> bool:
    """Report must mention database or connection-related root cause."""
    with open(REPORT_PATH) as f:
        content = f.read().lower()

    db_keywords = [
        "database",
        "db",
        "postgresql",
        "postgres",
        "connection",
        "sql",
        "query",
        "connection pool",
    ]
    if any(kw in content for kw in db_keywords):
        print("GATE PASS [root_cause]: Database-related root cause mentioned")
        return True

    print("GATE FAIL [root_cause]: No database-related root cause found")
    return False


# === Scored dimensions ========================================================


def check_timeline() -> float:
    """Causal ordering: DB problem → App cascading failure → Frontend errors (scored 0-1)."""
    with open(REPORT_PATH) as f:
        content = f.read().lower()

    # Find positions of causal layers
    db_pos = len(content)
    app_pos = len(content)
    nginx_pos = len(content)

    for marker in [
        "database",
        "db",
        "postgresql",
        "connection pool",
        "max_connection",
        "slow query",
    ]:
        pos = content.find(marker)
        if pos != -1 and pos < db_pos:
            db_pos = pos

    for marker in [
        "app server",
        "application",
        "timeout",
        "sqlalchemy",
        "flask",
        "api",
    ]:
        pos = content.find(marker)
        if pos != -1 and pos < app_pos and pos != db_pos:
            app_pos = pos

    for marker in ["nginx", "502", "bad gateway", "frontend", "upstream"]:
        pos = content.find(marker)
        if pos != -1 and pos < nginx_pos:
            nginx_pos = pos

    if db_pos < len(content) and app_pos < len(content) and nginx_pos < len(content):
        if db_pos < app_pos < nginx_pos:
            print("  timeline: 1.00 (DB → App → Nginx correct order)")
            return 1.0
        elif db_pos < nginx_pos:
            print("  timeline: 0.60 (DB before Nginx but App order unclear)")
            return 0.60
        else:
            print("  timeline: 0.25 (events found but order incorrect)")
            return 0.25
    elif db_pos < len(content) and (app_pos < len(content) or nginx_pos < len(content)):
        print("  timeline: 0.40 (incomplete timeline)")
        return 0.40
    else:
        print("  timeline: 0.00 (timeline events not found)")
        return 0.0


def check_evidence_citation() -> float:
    """Check report cites specific log entries as evidence (scored 0-1)."""
    with open(REPORT_PATH) as f:
        content = f.read()

    timestamp_pattern = r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"
    log_level_pattern = r"(ERROR|WARN|WARNING|INFO|CRITICAL|FATAL)\s"
    log_file_pattern = r"([\w/]+\.log|access\.log|error\.log|app\.log|db\.log)"

    timestamps_found = len(re.findall(timestamp_pattern, content))
    log_levels = len(re.findall(log_level_pattern, content, re.IGNORECASE))
    log_files = len(re.findall(log_file_pattern, content))

    evidence_score = 0.0
    if timestamps_found >= 3:
        evidence_score += 1.0
    elif timestamps_found >= 1:
        evidence_score += 0.5

    if log_levels >= 2:
        evidence_score += 0.5

    if log_files >= 1:
        evidence_score += 0.5

    rate = min(evidence_score / 2.0, 1.0)
    print(
        f"  evidence: {rate:.2f} ({timestamps_found} timestamps, {log_levels} log levels, {log_files} log refs)"
    )
    return rate


def check_noise_exclusion() -> float:
    """Check report correctly identifies noise/misleading errors (scored 0-1)."""
    with open(REPORT_PATH) as f:
        content = f.read().lower()

    noise_awareness_terms = [
        "noise",
        "misleading",
        "red herring",
        "not.*root cause",
        "symptom",
        "downstream",
        "consequen",
        "secondary",
        "distract",
        "false alarm",
    ]

    noise_found = 0
    for term in noise_awareness_terms:
        if re.search(term, content):
            noise_found += 1

    if noise_found >= 3:
        print(f"  noise_exclusion: 1.00 ({noise_found} noise-awareness terms)")
        return 1.0
    elif noise_found >= 2:
        print(f"  noise_exclusion: 0.70 ({noise_found} noise-awareness terms)")
        return 0.70
    elif noise_found >= 1:
        print(f"  noise_exclusion: 0.40 ({noise_found} noise-awareness terms)")
        return 0.40
    else:
        if "cause" in content and "effect" in content:
            print("  noise_exclusion: 0.20 (cause/effect mentioned)")
            return 0.20
        print("  noise_exclusion: 0.00 (no noise awareness)")
        return 0.0


def check_root_cause_deep() -> float:
    """Stricter root cause: must identify trigger + mechanism + propagation (scored 0-1)."""
    with open(REPORT_PATH) as f:
        content = f.read().lower()

    components = 0

    # Trigger: analytics/slow query
    trigger_kw = [
        "analytics",
        "slow query",
        "heavy query",
        "long.*query",
        "report.*query",
        "batch.*process",
    ]
    if any(re.search(kw, content) for kw in trigger_kw):
        components += 1

    # Mechanism: connection pool exhaustion
    mechanism_kw = [
        "connection pool",
        "max_connection",
        "connection limit",
        "connection exhaust",
        "too many connection",
    ]
    if any(re.search(kw, content) for kw in mechanism_kw):
        components += 1

    # Propagation: cascading to app/frontend
    propagation_kw = [
        "cascad",
        "propagat",
        "spread",
        "downstream.*fail",
        "resulte?d? in",
        "led to",
        "caused.*timeout",
        "caused.*502",
    ]
    if any(re.search(kw, content) for kw in propagation_kw):
        components += 1

    if components >= 3:
        print("  root_cause_deep: 1.00 (trigger + mechanism + propagation)")
        return 1.0
    elif components == 2:
        print(f"  root_cause_deep: 0.60 ({components}/3 components)")
        return 0.60
    elif components == 1:
        print(f"  root_cause_deep: 0.30 ({components}/3 components)")
        return 0.30
    else:
        print("  root_cause_deep: 0.00 (no deep root cause analysis)")
        return 0.0


def main():
    baseline_guard()

    # === Gate check ===========================================================
    if not gate_root_cause_basic():
        print("\nGATE FAILURE: Root cause not identified")
        print("Score: 0.00/1.0")
        try:
            os.makedirs("/logs/verifier", exist_ok=True)
            with open("/logs/verifier/reward.json", "w") as f:
                json.dump({"reward": 0.0, "gate_root_cause_basic": 0}, f, indent=2)
        except Exception:
            pass
        sys.exit(1)

    print("\nGate passed — scoring dimensions...\n")

    # === Scored dimensions ====================================================
    weights = {
        "timeline": 0.35,
        "evidence": 0.20,
        "noise_exclusion": 0.25,
        "root_cause_deep": 0.20,
    }

    raw_scores = {}
    raw_scores["timeline"] = check_timeline()
    raw_scores["evidence"] = check_evidence_citation()
    raw_scores["noise_exclusion"] = check_noise_exclusion()
    raw_scores["root_cause_deep"] = check_root_cause_deep()

    total = sum(raw_scores[k] * weights[k] for k in weights)
    total = round(total, 2)

    print("\n=== Score Breakdown ===")
    for key, weight in weights.items():
        s = raw_scores[key]
        print(f"  {key}: {s:.2f} x {weight:.2f} = {s * weight:.3f}")
    print(f"\nScore: {total}/1.0")

    try:
        os.makedirs("/logs/verifier", exist_ok=True)
        reward_data = {
            "reward": total,
            "gate_root_cause_basic": 1,
        }
        for key, weight in weights.items():
            reward_data[key] = round(raw_scores[key] * weight, 3)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_data, f, indent=2)
    except Exception:
        pass

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
