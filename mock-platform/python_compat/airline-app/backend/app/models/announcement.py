from datetime import datetime

from app.models import BaseModel, db


class Announcement(BaseModel):
    __tablename__ = "announcements"

    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    priority = db.Column(db.String(20), default="normal")
    is_active = db.Column(db.Boolean, default=True, index=True)
    published_at = db.Column(db.DateTime, default=datetime.now)
    expires_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "category": self.category,
            "priority": self.priority,
            "is_active": self.is_active,
            "published_at": self.published_at.isoformat()
            if self.published_at
            else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Announcement {self.title}>"
