#!/usr/bin/env bash
set -e

COOKIE_JAR=/tmp/workspace_cookies.txt

# 1. Login
curl -s -c "$COOKIE_JAR" -X POST http://localhost:5009/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' > /dev/null

# 2. List seeded notes
notes_json=$(curl -s -b "$COOKIE_JAR" "http://localhost:5009/api/notes?seeded=1")

# 3. Create/update task record for each note
for nid in 1 2 3 4 5 6 7; do
  # Infer values per the answer table
  case $nid in
    1) rt="summary"; sc="meeting"; sum="Project kickoff meeting covering scope and assignments." ;;
    2) rt="summary"; sc="manual"; sum="Weekly report template with achievements and plans." ;;
    3) rt="tracker_update"; sc="manual"; sum="Q2 OKR tracker with engagement and debt objectives." ;;
    4) rt="summary"; sc="meeting"; sum="Q3 product strategy brief on mobile app and EU expansion." ;;
    5) rt="tracker_update"; sc="incident"; sum="Incident #42: DB connection pool exhaustion on 2024-07-15." ;;
    6) rt="communication"; sc="email"; sum="Customer complaint about refund delay for order #8821." ;;
    7) rt="tracker_update"; sc="incident"; sum="DB latency spike on 2024-08-01 due to missing index." ;;
  esac

  curl -s -b "$COOKIE_JAR" -X PUT "http://localhost:5009/api/notes/${nid}/task-record" \
    -H "Content-Type: application/json" \
    -d "{\"record_type\":\"${rt}\",\"source_channel\":\"${sc}\",\"summary_text\":\"${sum}\",\"status\":\"open\"}" > /dev/null
done

# 4. Set all statuses to done
for nid in 1 2 3 4 5 6 7; do
  curl -s -b "$COOKIE_JAR" -X PUT "http://localhost:5009/api/notes/${nid}/task-record" \
    -H "Content-Type: application/json" \
    -d '{"status":"done"}' > /dev/null
done

echo "Task records created and statuses set to done."
