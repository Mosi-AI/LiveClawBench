#!/usr/bin/env python3
"""Verify flight-cancel-claim: check claim filed for cancelled flight"""

import sys

sys.path.insert(0, "/workspace/environment/airline-app/backend")
from app import create_app
from models import Claim

app = create_app()


def check():
    with app.app_context():
        claim = Claim.query.first()
        if claim:
            print(f"PASS: Found claim (id: {claim.id}, status: {claim.status})")
            return 1.0
        print("FAIL: No claim found")
        return 0.0


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
