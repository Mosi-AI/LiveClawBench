#!/usr/bin/env bash
set -euo pipefail

CALENDAR_API="http://localhost:5006"
SOCIAL_API="http://localhost:5004"
EMAIL="peter.griffin@work.mosi.inc"
PASSWORD="password123"

# Login to social platform (JSON POST to /api/auth/login)
curl -s -c /tmp/social_cookie -X POST "${SOCIAL_API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"mosi_brand","password":"demo123"}' -L > /dev/null

# Delete stale scheduled posts (IDs 100, 101, 102)
for PID in 100 101 102; do
    curl -s -b /tmp/social_cookie -X DELETE "${SOCIAL_API}/api/posts/${PID}" > /dev/null 2>&1 || true
done
echo "Cleaned up stale social posts"

# Create new social posts for June 1-7 campaign
curl -s -b /tmp/social_cookie -X POST "${SOCIAL_API}/api/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Introducing Our Summer Collection - discover the hottest trends of 2026! #SummerCollection #NewArrivals",
    "status": "scheduled",
    "scheduled_for": "2026-06-01T09:00:00",
    "scheduled_timezone": "UTC"
  }' > /dev/null

curl -s -b /tmp/social_cookie -X POST "${SOCIAL_API}/api/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Summer vibes are here! Check out our lightweight fabrics perfect for the season. #SummerStyle #Fashion",
    "status": "scheduled",
    "scheduled_for": "2026-06-03T10:00:00",
    "scheduled_timezone": "UTC"
  }' > /dev/null

curl -s -b /tmp/social_cookie -X POST "${SOCIAL_API}/api/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Behind the design: how we created the Summer 2026 collection. Read the full story on our blog! #DesignProcess #SummerLaunch",
    "status": "scheduled",
    "scheduled_for": "2026-06-05T14:00:00",
    "scheduled_timezone": "UTC"
  }' > /dev/null
echo "Scheduled 3 new social posts"

# Login to calendar
curl -s -c /tmp/cal_cookie -X POST "${CALENDAR_API}/login" \
  -d "email=${EMAIL}&password=${PASSWORD}" -L > /dev/null

# Delete orphan calendar events
EVENTS=$(curl -s -b /tmp/cal_cookie "${CALENDAR_API}/api/events")
for TITLE in "Spring Collection Post" "Flash Sale Post"; do
    EID=$(echo "$EVENTS" | python3 -c "import sys,json; [print(e['id']) for e in json.load(sys.stdin).get('events',[]) if '$TITLE' in e.get('title','')]" 2>/dev/null || true)
    for id in $EID; do
        curl -s -b /tmp/cal_cookie -X DELETE "${CALENDAR_API}/api/events/${id}" > /dev/null
    done
done
echo "Cleaned up orphan calendar events"

# Create new calendar events for content pieces
curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{"title":"Blog Post: Introducing Our Summer Collection","description":"Write and publish blog post for Summer Product Launch","event_type":"content","start_time":"2026-06-01T09:00:00Z","end_time":"2026-06-01T10:00:00Z"}' > /dev/null

curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{"title":"Social Media: Summer Collection Feature","description":"Post #2 - lightweight fabrics","event_type":"content","start_time":"2026-06-03T10:00:00Z","end_time":"2026-06-03T11:00:00Z"}' > /dev/null

curl -s -b /tmp/cal_cookie -X POST "${CALENDAR_API}/api/events" \
  -H "Content-Type: application/json" \
  -d '{"title":"Social Media: Design Story Post","description":"Post #3 - behind the design","event_type":"content","start_time":"2026-06-05T14:00:00Z","end_time":"2026-06-05T15:00:00Z"}' > /dev/null
echo "Created calendar events for content pieces"

echo "All tasks complete"
