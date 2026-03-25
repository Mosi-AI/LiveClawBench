from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class User(db.Model):
    """User model for storing user account information"""

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship with emails (as sender)
    sent_emails = db.relationship(
        "Email", foreign_keys="Email.sender_id", backref="sender", lazy="dynamic"
    )

    # Relationship with emails (as recipient)
    received_emails = db.relationship(
        "Email", foreign_keys="Email.recipient_id", backref="recipient", lazy="dynamic"
    )

    def set_password(self, password):
        """Hash and set the user's password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check if the provided password matches the hash"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Convert user object to dictionary"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
        }


class Email(db.Model):
    """Email model for storing email messages"""

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    recipient_id = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=True
    )  # Allow NULL for external recipients
    recipient_email = db.Column(
        db.String(120), nullable=False
    )  # Store recipient email directly
    subject = db.Column(db.String(500), nullable=False)
    body = db.Column(db.Text, nullable=False)
    folder = db.Column(db.String(50), default="inbox")  # inbox, sent, drafts, trash
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationship with attachments
    attachments = db.relationship(
        "Attachment", backref="email", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Convert email object to dictionary"""
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "sender_email": self.sender.email if self.sender else None,
            "sender_name": self.sender.username if self.sender else None,
            "recipient_id": self.recipient_id,
            "recipient_email": self.recipient_email,
            "recipient_name": self.recipient.username
            if self.recipient
            else self.recipient_email,
            "subject": self.subject,
            "body": self.body,
            "folder": self.folder,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "attachments": [att.to_dict() for att in self.attachments],
        }


class Attachment(db.Model):
    """Attachment model for storing email attachments"""

    id = db.Column(db.Integer, primary_key=True)
    email_id = db.Column(
        db.Integer, db.ForeignKey("email.id", ondelete="CASCADE"), nullable=True
    )
    filename = db.Column(db.String(255), nullable=False)  # UUID filename on disk
    original_filename = db.Column(
        db.String(255), nullable=False
    )  # User's original filename
    file_path = db.Column(
        db.String(500), nullable=False
    )  # Relative path from uploads directory
    file_size = db.Column(db.Integer, nullable=False)  # Size in bytes
    mime_type = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert attachment object to dictionary"""
        return {
            "id": self.id,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "created_at": self.created_at.isoformat(),
        }
