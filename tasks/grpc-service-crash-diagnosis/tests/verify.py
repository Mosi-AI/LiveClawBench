#!/usr/bin/env python3
"""
Verification script for grpc-service-crash-diagnosis task.

Scoring criteria (total 1.0):
  1. Service process running on port 50051                -> 0.20
  2. gRPC health check (single PUT/GET works)             -> 0.20
  3. Stress test passes (1000 concurrent ops, no crash)   -> 0.40
  4. Data consistency after stress test                    -> 0.20
"""

import json
import subprocess
import sys


def run_cmd(cmd, timeout=60):
    """Run a shell command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def check_service_running():
    """Check that a process is listening on port 50051."""
    rc, stdout, _ = run_cmd("ss -tlnp | grep 50051")
    if rc == 0 and "50051" in stdout:
        print("PASS: Service is listening on port 50051")
        return 0.20
    # Alternative check via grpc
    rc, stdout, _ = run_cmd(
        'python3 -c "'
        "import grpc; "
        "ch = grpc.insecure_channel('localhost:50051'); "
        "grpc.channel_ready_future(ch).result(timeout=5); "
        "print('connected')"
        '"',
        timeout=10,
    )
    if rc == 0 and "connected" in stdout:
        print("PASS: gRPC channel connected to port 50051")
        return 0.20
    print("FAIL: No service detected on port 50051")
    return 0.0


def check_health():
    """Simple gRPC health check: PUT then GET a single key."""
    test_script = """
import sys
sys.path.insert(0, '/workspace/kv-store')
import grpc
import kvstore_pb2
import kvstore_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = kvstore_pb2_grpc.KVStoreStub(channel)

# PUT
resp = stub.Put(kvstore_pb2.PutRequest(key='health_check_key', value='health_ok'))
assert resp.success, 'PUT failed'

# GET
resp = stub.Get(kvstore_pb2.GetRequest(key='health_check_key'))
assert resp.found, 'GET not found'
assert resp.value == 'health_ok', f'GET value mismatch: {resp.value}'

print('HEALTH_OK')
"""
    rc, stdout, stderr = run_cmd(f'python3 -c "{test_script}"', timeout=15)
    if rc == 0 and "HEALTH_OK" in stdout:
        print("PASS: gRPC health check succeeded (PUT/GET single key)")
        return 0.20
    print(f"FAIL: gRPC health check failed (rc={rc}, stderr={stderr[:200]})")
    return 0.0


def check_stress_test():
    """Run the stress test and check it passes."""
    rc, stdout, stderr = run_cmd("python3 /workspace/tests/stress_test.py", timeout=120)
    if rc == 0 and "STRESS TEST PASSED" in stdout:
        print("PASS: Stress test passed (1000 concurrent ops)")
        return 0.40
    # Partial credit if service survived but had some issues
    if "PUT phase: all" in stdout and rc != 0:
        print("PARTIAL: PUT succeeded but verification failed")
        return 0.15
    print(f"FAIL: Stress test failed (rc={rc})")
    if stdout:
        # Print last few lines for debugging
        for line in stdout.split("\n")[-8:]:
            print(f"  > {line}")
    return 0.0


def check_data_consistency():
    """After stress test, verify a sample of keys are consistent."""
    test_script = """
import sys, random
sys.path.insert(0, '/workspace/kv-store')
import grpc
import kvstore_pb2
import kvstore_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = kvstore_pb2_grpc.KVStoreStub(channel)

# Check that health_check_key from earlier still exists
resp = stub.Get(kvstore_pb2.GetRequest(key='health_check_key'))
if not resp.found:
    print('CONSISTENCY_FAIL: health_check_key lost')
    sys.exit(1)

# Check a few batch keys if they exist
found_count = 0
for i in range(10):
    key = f'batch:{i:04d}'
    resp = stub.Get(kvstore_pb2.GetRequest(key=key))
    if resp.found and len(resp.value) > 0:
        found_count += 1

if found_count >= 8:
    print(f'CONSISTENCY_OK found={found_count}/10')
else:
    print(f'CONSISTENCY_PARTIAL found={found_count}/10')
"""
    rc, stdout, _ = run_cmd(f'python3 -c "{test_script}"', timeout=15)
    if "CONSISTENCY_OK" in stdout:
        print("PASS: Data consistency verified")
        return 0.20
    if "CONSISTENCY_PARTIAL" in stdout:
        print("PARTIAL: Some data consistency issues")
        return 0.10
    print("FAIL: Data consistency check failed")
    return 0.0


def main():
    scores = {}
    scores["service_running"] = check_service_running()
    scores["health_check"] = check_health()
    scores["stress_test"] = check_stress_test()
    scores["data_consistency"] = check_data_consistency()

    total = sum(scores.values())
    print(f"\nScore: {total:.2f}/1.0")

    # Write detailed results
    try:
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(
                {
                    "reward": round(total, 2),
                    **{k: round(v, 2) for k, v in scores.items()},
                },
                f,
                indent=2,
            )
    except Exception:
        pass

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
