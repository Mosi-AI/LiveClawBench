#!/usr/bin/env python3
"""
Verification for package-build-publish task.

Scoring (total 1.0):
  1. pytest passes (0 failures)                     -> 0.25
  2. PyPI server lists vectorops                     -> 0.20
  3. pip install succeeds from local PyPI            -> 0.25
  4. import and basic function call works            -> 0.30
"""

import json
import os
import subprocess
import sys
import urllib.request


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


def http_get(url, timeout=5):
    try:
        resp = urllib.request.urlopen(url, timeout=timeout)
        return resp.status, resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)


def check_pytest():
    """Run pytest in vectorops directory."""
    rc, out, err = run_cmd(
        "python3 -m pytest tests/ -v --tb=short 2>&1",
        timeout=30,
        cwd="/workspace/vectorops",
    )
    combined = out + "\n" + err

    if rc == 0 and "passed" in combined.lower():
        print("PASS: pytest all passed")
        return 0.25
    elif "passed" in combined.lower():
        # Partial
        import re

        m = re.search(r"(\d+)\s+passed", combined)
        f_match = re.search(r"(\d+)\s+failed", combined)
        passed = int(m.group(1)) if m else 0
        failed = int(f_match.group(1)) if f_match else 0
        total = passed + failed
        if total > 0:
            rate = passed / total
            score = 0.25 * rate
            print(f"PARTIAL: pytest {passed}/{total} passed (score={score:.3f})")
            return score
        return 0.0
    else:
        # Check if tests even exist
        test_file = "/workspace/vectorops/tests/test_core.py"
        if os.path.exists(test_file):
            with open(test_file) as f:
                content = f.read()
            if "def test_" in content:
                print("PARTIAL: Tests exist but pytest failed to run")
                return 0.05
        print(f"FAIL: pytest failed (rc={rc})")
        return 0.0


def check_pypi_listing():
    """Check PyPI server has vectorops listed."""
    code, body = http_get("http://localhost:8080/simple/vectorops/")
    if code == 200 and "vectorops" in body.lower():
        print("PASS: vectorops listed on PyPI server")
        return 0.20
    elif code == 200:
        print("PARTIAL: PyPI responds but vectorops not clearly listed")
        return 0.10
    else:
        # Try alternative URL
        code2, body2 = http_get("http://localhost:8080/simple/")
        if code2 == 200 and "vectorops" in body2.lower():
            print("PASS: vectorops found in PyPI index")
            return 0.20
        print(
            f"FAIL: PyPI server not responding or vectorops not listed (status={code})"
        )
        return 0.0


def check_pip_install():
    """Check pip install from local PyPI works."""
    # Create temp venv
    rc, _, _ = run_cmd("python3 -m venv /tmp/test_venv")
    if rc != 0:
        print("FAIL: Could not create test venv")
        return 0.0

    rc, out, err = run_cmd(
        "/tmp/test_venv/bin/pip install --index-url http://localhost:8080/simple/ "
        "--trusted-host localhost vectorops 2>&1",
        timeout=30,
    )
    if rc == 0:
        print("PASS: pip install vectorops succeeded")
        return 0.25
    else:
        print(f"FAIL: pip install failed (rc={rc})")
        return 0.0


def check_import_and_use():
    """Check import and basic function call."""
    # Test in the venv we just created
    test_code = """
import sys
sys.path.insert(0, '/workspace/vectorops')
from vectorops import dot_product, magnitude, vector_add, normalize, cosine_similarity, cross_product

score = 0
total = 6

try:
    assert dot_product([1, 0], [0, 1]) == 0.0
    score += 1
except: pass

try:
    assert abs(magnitude([3, 4]) - 5.0) < 0.001
    score += 1
except: pass

try:
    assert vector_add([1, 2], [3, 4]) == [4, 6]
    score += 1
except: pass

try:
    n = normalize([3, 4])
    assert abs(n[0] - 0.6) < 0.01 and abs(n[1] - 0.8) < 0.01
    score += 1
except: pass

try:
    assert abs(cosine_similarity([1, 0], [0, 1])) < 0.001
    score += 1
except: pass

try:
    assert cross_product([1, 0, 0], [0, 1, 0]) == [0, 0, 1]
    score += 1
except: pass

print(f"{score}/{total}")
"""
    rc, out, err = run_cmd(f'python3 -c "{test_code}"', timeout=10)

    if rc == 0 and "/" in out:
        parts = out.strip().split("/")
        passed = int(parts[0])
        total = int(parts[1])
        rate = passed / total
        score = 0.30 * rate
        print(f"Functions: {passed}/{total} work correctly (score={score:.3f}/0.30)")
        return score
    else:
        print(f"FAIL: Import/function test failed (rc={rc})")
        return 0.0


def main():
    scores = {}
    scores["pytest"] = check_pytest()
    scores["pypi_listing"] = check_pypi_listing()
    scores["pip_install"] = check_pip_install()
    scores["import_use"] = check_import_and_use()

    total = sum(scores.values())
    print(f"\nScore: {total:.2f}/1.0")

    try:
        os.makedirs("/logs/verifier", exist_ok=True)
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
