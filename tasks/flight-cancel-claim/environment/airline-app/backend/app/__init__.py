from flask import Flask
from flask_cors import CORS

from app.models import db
from app.utils import init_utils


def create_app(config_name="default"):
    """Application factory"""
    from config import config

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)

    # Simple CORS configuration for development
    CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])
    init_utils(app)

    # Create instance folder if it doesn't exist
    import os

    instance_path = os.path.join(app.root_path, "..", "instance")
    if not os.path.exists(instance_path):
        os.makedirs(instance_path)

    # Register blueprints
    from app.routes.announcements import announcements_bp
    from app.routes.auth import auth_bp
    from app.routes.baggage import baggage_bp
    from app.routes.bookings import bookings_bp
    from app.routes.checkin import checkin_bp
    from app.routes.claims import claims_bp
    from app.routes.faq import faq_bp
    from app.routes.flights import flights_bp
    from app.routes.info import info_bp
    from app.routes.mock import mock_bp
    from app.routes.profile import profile_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(flights_bp, url_prefix="/api/flights")
    app.register_blueprint(bookings_bp, url_prefix="/api/bookings")
    app.register_blueprint(checkin_bp, url_prefix="/api/checkin")
    app.register_blueprint(claims_bp, url_prefix="/api/claims")
    app.register_blueprint(mock_bp, url_prefix="/api/mock")
    app.register_blueprint(announcements_bp, url_prefix="/api/announcements")
    app.register_blueprint(faq_bp, url_prefix="/api/faq")
    app.register_blueprint(baggage_bp, url_prefix="/api/baggage")
    app.register_blueprint(info_bp, url_prefix="/api/info")
    app.register_blueprint(profile_bp, url_prefix="/api/profile")

    # Create database tables
    with app.app_context():
        db.create_all()

    # Register error handlers
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
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    return app
