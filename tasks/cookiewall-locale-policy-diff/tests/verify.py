#!/usr/bin/env python3
import json
import os
import sys

WORKSPACE_FILE = "/home/node/.openclaw/workspace/policy_diff.md"
LOGS_DIR = "/logs/verifier"


def main():
    os.makedirs(LOGS_DIR, exist_ok=True)

    if not os.path.exists(WORKSPACE_FILE):
        score = 0.0
        checks_passed = 0
        source_check = "ok"
        _write_results(score, checks_passed, source_check)
        print("Score: 0.0/1.0")
        sys.exit(1)

    with open(WORKSPACE_FILE, encoding="utf-8") as f:
        content = f.read()

    c1 = "24 months" in content and "12 months" in content
    c2 = "30 days" in content and "72 hours" in content
    c3 = "Excel" in content
    c4 = "explicit consent" in content

    checks_passed = sum([c1, c2, c3, c4])

    if checks_passed == 4:
        score = 1.0
    elif checks_passed >= 1:
        score = 0.5
    else:
        score = 0.0

    source_check = "ok"
    if "/support/" in content or "/blog/" in content:
        source_check = "wrong_source_detected"
        if score > 0.5:
            score = 0.5

    _write_results(score, checks_passed, source_check)
    print(f"Score: {score}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


def _write_results(score, checks_passed, source_check):
    with open(f"{LOGS_DIR}/reward.txt", "w") as f:
        f.write(str(score))
    with open(f"{LOGS_DIR}/reward.json", "w") as f:
        json.dump(
            {
                "reward": score,
                "checks_passed": checks_passed,
                "_meta_source_check": source_check,
            },
            f,
        )


if __name__ == "__main__":
    main()
