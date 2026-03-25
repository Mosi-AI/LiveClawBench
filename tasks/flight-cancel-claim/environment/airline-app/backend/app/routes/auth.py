from datetime import datetime

from app.models import db
from app.models.user import User
from app.utils.auth import create_access_token, create_refresh_token, token_required
from flask import Blueprint, jsonify, request

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new user"""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ["email", "password", "first_name", "last_name"]
        for field in required_fields:
            if field not in data:
                return jsonify(
                    {"success": False, "message": f"{field} is required"}
                ), 400

        # Check if user already exists
        if User.query.filter_by(email=data["email"]).first():
            return jsonify(
                {"success": False, "message": "Email already registered"}
            ), 400

        # Create new user
        user = User(
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            phone=data.get("phone"),
            date_of_birth=datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
            if data.get("date_of_birth")
            else None,
        )

        db.session.add(user)
        db.session.commit()

        # Create tokens
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)

        return jsonify(
            {
                "success": True,
                "message": "User registered successfully",
                "data": {
                    "user": user.to_dict(),
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                },
            }
        ), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login user"""
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get("email") or not data.get("password"):
            return jsonify(
                {"success": False, "message": "Email and password are required"}
            ), 400

        # Find user
        user = User.query.filter_by(email=data["email"]).first()

        if not user or not user.check_password(data["password"]):
            return jsonify(
                {"success": False, "message": "Invalid email or password"}
            ), 401

        if not user.is_active:
            return jsonify({"success": False, "message": "Account is deactivated"}), 401

        # Create tokens
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)

        return jsonify(
            {
                "success": True,
                "message": "Login successful",
                "data": {
                    "user": user.to_dict(),
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    """Refresh access token"""
    from app.utils.auth import decode_token

    try:
        data = request.get_json()

        if not data.get("refresh_token"):
            return jsonify(
                {"success": False, "message": "Refresh token is required"}
            ), 400

        # Decode refresh token
        payload, error = decode_token(data["refresh_token"])

        if error:
            return jsonify({"success": False, "message": error}), 401

        if payload.get("type") != "refresh":
            return jsonify({"success": False, "message": "Invalid token type"}), 401

        # Get user
        user = User.query.get(payload["user_id"])

        if not user or not user.is_active:
            return jsonify(
                {"success": False, "message": "User not found or inactive"}
            ), 401

        # Create new access token
        access_token = create_access_token(user.id)

        return jsonify(
            {
                "success": True,
                "message": "Token refreshed",
                "data": {"access_token": access_token},
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@auth_bp.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    """Get current user profile"""
    return jsonify({"success": True, "data": current_user.to_dict()}), 200


@auth_bp.route("/profile", methods=["PUT"])
@token_required
def update_profile(current_user):
    """Update current user profile"""
    try:
        data = request.get_json()

        # Update allowed fields
        allowed_fields = ["first_name", "last_name", "phone", "email"]
        for field in allowed_fields:
            if field in data:
                setattr(current_user, field, data[field])

        # Handle date fields
        if "date_of_birth" in data:
            current_user.date_of_birth = datetime.strptime(
                data["date_of_birth"], "%Y-%m-%d"
            ).date()

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Profile updated successfully",
                "data": current_user.to_dict(),
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@auth_bp.route("/change-password", methods=["POST"])
@token_required
def change_password(current_user):
    """Change user password"""
    try:
        data = request.get_json()

        if not data.get("old_password") or not data.get("new_password"):
            return jsonify(
                {"success": False, "message": "Old and new password are required"}
            ), 400

        # Verify old password
        if not current_user.check_password(data["old_password"]):
            return jsonify({"success": False, "message": "Incorrect old password"}), 401

        # Set new password
        current_user.set_password(data["new_password"])
        db.session.commit()

        return jsonify(
            {"success": True, "message": "Password changed successfully"}
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
