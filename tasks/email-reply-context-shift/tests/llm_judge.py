"""Verifier for email-reply-context-shift (C1).

Checks: final sent email acknowledges the meeting cancellation.
Uses LLM judge to evaluate response quality.
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/email/email.db"


def check_sent_emails():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT subject, body, folder FROM emails WHERE folder = 'sent' ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return rows


def main():
    score = 0.0
    sent_emails = check_sent_emails()

    if not sent_emails:
        print("No sent emails found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(0 if score >= 0.5 else 1)

    # Export for LLM judge
    import json

    emails_data = [{"subject": r[0], "body": r[1], "folder": r[2]} for r in sent_emails]
    with open("/workspace/output/sent_emails.json", "w") as f:
        json.dump(emails_data, f, indent=2)

    # If LLM judge env vars are available, use them; otherwise heuristic check
    import os

    judge_url = os.environ.get("JUDGE_BASE_URL")
    if judge_url:
        sys.path.insert(0, "/tests")
        from llm_judge_core import judge

        prompt = (
            "The agent was asked to reply to an email about a meeting, "
            "but the meeting was cancelled while they were drafting. "
            "Check if the final sent email acknowledges the cancellation. "
            "Score 1.0 if cancellation is clearly acknowledged, "
            "0.3 if there is evidence of adaptation, 0.0 otherwise.\n\n"
            f"Sent emails: {json.dumps(emails_data)}"
        )
        score = judge(prompt)
    else:
        # Heuristic: check if any sent email mentions cancellation keywords
        for subj, body, _ in sent_emails:
            text = (subj + " " + body).lower()
            if any(
                kw in text
                for kw in ["cancel", "cancelled", "postponed", "not happening"]
            ):
                score = max(score, 0.3)
                if any(kw in text for kw in ["reschedule", "new date", "understand"]):
                    score = 1.0
                    break

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
