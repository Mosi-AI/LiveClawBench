#!/usr/bin/env python3
"""
Lightweight email mock service for grpc-service-crash-diagnosis task.
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
        "from_name": "Lisa Yang",
        "from_email": "lisa.yang@company.local",
        "subject": "CRITICAL: KV-Store service keeps crashing under load",
        "body": """Hi Peter,

The KV-Store service has been unstable since last night. We're getting intermittent failures from downstream services that depend on it.

What I've seen so far:
- Single-request testing (one client at a time) seems fine
- Under real production load, things fall apart within minutes
- Some clients report getting back wrong data, or data they wrote disappearing
- I captured a log export from the last incident and dropped it on the server

I've also heard from the infra team that they saw OOM kills around the same time, but I'm not sure if that's related or just a coincidence — our monitoring has been flaky lately.

Could you take a look? The service code should be somewhere under /workspace. The on-call runbook says the project was originally single-threaded but got refactored recently.

Thanks,
Lisa""",
        "date": "2026-04-14 09:30",
        "is_read": False,
    },
    {
        "id": 2,
        "from_name": "Dave Kim",
        "from_email": "dave.kim@company.local",
        "subject": "RE: Weekly infra digest",
        "body": """Team,

Some updates from this week:

1. We migrated the metrics pipeline to the new Prometheus exporter. If you see gaps in Grafana dashboards for the next hour, that's expected.

2. The certificate rotation for *.internal.company.local completed. Old certs expire tomorrow.

3. We're planning to increase the container memory limit for several services next sprint. Current 512MB limit is tight for some workloads.

4. Reminder: the staging cluster will be down Saturday 2-4 AM for kernel updates.

5. The load balancer health check interval was changed from 5s to 2s last week. Some services started showing TRANSIENT_FAILURE in channelz — this is cosmetic and can be ignored unless you see actual request failures.

Dave""",
        "date": "2026-04-14 08:15",
        "is_read": True,
    },
    {
        "id": 3,
        "from_name": "Maria Santos",
        "from_email": "maria.santos@company.local",
        "subject": "RE: Q2 capacity planning",
        "body": """Hi all,

Sharing the Q2 traffic projection. We expect a 3x increase in write operations for the product catalog service. The KV-Store handles most of the session and cache workload, so keep an eye on it.

Also, I noticed the gRPC message size limits are still at the defaults from the initial deployment. We should probably review those before Q2 ramp — some of the batch endpoints might hit limits with larger payloads.

@Peter — can you also check if we have proper connection pooling set up? Last time I looked, some services were creating new channels per request instead of reusing them.

Maria""",
        "date": "2026-04-13 16:45",
        "is_read": True,
    },
]

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
        .email-item { background: white; padding: 15px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid #ccc; cursor: pointer; }
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
