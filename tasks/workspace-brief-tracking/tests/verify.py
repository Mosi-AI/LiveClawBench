#!/usr/bin/env python3
import http.cookiejar
import json
import sys
import urllib.request

BASE_URL = "http://localhost:5009"


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

    # Find the non-seeded brief note by title
    notes = api_request("/api/notes", cookiejar=cj)
    target_note = None
    for note in notes:
        if (
            note.get("title") == "Sprint 24 Retrospective"
            and note.get("content_type") == "brief"
            and note.get("is_seeded") == 0
        ):
            target_note = note
            break

    note_created = 1.0 if target_note is not None else 0.0

    brief_key_updates = 0.0
    brief_evidence = 0.0
    brief_actions = 0.0
    task_record_created = 0.0
    task_record_updated = 0.0

    if target_note is not None:
        nid = target_note["id"]
        brief = api_request(f"/api/notes/{nid}/brief", cookiejar=cj)
        if brief is not None:
            ku = brief.get("key_updates", "")
            if isinstance(ku, str) and ku.strip():
                ku_lower = ku.lower()
                anchors = [
                    "api v2 migration completed",
                    "lcp dropped from 2.8s to 1.4s",
                    "lazy-loading refactor",
                    "99th-percentile latency under 120ms",
                    "load-test report",
                ]
                matched = sum(1 for a in anchors if a in ku_lower)
                if matched >= 2:
                    brief_key_updates = 1.0

            evidence = brief.get("evidence_bullets", [])
            if isinstance(evidence, list) and any(
                isinstance(item, dict) and item.get("source") for item in evidence
            ):
                brief_evidence = 1.0

            actions = brief.get("action_items", [])
            if isinstance(actions, list) and len(actions) >= 2:
                has_todo = any(
                    isinstance(a, dict) and a.get("status") == "todo" for a in actions
                )
                has_in_progress = any(
                    isinstance(a, dict) and a.get("status") == "in_progress"
                    for a in actions
                )
                if has_todo and has_in_progress:
                    brief_actions = 1.0

        tr = api_request(f"/api/notes/{nid}/task-record", cookiejar=cj)
        if tr is not None:
            summary = tr.get("summary_text", "")
            if (
                tr.get("record_type") == "tracker_update"
                and isinstance(summary, str)
                and "Sprint 24 follow-up" in summary
            ):
                task_record_created = 1.0
            if tr.get("status") == "in_progress":
                task_record_updated = 1.0

    reward = (
        0.15 * note_created
        + 0.15 * brief_key_updates
        + 0.15 * brief_evidence
        + 0.15 * brief_actions
        + 0.2 * task_record_created
        + 0.2 * task_record_updated
    )

    print(f"Score: {reward:.1f}/1.0")

    reward_json = {
        "reward": reward,
        "note_created": note_created,
        "brief_key_updates": brief_key_updates,
        "brief_evidence": brief_evidence,
        "brief_actions": brief_actions,
        "task_record_created": task_record_created,
        "task_record_updated": task_record_updated,
    }
    with open("/logs/verifier/reward.json", "w", encoding="utf-8") as f:
        json.dump(reward_json, f, indent=2)

    if reward < 0.5:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
