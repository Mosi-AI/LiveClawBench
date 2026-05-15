#!/usr/bin/env python3
import json
import sys
import urllib.request
import http.cookiejar

BASE_URL = "http://localhost:5003"

EXPECTED = {
    1: {"record_type": "summary", "source_channel": "meeting"},
    2: {"record_type": "summary", "source_channel": "manual"},
    3: {"record_type": "tracker_update", "source_channel": "manual"},
    4: {"record_type": "summary", "source_channel": "meeting"},
    5: {"record_type": "tracker_update", "source_channel": "incident"},
    6: {"record_type": "communication", "source_channel": "email"},
    7: {"record_type": "tracker_update", "source_channel": "incident"},
}


def api_request(path, method="GET", data=None, cookiejar=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    if cookiejar is not None:
        cookiejar.add_cookie_header(req)
    resp = urllib.request.urlopen(req)
    if cookiejar is not None:
        cookiejar.extract_cookies(resp, req)
    return json.loads(resp.read().decode("utf-8"))


def main():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    urllib.request.install_opener(opener)

    # Login
    login_resp = api_request("/api/auth/login", method="POST", data={"username": "demo", "password": "demo123"}, cookiejar=cj)
    if not login_resp.get("success"):
        print("Failed to login")
        print("Score: 0.0/1.0")
        sys.exit(1)

    # Get seeded notes
    notes = api_request("/api/notes?seeded=1", cookiejar=cj)

    all_records_exist = 0.0
    record_types_correct = 0.0
    source_channels_correct = 0.0
    summaries_non_empty = 0.0
    all_status_done = 0.0

    matched = 0
    rt_ok = 0
    sc_ok = 0
    sum_ok = 0
    status_ok = 0

    for note in notes:
        nid = note.get("id")
        if nid not in EXPECTED:
            continue
        matched += 1
        tr = api_request(f"/api/notes/{nid}/task-record", cookiejar=cj)
        if tr is None:
            continue
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
    all_records_exist = matched / total if total else 0.0
    record_types_correct = rt_ok / total if total else 0.0
    source_channels_correct = sc_ok / total if total else 0.0
    summaries_non_empty = sum_ok / total if total else 0.0
    all_status_done = status_ok / total if total else 0.0

    reward = (
        0.3 * all_records_exist
        + 0.2 * record_types_correct
        + 0.2 * source_channels_correct
        + 0.1 * summaries_non_empty
        + 0.2 * all_status_done
    )

    print(f"Score: {reward:.1f}/1.0")
    if reward < 0.5:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
