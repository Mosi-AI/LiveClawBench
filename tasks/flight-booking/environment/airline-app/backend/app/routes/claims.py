from app.models import db
from app.models.booking import Booking, Claim
from flask import Blueprint, jsonify, request

claims_bp = Blueprint("claims", __name__)

# Use default user ID for auto-login
DEFAULT_USER_ID = 1


@claims_bp.route("/", methods=["GET"])
def get_user_claims():
    """Get all claims for current user"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        status = request.args.get("status")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)

        # Join with booking to filter by user
        query = Claim.query.join(Booking).filter(Booking.user_id == user_id)

        if status:
            query = query.filter(Claim.claim_status == status)

        query = query.order_by(Claim.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify(
            {
                "success": True,
                "data": {
                    "claims": [claim.to_dict() for claim in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@claims_bp.route("/<int:claim_id>", methods=["GET"])
def get_claim(claim_id):
    """Get claim by ID"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        claim = (
            Claim.query.join(Booking)
            .filter(Claim.id == claim_id, Booking.user_id == user_id)
            .first()
        )

        if not claim:
            return jsonify({"success": False, "message": "Claim not found"}), 404

        return jsonify({"success": True, "data": claim.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@claims_bp.route("/", methods=["POST"])
def create_claim():
    """Create a new claim"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        data = request.get_json()

        # Validate required fields
        if not all(
            [
                data.get("booking_reference"),
                data.get("claim_type"),
                data.get("claim_amount"),
                data.get("claim_reason"),
            ]
        ):
            return jsonify(
                {
                    "success": False,
                    "message": "booking_reference, claim_type, claim_amount, and claim_reason are required",
                }
            ), 400

        # Get booking
        booking = Booking.query.filter_by(
            booking_reference=data["booking_reference"], user_id=user_id
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        # Create claim
        claim = Claim(
            booking_id=booking.id,
            claim_type=data["claim_type"],
            claim_amount=data["claim_amount"],
            claim_reason=data["claim_reason"],
        )
        db.session.add(claim)
        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Claim submitted successfully",
                "data": claim.to_dict(),
            }
        ), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@claims_bp.route("/<int:claim_id>", methods=["PUT"])
def update_claim(claim_id):
    """Update claim (for adding additional information)"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        claim = (
            Claim.query.join(Booking)
            .filter(
                Claim.id == claim_id,
                Booking.user_id == user_id,
                Claim.claim_status == "pending",
            )
            .first()
        )

        if not claim:
            return jsonify(
                {"success": False, "message": "Claim not found or cannot be updated"}
            ), 404

        data = request.get_json()

        # Update allowed fields
        if "claim_reason" in data:
            claim.claim_reason = data["claim_reason"]
        if "claim_amount" in data:
            claim.claim_amount = data["claim_amount"]

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Claim updated successfully",
                "data": claim.to_dict(),
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@claims_bp.route("/calculate-refund/<string:booking_reference>", methods=["POST"])
def calculate_refund(booking_reference):
    """Calculate potential refund amount"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        booking = Booking.query.filter_by(
            booking_reference=booking_reference, user_id=user_id
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        data = request.get_json()
        claim_type = data.get("claim_type")

        # Calculate refund based on claim type and flight status
        refund_amount = 0
        reason = ""

        flight = booking.flight

        if claim_type == "cancellation" and flight.status == "cancelled":
            refund_amount = booking.total_price
            reason = "Full refund for cancelled flight"

        elif claim_type == "delay" and flight.delay_minutes > 0:
            # Compensate $25 per hour of delay
            delay_hours = flight.delay_minutes / 60
            refund_amount = min(delay_hours * 25, booking.total_price)
            reason = f"Compensation for {flight.delay_minutes} minute delay"

        else:
            reason = "No compensation applicable"

        return jsonify(
            {
                "success": True,
                "data": {
                    "booking_reference": booking_reference,
                    "claim_type": claim_type,
                    "refund_amount": round(refund_amount, 2),
                    "reason": reason,
                    "flight_status": flight.status,
                    "delay_minutes": flight.delay_minutes,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
