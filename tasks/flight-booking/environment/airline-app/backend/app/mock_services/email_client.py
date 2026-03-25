from datetime import datetime
from app.models import db
from app.models.mock_services import EmailNotification

class MockEmailClient:
    """Mock email client for testing"""

    EMAIL_TEMPLATES = {
        'booking_confirmation': {
            'subject': 'Booking Confirmation - {booking_reference}',
            'body': '''
Dear {customer_name},

Thank you for your booking!

Booking Reference: {booking_reference}
Flight: {flight_number}
Route: {origin} → {destination}
Departure: {departure_time}
Cabin Class: {cabin_class}
Passengers: {passenger_count}
Total Amount: ${total_price}

Please arrive at the airport at least 2 hours before departure.

You can manage your booking at any time through our website.

Safe travels!

AirLine Customer Service
            '''
        },
        'payment_confirmation': {
            'subject': 'Payment Received - Booking {booking_reference}',
            'body': '''
Dear {customer_name},

We have received your payment.

Booking Reference: {booking_reference}
Amount Paid: ${amount}
Payment Method: {card_type} ending in {card_last_four}
Transaction ID: {transaction_id}

Your booking is now confirmed.

Thank you for choosing AirLine!

AirLine Customer Service
            '''
        },
        'check_in_confirmation': {
            'subject': 'Check-in Successful - Flight {flight_number}',
            'body': '''
Dear {customer_name},

You have successfully checked in for your flight.

Booking Reference: {booking_reference}
Flight: {flight_number}
Route: {origin} → {destination}
Departure: {departure_time}
Gate: {gate}
Terminal: {terminal}

Your boarding passes are attached to this email.

Remember to arrive at the gate at least 30 minutes before boarding time.

Have a pleasant flight!

AirLine Customer Service
            '''
        },
        'flight_delay': {
            'subject': 'Flight {flight_number} - Delay Notification',
            'body': '''
Dear {customer_name},

We regret to inform you that your flight has been delayed.

Booking Reference: {booking_reference}
Flight: {flight_number}
Route: {origin} → {destination}
Original Departure: {original_departure}
New Departure: {new_departure}
Delay: {delay_minutes} minutes
Reason: {delay_reason}

We apologize for any inconvenience caused. You may be eligible for compensation.
Please visit our claims section to submit a delay claim.

For updates, please check our website or contact customer service.

AirLine Customer Service
            '''
        },
        'flight_cancellation': {
            'subject': 'Flight {flight_number} - Cancellation Notice',
            'body': '''
Dear {customer_name},

We regret to inform you that your flight has been cancelled.

Booking Reference: {booking_reference}
Flight: {flight_number}
Route: {origin} → {destination}
Scheduled Departure: {departure_time}
Reason: {cancellation_reason}

A full refund will be processed automatically. You may also be eligible
for additional compensation. Please visit our claims section.

We sincerely apologize for this disruption to your travel plans.

For assistance, please contact our customer service team.

AirLine Customer Service
            '''
        },
        'booking_cancellation': {
            'subject': 'Booking Cancelled - {booking_reference}',
            'body': '''
Dear {customer_name},

Your booking has been cancelled as requested.

Booking Reference: {booking_reference}
Flight: {flight_number}
Route: {origin} → {destination}
Departure: {departure_time}

Refund Amount: ${refund_amount}
Refund will be processed within 5-7 business days.

We hope to serve you again in the future.

AirLine Customer Service
            '''
        },
        'claim_submitted': {
            'subject': 'Claim Submitted - {claim_id}',
            'body': '''
Dear {customer_name},

Your claim has been submitted successfully.

Claim ID: {claim_id}
Booking Reference: {booking_reference}
Claim Type: {claim_type}
Claim Amount: ${claim_amount}

Our team will review your claim and respond within 5-7 business days.

You can track your claim status through our website.

AirLine Customer Service
            '''
        },
        'claim_resolved': {
            'subject': 'Claim Resolved - {claim_id}',
            'body': '''
Dear {customer_name},

Your claim has been resolved.

Claim ID: {claim_id}
Booking Reference: {booking_reference}
Claim Type: {claim_type}
Requested Amount: ${claim_amount}
Resolved Amount: ${resolved_amount}
Status: {claim_status}

{resolution_notes}

The resolved amount will be refunded to your original payment method
within 5-7 business days.

Thank you for your patience.

AirLine Customer Service
            '''
        }
    }

    def __init__(self):
        """Initialize mock email client"""
        pass

    def send_email(self, user_id, email_type, recipient_email, template_vars, booking_id=None):
        """
        Send mock email (store in database)

        Args:
            user_id (int): User ID
            email_type (str): Type of email (from EMAIL_TEMPLATES)
            recipient_email (str): Recipient email address
            template_vars (dict): Variables to substitute in template
            booking_id (int): Associated booking ID

        Returns:
            EmailNotification: Created email record
        """
        # Get template
        template = self.EMAIL_TEMPLATES.get(email_type)
        if not template:
            raise ValueError(f"Unknown email type: {email_type}")

        # Format subject and body
        subject = template['subject'].format(**template_vars)
        body = template['body'].format(**template_vars)

        # Create email record
        email = EmailNotification(
            user_id=user_id,
            booking_id=booking_id,
            email_type=email_type,
            recipient_email=recipient_email,
            subject=subject.strip(),
            body=body.strip()
        )

        db.session.add(email)
        db.session.commit()

        return email

    def send_booking_confirmation(self, booking):
        """Send booking confirmation email"""
        user = booking.user
        flight = booking.flight

        return self.send_email(
            user_id=user.id,
            email_type='booking_confirmation',
            recipient_email=user.email,
            booking_id=booking.id,
            template_vars={
                'customer_name': f"{user.first_name} {user.last_name}",
                'booking_reference': booking.booking_reference,
                'flight_number': flight.flight_number,
                'origin': flight.origin_code,
                'destination': flight.destination_code,
                'departure_time': flight.departure_time.strftime('%Y-%m-%d %H:%M'),
                'cabin_class': booking.cabin_class.title(),
                'passenger_count': booking.passengers.count(),
                'total_price': f"{booking.total_price:.2f}"
            }
        )

    def send_payment_confirmation(self, booking, payment):
        """Send payment confirmation email"""
        user = booking.user

        return self.send_email(
            user_id=user.id,
            email_type='payment_confirmation',
            recipient_email=user.email,
            booking_id=booking.id,
            template_vars={
                'customer_name': f"{user.first_name} {user.last_name}",
                'booking_reference': booking.booking_reference,
                'amount': f"{payment.amount:.2f}",
                'card_type': payment.card_type.title(),
                'card_last_four': payment.card_last_four,
                'transaction_id': payment.transaction_id
            }
        )

    def send_check_in_confirmation(self, booking):
        """Send check-in confirmation email"""
        user = booking.user
        flight = booking.flight

        return self.send_email(
            user_id=user.id,
            email_type='check_in_confirmation',
            recipient_email=user.email,
            booking_id=booking.id,
            template_vars={
                'customer_name': f"{user.first_name} {user.last_name}",
                'booking_reference': booking.booking_reference,
                'flight_number': flight.flight_number,
                'origin': flight.origin_code,
                'destination': flight.destination_code,
                'departure_time': flight.departure_time.strftime('%Y-%m-%d %H:%M'),
                'gate': flight.gate or 'TBD',
                'terminal': flight.terminal or 'TBD'
            }
        )

    def send_flight_delay_notification(self, booking):
        """Send flight delay notification email"""
        user = booking.user
        flight = booking.flight

        new_departure = flight.departure_time + datetime.timedelta(minutes=flight.delay_minutes)

        return self.send_email(
            user_id=user.id,
            email_type='flight_delay',
            recipient_email=user.email,
            booking_id=booking.id,
            template_vars={
                'customer_name': f"{user.first_name} {user.last_name}",
                'booking_reference': booking.booking_reference,
                'flight_number': flight.flight_number,
                'origin': flight.origin_code,
                'destination': flight.destination_code,
                'original_departure': flight.departure_time.strftime('%Y-%m-%d %H:%M'),
                'new_departure': new_departure.strftime('%Y-%m-%d %H:%M'),
                'delay_minutes': flight.delay_minutes,
                'delay_reason': flight.delay_reason or 'Operational reasons'
            }
        )

    def send_booking_cancellation(self, booking, refund_amount):
        """Send booking cancellation email"""
        user = booking.user
        flight = booking.flight

        return self.send_email(
            user_id=user.id,
            email_type='booking_cancellation',
            recipient_email=user.email,
            booking_id=booking.id,
            template_vars={
                'customer_name': f"{user.first_name} {user.last_name}",
                'booking_reference': booking.booking_reference,
                'flight_number': flight.flight_number,
                'origin': flight.origin_code,
                'destination': flight.destination_code,
                'departure_time': flight.departure_time.strftime('%Y-%m-%d %H:%M'),
                'refund_amount': f"{refund_amount:.2f}"
            }
        )
