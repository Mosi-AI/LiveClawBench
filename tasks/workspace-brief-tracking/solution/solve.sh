#!/usr/bin/env bash
set -e

COOKIE_JAR=/tmp/workspace_cookies.txt

# 1. Login
curl -s -c "$COOKIE_JAR" -X POST http://localhost:5009/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' > /dev/null

# 2. Create brief-type note
note_resp=$(curl -s -b "$COOKIE_JAR" -X POST http://localhost:5009/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Sprint 24 Retrospective","content":"Sprint 24 retrospective summary","content_type":"brief"}')
note_id=$(echo "$note_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d)['id'])")

# 3. Populate brief
curl -s -b "$COOKIE_JAR" -X PUT "http://localhost:5009/api/notes/${note_id}/brief" \
  -H "Content-Type: application/json" \
  -d '{
    "key_updates": "Backend API v2 migration completed ahead of schedule. LCP dropped from 2.8s to 1.4s. Lazy-loading refactor also delivered.",
    "evidence_bullets": [{"text": "Load-test report shows 99th-percentile latency under 120ms.", "source": "document"}],
    "action_items": [
      {"text": "Update component library documentation", "status": "todo"},
      {"text": "Schedule database shard review", "status": "in_progress"}
    ],
    "citations": [],
    "status": "final"
  }' > /dev/null

# 4. Create task record
curl -s -b "$COOKIE_JAR" -X PUT "http://localhost:5009/api/notes/${note_id}/task-record" \
  -H "Content-Type: application/json" \
  -d '{"record_type":"tracker_update","summary_text":"Sprint 24 follow-up: track action items and onboarding polish.","status":"in_progress"}' > /dev/null

echo "Brief note and task record created."
