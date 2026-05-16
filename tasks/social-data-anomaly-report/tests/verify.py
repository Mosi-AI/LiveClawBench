#!/usr/bin/env python3
"""
Verifier for social-data-anomaly-report task (case_id=42).

Checks that the agent sent an anomaly report email via the email mock.
Scoring:
  - 0.3 for sending an email to the correct recipient (data-team@mosi.inc)
  - 0.3 for using the correct subject ("Social Media Data Anomaly Report")
  - 0.4 for mentioning at least 2 of the 3 seeded anomalies in the body

Seeded anomalies:
  1. Post 101: status=published but published_at=NULL
  2. Post 101 metrics: 0 impressions but 50000 likes (impossible)
  3. Post 6: status=draft in DB but action_log says "published" (contradictory)
"""

import sqlite3
import sys

SOCIAL_DB = "/opt/mock/data/social/social.db"
EMAIL_DB = "/var/lib/mock-data/email/email.db"

EXPECTED_RECIPIENT = "data-team@mosi.inc"
EXPECTED_SUBJECT = "Social Media Data Anomaly Report"

# Keywords for detecting each anomaly in the email body.
# Multiple variants per anomaly to catch natural language variation.
ANOMALY_KEYWORDS = {
    "post_101_null_published_at": [
        "101",
        "published_at",
        "published at",
        "missing timestamp",
        "no timestamp",
        "null",
        "missing published",
    ],
    "post_101_impossible_metrics": [
        "50000",
        "50,000",
        "50k",
        "zero impressions",
        "0 impressions",
        "no impressions",
        "likes without impressions",
        "impossible metric",
        "implausible metric",
    ],
    "post_6_status_log_mismatch": [
        "post 6",
        "draft",
        "action log",
        "action_log",
        "status mismatch",
        "contradict",
        "log says published",
        "published but draft",
        "draft but published",
    ],
}


def check_anomaly_mentioned(body: str, anomaly_key: str) -> bool:
    """Check if the body mentions the given anomaly using keyword matching."""
    body_lower = body.lower()
    keywords = ANOMALY_KEYWORDS[anomaly_key]
    # Require at least 2 keywords from the group to confirm a mention
    matched = sum(1 for kw in keywords if kw.lower() in body_lower)
    return matched >= 2


def main():
    score = 0.0
    messages = []

    # --- Step 1: Find the sent email ---
    try:
        email_db = sqlite3.connect(EMAIL_DB)
    except Exception as e:
        messages.append(f"FATAL: Cannot open email database: {e}")
        print(f"Score: {score}/1.0")
        for msg in messages:
            print(f"  {msg}")
        sys.exit(1)

    row = email_db.execute(
        "SELECT subject, body, recipient_email FROM emails "
        "WHERE recipient_email = ? AND folder = 'sent' "
        "ORDER BY id DESC LIMIT 1",
        (EXPECTED_RECIPIENT,),
    ).fetchone()

    if row is None:
        # Also check for any email with matching subject in sent folder
        row = email_db.execute(
            "SELECT subject, body, recipient_email FROM emails "
            "WHERE subject = ? AND folder = 'sent' "
            "ORDER BY id DESC LIMIT 1",
            (EXPECTED_SUBJECT,),
        ).fetchone()

    if row is None:
        messages.append("FAIL: No sent email found matching recipient or subject")
        print(f"Score: {score}/1.0")
        for msg in messages:
            print(f"  {msg}")
        email_db.close()
        sys.exit(0 if score >= 0.5 else 1)

    subject, body, recipient_email = row

    # --- Step 2: Score recipient ---
    if recipient_email == EXPECTED_RECIPIENT:
        score += 0.3
        messages.append(f"PASS: Email sent to correct recipient ({recipient_email})")
    else:
        messages.append(
            f"FAIL: Wrong recipient (got '{recipient_email}', expected '{EXPECTED_RECIPIENT}')"
        )

    # --- Step 3: Score subject ---
    if subject and EXPECTED_SUBJECT.lower() in subject.lower():
        score += 0.3
        messages.append(f"PASS: Correct subject ('{subject}')")
    else:
        messages.append(
            f"FAIL: Wrong subject (got '{subject}', expected '{EXPECTED_SUBJECT}')"
        )

    # --- Step 4: Score anomaly mentions ---
    if not body:
        body = ""

    anomalies_found = 0
    anomaly_details = []
    for anomaly_key in ANOMALY_KEYWORDS:
        if check_anomaly_mentioned(body, anomaly_key):
            anomalies_found += 1
            anomaly_details.append(anomaly_key)

    if anomalies_found >= 2:
        score += 0.4
        messages.append(
            f"PASS: Found {anomalies_found}/3 anomalies in body ({', '.join(anomaly_details)})"
        )
    elif anomalies_found == 1:
        score += 0.2
        messages.append(
            f"PARTIAL: Found only {anomalies_found}/3 anomalies in body ({', '.join(anomaly_details)})"
        )
    else:
        messages.append("FAIL: No anomalies mentioned in email body")

    email_db.close()

    print(f"Score: {score}/1.0")
    for msg in messages:
        print(f"  {msg}")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
