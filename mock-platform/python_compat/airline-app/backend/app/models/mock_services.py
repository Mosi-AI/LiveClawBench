from datetime import datetime

from app.models import BaseModel, db


class EmailNotification(BaseModel):
    __tablename__ = "email_notifications"

    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"))
    email_type = db.Column(db.String(30), nullable=False, index=True)
    recipient_email = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    sent_at = db.Column(db.DateTime, default=datetime.now)
    is_read = db.Column(db.Boolean, default=False, index=True)

    def to_dict(self):
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
    event_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(200))
    reminder_minutes = db.Column(db.Integer, default=60)

    def to_dict(self):
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
    __tablename__ = "chat_sessions"

    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    session_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    status = db.Column(db.String(20), default="active", index=True)
    started_at = db.Column(db.DateTime, default=datetime.now)
    ended_at = db.Column(db.DateTime)

    messages = db.relationship(
        "ChatMessage", backref="session", lazy="dynamic", cascade="all, delete-orphan"
    )

    def close(self):
        self.status = "closed"
        self.ended_at = datetime.now()
        db.session.commit()

    def to_dict(self):
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
    __tablename__ = "chat_messages"

    session_id = db.Column(
        db.Integer, db.ForeignKey("chat_sessions.id"), nullable=False, index=True
    )
    message = db.Column(db.Text, nullable=False)
    sender_type = db.Column(db.String(20), nullable=False)
    sender_name = db.Column(db.String(50))
    sent_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
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
    __tablename__ = "price_history"

    flight_id = db.Column(
        db.Integer, db.ForeignKey("flights.id"), nullable=False, index=True
    )
    cabin_class = db.Column(db.String(20), nullable=False)
    old_price = db.Column(db.Float, nullable=False)
    new_price = db.Column(db.Float, nullable=False)
    change_reason = db.Column(db.String(50))
    changed_at = db.Column(db.DateTime, default=datetime.now, index=True)

    def to_dict(self):
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
