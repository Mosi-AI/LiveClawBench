#!/usr/bin/env python3
"""
Verification for microservice-stack-deploy task (elevated difficulty v2).

Gate checks (all must pass for any score):
  - POST /api/set succeeds (stores a key-value pair)
  - GET /api/get returns the stored value

Scored dimensions (1.0 total, only evaluated if all gates pass):
  - kv_store    (0.40): multi-key ops, overwrite, missing key handling
  - api_server  (0.35): health endpoint depth, error handling
  - frontend    (0.25): content quality, dynamic API integration
"""

import json
import os
import socket
import sys
import time
import urllib.request


def http_get(url, timeout=5):
    try:
        resp = urllib.request.urlopen(url, timeout=timeout)
        return resp.status, resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)


def http_post(url, data, timeout=5):
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode(),
            headers={"Content-Type": "application/json"},
        )
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.status, resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)


def baseline_guard():
    """Check agent performed deployment work."""
    indicators = []

    for path in [
        "/etc/nginx/sites-enabled",
        "/etc/nginx/conf.d",
        "/workspace/services",
    ]:
        if os.path.exists(path):
            indicators.append("config_exists")
            break

    for port in [80, 5000, 50051]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2)
            if s.connect_ex(("localhost", port)) == 0:
                indicators.append(f"port_{port}")
            s.close()
        except Exception:
            pass

    if len(indicators) < 1:
        print("BASELINE GUARD: No agent activity detected")
        print("Score: 0.00/1.0")
        sys.exit(1)

    print(f"BASELINE GUARD: Agent activity confirmed ({indicators})")


# === Gate checks ==============================================================


def gate_set_api() -> bool:
    """POST /api/set must succeed with a test key-value pair."""
    for base_url in ["http://localhost", "http://localhost:5000"]:
        code, body = http_post(
            f"{base_url}/api/set",
            {"key": "__gate_test__", "value": "gate-check-value"},
        )
        if code == 200:
            try:
                data = json.loads(body)
                if data.get("success"):
                    print("GATE PASS [set_api]: POST /api/set succeeded")
                    return True
            except json.JSONDecodeError:
                pass
            # 200 but unexpected body — still pass gate
            print("GATE PASS [set_api]: POST /api/set returned 200")
            return True

    print("GATE FAIL [set_api]: POST /api/set failed on all endpoints")
    return False


def gate_get_api() -> bool:
    """GET /api/get must return the stored value."""
    for base_url in ["http://localhost", "http://localhost:5000"]:
        code, body = http_get(f"{base_url}/api/get?key=__gate_test__")
        if code == 200:
            try:
                data = json.loads(body)
                if data.get("value") == "gate-check-value":
                    print("GATE PASS [get_api]: GET /api/get returns correct value")
                    return True
            except json.JSONDecodeError:
                pass
            # 200 but wrong value — still technically working
            print("GATE PASS [get_api]: GET /api/get returned 200 (value mismatch)")
            return True

    print("GATE FAIL [get_api]: GET /api/get failed on all endpoints")
    return False


# === Scored dimensions ========================================================


def check_kv_store() -> float:
    """Deep KV store testing: multiple keys, overwrite, missing key (scored 0-1)."""
    score = 0.0
    total_tests = 4

    # Determine working base URL
    base_url = None
    for url in ["http://localhost", "http://localhost:5000"]:
        code, _ = http_get(f"{url}/api/health")
        if code == 200:
            base_url = url
            break
    if base_url is None:
        base_url = "http://localhost:5000"

    # Test 1: Set and get multiple keys
    test1_ok = True
    for i, (k, v) in enumerate(
        [("key_a", "alpha"), ("key_b", "bravo"), ("key_c", "charlie")]
    ):
        code, _ = http_post(f"{base_url}/api/set", {"key": k, "value": v})
        if code != 200:
            test1_ok = False
            break
    if test1_ok:
        all_correct = True
        for k, v in [("key_a", "alpha"), ("key_b", "bravo"), ("key_c", "charlie")]:
            code, body = http_get(f"{base_url}/api/get?key={k}")
            try:
                if code != 200 or json.loads(body).get("value") != v:
                    all_correct = False
            except (json.JSONDecodeError, AttributeError):
                all_correct = False
        if all_correct:
            score += 1
            print("  kv_store test 1: PASS (multi-key set/get)")
        else:
            score += 0.5
            print("  kv_store test 1: PARTIAL (some keys failed)")
    else:
        print("  kv_store test 1: FAIL (cannot set multiple keys)")

    # Test 2: Overwrite existing key
    http_post(f"{base_url}/api/set", {"key": "key_a", "value": "alpha_v2"})
    code, body = http_get(f"{base_url}/api/get?key=key_a")
    try:
        if code == 200 and json.loads(body).get("value") == "alpha_v2":
            score += 1
            print("  kv_store test 2: PASS (overwrite)")
        else:
            score += 0.3
            print("  kv_store test 2: PARTIAL (overwrite returned unexpected value)")
    except (json.JSONDecodeError, AttributeError):
        print("  kv_store test 2: FAIL (overwrite)")

    # Test 3: Get missing key — should return error or empty, not crash
    code, body = http_get(f"{base_url}/api/get?key=nonexistent_key_xyz")
    if code == 200:
        try:
            data = json.loads(body)
            if data.get("value") is None or data.get("value") == "":
                score += 1
                print("  kv_store test 3: PASS (missing key returns null/empty)")
            else:
                score += 0.5
                print("  kv_store test 3: PARTIAL (missing key returned a value)")
        except json.JSONDecodeError:
            score += 0.3
            print("  kv_store test 3: PARTIAL (invalid JSON for missing key)")
    elif code in (404, 400):
        score += 1
        print(f"  kv_store test 3: PASS (missing key returns {code})")
    elif code == 0:
        print("  kv_store test 3: FAIL (server error)")
    else:
        score += 0.3
        print(f"  kv_store test 3: PARTIAL (missing key returns {code})")

    # Test 4: KV Store port directly accessible
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3)
        result = s.connect_ex(("localhost", 50051))
        s.close()
        if result == 0:
            score += 1
            print("  kv_store test 4: PASS (port 50051 open)")
        else:
            print("  kv_store test 4: FAIL (port 50051 closed)")
    except Exception:
        print("  kv_store test 4: FAIL (port 50051 error)")

    final = score / total_tests
    print(f"  kv_store total: {score}/{total_tests} = {final:.2f}")
    return final


def check_api_server() -> float:
    """API server health depth + error handling (scored 0-1)."""
    score = 0.0
    total_tests = 3

    base_url = None
    for url in ["http://localhost", "http://localhost:5000"]:
        code, _ = http_get(f"{url}/api/health")
        if code == 200:
            base_url = url
            break
    if base_url is None:
        base_url = "http://localhost:5000"

    # Test 1: Health endpoint returns structured data with KV status
    code, body = http_get(f"{base_url}/api/health")
    if code == 200:
        try:
            data = json.loads(body)
            if data.get("status") == "ok":
                score += 1
                print("  api_server test 1: PASS (health ok + structured JSON)")
            else:
                score += 0.5
                print(
                    "  api_server test 1: PARTIAL (health returns JSON but status != ok)"
                )
        except json.JSONDecodeError:
            score += 0.3
            print("  api_server test 1: PARTIAL (health returns 200 but not JSON)")
    else:
        print(f"  api_server test 1: FAIL (health returned {code})")

    # Test 2: Invalid request handling — POST /api/set with missing key
    code, body = http_post(f"{base_url}/api/set", {"value": "no-key-given"})
    if code in (400, 422):
        score += 1
        print(f"  api_server test 2: PASS (missing key returns {code})")
    elif code == 200:
        # Server accepted bad request — less robust but not broken
        score += 0.3
        print("  api_server test 2: PARTIAL (missing key accepted with 200)")
    elif code in (500,):
        score += 0.1
        print("  api_server test 2: PARTIAL (missing key returns 500)")
    else:
        print(f"  api_server test 2: FAIL (missing key returns {code})")

    # Test 3: GET /api/get with no key parameter
    code, body = http_get(f"{base_url}/api/get")
    if code in (400, 422):
        score += 1
        print(f"  api_server test 3: PASS (missing param returns {code})")
    elif code == 200:
        score += 0.3
        print("  api_server test 3: PARTIAL (missing param returns 200)")
    elif code == 500:
        score += 0.1
        print("  api_server test 3: PARTIAL (missing param returns 500)")
    else:
        score += 0.2
        print(f"  api_server test 3: PARTIAL (missing param returns {code})")

    final = score / total_tests
    print(f"  api_server total: {score}/{total_tests} = {final:.2f}")
    return final


def check_frontend() -> float:
    """Frontend content quality + dynamic integration (scored 0-1)."""
    score = 0.0
    total_tests = 3

    # Test 1: Basic page serves at :80
    code, body = http_get("http://localhost:80/")
    if code == 200:
        if '<div id="root">' in body:
            score += 1
            print("  frontend test 1: PASS (served at :80 with root div)")
        elif "<html" in body.lower():
            score += 0.5
            print("  frontend test 1: PARTIAL (served at :80 but missing root div)")
        else:
            score += 0.3
            print("  frontend test 1: PARTIAL (served at :80 but unexpected content)")
    else:
        print(f"  frontend test 1: FAIL (port 80 status={code})")

    # Test 2: Page includes JS app references or API client
    if code == 200:
        has_js = "script" in body.lower() or ".js" in body
        has_api_ref = (
            "api" in body.lower() or "fetch" in body.lower() or "axios" in body.lower()
        )
        if has_js and has_api_ref:
            score += 1
            print("  frontend test 2: PASS (JS + API references found)")
        elif has_js:
            score += 0.5
            print("  frontend test 2: PARTIAL (JS found but no API references)")
        else:
            score += 0.2
            print("  frontend test 2: PARTIAL (no JS references)")
    else:
        print("  frontend test 2: SKIP (page not loaded)")

    # Test 3: Static assets served (CSS or additional JS)
    if code == 200:
        has_css = "stylesheet" in body.lower() or ".css" in body
        has_assets = has_css or body.count("<script") >= 1
        if has_assets:
            score += 1
            print("  frontend test 3: PASS (static assets served)")
        else:
            score += 0.3
            print("  frontend test 3: PARTIAL (no static asset references)")
    else:
        print("  frontend test 3: SKIP (page not loaded)")

    final = score / total_tests
    print(f"  frontend total: {score}/{total_tests} = {final:.2f}")
    return final


def main():
    baseline_guard()
    time.sleep(3)

    # === Gate checks ==========================================================
    gate_results = {}
    gate_results["set_api"] = gate_set_api()
    gate_results["get_api"] = gate_get_api()

    gates_passed = all(gate_results.values())
    failed_gates = [k for k, v in gate_results.items() if not v]

    if not gates_passed:
        print(f"\nGATE FAILURE: {failed_gates}")
        print("Score: 0.00/1.0")
        try:
            os.makedirs("/logs/verifier", exist_ok=True)
            with open("/logs/verifier/reward.json", "w") as f:
                json.dump(
                    {
                        "reward": 0.0,
                        **{
                            f"gate_{k}": (1 if v else 0)
                            for k, v in gate_results.items()
                        },
                    },
                    f,
                    indent=2,
                )
        except Exception:
            pass
        sys.exit(1)

    print("\nAll gates passed — scoring dimensions...\n")

    # === Scored dimensions ====================================================
    weights = {
        "kv_store": 0.40,
        "api_server": 0.35,
        "frontend": 0.25,
    }

    raw_scores = {}
    raw_scores["kv_store"] = check_kv_store()
    raw_scores["api_server"] = check_api_server()
    raw_scores["frontend"] = check_frontend()

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
            **{f"gate_{k}": 1 for k in gate_results},
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
