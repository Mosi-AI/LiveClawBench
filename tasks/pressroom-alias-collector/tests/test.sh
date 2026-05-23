#!/bin/sh
mkdir -p /logs/verifier
python3 /tests/verify.py
exit $?
