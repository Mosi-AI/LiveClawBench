#!/usr/bin/env python3
"""
Stress test for the gRPC KV-Store.
Runs 1000 concurrent PUT/GET operations and checks data consistency.
"""

import random
import string
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, "/workspace/kv-store")

import grpc
import kvstore_pb2
import kvstore_pb2_grpc

SERVER_ADDR = "localhost:50051"
NUM_OPERATIONS = 1000
MAX_WORKERS = 20


def random_value(length=16):
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def run_stress_test():
    channel = grpc.insecure_channel(SERVER_ADDR)
    stub = kvstore_pb2_grpc.KVStoreStub(channel)

    # Phase 1: Concurrent PUT operations
    print(f"[Phase 1] Sending {NUM_OPERATIONS} concurrent PUT requests...")
    expected_data = {}
    errors = []

    def do_put(key, value):
        try:
            resp = stub.Put(kvstore_pb2.PutRequest(key=key, value=value))
            if not resp.success:
                return f"PUT {key} returned success=false"
            return None
        except Exception as e:
            return f"PUT {key} error: {e}"

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {}
        for i in range(NUM_OPERATIONS):
            key = f"stress:{i:04d}"
            value = random_value()
            expected_data[key] = value
            futures[pool.submit(do_put, key, value)] = key

        for fut in as_completed(futures):
            err = fut.result()
            if err:
                errors.append(err)

    if errors:
        print(f"  PUT phase: {len(errors)} errors")
        for e in errors[:5]:
            print(f"    {e}")
    else:
        print(f"  PUT phase: all {NUM_OPERATIONS} succeeded")

    time.sleep(1)

    # Phase 2: Concurrent GET + consistency check
    print(f"[Phase 2] Verifying {NUM_OPERATIONS} keys via concurrent GET...")
    mismatches = []
    missing = []

    def do_get(key, expected_value):
        try:
            resp = stub.Get(kvstore_pb2.GetRequest(key=key))
            if not resp.found:
                return "missing", key
            if resp.value != expected_value:
                return "mismatch", (key, expected_value, resp.value)
            return "ok", None
        except Exception as e:
            return "error", f"GET {key} error: {e}"

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {}
        for key, value in expected_data.items():
            futures[pool.submit(do_get, key, value)] = key

        for fut in as_completed(futures):
            status, detail = fut.result()
            if status == "missing":
                missing.append(detail)
            elif status == "mismatch":
                mismatches.append(detail)
            elif status == "error":
                errors.append(detail)

    # Phase 3: BatchPut test (100 items)
    print("[Phase 3] Testing BatchPut with 100 items...")
    batch_items = []
    batch_expected = {}
    for i in range(100):
        key = f"batch:{i:04d}"
        value = random_value()
        batch_items.append(kvstore_pb2.KeyValuePair(key=key, value=value))
        batch_expected[key] = value

    try:
        resp = stub.BatchPut(kvstore_pb2.BatchPutRequest(items=batch_items))
        batch_success = resp.success_count == 100 and resp.failure_count == 0
        if not batch_success:
            errors.append(
                f"BatchPut: success={resp.success_count}, failure={resp.failure_count}, msg={resp.message}"
            )
        else:
            # Verify batch data
            for key, expected_value in batch_expected.items():
                resp = stub.Get(kvstore_pb2.GetRequest(key=key))
                if not resp.found:
                    missing.append(key)
                elif resp.value != expected_value:
                    mismatches.append((key, expected_value, resp.value))
    except Exception as e:
        errors.append(f"BatchPut error: {e}")
        batch_success = False

    # Report
    print("\n=== STRESS TEST RESULTS ===")
    print(f"PUT errors:  {len(errors)}")
    print(f"Missing keys: {len(missing)}")
    print(f"Data mismatches: {len(mismatches)}")
    print(f"BatchPut OK: {batch_success}")

    total_failures = (
        len(errors) + len(missing) + len(mismatches) + (0 if batch_success else 1)
    )
    if total_failures == 0:
        print("\nSTRESS TEST PASSED — all operations succeeded with data consistency")
        return 0
    else:
        print(f"\nSTRESS TEST FAILED — {total_failures} total issues found")
        return 1


if __name__ == "__main__":
    sys.exit(run_stress_test())
