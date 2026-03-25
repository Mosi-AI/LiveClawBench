from app.models.faq import FAQ
from flask import Blueprint, jsonify, request

faq_bp = Blueprint("faq", __name__)


@faq_bp.route("/", methods=["GET"])
def get_faqs():
    """Get all active FAQs"""
    try:
        category = request.args.get("category")

        query = FAQ.query.filter_by(is_active=True)

        if category:
            query = query.filter_by(category=category)

        query = query.order_by(FAQ.display_order, FAQ.created_at)
        faqs = query.all()

        return jsonify(
            {"success": True, "data": {"faqs": [faq.to_dict() for faq in faqs]}}
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@faq_bp.route("/<int:faq_id>", methods=["GET"])
def get_faq(faq_id):
    """Get FAQ by ID"""
    try:
        faq = FAQ.query.filter_by(id=faq_id, is_active=True).first()

        if not faq:
            return jsonify({"success": False, "message": "FAQ not found"}), 404

        return jsonify({"success": True, "data": faq.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
