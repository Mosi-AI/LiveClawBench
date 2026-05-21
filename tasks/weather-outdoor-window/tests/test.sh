#!/usr/bin/env bash
set -e
mkdir -p /logs/verifier
python3 /tests/verify.py
