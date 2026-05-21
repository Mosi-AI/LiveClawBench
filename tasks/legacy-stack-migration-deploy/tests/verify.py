#!/usr/bin/env python3
"""
Verification for legacy-stack-migration-deploy task (elevated difficulty v2).

Gate check (must pass for any score):
  - pip install climate-tools succeeds in a fresh venv

Scored dimensions (1.0 total, only evaluated if gate passes):
  - import_call     (0.35): import and basic function call works
  - edge_cases      (0.35): Py2→Py3 edge cases (bytes/str, empty list, float division)
  - pypi_alive      (0.15): PyPI server responds on :8080
  - package_listed  (0.15): climate-tools visible in PyPI listing
"""

import json
import os
import subprocess
import sys


def run_cmd(cmd, timeout=60):
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
    """Check agent performed migration work."""
    indicators = []

    rc, out, _ = run_cmd(
        "find /workspace/climate_tools -name '*.py' -newer /workspace/climate_tools/setup.py 2>/dev/null | head -5"
    )
    if rc == 0 and out:
        indicators.append("modified_source")

    for path in ["/workspace/climate_tools/dist", "/workspace/climate_tools/build"]:
        if os.path.exists(path):
            indicators.append("build_artifacts")
            break

    rc, out, _ = run_cmd("curl -s http://localhost:8080/simple/ 2>/dev/null")
    if rc == 0 and "climate" in out.lower():
        indicators.append("pypi_package")

    if len(indicators) < 1:
        print(f"BASELINE GUARD: No agent activity detected ({indicators})")
        print("Score: 0.00/1.0")
        sys.exit(1)

    print(f"BASELINE GUARD: Agent activity confirmed ({indicators})")


# === Gate check ===============================================================


def gate_pip_install() -> bool:
    """pip install climate-tools must succeed in a fresh venv."""
    cmds = """
    python3 -m venv /tmp/test_venv && \
    /tmp/test_venv/bin/pip install --index-url http://localhost:8080/simple/ \
        --trusted-host localhost climate-tools 2>&1
    """
    rc, stdout, stderr = run_cmd(cmds, timeout=60)
    combined = stdout + stderr
    if rc == 0 and "Successfully installed" in combined:
        print("GATE PASS [pip_install]: pip install climate-tools succeeded")
        return True
    if "climate" in combined.lower() and rc == 0:
        print(
            "GATE PASS [pip_install]: pip install completed (no explicit success msg)"
        )
        return True
    print(f"GATE FAIL [pip_install]: pip install failed (rc={rc})")
    return False


# === Scored dimensions ========================================================


def check_import_and_call() -> float:
    """Import and basic function call (scored 0-1)."""
    test_cmd = """
/tmp/test_venv/bin/python3 -c "
from climate_tools import analyze_temperature
result = analyze_temperature([20, 22, 19, 25, 23])
assert abs(result['mean'] - 21.8) < 0.01, f'mean mismatch: {result}'
assert result['count'] == 5
assert result['min'] == 19
assert result['max'] == 25
print('IMPORT_AND_CALL_OK')
"
"""
    rc, stdout, stderr = run_cmd(test_cmd, timeout=15)
    if rc == 0 and "IMPORT_AND_CALL_OK" in stdout:
        print("  import_call: 1.00 (import + basic call OK)")
        return 1.0

    # Try just import
    test_import = "/tmp/test_venv/bin/python3 -c \"from climate_tools import analyze_temperature; print('IMPORT_OK')\""
    rc2, stdout2, _ = run_cmd(test_import, timeout=10)
    if rc2 == 0 and "IMPORT_OK" in stdout2:
        print(f"  import_call: 0.40 (import OK but call failed: {stderr[:100]})")
        return 0.40

    print(f"  import_call: 0.00 (import failed: {stderr[:100]})")
    return 0.0


def check_edge_cases() -> float:
    """Py2 to Py3 edge cases: bytes/str, empty list, single element, float division, negative numbers (scored 0-1)."""
    test_cmd = r"""
/tmp/test_venv/bin/python3 -c "
import sys
score = 0
total = 5

# Test 1: Basic numeric result types
try:
    from climate_tools import analyze_temperature
    result = analyze_temperature([0, 10, 20, 30, 40])
    assert isinstance(result['mean'], (int, float)), 'mean should be numeric'
    assert result['mean'] == 20.0
    score += 1
except Exception as e:
    print(f'Edge case 1 (numeric types) failed: {e}')

# Test 2: Empty list handling
try:
    result = analyze_temperature([])
    score += 1
except ZeroDivisionError:
    print('Edge case 2 (empty list) failed: ZeroDivisionError')
except (ValueError, TypeError):
    score += 1  # Clear error is acceptable

# Test 3: Single element
try:
    result = analyze_temperature([42])
    assert result['min'] == 42
    assert result['max'] == 42
    assert result['count'] == 1
    score += 1
except Exception as e:
    print(f'Edge case 3 (single element) failed: {e}')

# Test 4: Float division precision
try:
    result = analyze_temperature([1, 2])
    assert abs(result['mean'] - 1.5) < 0.001, f'Expected 1.5, got {result.get(\"mean\")}'
    score += 1
except Exception as e:
    print(f'Edge case 4 (float division) failed: {e}')

# Test 5: Negative numbers
try:
    result = analyze_temperature([-10, -5, 0, 5, 10])
    assert result['min'] == -10
    assert result['max'] == 10
    assert abs(result['mean'] - 0.0) < 0.01
    score += 1
except Exception as e:
    print(f'Edge case 5 (negative numbers) failed: {e}')

print(f'{score}/{total}')
"
"""
    rc, stdout, stderr = run_cmd(test_cmd, timeout=15)
    if rc == 0 and "/" in stdout:
        parts = stdout.strip().split("\n")[-1].split("/")
        try:
            passed = int(parts[0])
            total = int(parts[1])
            rate = passed / total
            print(f"  edge_cases: {rate:.2f} ({passed}/{total} passed)")
            return rate
        except (ValueError, IndexError):
            pass
    print(f"  edge_cases: 0.00 (test script failed rc={rc})")
    return 0.0


def check_pypi_alive() -> float:
    """PyPI server responds on :8080 (scored 0-1)."""
    rc, stdout, _ = run_cmd(
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/simple/"
    )
    if rc == 0 and stdout in ("200", "301", "302"):
        print("  pypi_alive: 1.00 (PyPI alive on :8080)")
        return 1.0
    rc2, stdout2, _ = run_cmd(
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/"
    )
    if rc2 == 0 and stdout2 in ("200", "301", "302"):
        print("  pypi_alive: 1.00 (PyPI alive on :8080 root)")
        return 1.0
    print(f"  pypi_alive: 0.00 (PyPI not responding, status={stdout})")
    return 0.0


def check_package_listed() -> float:
    """climate-tools visible in PyPI simple index (scored 0-1)."""
    rc, stdout, _ = run_cmd("curl -s http://localhost:8080/simple/")
    if rc == 0 and "climate" in stdout.lower():
        print("  package_listed: 1.00 (climate-tools in listing)")
        return 1.0
    rc2, stdout2, _ = run_cmd("curl -s http://localhost:8080/simple/climate-tools/")
    if rc2 == 0 and (".whl" in stdout2 or ".tar.gz" in stdout2):
        print("  package_listed: 1.00 (package files found)")
        return 1.0
    print("  package_listed: 0.00 (climate-tools not found)")
    return 0.0


def main():
    baseline_guard()

    # === Gate check ===========================================================
    if not gate_pip_install():
        print("\nGATE FAILURE: pip install failed")
        print("Score: 0.00/1.0")
        try:
            os.makedirs("/logs/verifier", exist_ok=True)
            with open("/logs/verifier/reward.json", "w") as f:
                json.dump({"reward": 0.0, "gate_pip_install": 0}, f, indent=2)
        except Exception:
            pass
        sys.exit(1)

    print("\nGate passed — scoring dimensions...\n")

    # === Scored dimensions ====================================================
    weights = {
        "import_call": 0.35,
        "edge_cases": 0.35,
        "pypi_alive": 0.15,
        "package_listed": 0.15,
    }

    raw_scores = {}
    raw_scores["import_call"] = check_import_and_call()
    raw_scores["edge_cases"] = check_edge_cases()
    raw_scores["pypi_alive"] = check_pypi_alive()
    raw_scores["package_listed"] = check_package_listed()

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
            "gate_pip_install": 1,
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
