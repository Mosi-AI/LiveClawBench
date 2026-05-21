#!/usr/bin/env python3
"""
Verifier for faq-proof-bundle-from-js-docs.

Checks /workspace/faq_proof/:
- summary.md exists with ≥1 URL per claim (SSO, audit logs, data export)
- sso_evidence.txt          ≥80 chars, contains seed phrase "single sign-on via SAML 2.0"
- audit_logs_evidence.txt   ≥80 chars, contains seed phrase "audit log retention 90 days"
- data_export_evidence.txt  ≥80 chars, contains seed phrase "export in CSV or JSON format"
- No file contains the archived-page sentence
- No URL in summary.md matches /archive/ prefix

Scoring:
  1.0 — all checks pass
  0.5 — some files present/partially correct but at least one claim has evidence
  0.0 — proof bundle missing or all evidence from archived page
"""
import json
import re
import sys
from pathlib import Path

PROOF_DIR = Path("/home/node/.openclaw/workspace/faq_proof")
REWARD_TXT = Path("/logs/verifier/reward.txt")
REWARD_JSON = Path("/logs/verifier/reward.json")

ARCHIVE_SENTENCE = "This page has been archived and may contain outdated information."
ARCHIVE_URL_PREFIX = "/archive/"

EVIDENCE_FILES = {
    "sso": {
        "filename": "sso_evidence.txt",
        "seed_phrase": "single sign-on via SAML 2.0",
        "min_len": 80,
    },
    "audit_logs": {
        "filename": "audit_logs_evidence.txt",
        "seed_phrase": "audit log retention 90 days",
        "min_len": 80,
    },
    "data_export": {
        "filename": "data_export_evidence.txt",
        "seed_phrase": "export in CSV or JSON format",
        "min_len": 80,
    },
}

URL_ALLOWLIST = {"/docs/sso", "/docs/audit-logs", "/docs/data-export", "/faq"}


def find_urls(text: str) -> list[str]:
    # Match http://... or relative paths like /docs/sso
    patterns = [
        r'https?://[^\s\)\]\>\"\']+',
        r'/(?:docs|faq)[^\s\)\]\>\"\']*',
    ]
    urls: list[str] = []
    for pat in patterns:
        urls.extend(re.findall(pat, text))
    # Normalize: strip host from full URLs to just path
    normalised = []
    for u in urls:
        if u.startswith("http"):
            # extract path
            m = re.search(r'https?://[^/]+(/.*)$', u)
            if m:
                normalised.append(m.group(1).rstrip(".,;)>\"'"))
        else:
            normalised.append(u.rstrip(".,;)>\"'"))
    return normalised


def main() -> None:
    errors: list[str] = []
    passed: list[str] = []

    # Check proof directory exists
    if not PROOF_DIR.exists():
        score = 0.0
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(json.dumps({"reward": score, "_meta_errors": ["faq_proof/ directory not found"]}))
        print("Score: 0.0/1.0")
        sys.exit(1)

    # Check summary.md
    summary_path = PROOF_DIR / "summary.md"
    summary_ok = True
    summary_archive_contaminated = False
    if not summary_path.exists():
        errors.append("summary.md not found in faq_proof/")
        summary_ok = False
    else:
        summary_text = summary_path.read_text(encoding="utf-8", errors="replace")
        urls_in_summary = find_urls(summary_text)

        if ARCHIVE_SENTENCE in summary_text:
            errors.append("summary.md contains the archived-page sentence — sourced from wrong page")
            summary_archive_contaminated = True

        archive_urls_found = [u for u in urls_in_summary if ARCHIVE_URL_PREFIX in u]
        if archive_urls_found:
            errors.append(f"summary.md contains archive URLs: {archive_urls_found}")
            summary_archive_contaminated = True

        # Check at least one URL per claim keyword
        claims_found = 0
        for keyword in ("SSO", "sso", "single sign-on", "audit log", "Audit log", "data export", "Data export"):
            if keyword.lower() in summary_text.lower():
                claims_found += 1
        if claims_found < 3:
            errors.append(f"summary.md appears to cover only {claims_found}/3 required claims (SSO, audit logs, data export)")
            summary_ok = False
        else:
            passed.append("summary.md covers all 3 claims")

    # Check each evidence file
    evidence_scores: dict[str, bool] = {}
    for key, spec in EVIDENCE_FILES.items():
        fpath = PROOF_DIR / spec["filename"]
        if not fpath.exists():
            errors.append(f"{spec['filename']} not found")
            evidence_scores[key] = False
            continue

        text = fpath.read_text(encoding="utf-8", errors="replace")

        if ARCHIVE_SENTENCE in text:
            errors.append(f"{spec['filename']}: contains archived-page sentence — sourced from wrong page")
            evidence_scores[key] = False
            continue

        if len(text.strip()) < spec["min_len"]:
            errors.append(f"{spec['filename']}: too short ({len(text.strip())} chars, minimum {spec['min_len']})")
            evidence_scores[key] = False
            continue

        if spec["seed_phrase"].lower() not in text.lower():
            errors.append(
                f"{spec['filename']}: missing required seed phrase '{spec['seed_phrase']}'"
            )
            evidence_scores[key] = False
            continue

        passed.append(f"{spec['filename']}: OK")
        evidence_scores[key] = True

    # Compute score
    n_evidence_ok = sum(1 for ok in evidence_scores.values() if ok)
    all_ok = (
        summary_ok
        and not summary_archive_contaminated
        and n_evidence_ok == 3
    )

    if all_ok:
        score = 1.0
    elif n_evidence_ok > 0 and not summary_archive_contaminated:
        score = 0.5
    else:
        score = 0.0

    REWARD_TXT.write_text(f"{score}\n")
    REWARD_JSON.write_text(
        json.dumps({
            "reward": score,
            "evidence_ok": n_evidence_ok,
            "summary_ok": summary_ok,
            "_meta_errors": errors,
            "_meta_passed": passed,
        })
    )
    print(f"Score: {score}/1.0  (evidence files ok: {n_evidence_ok}/3, summary ok: {summary_ok})")
    for err in errors[:10]:
        print(f"  - {err}")
    if score < 0.5:
        sys.exit(1)


if __name__ == "__main__":
    main()
