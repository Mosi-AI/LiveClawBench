"""Email mock for microservice-stack-deploy — Tech Lead demo reminder."""

from flask import Flask, jsonify

app = Flask(__name__)

EMAILS = [
    {
        "id": 1,
        "from": "tech-lead@company.com",
        "to": "agent@company.com",
        "subject": "Urgent: Full service stack must be deployed before client demo",
        "date": "2026-04-12T13:00:00Z",
        "body": (
            "Hi,\n\n"
            "The client demo is in 1 hour — we need the entire service stack up and running.\n\n"
            "The source code is under /workspace/services/. This stack was previously deployed with docker-compose, "
            "but we've migrated to a single-container environment, so the old configs may not work directly.\n\n"
            "You need to figure out how to connect the services together and ensure data can be fully operated on from the browser.\n"
            "Nginx is installed but the config might be outdated — please check it.\n\n"
            "Please hurry, time is tight!\n"
            "— Wei Zhang"
        ),
    },
    {
        "id": 2,
        "from": "ops@company.com",
        "to": "team@company.com",
        "subject": "Infrastructure Migration Notice",
        "date": "2026-04-11T09:00:00Z",
        "body": (
            "Team,\n\n"
            "Reminder: we have migrated from docker-compose to single-container deployment. "
            "Previous service names (e.g. kv-store, api-server) no longer resolve as DNS in the new environment. "
            "Please adjust inter-service communication addresses accordingly when deploying.\n\n"
            "Also, in March the kv-store had a port change due to a conflict with the monitoring service. "
            "I don't remember the exact port it was changed to — please refer to the actual code.\n\n"
            "Contact the platform team if you have questions.\n"
            "— Ops Team"
        ),
    },
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
