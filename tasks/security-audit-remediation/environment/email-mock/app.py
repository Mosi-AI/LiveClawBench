#!/usr/bin/env python3
"""
Lightweight email mock service for security-audit-remediation task.
Provides a browser-accessible inbox at http://localhost:5174/
"""

from flask import Flask, jsonify, render_template_string
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CURRENT_USER = {
    "name": "Peter Griffin",
    "email": "peter.griffin@company.local",
}

EMAILS = [
    {
        "id": 1,
        "from_name": "Security Team",
        "from_email": "security@company.local",
        "subject": "Code Audit Report — webapp repository (CRITICAL)",
        "body": """Peter,

We have completed the security audit of the webapp repository (/workspace/webapp/).
Below is a summary of our findings. Immediate remediation is required.

=== CATEGORY 1: Secrets in Git History ===
Severity: CRITICAL

We found multiple API keys and credentials committed to the repository's Git history.
Even though some were "removed" in later commits, they remain accessible via git log.
All leaked secrets must be purged from the ENTIRE commit history, not just the latest revision.

Number of distinct leaked credentials found: 5
Affected files (historically): config.py, app.py, .env

We will not specify exact values here for security reasons. You need to scan the
complete git history yourself and identify all patterns matching API keys, passwords,
and secret tokens.

=== CATEGORY 2: Code Vulnerabilities ===
Severity: HIGH

Static analysis flagged several CWE-class vulnerabilities in the application code:

- CWE-89 (SQL Injection): At least one database query constructs SQL using
  string concatenation with user input instead of parameterized queries.

- CWE-79 (Cross-Site Scripting): User-supplied data is rendered in HTML templates
  without proper escaping. We found at least one instance in the search results page.

- CWE-798 (Use of Hardcoded Credentials): Production credentials are hardcoded
  directly in source files rather than loaded from environment variables.

We have not identified every instance; a thorough review is needed.
All existing pytest tests should pass after your fixes.

=== CATEGORY 3: Credential Rotation ===
Severity: HIGH

All credentials that were leaked in the Git history must be considered compromised
and need to be rotated:

- Generate new random values for all API keys
- Update configuration to use environment variables
- Ensure no hardcoded secrets remain in the codebase

=== DELIVERABLES ===

1. Clean Git history (git log --all -p must not contain any secrets)
2. All pytest tests passing
3. No hardcoded credentials in source code
4. Remediation report at /workspace/output/remediation_report.md

Priority: P0 — Fix before end of day.

Best regards,
InfoSec Team""",
        "date": "2026-04-14 09:15",
        "is_read": False,
    },
    {
        "id": 2,
        "from_name": "Dave Kim",
        "from_email": "dave.kim@company.local",
        "subject": "RE: Audit findings — some context",
        "body": """Hey Peter,

I saw the security audit report. Just wanted to give you some context:

The secrets were introduced early in development when we were prototyping.
I thought I removed them all, but apparently git keeps everything in history.

The app uses SQLite for the user database and a simple Flask backend.
The search feature was built quickly and probably needs better input handling.

The config.py file originally had everything hardcoded — I started moving
things to environment variables but didn't finish.

The pytest test suite in tests/ should cover the main functionality.
Make sure the tests still pass after your changes.

Let me know if you need help understanding the codebase.

- Dave""",
        "date": "2026-04-14 09:45",
        "is_read": True,
    },
]

# ---- HTML Templates (same pattern as cd-pipeline-setup) ----

INBOX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Email - Inbox</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .user-info { color: #666; margin-bottom: 20px; font-size: 14px; }
        .email-list { list-style: none; padding: 0; }
        .email-item { background: white; padding: 15px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid #ccc; }
        .email-item.unread { border-left-color: #dc3545; font-weight: bold; }
        .email-item a { text-decoration: none; color: #333; display: block; }
        .email-subject { font-size: 16px; margin-bottom: 4px; }
        .email-meta { font-size: 12px; color: #888; }
        .email-preview { font-size: 13px; color: #666; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 700px; }
    </style>
</head>
<body>
    <h1>Inbox</h1>
    <div class="user-info">Logged in as: {{ user.name }} &lt;{{ user.email }}&gt;</div>
    <ul class="email-list">
    {% for email in emails %}
        <li class="email-item {{ 'unread' if not email.is_read else '' }}">
            <a href="/email/{{ email.id }}">
                <div class="email-subject">{{ email.subject }}</div>
                <div class="email-meta">From: {{ email.from_name }} &lt;{{ email.from_email }}&gt; | {{ email.date }}</div>
                <div class="email-preview">{{ email.body[:120] }}...</div>
            </a>
        </li>
    {% endfor %}
    </ul>
</body>
</html>"""

EMAIL_DETAIL_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ email.subject }}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .back-link { color: #007bff; text-decoration: none; display: inline-block; margin-bottom: 20px; }
        .email-container { background: white; padding: 24px; border-radius: 8px; }
        .email-header { border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px; }
        .email-subject { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
        .email-meta { font-size: 13px; color: #666; line-height: 1.8; }
        .email-body { white-space: pre-wrap; line-height: 1.6; font-size: 14px; }
    </style>
</head>
<body>
    <a class="back-link" href="/">&larr; Back to Inbox</a>
    <div class="email-container">
        <div class="email-header">
            <div class="email-subject">{{ email.subject }}</div>
            <div class="email-meta">
                <div>From: {{ email.from_name }} &lt;{{ email.from_email }}&gt;</div>
                <div>To: {{ user.email }}</div>
                <div>Date: {{ email.date }}</div>
            </div>
        </div>
        <div class="email-body">{{ email.body }}</div>
    </div>
</body>
</html>"""


@app.route("/")
def inbox():
    return render_template_string(INBOX_HTML, emails=EMAILS, user=CURRENT_USER)


@app.route("/email/<int:email_id>")
def email_detail(email_id):
    email = next((e for e in EMAILS if e["id"] == email_id), None)
    if not email:
        return "Email not found", 404
    return render_template_string(EMAIL_DETAIL_HTML, email=email, user=CURRENT_USER)


@app.route("/api/emails")
def api_emails():
    return jsonify({"emails": EMAILS, "user": CURRENT_USER})


@app.route("/api/emails/<int:email_id>")
def api_email_detail(email_id):
    email = next((e for e in EMAILS if e["id"] == email_id), None)
    if not email:
        return jsonify({"error": "not found"}), 404
    return jsonify(email)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5174, debug=False)
