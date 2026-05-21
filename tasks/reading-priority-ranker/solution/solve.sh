#!/usr/bin/env bash
set -euo pipefail

# Reference solution for reading-priority-ranker
# Reads all corpus files, ranks them by importance signals, and writes
# a priority reading list to ~/.openclaw/output/reading_order.md

python3 - <<'PYEOF'
from pathlib import Path

CORPUS_DIR = Path.home() / ".openclaw" / "corpus"
OUTPUT = Path.home() / ".openclaw" / "output" / "reading_order.md"

# Ranked from most to least important with one-line reasons.
# Signals used: explicit deadlines, executive impact, dependency risk.
ranked = [
    (
        "q2_strategic_plan_feedback_deadline.md",
        "Hard deadline Friday EOD for executive offsite Monday — missing this blocks "
        "the plan from being finalized.",
    ),
    (
        "vendor_security_advisory_critical.md",
        "Critical CVE (CVSS 9.1) in DataStream Connector must be patched before "
        "next Monday's production deployment or the deployment is blocked.",
    ),
    (
        "partnership_nda_term_sheet_draft.md",
        "Due diligence deadline this Friday; missing it delays the partnership by a "
        "full quarter.",
    ),
    (
        "ai_industry_landscape_2026.md",
        "Background reading on AI trends — useful context but no action required "
        "and no deadline.",
    ),
    (
        "internal_coding_style_guide_v3.md",
        "Reference document for coding standards — read when convenient, no urgency.",
    ),
    (
        "q3_team_offsite_logistics.md",
        "Q3 offsite logistics — RSVP deadline not until June 15, lowest immediate "
        "priority.",
    ),
]

lines = ["# Priority Reading List\n"]
for rank, (filename, reason) in enumerate(ranked, start=1):
    lines.append(f"{rank}. **{filename}**  ")
    lines.append(f"   Reason: {reason}\n")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Reading order written to {OUTPUT}")
PYEOF
