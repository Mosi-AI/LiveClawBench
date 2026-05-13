#!/bin/bash
# Run all verifier unit tests across tasks
set -euo pipefail

FAILED=0
for testfile in tasks/*/tests/test_*.py; do
    if [ ! -f "$testfile" ]; then
        continue
    fi
    echo "=== $(basename "$(dirname "$(dirname "$testfile")")"): $(basename "$testfile") ==="
    if pytest "$testfile" -v --tb=short; then
        echo "PASS"
    else
        echo "FAIL"
        FAILED=$((FAILED + 1))
    fi
    echo
done

if [ $FAILED -gt 0 ]; then
    echo "$FAILED test file(s) failed"
    exit 1
fi

echo "All verifier tests passed."
