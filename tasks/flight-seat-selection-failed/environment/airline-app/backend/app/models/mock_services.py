from datetime import datetime

from app.models import BaseModel, db


class EmailNotification(BaseModel):
    """Mock email notification storage"""

    __tablename__ = "email_notifications"

    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"))

    # Email details
    email_type = db.Column(
        db.String(30), nullable=False, index=True
    )  # booking_confirmation, check_in, delay_notification, etc.
    recipient_email = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)

    # Status
    sent_at = db.Column(db.DateTime, default=datetime.now)
    is_read = db.Column(db.Boolean, default=False, index=True)

    def __init__(self, user_id, email_type, recipient_email, subject, body, **kwargs):
        self.user_id = user_id
        self.email_type = email_type
        self.recipient_email = recipient_email
        self.subject = subject
        self.body = body
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        """Convert email to dictionary"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "booking_id": self.booking_id,
            "email_type": self.email_type,
            "recipient_email": self.recipient_email,
            "subject": self.subject,
            "body": self.body,
            "sent_at": self.sent_at.isoformat(),
            "is_read": self.is_read,
        }

    def __repr__(self):
        return f"<EmailNotification {self.email_type} to {self.recipient_email}>"


class CalendarEvent(BaseModel):
    """Mock calendar event storage"""

    __tablename__ = "calendar_events"

    booking_id = db.Column(
        db.Integer,
        db.ForeignKey("bookings.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )

    # Event details
    event_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(200))

    # Reminder
    reminder_minutes = db.Column(db.Integer, default=60)

    # Status
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    def __init__(
        self, booking_id, user_id, event_id, title, start_time, end_time, **kwargs
    ):
        self.booking_id = booking_id
        self.user_id = user_id
        self.event_id = event_id
        self.title = title
        self.start_time = start_time
        self.end_time = end_time
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        """Convert event to dictionary"""
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "event_id": self.event_id,
            "title": self.title,
            "description": self.description,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "location": self.location,
            "reminder_minutes": self.reminder_minutes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<CalendarEvent {self.event_id}>"


class ChatSession(BaseModel):
    """Mock customer support chat session"""

    __tablename__ = "chat_sessions"

    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    session_id = db.Column(db.String(100), unique=True, nullable=False, index=True)

    # Session status
    status = db.Column(db.String(20), default="active", index=True)  # active, closed
    started_at = db.Column(db.DateTime, default=datetime.now)
    ended_at = db.Column(db.DateTime)

    # Relationships
    messages = db.relationship(
        "ChatMessage", backref="session", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __init__(self, user_id, session_id, **kwargs):
        self.user_id = user_id
        self.session_id = session_id
        for key, value in kwargs.items():
            setattr(self, key, value)

    def close(self):
        """Close the chat session"""
        self.status = "closed"
        self.ended_at = datetime.now()
        db.session.commit()

    def to_dict(self):
        """Convert session to dictionary"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "messages": [
                m.to_dict() for m in self.messages.order_by(ChatMessage.created_at)
            ],
        }

    def __repr__(self):
        return f"<ChatSession {self.session_id}>"


class ChatMessage(BaseModel):
    """Mock customer support chat message"""

    __tablename__ = "chat_messages"

    session_id = db.Column(
        db.Integer, db.ForeignKey("chat_sessions.id"), nullable=False, index=True
    )

    # Message details
    message = db.Column(db.Text, nullable=False)
    sender_type = db.Column(db.String(20), nullable=False)  # user, bot
    sender_name = db.Column(db.String(50))

    # Timestamp
    sent_at = db.Column(db.DateTime, default=datetime.now)

    def __init__(self, session_id, message, sender_type, **kwargs):
        self.session_id = session_id
        self.message = message
        self.sender_type = sender_type
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        """Convert message to dictionary"""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "message": self.message,
            "sender_type": self.sender_type,
            "sender_name": self.sender_name,
            "sent_at": self.sent_at.isoformat(),
        }

    def __repr__(self):
        return f"<ChatMessage {self.sender_type}: {self.message[:30]}>"


class PriceHistory(BaseModel):
    """Track price changes for dynamic pricing"""

    __tablename__ = "price_history"

    flight_id = db.Column(
        db.Integer, db.ForeignKey("flights.id"), nullable=False, index=True
    )

    # Price details
    cabin_class = db.Column(db.String(20), nullable=False)
    old_price = db.Column(db.Float, nullable=False)
    new_price = db.Column(db.Float, nullable=False)
    change_reason = db.Column(db.String(50))  # demand, time_based, manual, etc.

    # Timestamp
    changed_at = db.Column(db.DateTime, default=datetime.now, index=True)

    def __init__(self, flight_id, cabin_class, old_price, new_price, **kwargs):
        self.flight_id = flight_id
        self.cabin_class = cabin_class
        self.old_price = old_price
        self.new_price = new_price
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "flight_id": self.flight_id,
            "cabin_class": self.cabin_class,
            "old_price": self.old_price,
            "new_price": self.new_price,
            "change_reason": self.change_reason,
            "changed_at": self.changed_at.isoformat(),
        }

    def __repr__(self):
        return f"<PriceHistory Flight {self.flight_id}: ${self.old_price} -> ${self.new_price}>"
