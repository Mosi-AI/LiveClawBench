#!/usr/bin/env bash
set -euo pipefail

mkdir -p ~/.openclaw/output

python3 - <<'EOF'
import json, urllib.request, urllib.parse, os, glob
from pathlib import Path

# 1. Authenticate with calendar
base = "http://localhost:5003"
payload = json.dumps({"email": "peter.griffin@work.mosi.inc", "password": "password123"}).encode()
req = urllib.request.Request(f"{base}/api/auth/login", data=payload,
                             headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req) as r:
    token = json.loads(r.read())["access_token"]

# 2. List events, find Thursday's analyst call
req2 = urllib.request.Request(f"{base}/api/events",
                               headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(req2) as r:
    events = json.loads(r.read())["events"]

call_event = next(
    (e for e in events if "NXL" in e.get("title", "")),
    None
)
company = "Nexaline Therapeutics"  # resolved from NXL ticker via corpus
quarter = "Q3 2024"  # resolved from event title

# Extract calendar date/time for the Call Details section
if call_event:
    start_dt = call_event["start_time"]  # e.g. "2026-05-22T14:00:00"
    call_date = start_dt[:10]
    call_time = start_dt[11:16]  # "14:00"
    call_details_line = f"{call_event['title']} — {call_date}, {call_time}–16:00"
else:
    call_details_line = "NXL Q3 Investor Call — date/time unavailable"

# 3. Read corpus
corpus = Path.home() / ".openclaw/corpus"
texts = {f.name: f.read_text() for f in corpus.glob("*.md")
         if "q1_overview_archived" not in f.name}  # skip stale file

# 4. Write updated Q&A pack
out = Path.home() / ".openclaw/output/analyst_qna.md"
out.write_text(f"""# {company} — {quarter} Analyst Call Q&A Pack

> Updated from previous draft to reflect Q3 2024 materials.

## Call Details
{call_details_line}

## Q&A Pairs

### Q: How did NXL-7 perform commercially in Q3?
**A:** NXL-7 generated $41.6M in product revenue in Q3 2024, with 847 new patient initiations
and gross margin of 78.4% — up from 75.1% in Q2. Cumulative patient total reached 2,341.

### Q: What is the total revenue and net loss for Q3?
**A:** Total revenue was $58.4M (Q3 2024), up 38.7% year-over-year. Net loss improved to
$(8.3M) versus $(11.6M) in Q2 2024.

### Q: What is the current cash position?
**A:** Cash and equivalents at end of Q3 2024 were $312M. The Tanaka Pharma upfront payment
($45M) is expected to close in Q4, further strengthening the balance sheet.

### Q: What is the updated FY2024 revenue guidance?
**A:** Guidance was raised to $210–220M for FY2024 (prior guidance was $190–205M).

### Q: What is the status of NXL-12 and when is the interim readout?
**A:** NEXUS-301 enrollment completed in October 2024 (n=620). The interim readout
(60% information fraction) is expected in Q1 2025. We do not provide probability of success guidance.

### Q: What happens if the NXL-12 interim fails?
**A:** NXL-7 provides a sustainable commercial base, and our $312M cash position funds
operations through H2 2026 without NXL-12. Next priorities would be NXL-19 and NXL-31.

### Q: What is the competitive situation for NXL-7?
**A:** Zephyr Oncology's ZPH-4 filed for accelerated approval in August 2024, with decision
expected Q1 2025. We acknowledge the competition but believe NXL-7's activity in the C797S
mutation profile and the Tanaka Pharma licensing deal (validation of long-term value) support
our competitive position.

### Q: What is the NXL-19 timeline?
**A:** Dose escalation (Part A) is complete; recommended dose is 300 mg Q4W. The registrational
trial (CLARITY-2) design is under FDA review. Trial start is targeted Q2 2025, pending SPA agreement.

### Q: What is the NXL-31 Phase 1 status?
**A:** First-in-human dosing initiated in August 2024 with three cohorts completed. Early data
show serum ceruloplasmin reduction at 200 mg with no serious adverse events reported.

### Q: Any business development news?
**A:** We announced a licensing agreement with Tanaka Pharma for NXL-7 rights in Japan and Korea:
$45M upfront plus up to $120M in milestones. This validates the NXL-7 franchise internationally.

## Risk Topics

1. **NXL-12 interim analysis** — Binary outcome; if the futility boundary is crossed, the trial
   may be stopped. Analysts will probe confidence and valuation impact. Do not speculate on PoS.

2. **Competitive pressure on NXL-7** — Zephyr Oncology's ZPH-4 approval decision is expected
   in Q1 2025 and overlaps with NXL-7's second-line EGFR+ NSCLC indication. Be prepared to
   discuss the C797S differentiation without dismissing the competitive risk.

3. **NXL-19 SPA negotiation risk** — The FDA has previously requested additional endpoints
   before agreeing to the registrational trial design. A failed SPA negotiation would delay
   the Q2 2025 trial start. Do not commit to the timeline as definitive.

## Do Not Say

- **Do not cite Q2 revenue of $47.2M as the current figure** — Q3 revenue is $58.4M.
- **Do not say "no near-term competitor approval risk"** — ZPH-4 has filed for accelerated
  approval with a Q1 2025 decision; this is a material near-term risk.
- **Do not speculate on NXL-12 probability of success** — do not give numerical estimates
  or say "we're confident it will work."
- **Do not commit to the Q2 2025 NXL-19 trial start as definitive** — say "pending SPA agreement."
- **Do not discuss the Patheon manufacturing concentration** — not publicly disclosed;
  refer to 10-Q risk factors only if directly asked.
""")
print("Saved:", out)
EOF
