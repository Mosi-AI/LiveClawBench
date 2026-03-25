from app.models import db
from app.models.user import User
from flask import Blueprint, jsonify, request

profile_bp = Blueprint("profile", __name__)

# Use default user ID for auto-login
DEFAULT_USER_ID = 1


@profile_bp.route("/", methods=["GET"])
def get_profile():
    """Get current user profile"""
    try:
        # Use default user for auto-login
        user = User.query.get(DEFAULT_USER_ID)

        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        return jsonify({"success": True, "data": user.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@profile_bp.route("/", methods=["PUT"])
def update_profile():
    """Update user profile"""
    try:
        # Use default user for auto-login
        user = User.query.get(DEFAULT_USER_ID)

        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        data = request.get_json()

        # Update allowed fields
        if "first_name" in data:
            user.first_name = data["first_name"]
        if "last_name" in data:
            user.last_name = data["last_name"]
        if "phone" in data:
            user.phone = data["phone"]
        if "email" in data:
            user.email = data["email"]

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Profile updated successfully",
                "data": user.to_dict(),
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
