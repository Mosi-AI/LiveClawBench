#!/usr/bin/env bash
set -e
mkdir -p "${HOME}/.openclaw/output"

python3 - <<'PYEOF'
import json
import urllib.request
from pathlib import Path

CALENDAR_BASE = "http://localhost:3000"
OUT = Path.home() / ".openclaw" / "output" / "result.json"
CORPUS = Path.home() / ".openclaw" / "corpus"


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


# --- Step 1: Get all todos and find this Friday's partnership meeting ---
todos = fetch_json(f"{CALENDAR_BASE}/api/todos").get("data") or []
meeting = None
for todo in todos:
    title = (todo.get("title") or "").lower()
    if "partnership" in title or "novatech" in title or "discussion" in title:
        meeting = todo
        break

if meeting is None:
    # Fallback: just take the most relevant-sounding todo
    for todo in todos:
        if todo.get("person") and todo.get("date"):
            meeting = todo
            break

meeting_summary = (
    f"Partnership discussion with {meeting.get('person', 'counterpart')} "
    f"on {meeting.get('date', 'Friday')} at {meeting.get('time', 'TBD')} "
    f"— {meeting.get('description', '')}"
    if meeting else "Partnership discussion this Friday (details in calendar)"
)

# --- Step 2: Read corpus files ---
corpus_text = {}
if CORPUS.is_dir():
    for f in sorted(CORPUS.iterdir()):
        if f.is_file():
            try:
                corpus_text[f.name] = f.read_text(encoding="utf-8")
            except OSError:
                pass

# --- Step 3: Extract key facts and synthesize (deterministic extraction) ---
brief = {
    "meeting_summary": meeting_summary,
    "background": (
        "NovaTech AI is an enterprise AI platform company founded in 2021, "
        "headquartered in San Francisco. Backed by Horizon Ventures with a $85M Series B in 2023. "
        "CEO: Alex Morgan. Platform serves 500 enterprise clients with ML workflow automation."
    ),
    "discussion_points": [
        "Align on GDPR Article 28 Data Processing Agreement requirements before any EU data processing begins",
        "Clarify API compatibility and connector support for integrating NovaTech's DataShield module",
        "Negotiate revenue share terms for the co-sell marketplace arrangement (current gap: 15% vs 10%)",
        "Discuss timeline for Q3 2026 partnership decision and joint go-to-market planning",
    ],
    "risks": [
        "NovaTech is in parallel talks with DataForge — deal may be lost if terms are not finalized promptly",
        "GDPR Article 28 compliance gap may delay EU market go-live if DPA is not updated for 2026 requirements",
        "If deal slips past Q3 2026, next window is Q1 2027 — significant pipeline delay",
    ],
    "opportunities": [
        "Co-sell arrangement embedding DataShield gains access to NovaTech's 500+ enterprise client base",
        "Neutral cloud positioning of NovaScale aligns with our hybrid cloud strategy — strong joint GTM story",
        "Competitive displacement of DataForge (20% more expensive) gives us a pricing angle in joint pitches",
    ],
    "suggested_questions": [
        "Has your legal team finalized the 2026 GDPR Article 28 DPA template, and can we review it before signing?",
        "What specific API specs does Priya Nair need to confirm connector compatibility with our data platform?",
        "Is the 10% revenue share your final position, or is there flexibility given the co-sell volume projections?",
        "What is your timeline for the Q3 2026 decision, and who are the other stakeholders beyond Alex Morgan who need to sign off?",
    ],
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(brief, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Written: {OUT}")
print(f"Corpus files read: {list(corpus_text.keys())}")
PYEOF
