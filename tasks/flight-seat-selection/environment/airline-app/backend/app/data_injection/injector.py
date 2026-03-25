"""
Data Injection Interface for Automated Testing

This module provides a standardized API for injecting test data into the database,
enabling automated testing programs to create test cases efficiently.
"""

import random
import string
from datetime import datetime, timedelta

from app.models import db
from app.models.announcement import Announcement
from app.models.baggage import BaggageTracking
from app.models.booking import Booking, Claim, Passenger, Payment
from app.models.faq import FAQ
from app.models.flight import Flight, FlightStatusHistory, Seat
from app.models.mock_services import (
    CalendarEvent,
    ChatMessage,
    ChatSession,
    EmailNotification,
)
from app.models.user import User


class DataInjector:
    """
    Main interface for injecting test data into the database.
    Provides methods to create, modify, and delete test data programmatically.
    """

    def __init__(self, db_session=None):
        """
        Initialize with optional database session

        Args:
            db_session: Database session (defaults to db.session)
        """
        self.db = db_session or db.session

    # ============ USER INJECTION ============

    def create_user(self, email, password, **kwargs):
        """
        Create a test user with specified attributes

        Args:
            email (str): User email
            password (str): User password
            **kwargs: Additional user attributes (first_name, last_name, phone, etc.)

        Returns:
            User: Created user object
        """
        user = User(
            email=email,
            password=password,
            first_name=kwargs.get("first_name", "Test"),
            last_name=kwargs.get("last_name", "User"),
            phone=kwargs.get("phone"),
            date_of_birth=datetime.strptime(kwargs["date_of_birth"], "%Y-%m-%d").date()
            if kwargs.get("date_of_birth")
            else None,
            passport_number=kwargs.get("passport_number"),
            passport_expiry=datetime.strptime(
                kwargs["passport_expiry"], "%Y-%m-%d"
            ).date()
            if kwargs.get("passport_expiry")
            else None,
            is_verified=kwargs.get("is_verified", True),
            is_active=kwargs.get("is_active", True),
        )
        self.db.add(user)
        self.db.commit()
        return user

    def create_users_batch(self, users_data):
        """
        Create multiple users in batch

        Args:
            users_data (list): List of user data dictionaries

        Returns:
            list: List of created User objects
        """
        users = []
        for data in users_data:
            user = self.create_user(**data)
            users.append(user)
        return users

    # ============ FLIGHT INJECTION ============

    def create_flight(
        self,
        flight_number,
        origin_code,
        destination_code,
        departure_time,
        arrival_time,
        base_price_economy,
        **kwargs,
    ):
        """
        Create a flight with all details

        Args:
            flight_number (str): Flight number (e.g., "AA123")
            origin_code (str): Origin airport code (e.g., "JFK")
            destination_code (str): Destination airport code (e.g., "LAX")
            departure_time (datetime/str): Departure time
            arrival_time (datetime/str): Arrival time
            base_price_economy (float): Base economy price
            **kwargs: Additional flight attributes

        Returns:
            Flight: Created flight object
        """
        # Parse datetime if string
        if isinstance(departure_time, str):
            departure_time = datetime.strptime(departure_time, "%Y-%m-%d %H:%M:%S")
        if isinstance(arrival_time, str):
            arrival_time = datetime.strptime(arrival_time, "%Y-%m-%d %H:%M:%S")

        flight = Flight(
            flight_number=flight_number,
            airline=kwargs.get("airline", "GKD Airlines"),
            origin_code=origin_code,
            origin_city=kwargs.get("origin_city", f"{origin_code} City"),
            origin_airport=kwargs.get(
                "origin_airport", f"{origin_code} International Airport"
            ),
            destination_code=destination_code,
            destination_city=kwargs.get("destination_city", f"{destination_code} City"),
            destination_airport=kwargs.get(
                "destination_airport", f"{destination_code} International Airport"
            ),
            departure_time=departure_time,
            arrival_time=arrival_time,
            base_price_economy=base_price_economy,
            base_price_business=kwargs.get(
                "base_price_business", base_price_economy * 2
            ),
            base_price_first=kwargs.get("base_price_first", base_price_economy * 3),
            aircraft_type=kwargs.get("aircraft_type", "Boeing 737"),
            status=kwargs.get("status", "scheduled"),
            gate=kwargs.get("gate"),
            terminal=kwargs.get("terminal"),
        )
        self.db.add(flight)
        self.db.commit()
        return flight

    def create_flights_batch(self, flights_data):
        """
        Create multiple flights in batch

        Args:
            flights_data (list): List of flight data dictionaries

        Returns:
            list: List of created Flight objects
        """
        flights = []
        for data in flights_data:
            flight = self.create_flight(**data)
            flights.append(flight)
        return flights

    def create_flight_with_seats(self, flight_data, seats_config=None):
        """
        Create a flight with custom seat configuration

        Args:
            flight_data (dict): Flight data
            seats_config (dict): Seat configuration {
                'economy': {'rows': 30, 'seats_per_row': 6, 'price': 100},
                'business': {'rows': 5, 'seats_per_row': 4, 'price': 300},
                'first': {'rows': 2, 'seats_per_row': 4, 'price': 500}
            }

        Returns:
            Flight: Created flight with seats
        """
        # Create flight
        flight = self.create_flight(**flight_data)

        # Default seat configuration
        if seats_config is None:
            seats_config = {
                "economy": {
                    "rows": 30,
                    "seats_per_row": 6,
                    "price": flight.base_price_economy,
                },
                "business": {
                    "rows": 5,
                    "seats_per_row": 4,
                    "price": flight.base_price_business
                    or flight.base_price_economy * 2,
                },
                "first": {
                    "rows": 2,
                    "seats_per_row": 4,
                    "price": flight.base_price_first or flight.base_price_economy * 3,
                },
            }

        # Create seats for each cabin class
        seat_letters = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L"]

        row_offset = 1
        for cabin_class, config in seats_config.items():
            rows = config["rows"]
            seats_per_row = config["seats_per_row"]
            price = config["price"]

            for row in range(row_offset, row_offset + rows):
                for i in range(seats_per_row):
                    seat_letter = seat_letters[i]
                    seat_number = f"{row}{seat_letter}"

                    # Determine seat characteristics
                    is_window = seat_letter in ["A", "F", "L"]
                    is_aisle = seat_letter in ["C", "D", "G", "H"]
                    has_extra_legroom = row in [1, 12, 13]  # Exit rows

                    seat = Seat(
                        flight_id=flight.id,
                        seat_number=seat_number,
                        cabin_class=cabin_class,
                        price=price + (50 if has_extra_legroom else 0),
                        is_available=True,
                        is_window=is_window,
                        is_aisle=is_aisle,
                        has_extra_legroom=has_extra_legroom,
                        row_number=row,
                        seat_letter=seat_letter,
                    )
                    self.db.add(seat)

            row_offset += rows

        self.db.commit()
        return flight

    # ============ BOOKING INJECTION ============

    def create_booking(self, user_id, flight_id, passengers_data, **kwargs):
        """
        Create a complete booking with passengers

        Args:
            user_id (int): User ID
            flight_id (int): Flight ID
            passengers_data (list): List of passenger data dictionaries
            **kwargs: Additional booking attributes

        Returns:
            Booking: Created booking object
        """
        flight = Flight.query.get(flight_id)
        cabin_class = kwargs.get("cabin_class", "economy")

        # Calculate total price
        base_price = getattr(flight, f"base_price_{cabin_class}")
        total_price = base_price * len(passengers_data)

        # Create booking
        booking = Booking(
            user_id=user_id,
            flight_id=flight_id,
            cabin_class=cabin_class,
            total_price=total_price,
            booking_status=kwargs.get("booking_status", "pending"),
            checked_in=kwargs.get("checked_in", False),
            check_in_time=kwargs.get("check_in_time"),
        )
        self.db.add(booking)
        self.db.flush()  # Get booking ID

        # Add passengers
        for passenger_data in passengers_data:
            passenger = Passenger(
                booking_id=booking.id,
                first_name=passenger_data["first_name"],
                last_name=passenger_data["last_name"],
                date_of_birth=datetime.strptime(
                    passenger_data["date_of_birth"], "%Y-%m-%d"
                ).date(),
                passport_number=passenger_data.get("passport_number"),
                passport_expiry=datetime.strptime(
                    passenger_data["passport_expiry"], "%Y-%m-%d"
                ).date()
                if passenger_data.get("passport_expiry")
                else None,
                nationality=passenger_data.get("nationality"),
                meal_preference=passenger_data.get("meal_preference"),
                special_assistance=passenger_data.get("special_assistance"),
            )
            self.db.add(passenger)

        self.db.commit()
        return booking

    def create_booking_with_payment(self, booking_data, payment_data=None):
        """
        Create booking with processed payment

        Args:
            booking_data (dict): Booking data
            payment_data (dict): Payment data (optional)

        Returns:
            Booking: Created booking with payment
        """
        # Get or create user
        user_email = booking_data.get("user_email")
        user = User.query.filter_by(email=user_email).first()
        if not user:
            user = self.create_user(
                email=user_email,
                password=booking_data.get("user_password", "password123"),
                first_name=booking_data.get("first_name", "Test"),
                last_name=booking_data.get("last_name", "User"),
            )

        # Get or create flight
        flight_number = booking_data.get("flight_number")
        flight = Flight.query.filter_by(flight_number=flight_number).first()
        if not flight:
            # Create a test flight
            flight = self.create_flight_with_seats(
                {
                    "flight_number": flight_number,
                    "origin_code": booking_data.get("origin", "JFK"),
                    "destination_code": booking_data.get("destination", "LAX"),
                    "departure_time": booking_data.get(
                        "departure_time", datetime.now() + timedelta(days=7)
                    ),
                    "arrival_time": booking_data.get(
                        "arrival_time", datetime.now() + timedelta(days=7, hours=5)
                    ),
                    "base_price_economy": booking_data.get("price", 299.99),
                }
            )

        # Create booking
        booking = self.create_booking(
            user_id=user.id,
            flight_id=flight.id,
            passengers_data=booking_data.get("passengers", [{}]),
            cabin_class=booking_data.get("cabin_class", "economy"),
        )

        # Create payment
        if payment_data:
            payment = self.create_payment(
                booking_id=booking.id,
                amount=payment_data.get("amount", booking.total_price),
                status=payment_data.get("status", "completed"),
            )
            booking.payment = payment
            if payment.payment_status == "completed":
                booking.booking_status = "confirmed"
            self.db.commit()

        return booking

    def create_bookings_batch(self, bookings_data):
        """
        Create multiple bookings in batch

        Args:
            bookings_data (list): List of booking data dictionaries

        Returns:
            list: List of created Booking objects
        """
        bookings = []
        for data in bookings_data:
            booking = self.create_booking(**data)
            bookings.append(booking)
        return bookings

    # ============ PAYMENT INJECTION ============

    def create_payment(self, booking_id, amount, status="completed", **kwargs):
        """
        Create a payment record

        Args:
            booking_id (int): Booking ID
            amount (float): Payment amount
            status (str): Payment status
            **kwargs: Additional payment attributes

        Returns:
            Payment: Created payment object
        """
        payment = Payment(
            booking_id=booking_id,
            amount=amount,
            currency=kwargs.get("currency", "USD"),
            payment_method=kwargs.get("payment_method", "credit_card"),
            payment_status=status,
            card_last_four=kwargs.get("card_last_four", "4242"),
            card_type=kwargs.get("card_type", "visa"),
            card_holder_name=kwargs.get("card_holder_name", "Test User"),
            transaction_id="TXN" + "".join(random.choices(string.digits, k=12)),
            paid_at=datetime.utcnow() if status == "completed" else None,
        )
        self.db.add(payment)
        self.db.commit()
        return payment

    # ============ CLAIM INJECTION ============

    def create_claim(self, booking_id, claim_type, claim_amount, **kwargs):
        """
        Create a claim for testing

        Args:
            booking_id (int): Booking ID
            claim_type (str): Claim type (delay, cancellation, refund, other)
            claim_amount (float): Claim amount
            **kwargs: Additional claim attributes

        Returns:
            Claim: Created claim object
        """
        claim = Claim(
            booking_id=booking_id,
            claim_type=claim_type,
            claim_amount=claim_amount,
            claim_reason=kwargs.get("claim_reason", "Test claim"),
            claim_status=kwargs.get("claim_status", "pending"),
            resolution_notes=kwargs.get("resolution_notes"),
            resolved_amount=kwargs.get("resolved_amount"),
            resolved_at=kwargs.get("resolved_at"),
        )
        self.db.add(claim)
        self.db.commit()
        return claim

    # ============ FLIGHT STATUS INJECTION ============

    def set_flight_status(self, flight_id, status, delay_minutes=None, reason=None):
        """
        Update flight status and record history

        Args:
            flight_id (int): Flight ID
            status (str): New status
            delay_minutes (int): Delay in minutes (optional)
            reason (str): Reason for status change (optional)

        Returns:
            FlightStatusHistory: Status history record
        """
        flight = Flight.query.get(flight_id)
        if not flight:
            raise ValueError(f"Flight {flight_id} not found")

        return flight.update_status(status, delay_minutes, reason)

    # ============ EMAIL/CALENDAR INJECTION ============

    def create_email_notification(self, user_id, email_type, **kwargs):
        """
        Create mock email for testing

        Args:
            user_id (int): User ID
            email_type (str): Type of email
            **kwargs: Additional email attributes

        Returns:
            EmailNotification: Created email object
        """
        email = EmailNotification(
            user_id=user_id,
            booking_id=kwargs.get("booking_id"),
            email_type=email_type,
            recipient_email=kwargs.get("recipient_email", "test@example.com"),
            subject=kwargs.get("subject", f"Test {email_type}"),
            body=kwargs.get("body", "Test email body"),
            is_read=kwargs.get("is_read", False),
        )
        self.db.add(email)
        self.db.commit()
        return email

    def create_calendar_event(self, booking_id, **kwargs):
        """
        Create mock calendar event

        Args:
            booking_id (int): Booking ID
            **kwargs: Additional event attributes

        Returns:
            CalendarEvent: Created event object
        """
        import uuid

        booking = Booking.query.get(booking_id)
        if not booking:
            raise ValueError(f"Booking {booking_id} not found")

        event = CalendarEvent(
            booking_id=booking_id,
            user_id=booking.user_id,
            event_id=str(uuid.uuid4()),
            title=kwargs.get("title", f"Flight {booking.flight.flight_number}"),
            description=kwargs.get("description", "Test calendar event"),
            start_time=kwargs.get("start_time", booking.flight.departure_time),
            end_time=kwargs.get("end_time", booking.flight.arrival_time),
            location=kwargs.get("location", booking.flight.origin_airport),
        )
        self.db.add(event)
        self.db.commit()
        return event

    # ============ CLEANUP OPERATIONS ============

    def clear_all_data(self):
        """Clear all test data from database"""
        try:
            # Delete in order to respect foreign key constraints
            ChatMessage.query.delete()
            ChatSession.query.delete()
            CalendarEvent.query.delete()
            EmailNotification.query.delete()
            Claim.query.delete()
            Payment.query.delete()
            Passenger.query.delete()
            Booking.query.delete()
            Seat.query.delete()
            FlightStatusHistory.query.delete()
            Flight.query.delete()
            User.query.delete()
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise e

    def clear_user_data(self, user_id):
        """Clear all data for a specific user"""
        try:
            user = User.query.get(user_id)
            if not user:
                return

            # Delete user's bookings (cascade will handle related data)
            Booking.query.filter_by(user_id=user_id).delete()
            EmailNotification.query.filter_by(user_id=user_id).delete()
            ChatSession.query.filter_by(user_id=user_id).delete()
            CalendarEvent.query.filter_by(user_id=user_id).delete()

            # Delete user
            self.db.delete(user)
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise e

    def reset_to_seed_data(self):
        """Reset database to initial seed data"""
        self.clear_all_data()
        # Seed data will be added by seed script

    # ============ SCENARIO HELPERS ============

    def load_scenario(self, scenario_name):
        """
        Load a pre-defined test scenario

        Args:
            scenario_name (str): Name of scenario to load
        """
        from app.data_injection.scenarios import load_scenario

        load_scenario(self, scenario_name)

    def create_full_booking_flow(self, user_data, flight_data, passengers_data):
        """
        Create complete booking flow with all dependencies

        Args:
            user_data (dict): User data
            flight_data (dict): Flight data
            passengers_data (list): List of passenger data

        Returns:
            dict: Dictionary with user, flight, and booking objects
        """
        # Create user
        user = self.create_user(**user_data)

        # Create flight with seats
        flight = self.create_flight_with_seats(flight_data)

        # Create booking
        booking = self.create_booking(
            user_id=user.id, flight_id=flight.id, passengers_data=passengers_data
        )

        return {"user": user, "flight": flight, "booking": booking}

    # ============ QUERY HELPERS ============

    def get_user_by_email(self, email):
        """
        Retrieve user by email

        Args:
            email (str): User email

        Returns:
            User: User object or None
        """
        return User.query.filter_by(email=email).first()

    def get_booking_by_reference(self, reference):
        """
        Retrieve booking by reference

        Args:
            reference (str): Booking reference

        Returns:
            Booking: Booking object or None
        """
        return Booking.query.filter_by(booking_reference=reference).first()

    def get_flights_by_route(self, origin, destination):
        """
        Get flights by route

        Args:
            origin (str): Origin airport code
            destination (str): Destination airport code

        Returns:
            list: List of Flight objects
        """
        return Flight.query.filter_by(
            origin_code=origin, destination_code=destination
        ).all()

    # ============ ANNOUNCEMENT INJECTION ============

    def create_announcement(self, title, content, category, **kwargs):
        """
        Create an announcement

        Args:
            title (str): Announcement title
            content (str): Announcement content
            category (str): Category (general, flight, promotion, emergency)
            **kwargs: Additional attributes

        Returns:
            Announcement: Created announcement object
        """
        announcement = Announcement(
            title=title,
            content=content,
            category=category,
            priority=kwargs.get("priority", "normal"),
            is_active=kwargs.get("is_active", True),
            expires_at=kwargs.get("expires_at"),
        )
        self.db.add(announcement)
        self.db.commit()
        return announcement

    # ============ FAQ INJECTION ============

    def create_faq(self, question, answer, category, **kwargs):
        """
        Create a FAQ entry

        Args:
            question (str): FAQ question
            answer (str): FAQ answer
            category (str): Category (booking, check-in, baggage, payment, general)
            **kwargs: Additional attributes

        Returns:
            FAQ: Created FAQ object
        """
        faq = FAQ(
            question=question,
            answer=answer,
            category=category,
            display_order=kwargs.get("display_order", 0),
            is_active=kwargs.get("is_active", True),
        )
        self.db.add(faq)
        self.db.commit()
        return faq

    # ============ BAGGAGE TRACKING INJECTION ============

    def create_baggage_report(
        self,
        user_id,
        flight_number,
        flight_time,
        passenger_name,
        passenger_phone,
        passenger_email,
        baggage_description,
        **kwargs,
    ):
        """
        Create a baggage tracking report

        Args:
            user_id (int): User ID
            flight_number (str): Flight number
            flight_time (datetime/str): Flight time
            passenger_name (str): Passenger name
            passenger_phone (str): Passenger phone
            passenger_email (str): Passenger email
            baggage_description (str): Baggage description
            **kwargs: Additional attributes

        Returns:
            BaggageTracking: Created baggage tracking object
        """
        # Parse datetime if string
        if isinstance(flight_time, str):
            flight_time = datetime.strptime(flight_time, "%Y-%m-%d %H:%M:%S")

        report = BaggageTracking(
            user_id=user_id,
            flight_number=flight_number,
            flight_time=flight_time,
            passenger_name=passenger_name,
            passenger_phone=passenger_phone,
            passenger_email=passenger_email,
            baggage_description=baggage_description,
            seat_number=kwargs.get("seat_number"),
            loss_details=kwargs.get("loss_details"),
            status=kwargs.get("status", "processing"),
            location=kwargs.get("location"),
            booking_id=kwargs.get("booking_id"),
        )
        self.db.add(report)
        self.db.commit()
        return report

    # ============ DEFAULT USER ============

    def create_default_user(self):
        """
        Create default user for auto-login

        Returns:
            User: Default user object
        """
        # Check if default user already exists
        default_user = User.query.filter_by(email="default@gkdairlines.com").first()
        if default_user:
            return default_user

        user = User(
            email="default@gkdairlines.com",
            password="default123",
            first_name="Peter",
            last_name="Griffin",
            phone="+1-555-0100",
            is_verified=True,
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        return user
