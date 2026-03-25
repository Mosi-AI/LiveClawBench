from datetime import datetime
from app.models import db, BaseModel


class BaggageTracking(BaseModel):
    """Baggage tracking model for lost baggage reports"""
    __tablename__ = 'baggage_tracking'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'))
    flight_number = db.Column(db.String(10), nullable=False)
    flight_time = db.Column(db.DateTime, nullable=False)
    seat_number = db.Column(db.String(5))
    passenger_name = db.Column(db.String(100), nullable=False)
    passenger_phone = db.Column(db.String(20), nullable=False)
    passenger_email = db.Column(db.String(120), nullable=False)
    baggage_description = db.Column(db.Text, nullable=False)
    loss_details = db.Column(db.Text)
    status = db.Column(db.String(20), default='processing', index=True)  # processing, resolved
    location = db.Column(db.String(200))

    # Relationships
    user = db.relationship('User', backref=db.backref('baggage_reports', lazy='dynamic'))
    booking = db.relationship('Booking', backref=db.backref('baggage_reports', lazy='dynamic'))

    def __init__(self, user_id, flight_number, flight_time, passenger_name,
                 passenger_phone, passenger_email, baggage_description, **kwargs):
        self.user_id = user_id
        self.flight_number = flight_number
        self.flight_time = flight_time
        self.passenger_name = passenger_name
        self.passenger_phone = passenger_phone
        self.passenger_email = passenger_email
        self.baggage_description = baggage_description
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        """Convert baggage tracking to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'booking_id': self.booking_id,
            'flight_number': self.flight_number,
            'flight_time': self.flight_time.isoformat() if self.flight_time else None,
            'seat_number': self.seat_number,
            'passenger_name': self.passenger_name,
            'passenger_phone': self.passenger_phone,
            'passenger_email': self.passenger_email,
            'baggage_description': self.baggage_description,
            'loss_details': self.loss_details,
            'status': self.status,
            'location': self.location,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<BaggageTracking {self.flight_number} - {self.passenger_name}>'
