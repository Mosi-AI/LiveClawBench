#!/bin/bash
set -e

# Run the verifier
python3 /tests/verify.py

# Check the exit code
if [ $? -eq 0 ]; then
    echo "Verification passed"
    exit 0
else
    echo "Verification failed"
    exit 1
fi
