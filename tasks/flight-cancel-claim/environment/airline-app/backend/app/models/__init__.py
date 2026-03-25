from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class BaseModel(db.Model):
    """Base model with common fields"""

    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    def save(self):
        """Save this model to the database"""
        db.session.add(self)
        db.session.commit()

    def delete(self):
        """Delete this model from the database"""
        db.session.delete(self)
        db.session.commit()

    @classmethod
    def get_by_id(cls, id):
        """Get a record by ID"""
        return cls.query.get(id)

    @classmethod
    def get_all(cls):
        """Get all records"""
        return cls.query.all()


# Import all models to make them available from app.models
from app.models.announcement import Announcement
from app.models.baggage import BaggageTracking
from app.models.booking import Booking, Claim, Passenger, Payment
from app.models.faq import FAQ
from app.models.flight import Flight, FlightStatusHistory, Seat
from app.models.mock_services import (
    CalendarEvent,
    ChatMessage,
    ChatSession,
    EmailNotification,
    PriceHistory,
)
from app.models.user import User
