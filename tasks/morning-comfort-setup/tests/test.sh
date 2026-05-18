#!/bin/bash
set -e

# Create verifier output directory
mkdir -p /logs/verifier

# Run verifier
python3 /tests/verify.py
exit_code=$?

# Preserve exit status
exit $exit_code
