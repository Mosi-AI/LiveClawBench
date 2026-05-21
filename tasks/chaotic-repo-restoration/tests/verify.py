#!/usr/bin/env python3
"""
Verification script for chaotic-repo-restoration task.

Scoring criteria (total 1.0):
  1. Test pass rate (pytest)                     -> 0.50
  2. Junk file cleanup accuracy                  -> 0.15
  3. Dependency config correctness               -> 0.15
  4. Restoration report quality                   -> 0.20
"""

import json
import os
import subprocess
import sys

CODEBASE = "/workspace/codebase"
GOLDEN = "/workspace/environment/.golden"


def run_cmd(cmd, timeout=60, cwd=None):
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout, cwd=cwd
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def check_tests():
    """Run pytest and compute pass rate."""
    # Try multiple test locations
    for test_dir in ["tests", "test_archive", "."]:
        test_path = os.path.join(CODEBASE, test_dir)
        if test_dir == ".":
            rc, stdout, stderr = run_cmd(
                "python3 -m pytest -v --tb=short 2>&1", timeout=60, cwd=CODEBASE
            )
        else:
            if not os.path.isdir(test_path):
                continue
            rc, stdout, stderr = run_cmd(
                f"python3 -m pytest {test_dir}/ -v --tb=short 2>&1",
                timeout=60,
                cwd=CODEBASE,
            )

        # Count pass/fail
        output = stdout + "\n" + stderr
        passed = output.count(" PASSED")
        failed = output.count(" FAILED") + output.count(" ERROR")

        if passed + failed > 0:
            total = passed + failed
            rate = passed / total
            score = rate * 0.50
            print(
                f"Tests: {passed}/{total} passed (rate={rate:.1%}, score={score:.3f}/0.50)"
            )
            return score

    print("FAIL: No tests found or all tests errored")
    return 0.0


def check_junk_cleanup():
    """Check if junk files were removed and original files preserved."""
    with open(os.path.join(GOLDEN, "golden_checksums.json")) as f:
        golden = json.load(f)
    with open(os.path.join(GOLDEN, "injection_manifest.json")) as f:
        manifest = json.load(f)

    junk_files = manifest["junk_files"]
    junk_removed = 0
    for jf in junk_files:
        if not os.path.exists(os.path.join(CODEBASE, jf)):
            junk_removed += 1

    # Check original files still exist (with possibly modified content — that's ok)
    original_kept = 0
    original_files = [f for f in golden.keys() if not f.startswith("tests/")]
    for of in original_files:
        if os.path.exists(os.path.join(CODEBASE, of)):
            original_kept += 1

    total_junk = len(junk_files)
    total_orig = len(original_files)

    junk_rate = junk_removed / total_junk if total_junk > 0 else 1.0
    keep_rate = original_kept / total_orig if total_orig > 0 else 1.0

    score = 0.15 * (0.5 * junk_rate + 0.5 * keep_rate)
    print(
        f"Cleanup: {junk_removed}/{total_junk} junk removed, {original_kept}/{total_orig} originals kept (score={score:.3f}/0.15)"
    )
    return score


def check_deps():
    """Check dependency config correctness."""
    score = 0.0

    # Check pip install -e . works
    rc, stdout, stderr = run_cmd(
        "pip install --break-system-packages -e . 2>&1", timeout=30, cwd=CODEBASE
    )
    if rc == 0:
        score += 0.075
        print("PASS: pip install -e . succeeded")
    else:
        print(f"FAIL: pip install -e . failed (rc={rc})")

    # Check requirements.txt doesn't have fake packages
    req_path = os.path.join(CODEBASE, "requirements.txt")
    if os.path.exists(req_path):
        with open(req_path) as f:
            content = f.read()
        if "fake-nonexistent" not in content.lower():
            score += 0.075
            print("PASS: requirements.txt cleaned of fake packages")
        else:
            print("FAIL: requirements.txt still has fake packages")
    else:
        score += 0.04  # partial — file missing but not critical
        print("INFO: requirements.txt not found")

    print(f"Deps score: {score:.3f}/0.15")
    return score


def check_report():
    """Check restoration report quality."""
    report_path = "/workspace/output/restoration_report.md"
    if not os.path.exists(report_path):
        print("FAIL: restoration_report.md not found")
        return 0.0

    with open(report_path) as f:
        content = f.read()

    score = 0.0

    # Exists
    score += 0.06

    # Word count
    words = len(content.split())
    if words >= 200:
        score += 0.06
        print(f"PASS: Report has {words} words")
    elif words >= 100:
        score += 0.03
        print(f"PARTIAL: Report has {words} words (need ≥200)")
    else:
        print(f"FAIL: Report too short ({words} words)")

    # Keyword coverage
    keywords = ["swap", "junk", "syntax", "test", "config", "fix", "remove", "move"]
    found = sum(1 for kw in keywords if kw.lower() in content.lower())
    kw_score = min(found / 4, 1.0) * 0.08
    score += kw_score
    print(f"Report keywords: {found}/{len(keywords)} detected")

    print(f"Report score: {score:.3f}/0.20")
    return score


def main():
    scores = {}
    scores["tests"] = check_tests()
    scores["cleanup"] = check_junk_cleanup()
    scores["deps"] = check_deps()
    scores["report"] = check_report()

    total = sum(scores.values())
    print(f"\nScore: {total:.2f}/1.0")

    try:
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(
                {
                    "reward": round(total, 2),
                    **{k: round(v, 3) for k, v in scores.items()},
                },
                f,
                indent=2,
            )
    except Exception:
        pass

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
