from datetime import datetime

from app.models import db
from app.models.flight import Flight, Seat
from flask import Blueprint, jsonify, request

flights_bp = Blueprint("flights", __name__)


@flights_bp.route("/", methods=["GET"])
def get_flights():
    """Get all flights with optional filters"""
    try:
        # Get query parameters
        origin = request.args.get("origin")
        destination = request.args.get("destination")
        date = request.args.get("date")
        min_price = request.args.get("min_price", type=float)
        max_price = request.args.get("max_price", type=float)
        status = request.args.get("status")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        # Build query
        query = Flight.query

        if origin:
            query = query.filter(Flight.origin_code == origin.upper())
        if destination:
            query = query.filter(Flight.destination_code == destination.upper())
        if date:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            query = query.filter(db.func.date(Flight.departure_time) == date_obj.date())
        if min_price:
            query = query.filter(Flight.base_price_economy >= min_price)
        if max_price:
            query = query.filter(Flight.base_price_economy <= max_price)
        if status:
            query = query.filter(Flight.status == status)

        # Order by departure time
        query = query.order_by(Flight.departure_time)

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify(
            {
                "success": True,
                "data": {
                    "flights": [flight.to_dict() for flight in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@flights_bp.route("/search", methods=["POST"])
def search_flights():
    """Search flights with advanced filters"""
    try:
        data = request.get_json()

        # Get search parameters
        origin = data.get("origin")
        destination = data.get("destination")
        departure_date = data.get("departure_date")
        passengers = int(data.get("passengers", 1))
        cabin_class = data.get("cabin_class", "economy")

        # Validate required fields
        if not all([origin, destination, departure_date]):
            return jsonify(
                {
                    "success": False,
                    "message": "Origin, destination, and departure_date are required",
                }
            ), 400

        # Parse date
        date_obj = datetime.strptime(departure_date, "%Y-%m-%d")

        # Query flights
        query = Flight.query.filter(
            Flight.origin_code == origin.upper(),
            Flight.destination_code == destination.upper(),
            db.func.date(Flight.departure_time) == date_obj.date(),
            Flight.status != "cancelled",
        )

        flights = query.order_by(Flight.departure_time).all()

        # Filter by available seats
        available_flights = []
        for flight in flights:
            available_seats = flight.get_seats_count(cabin_class)
            if available_seats >= passengers:
                flight_dict = flight.to_dict()
                flight_dict["available_seats_count"] = available_seats
                available_flights.append(flight_dict)

        return jsonify(
            {
                "success": True,
                "data": {
                    "flights": available_flights,
                    "search_criteria": {
                        "origin": origin,
                        "destination": destination,
                        "departure_date": departure_date,
                        "passengers": passengers,
                        "cabin_class": cabin_class,
                    },
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@flights_bp.route("/<int:flight_id>", methods=["GET"])
def get_flight(flight_id):
    """Get flight by ID"""
    try:
        flight = Flight.query.get(flight_id)

        if not flight:
            return jsonify({"success": False, "message": "Flight not found"}), 404

        return jsonify({"success": True, "data": flight.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@flights_bp.route("/<int:flight_id>/seats", methods=["GET"])
def get_flight_seats(flight_id):
    """Get all seats for a flight"""
    try:
        flight = Flight.query.get(flight_id)

        if not flight:
            return jsonify({"success": False, "message": "Flight not found"}), 404

        # Get cabin class filter
        cabin_class = request.args.get("cabin_class")
        available_only = request.args.get("available_only", "false").lower() == "true"

        # Build query
        query = Seat.query.filter_by(flight_id=flight_id)

        if cabin_class:
            query = query.filter_by(cabin_class=cabin_class)
        if available_only:
            query = query.filter_by(is_available=True)

        seats = query.order_by(Seat.row_number, Seat.seat_letter).all()

        # Group seats by cabin class
        seats_by_class = {"economy": [], "business": [], "first": []}

        for seat in seats:
            seats_by_class[seat.cabin_class].append(seat.to_dict())

        return jsonify(
            {
                "success": True,
                "data": {
                    "flight_id": flight_id,
                    "flight_number": flight.flight_number,
                    "seats": seats_by_class,
                    "total_seats": len(seats),
                    "available_seats": {
                        cabin: len(
                            [
                                s
                                for s in seats
                                if s.cabin_class == cabin and s.is_available
                            ]
                        )
                        for cabin in ["economy", "business", "first"]
                    },
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@flights_bp.route("/<int:flight_id>/seats/<int:seat_id>", methods=["GET"])
def get_seat_details(flight_id, seat_id):
    """Get specific seat details"""
    try:
        seat = Seat.query.filter_by(id=seat_id, flight_id=flight_id).first()

        if not seat:
            return jsonify({"success": False, "message": "Seat not found"}), 404

        return jsonify({"success": True, "data": seat.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
