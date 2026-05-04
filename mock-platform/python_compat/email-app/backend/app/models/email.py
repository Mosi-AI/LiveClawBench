from datetime import datetime

from app.models import db


class Email(db.Model):
    __tablename__ = "emails"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    recipient_email = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(500), nullable=False)
    body = db.Column(db.Text, nullable=False)
    folder = db.Column(db.String(50), default="inbox")
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attachments = db.relationship(
        "Attachment", backref="email", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "sender_email": self.sender.email if self.sender else None,
            "sender_name": self.sender.username if self.sender else None,
            "recipient_id": self.recipient_id,
            "recipient_email": self.recipient_email,
            "recipient_name": self.recipient.username if self.recipient else self.recipient_email,
            "subject": self.subject,
            "body": self.body,
            "folder": self.folder,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "attachments": [att.to_dict() for att in self.attachments],
        }
