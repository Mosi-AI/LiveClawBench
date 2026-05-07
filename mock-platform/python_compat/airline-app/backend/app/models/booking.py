import random
import string
from datetime import datetime

from app.models import BaseModel, db


class Booking(BaseModel):
    __tablename__ = "bookings"

    booking_reference = db.Column(
        db.String(10), unique=True, nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    flight_id = db.Column(
        db.Integer, db.ForeignKey("flights.id"), nullable=False, index=True
    )
    cabin_class = db.Column(db.String(20), nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    booking_status = db.Column(
        db.String(20), nullable=False, default="pending", index=True
    )
    checked_in = db.Column(db.Boolean, default=False)
    check_in_time = db.Column(db.DateTime)
    booked_at = db.Column(db.DateTime, default=datetime.now)

    passengers = db.relationship(
        "Passenger", backref="booking", lazy="dynamic", cascade="all, delete-orphan"
    )
    payment = db.relationship(
        "Payment", backref="booking", uselist=False, cascade="all, delete-orphan"
    )
    claims = db.relationship(
        "Claim", backref="booking", lazy="dynamic", cascade="all, delete-orphan"
    )
    calendar_event = db.relationship(
        "CalendarEvent", backref="booking", uselist=False, cascade="all, delete-orphan"
    )

    @staticmethod
    def generate_booking_reference():
        while True:
            ref = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if not Booking.query.filter_by(booking_reference=ref).first():
                return ref

    def check_in(self):
        if self.checked_in:
            raise ValueError("Already checked in")
        flight = self.flight
        hours_until_departure = (
            flight.departure_time - datetime.now()
        ).total_seconds() / 3600
        if hours_until_departure > 24:
            raise ValueError("Check-in only available within 24 hours of departure")
        self.checked_in = True
        self.check_in_time = datetime.now()
        self.booking_status = "checked_in"
        db.session.commit()

    def cancel(self):
        if self.booking_status == "cancelled":
            raise ValueError("Booking already cancelled")
        for passenger in self.passengers:
            if passenger.seat:
                passenger.seat.is_available = True
        self.booking_status = "cancelled"
        db.session.commit()

    def to_dict(self):
        return {
            "id": self.id,
            "booking_reference": self.booking_reference,
            "user_id": self.user_id,
            "flight_id": self.flight_id,
            "flight": self.flight.to_dict() if self.flight else None,
            "cabin_class": self.cabin_class,
            "total_price": self.total_price,
            "booking_status": self.booking_status,
            "checked_in": self.checked_in,
            "check_in_time": self.check_in_time.isoformat()
            if self.check_in_time
            else None,
            "booked_at": self.booked_at.isoformat(),
            "passengers": [p.to_dict() for p in self.passengers],
            "payment": self.payment.to_dict() if self.payment else None,
        }

    def __repr__(self):
        return f"<Booking {self.booking_reference}>"


class Passenger(BaseModel):
    __tablename__ = "passengers"

    booking_id = db.Column(
        db.Integer, db.ForeignKey("bookings.id"), nullable=False, index=True
    )
    seat_id = db.Column(db.Integer, db.ForeignKey("seats.id"))
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    nationality = db.Column(db.String(50))
    meal_preference = db.Column(db.String(20))
    special_assistance = db.Column(db.Text)

    seat = db.relationship("Seat", backref="passenger", uselist=False)

    def assign_seat(self, seat):
        if not seat.is_available:
            raise ValueError("Seat is not available")
        if self.seat:
            self.seat.is_available = True
        self.seat_id = seat.id
        seat.is_available = False
        db.session.commit()

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "seat_id": self.seat_id,
            "seat": self.seat.to_dict() if self.seat else None,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "date_of_birth": self.date_of_birth.isoformat()
            if self.date_of_birth
            else None,
            "nationality": self.nationality,
            "meal_preference": self.meal_preference,
            "special_assistance": self.special_assistance,
        }

    def __repr__(self):
        return f"<Passenger {self.first_name} {self.last_name}>"


class Payment(BaseModel):
    __tablename__ = "payments"

    booking_id = db.Column(
        db.Integer,
        db.ForeignKey("bookings.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), default="USD")
    payment_method = db.Column(db.String(20), default="credit_card")
    payment_status = db.Column(
        db.String(20), nullable=False, default="pending", index=True
    )
    card_last_four = db.Column(db.String(4))
    card_type = db.Column(db.String(20))
    card_holder_name = db.Column(db.String(100))
    transaction_id = db.Column(db.String(100), unique=True)
    payment_gateway_response = db.Column(db.Text)
    refund_amount = db.Column(db.Float)
    refund_reason = db.Column(db.Text)
    refunded_at = db.Column(db.DateTime)
    paid_at = db.Column(db.DateTime)

    def process_refund(self, refund_amount, reason):
        if self.payment_status != "completed":
            raise ValueError("Can only refund completed payments")
        if refund_amount > self.amount:
            raise ValueError("Refund amount cannot exceed payment amount")
        self.refund_amount = refund_amount
        self.refund_reason = reason
        self.refunded_at = datetime.now()
        self.payment_status = "refunded"
        db.session.commit()

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "amount": self.amount,
            "currency": self.currency,
            "payment_method": self.payment_method,
            "payment_status": self.payment_status,
            "card_last_four": self.card_last_four,
            "card_type": self.card_type,
            "card_holder_name": self.card_holder_name,
            "transaction_id": self.transaction_id,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "refund_amount": self.refund_amount,
            "refund_reason": self.refund_reason,
            "refunded_at": self.refunded_at.isoformat() if self.refunded_at else None,
        }

    def __repr__(self):
        return f"<Payment {self.id} ${self.amount} for Booking {self.booking_id}>"


class Claim(BaseModel):
    __tablename__ = "claims"

    booking_id = db.Column(
        db.Integer, db.ForeignKey("bookings.id"), nullable=False, index=True
    )
    claim_type = db.Column(db.String(20), nullable=False, index=True)
    claim_amount = db.Column(db.Float, nullable=False)
    claim_reason = db.Column(db.Text, nullable=False)
    claim_status = db.Column(db.String(20), default="pending", index=True)
    resolution_notes = db.Column(db.Text)
    resolved_amount = db.Column(db.Float)
    resolved_at = db.Column(db.DateTime)

    def resolve(self, resolved_amount, notes):
        self.claim_status = "resolved"
        self.resolved_amount = resolved_amount
        self.resolution_notes = notes
        self.resolved_at = datetime.now()
        db.session.commit()

    def reject(self, reason):
        self.claim_status = "rejected"
        self.resolution_notes = reason
        self.resolved_at = datetime.now()
        db.session.commit()

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "booking_reference": self.booking.booking_reference
            if self.booking
            else None,
            "claim_type": self.claim_type,
            "claim_amount": self.claim_amount,
            "claim_reason": self.claim_reason,
            "claim_status": self.claim_status,
            "resolution_notes": self.resolution_notes,
            "resolved_amount": self.resolved_amount,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Claim {self.id} for Booking {self.booking_id}>"
