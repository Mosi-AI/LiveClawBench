import os

from flask import Flask
from flask_cors import CORS
from sqlalchemy import event

from models import db, User, Email, Attachment

# Module-level Flask app for verifier imports.
# Verifiers do: from app import app
# And: email_module = importlib.util.module_from_spec(...); email_module.app; email_module.Email
app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or "dev-secret-key-change-in-production"
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL"
) or "sqlite:////var/lib/mock-data/email/email.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])

with app.app_context():
    @event.listens_for(db.engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    db.create_all()


@app.errorhandler(404)
def not_found(error):
    from flask import jsonify
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    from flask import jsonify
    db.session.rollback()
    return jsonify({"error": "Internal server error"}), 500


@app.route("/health")
def health():
    from flask import jsonify
    return jsonify({"ok": True})


# Re-export models at module level so dynamic imports (e.g. flight-cancel-claim)
# can access them as email_module.Email, email_module.User, etc.
# TYPE-A verifiers use: from models import Email
