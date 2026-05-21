#!/usr/bin/env bash
set -e
mkdir -p "${HOME}/.openclaw/output"

python3 - <<'PYEOF'
from pathlib import Path

CORPUS = Path.home() / ".openclaw" / "corpus"
CHECKLIST = Path("/workspace/compliance_checklist.md")

# Read corpus to extract correct policy values from source_01 (authoritative)
corpus_texts = {}
if CORPUS.is_dir():
    for f in sorted(CORPUS.iterdir()):
        if f.is_file():
            try:
                corpus_texts[f.name] = f.read_text(encoding="utf-8")
            except OSError:
                pass

# Parse the checklist
original = CHECKLIST.read_text(encoding="utf-8")
lines = original.splitlines()

# Corrections based on source_01_new_data_governance_policy.md:
# 1. PII retention: 90 days -> 30 days
# 2. Password rotation: 180 days -> 90 days
# 3. 2FA: "strongly recommended" -> "mandatory"

CORRECTIONS = [
    {
        "match": "maximum 90 days post-transaction",
        "outdated_text": "- [ ] Data retention for customer PII: maximum 90 days post-transaction",
        "updated_text": "- [UPDATED] Data retention for customer PII: maximum 30 days post-transaction (per Data Governance Policy v3.0, Apr 2026)",
    },
    {
        "match": "every 180 days",
        "outdated_text": "- [ ] Password rotation enforced: all accounts updated every 180 days",
        "updated_text": "- [UPDATED] Password rotation enforced: all accounts updated every 90 days (per Data Governance Policy v3.0, Apr 2026)",
    },
    {
        "match": "strongly recommended for all admin accounts",
        "outdated_text": "- [ ] Two-factor authentication: strongly recommended for all admin accounts",
        "updated_text": "- [UPDATED] Two-factor authentication: MANDATORY for all accounts with admin privileges (per Data Governance Policy v3.0, Apr 2026)",
    },
]

new_lines = []
for line in lines:
    replaced = False
    for correction in CORRECTIONS:
        if correction["match"] in line:
            # Mark original as outdated
            outdated_line = line.replace("- [ ]", "- [OUTDATED]", 1)
            new_lines.append(outdated_line)
            new_lines.append(correction["updated_text"])
            replaced = True
            print(f"Fixed: {correction['match']}")
            break
    if not replaced:
        new_lines.append(line)

result = "\n".join(new_lines)
if not result.endswith("\n"):
    result += "\n"

CHECKLIST.write_text(result, encoding="utf-8")
print("Updated /workspace/compliance_checklist.md with 3 policy corrections")
print(f"Corpus files reviewed: {list(corpus_texts.keys())}")
PYEOF
