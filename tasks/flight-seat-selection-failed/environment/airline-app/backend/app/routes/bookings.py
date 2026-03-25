import logging
from datetime import datetime

from app.models import db
from app.models.booking import Booking, Passenger
from app.models.flight import Flight, Seat
from flask import Blueprint, jsonify, request

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bookings_bp = Blueprint("bookings", __name__)

# Use default user ID for auto-login
DEFAULT_USER_ID = 1


@bookings_bp.route("/", methods=["GET"])
def get_user_bookings():
    """Get all bookings for current user"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        status = request.args.get("status")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)

        query = Booking.query.filter_by(user_id=user_id)

        # Exclude pending bookings - only show confirmed, cancelled, or checked_in bookings
        if status:
            query = query.filter_by(booking_status=status)
        else:
            # By default, exclude pending bookings (only show confirmed, cancelled, checked_in)
            query = query.filter(
                Booking.booking_status.in_(["confirmed", "cancelled", "checked_in"])
            )

        query = query.order_by(Booking.booked_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify(
            {
                "success": True,
                "data": {
                    "bookings": [booking.to_dict() for booking in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@bookings_bp.route("/<string:booking_reference>", methods=["GET"])
def get_booking(booking_reference):
    """Get booking by reference"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        booking = Booking.query.filter_by(
            booking_reference=booking_reference, user_id=user_id
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        return jsonify({"success": True, "data": booking.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@bookings_bp.route("/", methods=["POST"])
def create_booking():
    """Create a new booking"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        data = request.get_json()
        logger.info(f"Creating booking request: {data}")

        # Validate required fields
        if not data:
            return jsonify(
                {"success": False, "message": "Request body is required"}
            ), 400

        if not data.get("flight_id"):
            return jsonify({"success": False, "message": "flight_id is required"}), 400

        if not data.get("cabin_class"):
            return jsonify(
                {"success": False, "message": "cabin_class is required"}
            ), 400

        if not data.get("passengers") or len(data["passengers"]) == 0:
            return jsonify(
                {"success": False, "message": "At least one passenger is required"}
            ), 400

        # Get flight
        try:
            flight = Flight.query.get(data["flight_id"])
            if not flight:
                logger.error(f"Flight not found with ID: {data['flight_id']}")
                return jsonify({"success": False, "message": "Flight not found"}), 404

            logger.info(f"Found flight {flight.flight_number} (ID: {flight.id})")
        except Exception as e:
            logger.error(f"Error fetching flight: {str(e)}")
            return jsonify(
                {"success": False, "message": "Error fetching flight details"}
            ), 500

        if flight.status == "cancelled":
            return jsonify(
                {"success": False, "message": "Cannot book cancelled flight"}
            ), 400

        # Check available seats
        try:
            available_seats = flight.get_seats_count(data["cabin_class"])
            logger.info(f"Available {data['cabin_class']} seats: {available_seats}")
            if available_seats < len(data["passengers"]):
                return jsonify(
                    {
                        "success": False,
                        "message": f"Not enough available seats. Required: {len(data['passengers'])}, Available: {available_seats}",
                    }
                ), 400
        except Exception as e:
            logger.error(f"Error checking available seats: {str(e)}")
            return jsonify(
                {"success": False, "message": "Error checking seat availability"}
            ), 500

        # Calculate total price - handle missing cabin class prices
        cabin_class = data["cabin_class"]
        try:
            base_price = getattr(flight, f"base_price_{cabin_class}")
            logger.info(f"Base price for {cabin_class}: {base_price}")
            if base_price is None:
                # Fallback to economy price if other classes are not available
                if cabin_class != "economy" and flight.base_price_economy:
                    logger.warning(
                        f" {cabin_class} price not available, using economy price"
                    )
                    base_price = (
                        flight.base_price_economy * 2
                    )  # Markup for business/first
                else:
                    return jsonify(
                        {
                            "success": False,
                            "message": f"Pricing not available for {cabin_class} class",
                        }
                    ), 400
            total_price = base_price * len(data["passengers"])
            logger.info(f"Total price: {total_price}")
        except AttributeError as e:
            logger.error(f"Error getting pricing: {str(e)}")
            return jsonify(
                {"success": False, "message": "Error calculating price"}
            ), 500

        # Create booking
        booking = Booking(
            user_id=user_id,
            flight_id=flight.id,
            cabin_class=data["cabin_class"],
            total_price=total_price,
            booking_status="pending",
        )
        db.session.add(booking)
        db.session.flush()  # Get booking ID

        # Add passengers
        for idx, passenger_data in enumerate(data["passengers"]):
            # Validate required passenger fields
            if not passenger_data.get("first_name"):
                return jsonify(
                    {
                        "success": False,
                        "message": f"Passenger {idx + 1}: first_name is required",
                    }
                ), 400

            if not passenger_data.get("last_name"):
                return jsonify(
                    {
                        "success": False,
                        "message": f"Passenger {idx + 1}: last_name is required",
                    }
                ), 400

            if not passenger_data.get("date_of_birth"):
                return jsonify(
                    {
                        "success": False,
                        "message": f"Passenger {idx + 1}: date_of_birth is required",
                    }
                ), 400

            try:
                date_of_birth = datetime.strptime(
                    passenger_data["date_of_birth"], "%Y-%m-%d"
                ).date()
            except ValueError:
                return jsonify(
                    {
                        "success": False,
                        "message": f"Passenger {idx + 1}: Invalid date_of_birth format. Use YYYY-MM-DD",
                    }
                ), 400

            passenger = Passenger(
                booking_id=booking.id,
                first_name=passenger_data["first_name"],
                last_name=passenger_data["last_name"],
                date_of_birth=date_of_birth,
                nationality=passenger_data.get("nationality"),
                meal_preference=passenger_data.get("meal_preference"),
                special_assistance=passenger_data.get("special_assistance"),
            )
            db.session.add(passenger)

        db.session.commit()
        logger.info(f"Booking created successfully: {booking.booking_reference}")

        return jsonify(
            {
                "success": True,
                "message": "Booking created successfully",
                "data": booking.to_dict(),
            }
        ), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating booking: {str(e)}", exc_info=True)
        return jsonify(
            {
                "success": False,
                "message": str(e)
                if len(str(e)) < 200
                else "Error creating booking. Please check passenger details and try again.",
            }
        ), 500


@bookings_bp.route("/<string:booking_reference>/seats", methods=["POST"])
def assign_seats(booking_reference):
    """Assign seats to passengers"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        booking = Booking.query.filter_by(
            booking_reference=booking_reference, user_id=user_id
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        data = request.get_json()
        seat_assignments = data.get("seat_assignments", [])

        for assignment in seat_assignments:
            passenger_id = assignment.get("passenger_id")
            seat_id = assignment.get("seat_id")

            # Get passenger
            passenger = Passenger.query.filter_by(
                id=passenger_id, booking_id=booking.id
            ).first()

            if not passenger:
                return jsonify(
                    {
                        "success": False,
                        "message": f"Passenger {passenger_id} not found in booking",
                    }
                ), 404

            # Get seat
            seat = Seat.query.filter_by(id=seat_id, flight_id=booking.flight_id).first()

            if not seat:
                return jsonify(
                    {"success": False, "message": f"Seat {seat_id} not found"}
                ), 404

            if not seat.is_available:
                return jsonify(
                    {
                        "success": False,
                        "message": f"Seat {seat.seat_number} is not available",
                    }
                ), 400

            # Assign seat
            passenger.assign_seat(seat)

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Seats assigned successfully",
                "data": booking.to_dict(),
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@bookings_bp.route("/<string:booking_reference>/cancel", methods=["POST"])
def cancel_booking(booking_reference):
    """Cancel a booking"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        booking = Booking.query.filter_by(
            booking_reference=booking_reference, user_id=user_id
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        if booking.booking_status == "cancelled":
            return jsonify(
                {"success": False, "message": "Booking already cancelled"}
            ), 400

        booking.cancel()

        return jsonify(
            {
                "success": True,
                "message": "Booking cancelled successfully",
                "data": booking.to_dict(),
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
