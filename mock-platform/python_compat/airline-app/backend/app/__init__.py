from flask import Flask
from flask_cors import CORS
from sqlalchemy import event

from app.models import db
from app.utils import init_utils


def create_app(config_name="default"):
    """Application factory for the python_compat ORM bridge.

    This Flask app connects to the same SQLite database as the Bun airline mock.
    It does NOT register any routes or serve any HTTP requests — it exists solely
    so that verifier scripts can import SQLAlchemy models and query the shared DB.
    """
    from config import config

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])
    init_utils(app)

    import os

    instance_path = os.path.join(app.root_path, "..", "instance")
    if not os.path.exists(instance_path):
        os.makedirs(instance_path)

    with app.app_context():
        # Register PRAGMA listener on the engine inside app context
        # so db.engine can resolve SQLALCHEMY_DATABASE_URI.
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

        return jsonify({"success": False, "message": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        from flask import jsonify

        db.session.rollback()
        return jsonify({"success": False, "message": "Internal server error"}), 500

    @app.route("/health")
    def health():
        from datetime import datetime

        from flask import jsonify

        return jsonify(
            {
                "success": True,
                "message": "Server is running",
                "timestamp": datetime.now().isoformat(),
            }
        )

    return app
