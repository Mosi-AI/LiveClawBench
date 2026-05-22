"""Email mock for package-build-publish — architect request."""

from flask import Flask, jsonify

app = Flask(__name__)

EMAILS = [
    {
        "id": 1,
        "from": "architect@company.com",
        "to": "agent@company.com",
        "subject": "Internal Python library vectorops — development request",
        "date": "2026-04-12T09:00:00Z",
        "body": (
            "Hi,\n\n"
            "We need an internal Python library `vectorops` that wraps common vector operations.\n\n"
            "I've already prepared the interface specification document (/workspace/vectorops/SPEC.md) and skeleton code. "
            "Please complete the implementation, write unit tests, build the wheel package, and publish it to the internal PyPI server "
            "(http://localhost:8080/).\n\n"
            "Downstream teams need to be able to `pip install vectorops` and use it directly.\n\n"
            "Specific requirements:\n"
            "1. Implement all 6 interfaces of the vectorops library per SPEC.md\n"
            "2. Write pytest tests covering all interfaces\n"
            "3. Build the wheel package and upload to local PyPI\n"
            "4. Confirm pip install succeeds\n\n"
            "PyPI server configuration is under /workspace/pypi-server/, see start.sh for the launch command.\n\n"
            "Thanks!\n"
            "— Architect, Lei Wang"
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
