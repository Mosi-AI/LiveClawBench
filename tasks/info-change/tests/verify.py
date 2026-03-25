#!/usr/bin/env python3
"""Verify info_change: check user profile updated with new address and phone"""

import json
import sys

score = 0.0
user_path = "/tmp/mosi_shop_user.json"

try:
    with open(user_path) as f:
        users = json.load(f)
    addr_ok = all(
        u.get("address") == "4278 Maple View Drive, Sacramento, CA 95814, USA"
        for u in users
    )
    phone_ok = all(
        u.get("phone") == 12345678901 or u.get("phone") == "12345678901" for u in users
    )
    if addr_ok and phone_ok:
        score = 1.0
    elif addr_ok or phone_ok:
        score = 0.5
except FileNotFoundError:
    pass

print(f"Score: {score}/1.0")
sys.exit(0 if score >= 0.5 else 1)
