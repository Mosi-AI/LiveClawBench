#!/usr/bin/env python3
"""Verify vue-project-build-bug-fix-hard: check answer_file.txt with 7 metrics."""

import json
import sys

answer_path = "/workspace/output/answer_file.txt"
score = 0
total = 7

try:
    with open(answer_path) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    print("FAIL: answer_file.txt not found or invalid JSON")
    sys.exit(1)

if data.get("Total Growth"):
    score += 1
if data.get("Total Page Views"):
    score += 1
if data.get("Total Sales"):
    score += 1

customer = data.get("Customer", {}).get("Betty Hammes", {})
if customer.get("Email"):
    score += 1
if customer.get("Membership"):
    score += 1
if customer.get("Reward") is not None:
    score += 1
# Bonus for all correct
if score == 6:
    score = 7

print(f"Score: {score}/{total}")
sys.exit(0 if score > 0 else 1)
