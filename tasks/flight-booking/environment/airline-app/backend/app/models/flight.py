from datetime import datetime

from app.models import BaseModel, db


class Flight(BaseModel):
    """Flight model with all flight details"""

    __tablename__ = "flights"

    flight_number = db.Column(db.String(10), nullable=False, index=True)
    airline = db.Column(db.String(50), nullable=False, default="GKD Airlines")

    # Route information
    origin_code = db.Column(db.String(3), nullable=False, index=True)
    origin_city = db.Column(db.String(100), nullable=False)
    origin_airport = db.Column(db.String(200), nullable=False)
    destination_code = db.Column(db.String(3), nullable=False, index=True)
    destination_city = db.Column(db.String(100), nullable=False)
    destination_airport = db.Column(db.String(200), nullable=False)

    # Times
    departure_time = db.Column(db.DateTime, nullable=False, index=True)
    arrival_time = db.Column(db.DateTime, nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=False)

    # Aircraft and pricing
    aircraft_type = db.Column(db.String(50), nullable=False, default="Boeing 737")
    base_price_economy = db.Column(db.Float, nullable=False)
    base_price_business = db.Column(db.Float)
    base_price_first = db.Column(db.Float)

    # Status
    status = db.Column(db.String(20), nullable=False, default="scheduled", index=True)
    delay_minutes = db.Column(db.Integer, default=0)
    delay_reason = db.Column(db.Text)

    # Gate and terminal
    gate = db.Column(db.String(10))
    terminal = db.Column(db.String(10))

    # Relationships
    seats = db.relationship(
        "Seat", backref="flight", lazy="dynamic", cascade="all, delete-orphan"
    )
    bookings = db.relationship(
        "Booking", backref="flight", lazy="dynamic", cascade="all, delete-orphan"
    )
    status_history = db.relationship(
        "FlightStatusHistory",
        backref="flight",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        db.Index("idx_route", "origin_code", "destination_code"),
        db.Index("idx_departure", "departure_time"),
    )

    def __init__(
        self,
        flight_number,
        origin_code,
        destination_code,
        departure_time,
        arrival_time,
        base_price_economy,
        **kwargs,
    ):
        self.flight_number = flight_number
        self.origin_code = origin_code
        self.destination_code = destination_code
        self.departure_time = departure_time
        self.arrival_time = arrival_time
        self.base_price_economy = base_price_economy

        # Calculate duration
        self.duration_minutes = int(
            (arrival_time - departure_time).total_seconds() / 60
        )

        # Set defaults for other fields
        for key, value in kwargs.items():
            setattr(self, key, value)

    def get_available_seats(self, cabin_class="economy"):
        """Get available seats for a specific cabin class"""
        return self.seats.filter_by(cabin_class=cabin_class, is_available=True).all()

    def get_seats_count(self, cabin_class="economy"):
        """Get count of available seats"""
        return self.seats.filter_by(cabin_class=cabin_class, is_available=True).count()

    def update_status(self, new_status, delay_minutes=None, reason=None):
        """Update flight status and record history"""
        old_status = self.status
        self.status = new_status
        if delay_minutes:
            self.delay_minutes = delay_minutes
        if reason:
            self.delay_reason = reason

        # Create history record
        history = FlightStatusHistory(
            flight_id=self.id,
            old_status=old_status,
            new_status=new_status,
            delay_minutes=delay_minutes,
            reason=reason,
        )
        db.session.add(history)
        db.session.commit()
        return history

    def to_dict(self):
        """Convert flight to dictionary"""
        return {
            "id": self.id,
            "flight_number": self.flight_number,
            "airline": self.airline,
            "origin": {
                "code": self.origin_code,
                "city": self.origin_city,
                "airport": self.origin_airport,
            },
            "destination": {
                "code": self.destination_code,
                "city": self.destination_city,
                "airport": self.destination_airport,
            },
            "departure_time": self.departure_time.isoformat(),
            "arrival_time": self.arrival_time.isoformat(),
            "duration_minutes": self.duration_minutes,
            "aircraft_type": self.aircraft_type,
            "pricing": {
                "economy": self.base_price_economy,
                "business": self.base_price_business,
                "first": self.base_price_first,
            },
            "status": self.status,
            "delay_minutes": self.delay_minutes,
            "delay_reason": self.delay_reason,
            "gate": self.gate,
            "terminal": self.terminal,
            "available_seats": {
                "economy": self.get_seats_count("economy"),
                "business": self.get_seats_count("business"),
                "first": self.get_seats_count("first"),
            },
        }

    def __repr__(self):
        return (
            f"<Flight {self.flight_number} {self.origin_code}->{self.destination_code}>"
        )


class Seat(BaseModel):
    """Individual seat model"""

    __tablename__ = "seats"

    flight_id = db.Column(
        db.Integer, db.ForeignKey("flights.id"), nullable=False, index=True
    )
    seat_number = db.Column(db.String(5), nullable=False)  # e.g., "12A", "1F"
    cabin_class = db.Column(db.String(20), nullable=False)  # economy, business, first
    price = db.Column(db.Float, nullable=False)
    is_available = db.Column(db.Boolean, default=True, index=True)
    is_window = db.Column(db.Boolean, default=False)
    is_aisle = db.Column(db.Boolean, default=False)
    has_extra_legroom = db.Column(db.Boolean, default=False)
    row_number = db.Column(db.Integer, nullable=False)
    seat_letter = db.Column(db.String(1), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("flight_id", "seat_number", name="unique_seat_per_flight"),
        db.Index("idx_flight_availability", "flight_id", "is_available"),
    )

    def __init__(self, flight_id, seat_number, cabin_class, price, **kwargs):
        self.flight_id = flight_id
        self.seat_number = seat_number
        self.cabin_class = cabin_class
        self.price = price

        # Parse seat number to get row and letter
        self.row_number = int("".join(filter(str.isdigit, seat_number)))
        self.seat_letter = "".join(filter(str.isalpha, seat_number))

        # Determine seat characteristics
        letter = self.seat_letter.upper()
        self.is_window = letter in ["A", "F"] or letter in ["A", "L"]
        self.is_aisle = letter in ["C", "D"] or letter in ["C", "D", "G", "H"]

        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        """Convert seat to dictionary"""
        return {
            "id": self.id,
            "flight_id": self.flight_id,
            "seat_number": self.seat_number,
            "cabin_class": self.cabin_class,
            "price": self.price,
            "is_available": self.is_available,
            "is_window": self.is_window,
            "is_aisle": self.is_aisle,
            "has_extra_legroom": self.has_extra_legroom,
            "row_number": self.row_number,
            "seat_letter": self.seat_letter,
        }

    def __repr__(self):
        return f"<Seat {self.seat_number} on Flight {self.flight_id}>"


class FlightStatusHistory(BaseModel):
    """Track flight status changes"""

    __tablename__ = "flight_status_history"

    flight_id = db.Column(
        db.Integer, db.ForeignKey("flights.id"), nullable=False, index=True
    )
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20), nullable=False)
    delay_minutes = db.Column(db.Integer)
    reason = db.Column(db.Text)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "flight_id": self.flight_id,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "delay_minutes": self.delay_minutes,
            "reason": self.reason,
            "changed_at": self.changed_at.isoformat(),
        }

    def __repr__(self):
        return f"<FlightStatusHistory Flight {self.flight_id}: {self.old_status} -> {self.new_status}>"
