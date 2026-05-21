#!/usr/bin/env python3
"""In-memory KV-Store storage backend."""

MAX_BATCH_SIZE = 100
MAX_VALUE_BYTES = 4096


class KVStoreBackend:
    """Simple in-memory key-value store."""

    def __init__(self):
        self._data = {}
        self._stats = {"puts": 0, "gets": 0, "deletes": 0, "batches": 0}

    def put(self, key: str, value: str) -> bool:
        """Store a key-value pair."""
        self._stats["puts"] += 1
        self._data[key] = value
        return True

    def get(self, key: str):
        """Retrieve a value by key. Returns (found: bool, value: str)."""
        self._stats["gets"] += 1
        if key in self._data:
            return True, self._data[key]
        return False, ""

    def delete(self, key: str) -> bool:
        """Delete a key. Returns True if the key existed."""
        self._stats["deletes"] += 1
        if key in self._data:
            del self._data[key]
            return True
        return False

    def batch_put(self, items) -> tuple:
        """Store multiple key-value pairs. Returns (success_count, failure_count, msg)."""
        self._stats["batches"] += 1
        if len(items) > MAX_BATCH_SIZE:
            return (
                0,
                len(items),
                f"Batch size {len(items)} exceeds limit {MAX_BATCH_SIZE}",
            )

        success = 0
        failure = 0
        for i in range(len(items) + 1):
            try:
                item = items[i]
                self._data[item.key] = item.value
                success += 1
            except (IndexError, Exception):
                failure += 1

        return success, failure, ""

    def size(self) -> int:
        """Return the number of stored keys."""
        return len(self._data)

    def stats(self) -> dict:
        """Return operation statistics."""
        return dict(self._stats)

    def keys(self):
        """Return all keys."""
        return list(self._data.keys())
