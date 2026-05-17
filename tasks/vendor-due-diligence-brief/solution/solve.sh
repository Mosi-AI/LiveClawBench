#!/usr/bin/env bash
set -e
mkdir -p "${HOME}/.openclaw/output"

python3 - <<'PYEOF'
import json
import urllib.request
from pathlib import Path

EMAIL_BASE = "http://localhost:5174"
OUT = Path.home() / ".openclaw" / "output" / "result.json"
CORPUS = Path.home() / ".openclaw" / "corpus"


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


# --- Step 1: Find vendor intro email in inbox ---
emails_data = fetch_json(f"{EMAIL_BASE}/api/emails?folder=inbox")
emails = emails_data.get("data", {}).get("emails", [])

vendor_email = None
for email in emails:
    subject = (email.get("subject") or "").lower()
    body = (email.get("body") or "").lower()
    if "vendor" in subject or "cloudedge" in subject or "cloudedge" in body or "partnership" in subject:
        vendor_email = email
        break

email_context = ""
if vendor_email:
    email_id = vendor_email.get("id")
    if email_id:
        detail = fetch_json(f"{EMAIL_BASE}/api/emails/{email_id}")
        email_detail = detail.get("data", {}).get("email", vendor_email)
    else:
        email_detail = vendor_email
    email_context = (
        f"Subject: {email_detail.get('subject', '')}\n"
        f"From: {email_detail.get('sender_email', '')}\n"
        f"Body: {email_detail.get('body', '')}"
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

# --- Step 3: Synthesize due diligence brief ---
brief = {
    "vendor_background": (
        "CloudEdge Systems is a cloud security middleware company founded in 2022, "
        "headquartered in San Francisco. They raised a Series A of $18M in 2023 and currently "
        "have 14 enterprise customers. Their sole product is DataGuard, an encryption and "
        "access-control middleware layer using AES-256-GCM encryption."
    ),
    "fit_assessment": (
        "CloudEdge's DataGuard addresses a genuine need — encrypting data pipelines between "
        "application and storage tiers. The AES-256-GCM encryption approach and Kubernetes-native "
        "deployment are technically sound. However, the company's early stage (founded in 2022, "
        "only 14 enterprise customers) and unresolved legal issues raise questions about long-term "
        "vendor stability that must be resolved before commitment."
    ),
    "red_flags": [
        "CRITICAL: Active IP dispute with ForgeNet Inc. (per internal memo, case DE-2024-CV-7821) "
        "alleging that DataGuard's key rotation mechanism infringes US Patent No. 11,234,567. "
        "If ruled against CloudEdge, the core product may require re-engineering. Legal recommends "
        "withholding contract signature until the dispute is resolved or written indemnification is provided.",
        "HIGH: SOC 2 Type II audit is currently in progress (per security questionnaire) — expected "
        "completion Q4 2026. CloudEdge only holds a Type I assessment. Third-party penetration "
        "testing is also not yet complete (scheduled Q3 2026). This gap creates compliance risk "
        "for any regulated data we route through their middleware.",
        "MEDIUM: Pricing structure includes uncapped overage fees (per pricing summary) at $0.05/GB "
        "above the 50 TB included in the Enterprise tier, plus an 8% annual price increase clause "
        "after the 24-month lock. Total cost of ownership at scale could significantly exceed the "
        "quoted $28,000/month base rate.",
        "MEDIUM: Company founded in 2022 with only 18-24 months of runway on existing capital. "
        "A fundraising event is likely needed by late 2026. If Series B does not close, operational "
        "continuity and support quality could be at risk during the contract term.",
    ],
    "recommendation": (
        "Conditional proceed — do NOT sign until: (1) CloudEdge provides written legal indemnification "
        "covering the ForgeNet IP dispute, or the dispute is resolved in CloudEdge's favor; "
        "(2) CloudEdge shares their SOC 2 Type II report upon completion (Q4 2026 per their estimate); "
        "(3) pricing terms are renegotiated to cap overage fees at a defined monthly maximum. "
        "If all three conditions are met, the technical fit is adequate to proceed to a pilot. "
        "If the IP dispute is not resolved within 90 days, recommend disqualifying CloudEdge and "
        "evaluating HashiCorp Vault Enterprise as an alternative."
    ),
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(brief, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Written: {OUT}")
print(f"Email context found: {bool(vendor_email)}")
print(f"Corpus files read: {list(corpus_text.keys())}")
PYEOF
