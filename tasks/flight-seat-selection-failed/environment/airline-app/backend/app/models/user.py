from werkzeug.security import check_password_hash, generate_password_hash

from app.models import BaseModel, db


class User(BaseModel):
    """User model for authentication and profile"""

    __tablename__ = "users"

    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20))
    date_of_birth = db.Column(db.Date)
    passport_number = db.Column(db.String(20))
    passport_expiry = db.Column(db.Date)
    is_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    bookings = db.relationship(
        "Booking", backref="user", lazy="dynamic", cascade="all, delete-orphan"
    )
    email_notifications = db.relationship(
        "EmailNotification",
        backref="user",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    chat_sessions = db.relationship(
        "ChatSession", backref="user", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __init__(self, email, password, first_name, last_name, **kwargs):
        self.email = email
        self.set_password(password)
        self.first_name = first_name
        self.last_name = last_name
        for key, value in kwargs.items():
            setattr(self, key, value)

    def set_password(self, password):
        """Set password hash"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Convert user to dictionary"""
        return {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "phone": self.phone,
            "date_of_birth": self.date_of_birth.isoformat()
            if self.date_of_birth
            else None,
            "passport_number": self.passport_number,
            "passport_expiry": self.passport_expiry.isoformat()
            if self.passport_expiry
            else None,
            "is_verified": self.is_verified,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<User {self.email}>"
