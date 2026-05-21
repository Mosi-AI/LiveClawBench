#!/usr/bin/env python3
"""Email mock for chaotic-repo-restoration task."""

from flask import Flask, jsonify, render_template_string
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CURRENT_USER = {"name": "Peter Griffin", "email": "peter.griffin@company.local"}

EMAILS = [
    {
        "id": 1,
        "from_name": "Jake Torres",
        "from_email": "jake.torres@company.local",
        "subject": "Handover: Sorry about the codebase mess...",
        "body": """Hi Peter,

I'm really sorry about this. I'm leaving the company at the end of the week, and the `textproc` library codebase at /workspace/codebase/ is kind of a mess.

I was doing some experimental refactoring — moved functions between files, tried out some new helper modules, changed the project config. I honestly lost track of what I changed and what's original.

What I do know:
- The test suite should still be valid (I didn't touch the test assertions), but I think I moved the test files somewhere else at some point
- Some function implementations might be in the wrong file now — I was experimenting with reorganizing the code
- There might be some experimental .py files I added that aren't actually needed
- I might have messed up the requirements.txt or pyproject.toml too
- There are probably some typos I introduced while editing

The good news is the test suite covers everything. If you can get all the tests passing, the library should be back to working condition.

Again, really sorry about this. Good luck!

Jake Torres""",
        "date": "2026-04-14 09:00",
        "is_read": False,
    },
]

INBOX_HTML = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Email - Inbox</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#f5f5f5}
h1{color:#333}.email-list{list-style:none;padding:0}.email-item{background:#fff;padding:15px;margin-bottom:8px;border-radius:8px;border-left:4px solid #dc3545;font-weight:bold}
.email-item a{text-decoration:none;color:#333;display:block}.email-subject{font-size:16px;margin-bottom:4px}.email-meta{font-size:12px;color:#888}</style></head>
<body><h1>Inbox</h1><ul class="email-list">{% for email in emails %}
<li class="email-item"><a href="/email/{{ email.id }}"><div class="email-subject">{{ email.subject }}</div>
<div class="email-meta">From: {{ email.from_name }} | {{ email.date }}</div></a></li>{% endfor %}</ul></body></html>"""

EMAIL_DETAIL_HTML = """<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>{{ email.subject }}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#f5f5f5}
.back-link{color:#007bff;text-decoration:none;margin-bottom:20px;display:inline-block}
.email-container{background:#fff;padding:24px;border-radius:8px}.email-subject{font-size:20px;font-weight:bold;margin-bottom:10px}
.email-meta{font-size:13px;color:#666;border-bottom:1px solid #eee;padding-bottom:15px;margin-bottom:15px}
.email-body{white-space:pre-wrap;line-height:1.6;font-size:14px}</style></head>
<body><a class="back-link" href="/">&larr; Back</a><div class="email-container">
<div class="email-subject">{{ email.subject }}</div>
<div class="email-meta">From: {{ email.from_name }} | {{ email.date }}</div>
<div class="email-body">{{ email.body }}</div></div></body></html>"""


@app.route("/")
def inbox():
    return render_template_string(INBOX_HTML, emails=EMAILS, user=CURRENT_USER)


@app.route("/email/<int:email_id>")
def email_detail(email_id):
    email = next((e for e in EMAILS if e["id"] == email_id), None)
    if not email:
        return "Not found", 404
    return render_template_string(EMAIL_DETAIL_HTML, email=email, user=CURRENT_USER)


@app.route("/api/emails")
def api_emails():
    return jsonify({"emails": EMAILS, "user": CURRENT_USER})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5174, debug=False)
