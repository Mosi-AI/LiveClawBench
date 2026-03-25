from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models import db
from app.models.baggage import BaggageTracking
from app.models.user import User

baggage_bp = Blueprint('baggage', __name__)

# Use default user ID for auto-login
DEFAULT_USER_ID = 1

@baggage_bp.route('/', methods=['GET'])
def get_baggage_list():
    """Get user's baggage tracking list"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        query = BaggageTracking.query.filter_by(user_id=user_id)

        if status:
            query = query.filter_by(status=status)

        query = query.order_by(BaggageTracking.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'success': True,
            'data': {
                'baggage_reports': [report.to_dict() for report in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@baggage_bp.route('/', methods=['POST'])
def submit_baggage_report():
    """Submit new lost baggage report"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        data = request.get_json()

        # Validate required fields
        required_fields = ['flight_number', 'flight_time', 'passenger_name',
                         'passenger_phone', 'passenger_email', 'baggage_description']

        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400

        # Parse flight time
        try:
            flight_time = datetime.strptime(data['flight_time'], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            return jsonify({
                'success': False,
                'message': 'Invalid flight_time format. Use YYYY-MM-DD HH:MM:SS'
            }), 400

        # Create baggage tracking report
        report = BaggageTracking(
            user_id=user_id,
            flight_number=data['flight_number'],
            flight_time=flight_time,
            seat_number=data.get('seat_number'),
            passenger_name=data['passenger_name'],
            passenger_phone=data['passenger_phone'],
            passenger_email=data['passenger_email'],
            baggage_description=data['baggage_description'],
            loss_details=data.get('loss_details'),
            booking_id=data.get('booking_id')
        )

        db.session.add(report)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Baggage report submitted successfully',
            'data': report.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@baggage_bp.route('/<int:report_id>', methods=['GET'])
def get_baggage_report(report_id):
    """Get specific baggage tracking details"""
    try:
        # Use default user for auto-login
        user_id = DEFAULT_USER_ID

        report = BaggageTracking.query.filter_by(
            id=report_id,
            user_id=user_id
        ).first()

        if not report:
            return jsonify({
                'success': False,
                'message': 'Baggage report not found'
            }), 404

        return jsonify({
            'success': True,
            'data': report.to_dict()
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
