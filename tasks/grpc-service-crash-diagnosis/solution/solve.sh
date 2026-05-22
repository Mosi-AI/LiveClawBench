#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for grpc-service-crash-diagnosis"
echo "===================================================="

cd /workspace/kv-store

# 1. Fix store.py — add threading lock for thread safety
cat > store.py << 'STOREEOF'
#!/usr/bin/env python3
"""In-memory KV-Store storage backend — FIXED version with thread safety."""

import threading

MAX_BATCH_SIZE = 100


class KVStoreBackend:
    """Thread-safe in-memory key-value store."""

    def __init__(self):
        self._data = {}
        self._lock = threading.Lock()

    def put(self, key: str, value: str) -> bool:
        with self._lock:
            self._data[key] = value
        return True

    def get(self, key: str):
        with self._lock:
            if key in self._data:
                return True, self._data[key]
            return False, ""

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._data:
                del self._data[key]
                return True
            return False

    def batch_put(self, items) -> tuple:
        if len(items) > MAX_BATCH_SIZE:
            return 0, len(items), f"Batch size {len(items)} exceeds limit {MAX_BATCH_SIZE}"

        success = 0
        failure = 0
        with self._lock:
            # FIXED: use range(len(items)) not range(len(items) + 1)
            for i in range(len(items)):
                try:
                    item = items[i]
                    self._data[item.key] = item.value
                    success += 1
                except Exception:
                    failure += 1

        return success, failure, ""

    def size(self) -> int:
        with self._lock:
            return len(self._data)

    def keys(self):
        with self._lock:
            return list(self._data.keys())
STOREEOF

# 2. Start the service
cd /workspace/kv-store
python3 server.py &
sleep 2

# 3. Run the stress test
echo "Running stress test..."
python3 /workspace/tests/stress_test.py

echo "Reference solution complete."
