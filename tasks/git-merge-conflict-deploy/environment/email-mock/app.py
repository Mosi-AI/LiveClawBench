"""Email mock for git-merge-conflict-deploy — Tech Lead message."""

from flask import Flask, jsonify

app = Flask(__name__)

EMAILS = [
    {
        "id": 1,
        "from": "tech-lead@company.com",
        "to": "agent@company.com",
        "subject": "Merge conflict on feature/payment branch — need your help",
        "date": "2026-04-12T10:30:00Z",
        "body": (
            "Hi,\n\n"
            "The feature/payment branch needs to be merged into main, but there are conflicts. "
            "I've tried several times and can't get it sorted — could you take care of it?\n\n"
            "Both branches have important changes; you can't lose either side's functionality during the merge. "
            "You'll need to look at each branch's commit history and code to understand what each one changed.\n\n"
            "Also note there's an abandoned refactor branch and some stashes in the repo — "
            "those are unrelated to this merge, don't get distracted by them.\n\n"
            "Remember to run npm test after the merge.\n\n"
            "Thanks!\n"
            "— Wei Zhang"
        ),
    },
    {
        "id": 2,
        "from": "qa@company.com",
        "to": "agent@company.com",
        "subject": "Re: Merge plan — test coverage notes",
        "date": "2026-04-12T09:15:00Z",
        "body": (
            "Hi,\n\n"
            "Regarding this merge — the test cases already cover all expected functionality after merging. "
            "If your merge is correct, npm test should pass entirely.\n\n"
            "Note that some tests check whether functions exist and verify return value precision, "
            "so be careful with the behavioral semantics of each function during the merge.\n\n"
            "Good luck!\n"
            "— QA Team"
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
