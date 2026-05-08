#!/bin/bash
set -e

# Run the verifier
python3 /tests/verify.py

# Exit with the verifier's exit code
exit $?
