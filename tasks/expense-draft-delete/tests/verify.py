#!/usr/bin/env python3
"""
Verifier for expense-draft-delete task.
Scores: (1) deleted draft gone from list -> 0.5, (2) count decreased by 1 -> 0.5

The verifier does NOT perform the delete itself - it only inspects post-agent state.
The agent is expected to delete one of alice's two seeded drafts (EXP-001 or EXP-002).
Expected post-agent state: alice has exactly 1 draft remaining.
"""

import json
import sys
import urllib.error
import urllib.request

BASE_URL = "http://localhost:5004"
EMAIL = "alice@mosi.inc"
PASSWORD = "password123"

# The seed data contains two drafts: EXP-001 (Cloudflare) and EXP-002 (AWS)
# After the agent deletes one, exactly 1 draft should remain
SEEDED_DRAFT_CODES = {"EXP-001", "EXP-002"}
EXPECTED_SEED_COUNT = 2


def api_call(
    method: str, path: str, data: dict | None = None, token: str | None = None
) -> dict:
    """Make an API call and return parsed JSON response."""
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        raise Exception(f"HTTP {e.code}: {error_body}")


def main() -> tuple[float, dict]:
    score = 0.0
    details = {"dimension_scores": {}, "messages": []}

    try:
        # Step 1: Login as alice
        login_resp = api_call(
            "POST", "/api/auth/token", {"email": EMAIL, "password": PASSWORD}
        )
        token = login_resp.get("token")
        if not token:
            raise Exception("No token in login response")
        details["messages"].append(f"Logged in as {EMAIL}")

        # Step 2: Get alice's current drafts
        drafts_resp = api_call("GET", "/api/drafts", token=token)
        drafts = drafts_resp.get("drafts", [])
        total = drafts_resp.get("total", len(drafts))
        draft_ids = {d["id"] for d in drafts}
        draft_codes = {d.get("draft_code") for d in drafts}

        details["messages"].append(
            f"Post-agent: {total} drafts, IDs: {draft_ids}, Codes: {draft_codes}"
        )

        # Dimension 1: Exactly one of the seeded drafts should remain (0.5 points)
        # Must be exactly 1, not 0 (both deleted + replacement) or 2 (none deleted)
        dimension_1_score = 0.0
        remaining_seeded = draft_codes & SEEDED_DRAFT_CODES
        non_seeded = draft_codes - SEEDED_DRAFT_CODES
        if len(remaining_seeded) == 1 and len(non_seeded) == 0:
            dimension_1_score = 0.5
            details["messages"].append(
                f"PASS: Exactly one seeded draft remains ({remaining_seeded})"
            )
        elif len(remaining_seeded) == 0 and total == 1:
            details["messages"].append(
                "FAIL: Both seeded drafts deleted and replacement draft created (loophole rejected)"
            )
        elif len(remaining_seeded) == 0:
            details["messages"].append("FAIL: Both seeded drafts deleted")
        elif len(non_seeded) > 0:
            details["messages"].append(
                f"FAIL: Non-seeded replacement draft created ({non_seeded})"
            )
        else:
            details["messages"].append(
                f"FAIL: Expected 1 seeded draft remaining, got {len(remaining_seeded)}"
            )

        # Dimension 2: Total count should be exactly 1 (0.5 points)
        dimension_2_score = 0.0
        if total == 1:
            dimension_2_score = 0.5
            details["messages"].append(
                f"PASS: Draft count decreased from {EXPECTED_SEED_COUNT} to {total}"
            )
        elif total == EXPECTED_SEED_COUNT:
            details["messages"].append(
                f"FAIL: Draft count unchanged at {total} (no deletion occurred)"
            )
        else:
            details["messages"].append(
                f"FAIL: Unexpected draft count {total} (expected {EXPECTED_SEED_COUNT} or 1)"
            )

        score = dimension_1_score + dimension_2_score
        details["dimension_scores"] = {
            "draft_gone": dimension_1_score,
            "count_decreased": dimension_2_score,
        }

    except Exception as e:
        details["messages"].append(f"ERROR: {str(e)}")
        import traceback

        details["messages"].append(traceback.format_exc())

    return score, details


if __name__ == "__main__":
    score, details = main()

    print(f"Score: {score:.1f}/1.0")
    for msg in details.get("messages", []):
        print(f"  {msg}")

    if score >= 0.5:
        sys.exit(0)
    else:
        sys.exit(1)
