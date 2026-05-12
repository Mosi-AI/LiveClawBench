#!/bin/bash
set -e

# Create logs directory before running verifier
mkdir -p /logs/verifier

# Run the verifier
python3 /tests/verify.py

# Exit with the verifier's exit code
exit $?