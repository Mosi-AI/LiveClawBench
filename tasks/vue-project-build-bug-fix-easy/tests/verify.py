#!/usr/bin/env python3
"""Verify vue-project-build-bug-fix-easy: check answer_total_growth.txt exists."""

import sys

answer_path = "/workspace/output/answer_total_growth.txt"
try:
    with open(answer_path) as f:
        content = f.read().strip()
    if content:
        print(f"PASS: Found answer: {content}")
        sys.exit(0)
    else:
        print("FAIL: answer file is empty")
        sys.exit(1)
except FileNotFoundError:
    print("FAIL: answer_total_growth.txt not found")
    sys.exit(1)
