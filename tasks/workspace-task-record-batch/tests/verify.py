#!/usr/bin/env python3
import http.cookiejar
import json
import sys
import urllib.request

BASE_URL = "http://localhost:5009"

EXPECTED = {
    1: {
        "title": "Project Kickoff Meeting Notes",
        "record_type": "summary",
        "source_channel": "meeting",
    },
    2: {
        "title": "Weekly Report Template",
        "record_type": "summary",
        "source_channel": "manual",
    },
    3: {
        "title": "Q2 OKR Tracker",
        "record_type": "tracker_update",
        "source_channel": "manual",
    },
    4: {
        "title": "Q3 Product Strategy Brief",
        "record_type": "summary",
        "source_channel": "meeting",
    },
    5: {
        "title": "Incident Report #42",
        "record_type": "tracker_update",
        "source_channel": "incident",
    },
    6: {
        "title": "Customer Complaint — Refund Delay",
        "record_type": "communication",
        "source_channel": "email",
    },
    7: {
        "title": "Deployment Incident — DB Latency Spike",
        "record_type": "tracker_update",
        "source_channel": "incident",
    },
}


def api_request(path, method="GET", data=None, cookiejar=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    if cookiejar is not None:
        cookiejar.add_cookie_header(req)
    resp = urllib.request.urlopen(req, timeout=10)
    if cookiejar is not None:
        cookiejar.extract_cookies(resp, req)
    payload = json.loads(resp.read().decode("utf-8"))
    # Unwrap mock-lib ok() envelope if present
    if (
        isinstance(payload, dict)
        and payload.get("success") is True
        and "data" in payload
    ):
        return payload["data"]
    return payload


def main():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    urllib.request.install_opener(opener)

    # Login
    login_resp = api_request(
        "/api/auth/login",
        method="POST",
        data={"username": "demo", "password": "demo123"},
        cookiejar=cj,
    )
    if not (login_resp.get("success") or login_resp.get("redirect") == "/workspace"):
        print("Failed to login")
        print("Score: 0.0/1.0")
        sys.exit(1)

    # Get seeded notes
    notes = api_request("/api/notes?seeded=1", cookiejar=cj)

    # Build ID -> title map from fetched notes and verify titles
    notes_by_id = {note.get("id"): note for note in notes}
    title_mismatches = []
    for nid, exp in EXPECTED.items():
        note = notes_by_id.get(nid)
        if note is None:
            title_mismatches.append(nid)
        elif note.get("title") != exp["title"]:
            title_mismatches.append(nid)

    if title_mismatches:
        print(f"Title mismatch or missing for note IDs: {title_mismatches}")

    matched = 0
    rt_ok = 0
    sc_ok = 0
    sum_ok = 0
    status_ok = 0

    for note in notes:
        nid = note.get("id")
        if nid not in EXPECTED or nid in title_mismatches:
            continue
        tr = api_request(f"/api/notes/{nid}/task-record", cookiejar=cj)
        if tr is None:
            continue
        matched += 1
        exp = EXPECTED[nid]
        if tr.get("record_type") == exp["record_type"]:
            rt_ok += 1
        if tr.get("source_channel") == exp["source_channel"]:
            sc_ok += 1
        summary = tr.get("summary_text", "")
        if isinstance(summary, str) and summary.strip():
            sum_ok += 1
        if tr.get("status") == "done":
            status_ok += 1

    total = len(EXPECTED)
    all_records_exist = matched / total
    record_types_correct = rt_ok / total
    source_channels_correct = sc_ok / total
    summaries_non_empty = sum_ok / total
    all_status_done = status_ok / total

    reward = (
        0.3 * all_records_exist
        + 0.2 * record_types_correct
        + 0.2 * source_channels_correct
        + 0.1 * summaries_non_empty
        + 0.2 * all_status_done
    )

    print(f"Score: {reward:.1f}/1.0")

    reward_json = {
        "reward": reward,
        "all_records_exist": all_records_exist,
        "record_types_correct": record_types_correct,
        "source_channels_correct": source_channels_correct,
        "summaries_non_empty": summaries_non_empty,
        "all_status_done": all_status_done,
    }
    with open("/logs/verifier/reward.json", "w", encoding="utf-8") as f:
        json.dump(reward_json, f, indent=2)

    if reward < 0.5:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
