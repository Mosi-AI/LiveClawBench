#!/usr/bin/env bash
set -e
mkdir -p "${HOME}/.openclaw/output"

python3 - <<'PYEOF'
import json
import urllib.request
import urllib.parse
from http.cookiejar import CookieJar
from pathlib import Path
import datetime

CALENDAR_BASE = "http://localhost:5006"
EMAIL_BASE = "http://localhost:5174"
HEALTH_BASE = "http://localhost:5007"
WEATHER_BASE = "http://localhost:3000"
CHAT_BASE = "http://localhost:5003"

DAILY_LOG = Path("/workspace/daily_action_log.md")
TODAY = datetime.date.today().isoformat()


def fetch_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


# --- Step 1: Authenticate with calendar (cookie-based form login) ---
cj = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
login_data = urllib.parse.urlencode({
    "email": "peter.griffin@work.mosi.inc",
    "password": "password123",
}).encode("utf-8")
login_req = urllib.request.Request(
    f"{CALENDAR_BASE}/login",
    data=login_data,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    method="POST",
)
with opener.open(login_req, timeout=10):
    pass

CAL_TOKEN = next((c.value for c in cj if c.name == "token"), None)
if not CAL_TOKEN:
    raise SystemExit("ERROR: Calendar auth failed")
CAL_AUTH = {"Authorization": f"Bearer {CAL_TOKEN}"}

# --- Step 2: Authenticate with email (JWT) ---
email_login = urllib.request.Request(
    f"{EMAIL_BASE}/api/auth/login",
    data=json.dumps({"username": "peter", "password": "password123"}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(email_login, timeout=10) as r:
    email_login_data = json.loads(r.read().decode("utf-8"))
EMAIL_TOKEN = (email_login_data.get("data") or {}).get("access_token")
if not EMAIL_TOKEN:
    raise SystemExit("ERROR: Email auth failed")
EMAIL_AUTH = {"Authorization": f"Bearer {EMAIL_TOKEN}"}

# --- Step 3: Gather data from all services ---

# Calendar events
events_data = fetch_json(f"{CALENDAR_BASE}/api/events", headers=CAL_AUTH)
all_events = events_data.get("events", [])
today_events = [e for e in all_events if (e.get("start_time") or "").startswith(TODAY)]
today_events.sort(key=lambda e: e.get("start_time", ""))

# Detect schedule conflicts
conflicts = []
for i, ev_a in enumerate(today_events):
    for ev_b in today_events[i + 1:]:
        start_a = ev_a.get("start_time", "")
        end_a = ev_a.get("end_time", "")
        start_b = ev_b.get("start_time", "")
        end_b = ev_b.get("end_time", "")
        if start_a and end_a and start_b and end_b:
            if start_b < end_a and end_b > start_a:
                conflicts.append((ev_a, ev_b))

# Inbox emails
inbox_data = fetch_json(f"{EMAIL_BASE}/api/emails?folder=inbox", headers=EMAIL_AUTH)
emails = inbox_data.get("data", {}).get("emails", [])
unread = [e for e in emails if not e.get("is_read")]

# Identify important emails (action items, urgent subjects)
important_emails = []
for e in unread:
    subj = (e.get("subject") or "").lower()
    if any(kw in subj for kw in ["action", "required", "urgent", "due", "deadline", "prep", "pre-read"]):
        important_emails.append(e)

# Health snapshot
try:
    health_data = fetch_json(f"{HEALTH_BASE}/api/health/snapshot")
    health_snap = health_data.get("data", {}) or {}
except Exception:
    health_snap = {}

# Weather (Beijing)
try:
    weather_data = fetch_json(f"{WEATHER_BASE}/api/location/beijing/health-tips")
    weather_tips = (weather_data.get("data") or [])
    weather_tip_text = weather_tips[0]["body"] if weather_tips else "No weather tip available"
    # Also get daily forecast
    forecast_data = fetch_json(f"{WEATHER_BASE}/location/beijing/daily") if False else {}
except Exception:
    weather_tip_text = "Weather data unavailable"

# --- Step 4: Compose the brief ---
calendar_section = "\n".join(
    f"  • {e.get('start_time', '')[11:16]}–{e.get('end_time', '')[11:16]} {e.get('title', '')}"
    for e in today_events
) or "  (no events found)"

conflict_section = ""
if conflicts:
    for ev_a, ev_b in conflicts:
        conflict_section += (
            f"\n⚠️ SCHEDULE CONFLICT: '{ev_a.get('title')}' "
            f"({ev_a.get('start_time', '')[11:16]}–{ev_a.get('end_time', '')[11:16]}) "
            f"overlaps with '{ev_b.get('title')}' "
            f"({ev_b.get('start_time', '')[11:16]}–{ev_b.get('end_time', '')[11:16]})"
        )

action_items = []
for e in important_emails:
    action_items.append(f"• [EMAIL] {e.get('subject', '')}")
# Add calendar-based actions
for ev in today_events:
    desc = (ev.get("description") or "").lower()
    if "prep" in desc or "review" in desc or "submit" in desc:
        action_items.append(f"• [CALENDAR] Prep for: {ev.get('title', '')}")

health_summary = ""
if health_snap:
    steps = health_snap.get("steps", "N/A")
    sleep = health_snap.get("sleep_hours", "N/A")
    hr = health_snap.get("resting_heart_rate", "N/A")
    health_summary = f"Steps: {steps} | Sleep: {sleep}h | Resting HR: {hr} bpm"

brief = f"""📋 Morning Decision Brief — {TODAY}

**1. Must-Do Items**
{chr(10).join(action_items) if action_items else "  No urgent action items in email."}

**2. Schedule Risks**
Today's calendar:
{calendar_section}
{conflict_section if conflict_section else "  No scheduling conflicts detected."}

**3. Health & Weather**
Today's health: {health_summary or "No snapshot available"}
Beijing weather tip: {weather_tip_text}

**4. Recommended Prep**
{chr(10).join(f"• {ev.get('description', '').split('. Prep:')[-1].strip()}" for ev in today_events if 'prep' in (ev.get('description') or '').lower() and '. Prep:' in (ev.get('description') or '')) or "  Review email pre-reads before morning meetings."}
"""

# --- Step 5: Post brief to #general (channel 1) ---
msg_req = urllib.request.Request(
    f"{CHAT_BASE}/api/channels/1/messages",
    data=json.dumps({"message_kind": "chat", "body": brief}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(msg_req, timeout=10) as r:
    msg_result = json.loads(r.read().decode("utf-8"))

print(f"Brief posted to #general (message id: {msg_result.get('id')})")

# --- Step 6: Update daily action log (B2) ---
log_text = DAILY_LOG.read_text(encoding="utf-8") if DAILY_LOG.exists() else ""

day_abbr = datetime.date.today().strftime("%A")
new_entry = f"\n## {TODAY} ({day_abbr})\n"
for item in action_items:
    clean = item.replace("• [EMAIL] ", "").replace("• [CALENDAR] Prep for: ", "Prep for ")
    new_entry += f"- {clean}\n"
if not action_items:
    new_entry += "- No critical action items today\n"

log_text = log_text.rstrip() + "\n" + new_entry
DAILY_LOG.write_text(log_text, encoding="utf-8")
print(f"Updated daily action log with {len(action_items)} action items for {TODAY}")
PYEOF
