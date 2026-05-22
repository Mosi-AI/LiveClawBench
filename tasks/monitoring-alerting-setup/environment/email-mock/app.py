"""Email mock for monitoring-alerting-setup — ops lead message."""

from flask import Flask, jsonify

app = Flask(__name__)

EMAILS = [
    {
        "id": 1,
        "from": "ops-lead@company.com",
        "to": "agent@company.com",
        "subject": "Urgent: Monitoring must be set up before maintenance window",
        "date": "2026-04-12T14:00:00Z",
        "body": (
            "Hi,\n\n"
            "The system enters a maintenance window in 2 hours (16:00-18:00). "
            "Monitoring and alerting must be set up before maintenance — "
            "otherwise we'll have no visibility if something goes wrong.\n\n"
            "Two core services are currently running:\n"
            "- API Server (port 5000): handles client requests\n"
            "- Worker (port 5001): background task processing\n\n"
            "What you need to do:\n"
            "1. Add Prometheus /metrics endpoints to both services\n"
            "2. Configure Prometheus scrape rules\n"
            "3. Create a Dashboard in Grafana (http://localhost:3000/)\n"
            "4. Set up alert rules (alert when error_count > 0)\n"
            "5. Write an operations guide for future maintenance\n\n"
            "The prometheus_client library is already installed. Grafana supports HTTP API for Dashboard management.\n\n"
            "Please hurry, this is urgent!\n\n"
            "— Ops Lead, Ming Li"
        ),
    }
]


@app.route("/")
def index():
    return "<h1>Email System</h1><p>API: GET /api/emails</p>"


@app.route("/api/emails")
def list_emails():
    return jsonify(EMAILS)


@app.route("/api/emails/<int:eid>")
def get_email(eid):
    for e in EMAILS:
        if e["id"] == eid:
            return jsonify(e)
    return jsonify({"error": "not found"}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5174)
