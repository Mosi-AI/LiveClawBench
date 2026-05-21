#!/usr/bin/env python3
"""Email mock service for legacy-stack-migration-deploy task."""

from flask import Flask, jsonify, render_template_string
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CURRENT_USER = {"name": "Peter Griffin", "email": "peter.griffin@company.local"}

EMAILS = [
    {
        "id": 1,
        "from_name": "Alice Chen",
        "from_email": "alice.chen@company.local",
        "subject": "Re: climate_tools upgrade",
        "body": """Hi Peter,

Quick follow-up on our earlier conversation — the data-science team is still blocked on the climate_tools library. They've moved their entire pipeline to Python 3 and our package won't even import. We need to get it working and published to our internal package registry so they can install it.

I believe there's a PyPI server somewhere in the workspace that was set up a while back, though I'm not sure if it ever ran properly. Jake mentioned he had trouble getting it started last month.

Can you take a look and get everything sorted? The DS team just needs to be able to pip-install the library and use it from Python 3.

Thanks,
Alice""",
        "date": "2026-04-14 10:00",
        "is_read": False,
    },
    {
        "id": 2,
        "from_name": "Jake Rivera",
        "from_email": "jake.rivera@company.local",
        "subject": "Infrastructure digest — April",
        "body": """Team,

Monthly infra update:

- We've migrated the container registry to Harbor. Old images are still available for 30 days.
- Port allocation reminder: services should register ports in the wiki before binding. We've had collisions on 5000 and 9090 this month.
- The Python 3.12 base image has been promoted to default for all new services. Legacy 2.7 images will be decommissioned by end of Q2.
- Disk quotas on /workspace volumes increased to 10GB per project.

Let me know if you hit any issues.

Jake
Platform Engineering""",
        "date": "2026-04-13 16:30",
        "is_read": True,
    },
    {
        "id": 3,
        "from_name": "Priya Patel",
        "from_email": "priya.patel@company.local",
        "subject": "Re: climate_tools — test suite question",
        "body": """Hi Peter,

Just a heads-up about climate_tools: I noticed the test suite exercises most of the public functions but a few of the newer utilities (export, sorting) aren't covered yet. Also be careful with the build configuration — I think someone set it up ages ago targeting Python 2 and it may need updating.

Let me know if you need anything from the DS side.

Priya
Data Science""",
        "date": "2026-04-14 11:15",
        "is_read": False,
    },
]

INBOX_HTML = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Email - Inbox</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#f5f5f5}
h1{color:#333}.email-list{list-style:none;padding:0}.email-item{background:#fff;padding:15px;margin-bottom:8px;border-radius:8px;border-left:4px solid #ccc}
.email-item.unread{border-left-color:#dc3545;font-weight:bold}.email-item a{text-decoration:none;color:#333;display:block}
.email-subject{font-size:16px;margin-bottom:4px}.email-meta{font-size:12px;color:#888}</style></head>
<body><h1>Inbox</h1>
<ul class="email-list">{% for email in emails %}
<li class="email-item {{ 'unread' if not email.is_read else '' }}"><a href="/email/{{ email.id }}">
<div class="email-subject">{{ email.subject }}</div>
<div class="email-meta">From: {{ email.from_name }} | {{ email.date }}</div></a></li>{% endfor %}</ul></body></html>"""

EMAIL_DETAIL_HTML = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>{{ email.subject }}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#f5f5f5}
.back-link{color:#007bff;text-decoration:none;margin-bottom:20px;display:inline-block}
.email-container{background:#fff;padding:24px;border-radius:8px}.email-subject{font-size:20px;font-weight:bold;margin-bottom:10px}
.email-meta{font-size:13px;color:#666;border-bottom:1px solid #eee;padding-bottom:15px;margin-bottom:15px}
.email-body{white-space:pre-wrap;line-height:1.6;font-size:14px}</style></head>
<body><a class="back-link" href="/">&larr; Back</a>
<div class="email-container"><div class="email-subject">{{ email.subject }}</div>
<div class="email-meta">From: {{ email.from_name }} &lt;{{ email.from_email }}&gt; | {{ email.date }}</div>
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
