#!/usr/bin/env python3
"""
verify.py — Verifier for security-audit-remediation task (elevated difficulty v2).

Gate check (must pass for any score):
  - Credentials rotated: all old secrets removed from source files

Scored dimensions (1.0 total, only evaluated if gate passes):
  - git_history_clean (0.35): no leaked secrets in any git commit
  - security_tests    (0.30): all CWE-class tests pass
  - report_quality    (0.35): covers vuln categories + fix strategy
"""

import json
import os
import re
import subprocess
import sys

WEBAPP_DIR = "/workspace/webapp"

# Note: secrets are split via string concatenation so the literals do not appear
# in source (GitHub push protection would block them). Python folds adjacent
# literal concatenations at compile time, so the runtime values are identical
# to the full secrets.
LEAKED_SECRETS = [
    "sk_" + "live_4eC39HqLyjWDarjtT1zdp7dc",
    "super_secret_db_pass_2026",
    "jwt-hardcoded-secret-never-do-this",
    "AKIA" + "IOSFODNN7EXAMPLE",
    "wJalrXUtnFEMI" + "/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "tok_" + "live_payment_gateway_2026_secret",
]


def run_cmd(cmd, timeout=30):
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def baseline_guard():
    """Check agent performed audit/fix work."""
    indicators = []

    rc, out, _ = run_cmd("git -C /workspace/webapp log --oneline -10 2>/dev/null")
    if rc == 0 and len(out.strip().split("\n")) > 1:
        indicators.append("git_commits")

    for path in [
        "/workspace/output/remediation_report.md",
        "/workspace/output/report.md",
        "/workspace/remediation_report.md",
    ]:
        if os.path.exists(path):
            indicators.append("report")
            break

    rc, out, _ = run_cmd("git -C /workspace/webapp diff --stat HEAD~1 2>/dev/null")
    if rc == 0 and out:
        indicators.append("source_modified")

    if len(indicators) < 1:
        print("BASELINE GUARD: No agent activity detected")
        print("Score: 0.00/1.0")
        sys.exit(1)

    print(f"BASELINE GUARD: Agent activity confirmed ({indicators})")


# === Gate check ===============================================================


def gate_credentials_rotated() -> bool:
    """All old secrets must be removed from current source files."""
    files_to_check = [
        os.path.join(WEBAPP_DIR, "app.py"),
        os.path.join(WEBAPP_DIR, "config.py"),
    ]

    total_checks = 0
    remaining_secrets = []

    for filepath in files_to_check:
        if not os.path.exists(filepath):
            continue
        with open(filepath) as f:
            content = f.read()
        for secret in LEAKED_SECRETS:
            total_checks += 1
            if secret in content:
                remaining_secrets.append(secret[:20] + "...")

    if total_checks == 0:
        print("GATE FAIL [credentials]: No source files found to check")
        return False

    if len(remaining_secrets) == 0:
        print("GATE PASS [credentials]: All old secrets removed from source")
        return True

    print(
        f"GATE FAIL [credentials]: {len(remaining_secrets)}/{total_checks} secrets still in source"
    )
    return False


# === Scored dimensions ========================================================


def check_git_history_clean() -> float:
    """No leaked secrets in git history (scored 0-1)."""
    try:
        result = subprocess.run(
            ["git", "-C", WEBAPP_DIR, "log", "-p", "--all", "--full-history"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        full_log = result.stdout

        found_secrets = []
        for secret in LEAKED_SECRETS:
            if secret in full_log:
                found_secrets.append(secret[:20] + "...")

        if not found_secrets:
            print("  git_history_clean: 1.00 (no secrets in history)")
            return 1.0

        leaked_count = len(found_secrets)
        total_count = len(LEAKED_SECRETS)
        cleaned = total_count - leaked_count
        ratio = cleaned / total_count
        # Cap at 0.70 if any remain (still in history = still a risk)
        final = round(ratio * 0.70, 2)
        print(
            f"  git_history_clean: {final} ({leaked_count}/{total_count} secrets still in history)"
        )
        return final

    except Exception as e:
        print(f"  git_history_clean: 0.00 (error: {e})")
        return 0.0


def check_security_tests() -> float:
    """Run security tests from verifier-only copy (scored 0-1)."""
    test_file = os.path.join(os.path.dirname(__file__), "test_security.py")
    if not os.path.exists(test_file):
        test_file = os.path.join(WEBAPP_DIR, "tests", "test_security.py")

    if not os.path.exists(test_file):
        print("  security_tests: 0.00 (test file not found)")
        return 0.0

    try:
        result = subprocess.run(
            ["python3", "-m", "pytest", test_file, "-v", "--tb=short"],
            capture_output=True,
            text=True,
            cwd=WEBAPP_DIR,
            timeout=60,
        )
        output = result.stdout + result.stderr

        passed_match = re.search(r"(\d+) passed", output)
        failed_match = re.search(r"(\d+) failed", output)

        passed = int(passed_match.group(1)) if passed_match else 0
        failed = int(failed_match.group(1)) if failed_match else 0
        total = passed + failed

        if total == 0:
            print("  security_tests: 0.00 (no tests collected)")
            return 0.0

        ratio = passed / total
        if ratio == 1.0:
            print(f"  security_tests: 1.00 (all {total} tests passed)")
        else:
            print(f"  security_tests: {ratio:.2f} ({passed}/{total} passed)")
        return round(ratio, 2)

    except Exception as e:
        print(f"  security_tests: 0.00 (error: {e})")
        return 0.0


def check_report_quality() -> float:
    """Report must cover vuln types + fix details (scored 0-1)."""
    report_path = None
    for path in [
        "/workspace/output/remediation_report.md",
        "/workspace/output/remediation-report.md",
        "/workspace/output/report.md",
        "/workspace/remediation_report.md",
    ]:
        if os.path.exists(path):
            report_path = path
            break

    if report_path is None:
        output_dir = "/workspace/output"
        if os.path.isdir(output_dir):
            for fname in os.listdir(output_dir):
                if fname.endswith(".md") or fname.endswith(".txt"):
                    report_path = os.path.join(output_dir, fname)
                    break

    if report_path is None:
        print("  report_quality: 0.00 (no report found)")
        return 0.0

    with open(report_path) as f:
        content = f.read()

    word_count = len(content.split())
    content_lower = content.lower()

    if word_count < 50:
        print(f"  report_quality: 0.00 (too short: {word_count} words)")
        return 0.0

    score = 0.0

    # Word count tier
    if word_count >= 200:
        score += 0.3
    elif word_count >= 100:
        score += 0.2
    else:
        score += 0.1

    # Vulnerability categories coverage
    vuln_categories = {
        "injection": [
            "sql injection",
            "sqli",
            "inject",
            "parameterized",
            "prepared statement",
        ],
        "xss": [
            "xss",
            "cross-site scripting",
            "cross site scripting",
            "escap",
            "sanitiz",
        ],
        "hardcoded_secrets": ["hardcod", "credential", "secret", "api key", "password"],
        "git_history": ["git history", "git log", "rebase", "filter-branch", "bfg"],
    }

    categories_found = 0
    for cat_name, keywords in vuln_categories.items():
        if any(kw in content_lower for kw in keywords):
            categories_found += 1

    if categories_found >= 4:
        score += 0.7
    elif categories_found >= 3:
        score += 0.5
    elif categories_found >= 2:
        score += 0.3
    else:
        score += 0.1

    final = min(score, 1.0)
    print(
        f"  report_quality: {final:.2f} ({word_count} words, {categories_found}/4 vuln categories)"
    )
    return final


def main():
    baseline_guard()

    # === Gate check ===========================================================
    if not gate_credentials_rotated():
        print("\nGATE FAILURE: Credentials not fully rotated")
        print("Score: 0.00/1.0")
        os.makedirs("/logs/verifier", exist_ok=True)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump({"reward": 0.0, "gate_credentials_rotated": 0}, f, indent=2)
        sys.exit(1)

    print("\nGate passed — scoring dimensions...\n")

    # === Scored dimensions ====================================================
    weights = {
        "git_history_clean": 0.35,
        "security_tests": 0.30,
        "report_quality": 0.35,
    }

    raw_scores = {}
    raw_scores["git_history_clean"] = check_git_history_clean()
    raw_scores["security_tests"] = check_security_tests()
    raw_scores["report_quality"] = check_report_quality()

    total = sum(raw_scores[k] * weights[k] for k in weights)
    total = round(total, 2)

    print("\n=== Score Breakdown ===")
    for key, weight in weights.items():
        s = raw_scores[key]
        print(f"  {key}: {s:.2f} x {weight:.2f} = {s * weight:.3f}")
    print(f"\nScore: {total}/1.0")

    os.makedirs("/logs/verifier", exist_ok=True)
    reward_data = {
        "reward": total,
        "gate_credentials_rotated": 1,
    }
    for key, weight in weights.items():
        reward_data[key] = round(raw_scores[key] * weight, 3)
    with open("/logs/verifier/reward.json", "w") as f:
        json.dump(reward_data, f, indent=2)

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
