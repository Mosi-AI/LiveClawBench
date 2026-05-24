#!/usr/bin/env python3
"""Verifier for consent-flow-form-visibility-check (case_id=119).

Checks /home/node/.openclaw/workspace/signup_field_matrix.md for:
  C1: File exists and non-empty
  C2: Both "accept" and "decline" branches mentioned
  C3: All 5 always-required fields mentioned
  C4: phone correctly identified as optional (not required)
  C5: Marketing fields discovered (at least 2 of 4 variants)
  C6: Marketing fields not over-marked as required

Scoring: 6/6 -> 1.0, 3-5/6 -> 0.5, 0-2/6 -> 0.0
"""

import json
import os
import re
import sys

WORKSPACE_FILE = "/home/node/.openclaw/workspace/signup_field_matrix.md"
REWARD_TXT = "/logs/verifier/reward.txt"
REWARD_JSON = "/logs/verifier/reward.json"

REQUIRED_FIELDS = ["email", "password", "full_name", "consent_marketing", "agree_terms"]
MARKETING_VARIANTS = [
    "marketing_email",
    "marketing_sms",
    "marketing email",
    "marketing sms",
]


def check_c1(content):
    """File exists and non-empty."""
    return os.path.isfile(WORKSPACE_FILE) and os.path.getsize(WORKSPACE_FILE) > 0


def check_c2(content):
    """Both accept and decline branches documented."""
    lower = content.lower()
    return "accept" in lower and "decline" in lower


def check_c3(content):
    """All 5 always-required fields mentioned."""
    lower = content.lower()
    return all(field in lower for field in REQUIRED_FIELDS)


def check_c4(content):
    """Phone correctly identified as optional (not required)."""
    lower = content.lower()
    if "phone" not in lower:
        return False

    for line in content.split("\n"):
        if "phone" in line.lower():
            # Check this line doesn't mark phone as required
            if re.search(r"required", line, re.IGNORECASE):
                return False
            if re.search(r"[^a-zA-Z]R[^a-zA-Z]", line):
                return False
    return True


def check_c5(content):
    """At least 2 marketing field variants mentioned."""
    lower = content.lower()
    count = sum(1 for v in MARKETING_VARIANTS if v in lower)
    return count >= 2


def check_c6(content):
    """Marketing fields not over-marked as required."""
    for line in content.split("\n"):
        if "marketing" in line.lower():
            if re.search(r"required", line, re.IGNORECASE):
                return False
            if re.search(r"[^a-zA-Z]R[^a-zA-Z]", line):
                return False
    return True


def main():
    os.makedirs("/logs/verifier", exist_ok=True)

    if not os.path.isfile(WORKSPACE_FILE):
        score = 0.0
        checks_passed = 0
        details = "C1:fail(file_missing) C2:fail C3:fail C4:fail C5:fail C6:pass"
    else:
        with open(WORKSPACE_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        if len(content.strip()) == 0:
            score = 0.0
            checks_passed = 0
            details = "C1:fail(empty) C2:fail C3:fail C4:fail C5:fail C6:pass"
        else:
            results = {
                "C1": check_c1(content),
                "C2": check_c2(content),
                "C3": check_c3(content),
                "C4": check_c4(content),
                "C5": check_c5(content),
                "C6": check_c6(content),
            }
            checks_passed = sum(1 for v in results.values() if v)

            if checks_passed >= 6:
                score = 1.0
            elif checks_passed >= 3:
                score = 0.5
            else:
                score = 0.0

            details = " ".join(
                f"C{i + 1}:{'pass' if results[f'C{i + 1}'] else 'fail'}"
                for i in range(6)
            )

    with open(REWARD_TXT, "w") as f:
        f.write(str(score))

    with open(REWARD_JSON, "w") as f:
        json.dump(
            {
                "reward": score,
                "checks_passed": checks_passed,
                "_meta_check_details": details,
            },
            f,
        )

    print(f"Score: {score}/1.0")
    print(f"Checks passed: {checks_passed}/6")
    print(f"Details: {details}")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
