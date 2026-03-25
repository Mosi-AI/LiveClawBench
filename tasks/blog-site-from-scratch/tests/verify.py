#!/usr/bin/env python3
"""Parse test output and calculate score for blog-site-from-scratch."""

import re
import sys

output_path = "/workspace/output/test_output.txt"
try:
    with open(output_path) as f:
        output = f.read()
except FileNotFoundError:
    print("FAIL: No test output found")
    sys.exit(1)

tc_match = re.search(r"Test Cases Passed:\s+(\d+)/(\d+)", output)
ms_match = re.search(r"Milestones Completed:\s+(\d+)/(\d+)", output)

tc_passed = int(tc_match.group(1)) if tc_match else 0
tc_total = int(tc_match.group(2)) if tc_match else 21
ms_passed = int(ms_match.group(1)) if ms_match else 0
ms_total = int(ms_match.group(2)) if ms_match else 5

test_score = (tc_passed / tc_total) * 0.5 if tc_total else 0
ms_score = (ms_passed / ms_total) * 0.5 if ms_total else 0
final = test_score + ms_score

print(f"Test Cases: {tc_passed}/{tc_total}")
print(f"Milestones: {ms_passed}/{ms_total}")
print(f"Score: {final:.2f}/1.0")
sys.exit(0 if final > 0 else 1)
