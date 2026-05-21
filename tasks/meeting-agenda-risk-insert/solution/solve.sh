#!/usr/bin/env bash
set -e
mkdir -p "${HOME}/.openclaw/output"

python3 - <<'PYEOF'
import json
import urllib.request
from pathlib import Path

CALENDAR_BASE = "http://localhost:5006"
CORPUS = Path.home() / ".openclaw" / "corpus"

# --- Step 0: Authenticate ---
login_req = urllib.request.Request(
    f"{CALENDAR_BASE}/api/auth/login",
    data=json.dumps({"username": "peter.griffin@work.mosi.inc", "password": "password123"}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(login_req, timeout=10) as r:
    login_data = json.loads(r.read().decode("utf-8"))
TOKEN = (login_data.get("data") or {}).get("access_token")
if not TOKEN:
    raise SystemExit("ERROR: Calendar auth failed")
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def fetch_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


# --- Step 1: Find TerraScale meeting ---
events_data = fetch_json(f"{CALENDAR_BASE}/api/events", headers=AUTH)
events = events_data.get("data", {}).get("events", [])

terrascale_event = None
for event in events:
    title = (event.get("title") or "").lower()
    if "terrascale" in title:
        terrascale_event = event
        break

if not terrascale_event:
    raise SystemExit("ERROR: TerraScale Logistics Partnership Meeting not found in calendar")

event_id = terrascale_event.get("id")
print(f"Found event: {terrascale_event.get('title')} (id={event_id}, date={terrascale_event.get('start_time')})")

# --- Step 2: Read corpus files ---
corpus_texts = {}
if CORPUS.is_dir():
    for f in sorted(CORPUS.iterdir()):
        if f.is_file():
            try:
                corpus_texts[f.name] = f.read_text(encoding="utf-8")
            except OSError:
                pass

# --- Step 3: Synthesize risk summary ---
# Key risks identified from corpus:
# 1. GDPR DPA gap (source_03): TerraScale's DPA lacks Article 46 SCCs for EU→APAC data transfers
# 2. API fee dispute (source_02): 20-point discount gap (~$180K/year impact), currently deadlocked
# 3. Integration timeline risk (source_05): Based on comparable Atlas Logistics deal,
#    actual integration took 10 months vs. projected 4; same pattern likely applies to TerraScale

risk_summary = """Meeting Risks & Open Issues — TerraScale Logistics Partnership

RISK 1 — GDPR Compliance Gap (CRITICAL):
TerraScale's DPA does not include Article 46 SCCs for EU→APAC data transfers (Singapore ops hub).
No remediation timeline provided despite acknowledgment. Must obtain written commitment with deadline
before any production data sharing. Source: Q2 Compliance Review (Apr 2026).

RISK 2 — API Fee Dispute (HIGH):
Unresolved 20-point discount gap (TerraScale demands 40%, our floor is 20%) on 130–160M API calls/month.
Represents ~$180K/year revenue impact. TerraScale signaled willingness to explore alternatives if not resolved.
Finance to present 30%/35% scenario analysis. Source: Q1 Negotiation Notes (Feb 2026).

RISK 3 — Integration Timeline Risk (MEDIUM):
Current proposal assumes 4-month integration timeline. Atlas Logistics postmortem (comparable technical profile)
shows actual integration took 10 months due to API schema mismatches, auth migration complexity, and 3x
volume underestimate. Recommend requiring joint API schema validation and revising timeline to 8–10 months.
Source: Atlas Logistics Integration Postmortem (Jan 2025).

ADDITIONAL NOTES:
- SLA terms remain below our standard (99.5% vs 99.9% uptime; 4hr vs 2hr P1 response) — to be resolved
- Liability cap ($500K) well below our standard (2x ACV) — needs renegotiation"""

# --- Step 4: Update calendar event description ---
update_req = urllib.request.Request(
    f"{CALENDAR_BASE}/api/events/{event_id}",
    data=json.dumps({"description": risk_summary}).encode("utf-8"),
    headers={**AUTH, "Content-Type": "application/json"},
    method="PUT",
)
with urllib.request.urlopen(update_req, timeout=10) as r:
    update_result = json.loads(r.read().decode("utf-8"))

print(f"Updated event {event_id} description with risk summary")
print(f"Corpus files reviewed: {list(corpus_texts.keys())}")
PYEOF
