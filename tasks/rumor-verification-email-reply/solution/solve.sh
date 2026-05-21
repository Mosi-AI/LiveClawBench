#!/usr/bin/env bash
set -e
mkdir -p "${HOME}/.openclaw/output"

python3 - <<'PYEOF'
import json
import urllib.request
from pathlib import Path

EMAIL_BASE = "http://localhost:5174"
CORPUS = Path.home() / ".openclaw" / "corpus"

# --- Step 0: Authenticate ---
login_req = urllib.request.Request(
    f"{EMAIL_BASE}/api/auth/login",
    data=json.dumps({"username": "peter", "password": "password123"}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(login_req, timeout=10) as r:
    login_data = json.loads(r.read().decode("utf-8"))
TOKEN = (login_data.get("data") or {}).get("access_token")
if not TOKEN:
    raise SystemExit("ERROR: Email auth failed")
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def fetch_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


# --- Step 1: Find Alex Rivera's email ---
inbox_data = fetch_json(f"{EMAIL_BASE}/api/emails?folder=inbox", headers=AUTH)
emails = inbox_data.get("data", {}).get("emails", [])

alex_email = None
for email in emails:
    sender = (email.get("sender_email") or "").lower()
    subject = (email.get("subject") or "").lower()
    if "veridian" in sender or "alex.rivera" in sender or "luminos" in subject or "rumor" in subject or "acquisition" in subject:
        alex_email = email
        break

if not alex_email:
    raise SystemExit("ERROR: Alex Rivera's email not found in inbox")

email_id = alex_email.get("id")
if email_id:
    detail = fetch_json(f"{EMAIL_BASE}/api/emails/{email_id}", headers=AUTH)
    alex_email = detail.get("data", {}).get("email", alex_email)

sender_email = alex_email.get("sender_email", "alex.rivera@veridian.inc")

# --- Step 2: Read corpus files ---
corpus_texts = {}
if CORPUS.is_dir():
    for f in sorted(CORPUS.iterdir()):
        if f.is_file():
            try:
                corpus_texts[f.name] = f.read_text(encoding="utf-8")
            except OSError:
                pass

# --- Step 3: Assess the rumor ---
# Analysis:
# - source_01: board notes show "strategic alternatives under review" but "no definitive agreement"
# - source_02: analyst brief says consolidation interest but explicitly NOT confirmed
# - source_03: legal memo is preliminary IP review only, no transaction confirmed
# - source_04: previous Veridian/Luminos discussions FAILED in Jan 2025 (valuation gap)
# - source_05: anonymous blog post claiming deal finalized — unattributed, no named sources
#
# Verdict: UNVERIFIED — evidence is circumstantial and contradicted by failed 2025 discussions.
# The blog post (source_05) is unreliable noise with no named sources.

reply_body = """Hi Alex,

I've reviewed the available research materials on this and wanted to give you an honest read before your IC meeting.

**Verdict: The acquisition rumor is UNVERIFIED. I would treat it as unconfirmed speculation.**

Here's why:

**Evidence supporting caution:**
1. **Prior discussions failed (Jan 2025):** Veridian and Luminos had a formal strategic discussion (Project Lantern) that was terminated in January 2025 due to a $30M valuation gap and strategic fit concerns. Luminos management explicitly said they weren't ready for a transaction. Any re-engagement would require a meaningful change in circumstances.

2. **No official confirmation from either party:** Both Luminos and Veridian have declined to comment on current rumors. There have been no SEC filings, press releases, or named-source statements from either organization.

3. **The analyst brief explicitly flags the rumors as unconfirmed:** Tier One Research's Q1 2026 brief notes that the speculation is based on "pattern-matching" rather than verified deal intelligence, and explicitly cautions against reports claiming a deal has been finalized.

4. **Luminos board notes show only exploratory activity:** Internal notes confirm Luminos engaged advisors to "explore strategic alternatives" — consistent with a broad strategic review, not necessarily an imminent transaction with Veridian specifically.

**Red flag on the blog post:** There is an anonymous TechDealWatch post claiming the deal has been "finalized." This post has no named sources ("people familiar with the matter"), no byline, and their own disclaimer says content is "based on unverified tips and speculation." I would not treat this as reliable evidence.

**Bottom line:** The circumstantial signals (IP due diligence activity, strategic advisor engagement by Luminos) are consistent with a general strategic review — but the specific Veridian angle is unconfirmed and contradicted by the well-documented 2025 breakdown. If Veridian is genuinely re-engaging, they have not made this public.

I'd recommend holding off on any position based on this rumor until official confirmation emerges.

Best,
Peter"""

# --- Step 4: Send the reply ---
reply_req = urllib.request.Request(
    f"{EMAIL_BASE}/api/emails",
    data=json.dumps({
        "recipient_email": sender_email,
        "subject": f"Re: {alex_email.get('subject', 'Luminos Data Acquisition Rumor')}",
        "body": reply_body,
    }).encode("utf-8"),
    headers={**AUTH, "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(reply_req, timeout=10) as r:
    reply_result = json.loads(r.read().decode("utf-8"))

print(f"Reply sent to {sender_email}")
print(f"Corpus files reviewed: {list(corpus_texts.keys())}")
PYEOF
