#!/usr/bin/env bash
set -euo pipefail

# Reference solution for email-thread-background-summary
# Reads the project kickoff email, identifies Nova Analytics Platform,
# reads relevant corpus files, and writes a background summary.

python3 - <<'PYEOF'
import re
import urllib.request
import urllib.parse
import json
from pathlib import Path

EMAIL_BASE = "http://localhost:5174"
OUTPUT = Path.home() / ".openclaw" / "output" / "project_background.txt"
CORPUS_DIR = Path.home() / ".openclaw" / "corpus"

def login():
    data = json.dumps({"username": "peter", "password": "peter123"}).encode()
    req = urllib.request.Request(
        f"{EMAIL_BASE}/api/auth/login",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    return resp["data"]["access_token"]

def get_emails(token):
    req = urllib.request.Request(
        f"{EMAIL_BASE}/api/emails?folder=inbox",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read()).get("data", {}).get("emails", [])

token = login()
emails = get_emails(token)

# Find the Nova Analytics Platform project email
project_email = None
for e in emails:
    if "nova analytics platform" in (e.get("subject") or "").lower():
        project_email = e
        break

if not project_email:
    raise RuntimeError("Nova Analytics Platform email not found")

project_name = "Nova Analytics Platform"
print(f"Found project email: {project_email['subject']}")

# Read relevant corpus files (exclude Signal Enhancement Suite)
corpus_texts = {}
for f in sorted(CORPUS_DIR.glob("nova_*.md")):
    corpus_texts[f.stem] = f.read_text(encoding="utf-8")

# Build background summary
summary_lines = [
    f"# Project Background Summary: {project_name}",
    "",
    "## Overview",
    "The Nova Analytics Platform is a company-wide initiative to replace fragmented "
    "reporting with a unified data analytics layer. Approved budget: $2 million (FY2026).",
    "",
    "## Goals",
    "- Provide a single data warehouse accessible to all business units.",
    "- Reduce reporting lag from 3–5 days to near-real-time.",
    "- Enable self-serve analytics; retire four legacy reporting scripts.",
    "",
    "## Timeline",
    "Target general availability: Q3 2026.",
    "Key milestones: architecture sign-off May 2026, data migration July 2026, "
    "internal beta August 2026.",
    "",
    "## Team",
    "Project Lead: Dr. Sarah Kim (Head of Data Engineering).",
    "Architecture Lead: Marcus Osei. Business Analyst: Priya Nair.",
    "Sponsor: VP Engineering James Thornton.",
    "",
    "## Technology Stack",
    "- Ingestion: Apache Kafka (Confluent Cloud) with CDC connectors.",
    "- Transformation: dbt with 15-minute refresh cycles.",
    "- Storage: BigQuery (GCP); PII fields tokenized before landing.",
    "- Visualization: Looker dashboards; self-serve via BigQuery Studio.",
    "",
    "## Key Stakeholders",
    "- Marketing (Lisa Torres): campaign performance dashboards.",
    "- Finance (Alan Marsh): P&L roll-up by cost center.",
    "- Sales Operations (Jenny Park): real-time pipeline visibility.",
    "",
    "## Known Risks",
    "- Data migration scope may exceed estimates (mitigated by phased approach).",
    "- Kafka CDC connector instability on legacy DB (pilot on staging first).",
    "- BigQuery cost overrun from unoptimized queries (query cost caps enforced).",
    "- Stakeholder adoption risk — teams reverting to old reports (change management plan).",
]

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
print(f"Summary written to {OUTPUT}")
PYEOF
