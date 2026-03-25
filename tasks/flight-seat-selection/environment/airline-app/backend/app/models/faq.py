from app.models import BaseModel, db


class FAQ(BaseModel):
    """FAQ model for frequently asked questions"""

    __tablename__ = "faqs"

    question = db.Column(db.String(500), nullable=False)
    answer = db.Column(db.Text, nullable=False)
    category = db.Column(
        db.String(50), nullable=False
    )  # booking, check-in, baggage, payment, general
    is_active = db.Column(db.Boolean, default=True, index=True)
    display_order = db.Column(db.Integer, default=0)

    def __init__(self, question, answer, category, **kwargs):
        self.question = question
        self.answer = answer
        self.category = category
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        """Convert FAQ to dictionary"""
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer,
            "category": self.category,
            "is_active": self.is_active,
            "display_order": self.display_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<FAQ {self.question[:50]}>"
