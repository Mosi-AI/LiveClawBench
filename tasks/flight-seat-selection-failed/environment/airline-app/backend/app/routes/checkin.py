from datetime import datetime, timedelta

from app.models import db
from app.models.booking import Booking
from app.models.flight import Seat
from flask import Blueprint, jsonify

checkin_bp = Blueprint("checkin", __name__)

# Use default user ID for auto-login
DEFAULT_USER_ID = 1


@checkin_bp.route("/<string:booking_reference>", methods=["POST"])
def check_in(booking_reference):
    """Check in for a flight"""
    try:
        # Use default user for auto-login
        booking = Booking.query.filter_by(
            booking_reference=booking_reference, user_id=DEFAULT_USER_ID
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        # Check if already checked in
        if booking.checked_in:
            return jsonify({"success": False, "message": "Already checked in"}), 400

        # Verify payment is complete
        if not booking.payment or booking.payment.payment_status != "completed":
            return jsonify(
                {
                    "success": False,
                    "message": "Payment must be completed before check-in",
                }
            ), 400

        # Verify all passengers have seats
        for passenger in booking.passengers:
            if not passenger.seat:
                return jsonify(
                    {
                        "success": False,
                        "message": "All passengers must have assigned seats before check-in",
                    }
                ), 400

        # Perform check-in
        booking.check_in()

        return jsonify(
            {
                "success": True,
                "message": "Check-in successful",
                "data": booking.to_dict(),
            }
        ), 200

    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@checkin_bp.route("/<string:booking_reference>/boarding-pass", methods=["GET"])
def get_boarding_pass(booking_reference):
    """Get boarding pass for checked-in booking"""
    try:
        # Use default user for auto-login
        booking = Booking.query.filter_by(
            booking_reference=booking_reference, user_id=DEFAULT_USER_ID
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        if not booking.checked_in:
            return jsonify(
                {
                    "success": False,
                    "message": "Must check in before getting boarding pass",
                }
            ), 400

        # Generate boarding pass data
        boarding_passes = []
        for passenger in booking.passengers:
            boarding_pass = {
                "booking_reference": booking.booking_reference,
                "passenger_name": f"{passenger.first_name} {passenger.last_name}",
                "flight_number": booking.flight.flight_number,
                "origin": booking.flight.origin_code,
                "destination": booking.flight.destination_code,
                "departure_time": booking.flight.departure_time.isoformat(),
                "gate": booking.flight.gate or "TBD",
                "terminal": booking.flight.terminal or "TBD",
                "seat": passenger.seat.seat_number if passenger.seat else "TBD",
                "cabin_class": booking.cabin_class,
                "boarding_time": (
                    booking.flight.departure_time.replace(minute=0, second=0)
                    - timedelta(minutes=30)
                ).isoformat(),
                "barcode": f"{booking.booking_reference}-{passenger.id}",
            }
            boarding_passes.append(boarding_pass)

        return jsonify(
            {
                "success": True,
                "data": {
                    "booking_reference": booking.booking_reference,
                    "boarding_passes": boarding_passes,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@checkin_bp.route("/eligible", methods=["GET"])
def get_eligible_checkins():
    """Get bookings eligible for check-in"""
    try:
        # Use default user for auto-login
        now = datetime.utcnow()
        check_in_window = now + datetime.timedelta(hours=24)

        # Find bookings within 24 hours of departure
        bookings = (
            Booking.query.filter_by(user_id=DEFAULT_USER_ID, checked_in=False)
            .filter(Booking.booking_status.in_(["confirmed", "pending"]))
            .all()
        )

        eligible = []
        for booking in bookings:
            hours_until_departure = (
                booking.flight.departure_time - now
            ).total_seconds() / 3600
            if 0 < hours_until_departure <= 24:
                eligible.append(
                    {
                        "booking_reference": booking.booking_reference,
                        "flight_number": booking.flight.flight_number,
                        "departure_time": booking.flight.departure_time.isoformat(),
                        "route": f"{booking.flight.origin_code} → {booking.flight.destination_code}",
                        "hours_until_departure": round(hours_until_departure, 1),
                    }
                )

        return jsonify({"success": True, "data": {"eligible_checkins": eligible}}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@checkin_bp.route("/<string:booking_reference>/seats", methods=["GET"])
def get_seat_chart(booking_reference):
    """Get seat chart for seat selection"""
    try:
        # Use default user for auto-login
        booking = Booking.query.filter_by(
            booking_reference=booking_reference, user_id=DEFAULT_USER_ID
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        # Get all seats for the flight
        seats = (
            Seat.query.filter_by(
                flight_id=booking.flight_id, cabin_class=booking.cabin_class
            )
            .order_by(Seat.row_number, Seat.seat_letter)
            .all()
        )

        # Group seats by row
        seat_chart = {}
        for seat in seats:
            if seat.row_number not in seat_chart:
                seat_chart[seat.row_number] = []

            seat_chart[seat.row_number].append(
                {
                    "id": seat.id,
                    "seat_number": seat.seat_number,
                    "is_available": seat.is_available,
                    "is_window": seat.is_window,
                    "is_aisle": seat.is_aisle,
                    "has_extra_legroom": seat.has_extra_legroom,
                    "price": seat.price,
                    "row_number": seat.row_number,
                    "seat_letter": seat.seat_letter,
                }
            )

        return jsonify(
            {
                "success": True,
                "data": {
                    "booking_reference": booking.booking_reference,
                    "flight_number": booking.flight.flight_number,
                    "cabin_class": booking.cabin_class,
                    "seat_chart": seat_chart,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
