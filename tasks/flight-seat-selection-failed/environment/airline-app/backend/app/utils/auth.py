from datetime import datetime, timezone

import jwt
from flask import current_app


def create_access_token(user_id, expires_in=None):
    """Create JWT access token"""
    if expires_in is None:
        expires_in = current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]

    payload = {
        "user_id": user_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + expires_in,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def create_refresh_token(user_id):
    """Create JWT refresh token"""
    expires_in = current_app.config["JWT_REFRESH_TOKEN_EXPIRES"]
    payload = {
        "user_id": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + expires_in,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def decode_token(token):
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(
            token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"]
        )
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"


def token_required(f):
    """Decorator to require valid token for route"""
    from functools import wraps

    from flask import jsonify, request

    from app.models.user import User

    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Get token from header
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"success": False, "message": "Token is missing"}), 401

        # Decode token
        payload, error = decode_token(token)
        if error:
            return jsonify({"success": False, "message": error}), 401

        # Check token type
        if payload.get("type") != "access":
            return jsonify({"success": False, "message": "Invalid token type"}), 401

        # Get user
        current_user = User.query.get(payload["user_id"])
        if not current_user:
            return jsonify({"success": False, "message": "User not found"}), 401

        if not current_user.is_active:
            return jsonify(
                {"success": False, "message": "User account is deactivated"}
            ), 401

        return f(current_user=current_user, *args, **kwargs)

    return decorated
