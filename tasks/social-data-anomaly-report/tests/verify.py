#!/usr/bin/env python3
"""
Verifier for social-data-anomaly-report task (case_id=53).

Checks that the agent sent an anomaly report email via the email mock.
Scoring:
  - 0.1 for sending an email to the correct recipient (data-team@mosi.inc)
  - 0.4 for using the correct subject ("Social Media Data Anomaly Report")
  - 0.5 for mentioning at least 2 of the 3 seeded anomalies in the body

Seeded anomalies:
  1. Post 101: status=published but published_at=NULL
  2. Post 101 metrics: 0 impressions but 50000 likes (impossible)
  3. Post 6: status=draft in DB but action_log says "published" (contradictory)

Single-row guarantee: recipient/subject/body are all scored against the SAME
sent email row. We pick one row that best matches the expected recipient and
subject (preferring full matches), then read all three fields from it. This
prevents cross-row stitching where the recipient-match row and the
subject-match row are different emails.

Completion gate: the anomaly report body is the required workflow artifact.
When fewer than 2 anomalies are mentioned (anomalies_found < 2), the final
score is capped at 0.4 — below the 0.5 success threshold. A correctly
addressed email with an empty or off-topic body must not pass.
"""

import sqlite3
import sys

SOCIAL_DB = "/opt/mock/data/social/social.db"


def token_f1(expected: str, actual: str) -> float:
    """Compute token-level F1 between two strings."""
    expected_tokens = set(expected.lower().split())
    actual_tokens = set(actual.lower().split())
    if not expected_tokens or not actual_tokens:
        return 0.0
    matched = expected_tokens & actual_tokens
    precision = len(matched) / len(actual_tokens)
    recall = len(matched) / len(expected_tokens)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


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
    except sqlite3.Error as e:
        messages.append(f"FATAL: Cannot open email database: {type(e).__name__}: {e}")
        print(f"Score: {score}/1.0")
        for msg in messages:
            print(f"  {msg}")
        sys.exit(1)

    # Single-row lookup: find the best-matching sent email and score all three
    # dimensions (recipient, subject, body) against it. Prefer rows that match
    # BOTH the expected recipient AND subject, then recipient-only, then any
    # sent email whose subject contains the expected subject. This guarantees
    # recipient/subject/body credit cannot be stitched together from different
    # sent emails.
    subject_like = f"%{EXPECTED_SUBJECT}%"
    row = email_db.execute(
        "SELECT subject, body, recipient_email FROM emails "
        "WHERE folder = 'sent' "
        "  AND (recipient_email = ? OR subject LIKE ?) "
        "ORDER BY "
        "  (recipient_email = ? AND subject LIKE ?) DESC, "
        "  (recipient_email = ?) DESC, "
        "  id DESC LIMIT 1",
        (
            EXPECTED_RECIPIENT,
            subject_like,
            EXPECTED_RECIPIENT,
            subject_like,
            EXPECTED_RECIPIENT,
        ),
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
        score += 0.1
        messages.append(f"PASS: Email sent to correct recipient ({recipient_email})")
    else:
        messages.append(
            f"FAIL: Wrong recipient (got '{recipient_email}', "
            f"expected '{EXPECTED_RECIPIENT}')"
        )

    # --- Step 3: Score subject (F1-based) ---
    subject_f1 = token_f1(EXPECTED_SUBJECT, subject or "")
    if subject_f1 >= 0.5:
        score += 0.4
        messages.append(f"PASS: Correct subject ('{subject}', F1={subject_f1:.2f})")
    else:
        messages.append(
            f"FAIL: Wrong subject (got '{subject}', "
            f"F1={subject_f1:.2f} against '{EXPECTED_SUBJECT}')"
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
        score += 0.5
        messages.append(
            f"PASS: Found {anomalies_found}/3 anomalies in body "
            f"({', '.join(anomaly_details)})"
        )
    else:
        messages.append("FAIL: No anomalies mentioned in email body")

    email_db.close()

    # Completion gate: the anomaly report body is the required workflow artifact.
    # Recipient (0.1) + subject (0.4) = 0.5 alone reaches the 0.5 success
    # threshold even with an empty or off-topic body. Cap the final score at 0.4
    # whenever fewer than 2 anomalies are mentioned, so a correctly-addressed
    # but content-empty email cannot pass.
    if anomalies_found < 2:
        capped = min(score, 0.4)
        if capped < score:
            messages.append(
                f"GATE: Required workflow artifact missing — score capped from "
                f"{score:.1f} to {capped:.1f} "
                f"(need >= 2 anomalies mentioned, got {anomalies_found})"
            )
        score = capped

    print(f"Score: {score}/1.0")
    for msg in messages:
        print(f"  {msg}")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
