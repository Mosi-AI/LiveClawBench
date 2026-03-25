import time
from datetime import datetime

from app.models import db
from app.models.booking import Booking, Payment
from app.models.mock_services import (
    CalendarEvent,
    ChatMessage,
    ChatSession,
    EmailNotification,
)
from flask import Blueprint, jsonify, request

mock_bp = Blueprint("mock", __name__)

# Use default user ID for auto-login
DEFAULT_USER_ID = 1


# Email routes
@mock_bp.route("/emails", methods=["GET"])
def get_emails():
    """Get mock emails for current user"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        email_type = request.args.get("type")
        unread_only = request.args.get("unread_only", "false").lower() == "true"
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        query = EmailNotification.query.filter_by(user_id=user_id)

        if email_type:
            query = query.filter_by(email_type=email_type)
        if unread_only:
            query = query.filter_by(is_read=False)

        query = query.order_by(EmailNotification.sent_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify(
            {
                "success": True,
                "data": {
                    "emails": [email.to_dict() for email in pagination.items],
                    "total": pagination.total,
                    "page": page,
                    "per_page": per_page,
                    "pages": pagination.pages,
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@mock_bp.route("/emails/<int:email_id>", methods=["GET"])
def get_email(email_id):
    """Get specific email"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        email = EmailNotification.query.filter_by(id=email_id, user_id=user_id).first()

        if not email:
            return jsonify({"success": False, "message": "Email not found"}), 404

        # Mark as read
        email.is_read = True
        db.session.commit()

        return jsonify({"success": True, "data": email.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Calendar routes
@mock_bp.route("/calendar/events", methods=["GET"])
def get_calendar_events():
    """Get mock calendar events for current user"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        query = CalendarEvent.query.filter_by(user_id=user_id)

        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(CalendarEvent.start_time >= start)
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(CalendarEvent.end_time <= end)

        events = query.order_by(CalendarEvent.start_time).all()

        return jsonify(
            {"success": True, "data": {"events": [event.to_dict() for event in events]}}
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Payment routes
@mock_bp.route("/payment/process", methods=["POST"])
def process_payment():
    """Process mock payment"""
    try:
        from app.mock_services.payment_gateway import MockPaymentGateway

        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        data = request.get_json()

        # Validate required fields
        if not all(
            [
                data.get("booking_id"),
                data.get("card_number"),
                data.get("card_holder"),
                data.get("expiry"),
                data.get("cvv"),
            ]
        ):
            return jsonify(
                {"success": False, "message": "All payment details are required"}
            ), 400

        # Get booking
        booking = Booking.query.filter_by(
            id=data["booking_id"], user_id=user_id
        ).first()

        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        if booking.payment:
            return jsonify(
                {"success": False, "message": "Payment already exists for this booking"}
            ), 400

        # Check if this is an automated payment (add delay only for automated)
        is_automated = data.get("card_holder") == "Auto Payment"

        # Add 10-second delay only for automated payments
        if is_automated:
            time.sleep(10)

        # Process payment through mock gateway
        # Use 100% success rate for automated payments, 90% for manual
        success_rate = 1.0 if is_automated else 0.90
        gateway = MockPaymentGateway(success_rate=success_rate)
        result = gateway.process_payment(
            amount=booking.total_price,
            card_number=data["card_number"],
            card_holder=data["card_holder"],
            expiry=data["expiry"],
            cvv=data["cvv"],
        )

        # Create payment record
        payment = Payment(
            booking_id=booking.id,
            amount=booking.total_price,
            payment_status=result["status"],
            card_last_four=data["card_number"][-4:],
            card_type=result["card_type"],
            card_holder_name=data["card_holder"],
            transaction_id=result["transaction_id"],
            payment_gateway_response=result["gateway_response"],
            paid_at=datetime.utcnow() if result["status"] == "completed" else None,
        )
        db.session.add(payment)

        # Update booking status if payment successful
        if result["status"] == "completed":
            booking.booking_status = "confirmed"

        db.session.commit()

        return jsonify(
            {
                "success": result["status"] == "completed",
                "message": result["message"],
                "data": {
                    "payment": payment.to_dict(),
                    "booking_status": booking.booking_status,
                },
            }
        ), 200 if result["status"] == "completed" else 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# Chat routes
@mock_bp.route("/chat/sessions", methods=["GET"])
def get_chat_sessions():
    """Get chat sessions for current user"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        status = request.args.get("status")
        query = ChatSession.query.filter_by(user_id=user_id)

        if status:
            query = query.filter_by(status=status)

        sessions = query.order_by(ChatSession.started_at.desc()).all()

        return jsonify(
            {
                "success": True,
                "data": {"sessions": [session.to_dict() for session in sessions]},
            }
        ), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@mock_bp.route("/chat/sessions", methods=["POST"])
def create_chat_session():
    """Create new chat session"""
    try:
        import uuid

        from app.mock_services.chat_bot import MockChatBot

        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        session = ChatSession(user_id=user_id, session_id=str(uuid.uuid4()))
        db.session.add(session)
        db.session.flush()

        # Add welcome message
        chatbot = MockChatBot()
        welcome_message = chatbot.get_welcome_message()

        message = ChatMessage(
            session_id=session.id,
            message=welcome_message,
            sender_type="bot",
            sender_name="Support Bot",
        )
        db.session.add(message)
        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Chat session created",
                "data": session.to_dict(),
            }
        ), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@mock_bp.route("/chat/sessions/<string:session_id>/messages", methods=["POST"])
def send_chat_message(session_id):
    """Send message to chat session"""
    try:
        from app.mock_services.chat_bot import MockChatBot

        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        session = ChatSession.query.filter_by(
            session_id=session_id, user_id=user_id, status="active"
        ).first()

        if not session:
            return jsonify(
                {"success": False, "message": "Chat session not found or closed"}
            ), 404

        data = request.get_json()
        user_message = data.get("message")

        if not user_message:
            return jsonify({"success": False, "message": "Message is required"}), 400

        # Add user message
        user_msg = ChatMessage(
            session_id=session.id,
            message=user_message,
            sender_type="user",
            sender_name=f"{session.user.first_name} {session.user.last_name}",
        )
        db.session.add(user_msg)

        # Get bot response
        chatbot = MockChatBot()
        bot_response = chatbot.get_response(user_message)

        bot_msg = ChatMessage(
            session_id=session.id,
            message=bot_response,
            sender_type="bot",
            sender_name="Support Bot",
        )
        db.session.add(bot_msg)
        db.session.commit()

        return jsonify(
            {
                "success": True,
                "data": {
                    "user_message": user_msg.to_dict(),
                    "bot_response": bot_msg.to_dict(),
                },
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@mock_bp.route("/chat/sessions/<string:session_id>/close", methods=["POST"])
def close_chat_session(session_id):
    """Close chat session"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        session = ChatSession.query.filter_by(
            session_id=session_id, user_id=user_id, status="active"
        ).first()

        if not session:
            return jsonify(
                {
                    "success": False,
                    "message": "Chat session not found or already closed",
                }
            ), 404

        session.close()

        return jsonify({"success": True, "message": "Chat session closed"}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
