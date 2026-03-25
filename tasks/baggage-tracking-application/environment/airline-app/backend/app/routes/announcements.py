from datetime import datetime

from app.models.announcement import Announcement
from flask import Blueprint, jsonify, request

announcements_bp = Blueprint("announcements", __name__)


@announcements_bp.route("/", methods=["GET"])
def get_announcements():
    """Get all active announcements"""
    try:
        category = request.args.get("category")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        query = Announcement.query.filter_by(is_active=True)

        if category:
            query = query.filter_by(category=category)

        # Filter out expired announcements
        query = query.filter(
            (Announcement.expires_at.is_(None))
            | (Announcement.expires_at > datetime.utcnow())
        )

        query = query.order_by(
            Announcement.priority.desc(), Announcement.published_at.desc()
        )
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify(
            {
                "success": True,
                "data": {
                    "announcements": [
                        announcement.to_dict() for announcement in pagination.items
                    ],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@announcements_bp.route("/<int:announcement_id>", methods=["GET"])
def get_announcement(announcement_id):
    """Get announcement by ID"""
    try:
        announcement = Announcement.query.filter_by(
            id=announcement_id, is_active=True
        ).first()

        if not announcement:
            return jsonify({"success": False, "message": "Announcement not found"}), 404

        return jsonify({"success": True, "data": announcement.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
