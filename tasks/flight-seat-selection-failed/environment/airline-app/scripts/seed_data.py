#!/usr/bin/env python3
"""Seed database with initial test data"""

import os
import sys
from datetime import datetime, timedelta

# Add backend directory to path
backend_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"
)
sys.path.insert(0, backend_dir)

from app import create_app
from app.data_injection import DataInjector
from app.models.flight import Flight


def seed_database():
    """Seed database with sample data"""
    app = create_app("development")

    with app.app_context():
        print("Starting database seeding...")

        # Clear existing data
        print("Clearing existing data...")
        injector = DataInjector()
        injector.clear_all_data()

        # Create default user (Peter Griffin) for auto-login (MUST be ID=1)
        print("Creating default user (Peter Griffin) for auto-login...")
        default_user = injector.create_default_user()
        print(f"Default user created with ID: {default_user.id}")

        # Create test users
        print("Creating test users...")
        user1 = injector.create_user(
            email="john@example.com",
            password="password123",
            first_name="John",
            last_name="Doe",
            phone="+1234567890",
            date_of_birth="1990-01-15",
            is_verified=True,
        )

        user2 = injector.create_user(
            email="jane@example.com",
            password="password123",
            first_name="Jane",
            last_name="Smith",
            is_verified=True,
        )

        # Create sample flights
        print("Creating sample flights...")
        now = datetime.now()

        airports = {
            "JFK": {
                "city": "New York",
                "airport": "John F. Kennedy International Airport",
            },
            "LAX": {
                "city": "Los Angeles",
                "airport": "Los Angeles International Airport",
            },
            "SFO": {
                "city": "San Francisco",
                "airport": "San Francisco International Airport",
            },
            "SEA": {
                "city": "Seattle",
                "airport": "Seattle-Tacoma International Airport",
            },
            "MIA": {"city": "Miami", "airport": "Miami International Airport"},
            "ORD": {"city": "Chicago", "airport": "O'Hare International Airport"},
            "DFW": {
                "city": "Dallas",
                "airport": "Dallas/Fort Worth International Airport",
            },
            "BOS": {"city": "Boston", "airport": "Logan International Airport"},
            "ATL": {
                "city": "Atlanta",
                "airport": "Hartsfield-Jackson Atlanta International Airport",
            },
            "DEN": {"city": "Denver", "airport": "Denver International Airport"},
        }

        # Create flights for next 30 days
        flight_configs = [
            {"origin": "JFK", "dest": "LAX", "hours": 5, "price": 299.99, "time": 8},
            {"origin": "LAX", "dest": "SFO", "hours": 1.5, "price": 149.99, "time": 10},
            {"origin": "SFO", "dest": "SEA", "hours": 2, "price": 199.99, "time": 14},
            {"origin": "JFK", "dest": "MIA", "hours": 3, "price": 179.99, "time": 9},
            {"origin": "ORD", "dest": "DFW", "hours": 2.5, "price": 159.99, "time": 11},
            {"origin": "BOS", "dest": "ATL", "hours": 2.5, "price": 189.99, "time": 13},
            {"origin": "SEA", "dest": "DEN", "hours": 2.5, "price": 209.99, "time": 15},
            {"origin": "LAX", "dest": "JFK", "hours": 5, "price": 279.99, "time": 7},
            {"origin": "MIA", "dest": "JFK", "hours": 3, "price": 169.99, "time": 16},
            {"origin": "ATL", "dest": "BOS", "hours": 2.5, "price": 179.99, "time": 12},
        ]

        flight_number = 100
        for day_offset in range(30):
            for config in flight_configs:
                origin = config["origin"]
                dest = config["dest"]

                flight = injector.create_flight_with_seats(
                    {
                        "flight_number": f"AA{flight_number}",
                        "origin_code": origin,
                        "origin_city": airports[origin]["city"],
                        "origin_airport": airports[origin]["airport"],
                        "destination_code": dest,
                        "destination_city": airports[dest]["city"],
                        "destination_airport": airports[dest]["airport"],
                        "departure_time": now
                        + timedelta(days=day_offset, hours=config["time"]),
                        "arrival_time": now
                        + timedelta(
                            days=day_offset, hours=config["time"] + config["hours"]
                        ),
                        "base_price_economy": config["price"],
                        "aircraft_type": "Boeing 737",
                        "status": "scheduled",
                    }
                )

                flight_number += 1

        print(f"Created {flight_number - 100} flights")

        # Create a sample booking
        print("Creating sample booking...")

        # Get first flight
        first_flight = Flight.query.first()

        booking = injector.create_booking(
            user_id=user1.id,
            flight_id=first_flight.id,
            passengers_data=[
                {
                    "first_name": "John",
                    "last_name": "Doe",
                    "date_of_birth": "1990-01-15",
                }
            ],
            cabin_class="economy",
            booking_status="confirmed",
        )

        # Add payment
        payment = injector.create_payment(
            booking_id=booking.id, amount=booking.total_price, status="completed"
        )

        # Create announcements
        print("Creating announcements...")
        announcements = [
            {
                "title": "New Summer Routes Available",
                "content": "GKD Airlines is excited to announce new summer routes to popular destinations including Barcelona, Mykonos, and Santorini. Book now to secure your summer vacation!",
                "category": "promotion",
                "priority": "normal",
            },
            {
                "title": "Enhanced Baggage Tracking System",
                "content": "We have implemented a new baggage tracking system that allows you to track your luggage in real-time throughout your journey. This feature is now available for all flights.",
                "category": "general",
                "priority": "high",
            },
            {
                "title": "Flight Schedule Updates - Winter Season",
                "content": "Please note that our winter flight schedule will be effective from November 1st. Check your flight status before heading to the airport.",
                "category": "flight",
                "priority": "normal",
            },
            {
                "title": "Priority Boarding Now Available",
                "content": "Enjoy the convenience of priority boarding for just $25 per passenger. Skip the queues and board at your leisure. Available on all flights.",
                "category": "promotion",
                "priority": "low",
            },
            {
                "title": "Important: Travel Document Requirements",
                "content": "Please ensure your passport is valid for at least 6 months beyond your travel date. Check visa requirements for your destination country before booking.",
                "category": "general",
                "priority": "urgent",
            },
        ]

        for ann_data in announcements:
            injector.create_announcement(**ann_data)

        print(f"Created {len(announcements)} announcements")

        # Create FAQs
        print("Creating FAQs...")
        faqs = [
            {
                "question": "What is the baggage allowance for my flight?",
                "answer": "Economy class passengers are allowed one carry-on bag (max 7kg) and one checked bag (max 23kg). Business class passengers can bring two checked bags (max 32kg each). First class passengers enjoy three checked bags (max 32kg each).",
                "category": "baggage",
                "display_order": 1,
            },
            {
                "question": "How can I change or cancel my booking?",
                "answer": "You can modify or cancel your booking through our website or mobile app up to 24 hours before departure. Cancellation fees may apply depending on your fare type. Refunds for cancelled flights by GKD Airlines are processed automatically within 7-10 business days.",
                "category": "booking",
                "display_order": 2,
            },
            {
                "question": "When can I check in for my flight?",
                "answer": "Online check-in opens 24 hours before your scheduled departure time and closes 2 hours before departure. Airport check-in counters open 3 hours before departure for international flights and 2 hours for domestic flights.",
                "category": "check-in",
                "display_order": 3,
            },
            {
                "question": "What payment methods are accepted?",
                "answer": "We accept all major credit cards (Visa, MasterCard, American Express, Discover), debit cards, PayPal, and bank transfers. For certain promotions, we also offer installment payment plans.",
                "category": "payment",
                "display_order": 4,
            },
            {
                "question": "How do I get a refund for a cancelled flight?",
                "answer": "If GKD Airlines cancels your flight, you are entitled to a full refund automatically processed to your original payment method within 7-10 business days. You can also choose to receive travel credits for future flights with a 10% bonus value. Contact our customer service for assistance.",
                "category": "booking",
                "display_order": 5,
            },
            {
                "question": "Can I select my seat in advance?",
                "answer": 'Yes! You can select your preferred seat during booking or through the "Manage Booking" section. Window and aisle seats may have additional fees. Seat selection is complimentary for Business and First class passengers.',
                "category": "booking",
                "display_order": 6,
            },
            {
                "question": "What happens if my flight is delayed?",
                "answer": "We will notify you via email and SMS about any delays. For delays over 2 hours, you may be eligible for meal vouchers. For delays over 4 hours due to airline fault, you may receive compensation up to $200 depending on the flight distance.",
                "category": "general",
                "display_order": 7,
            },
        ]

        for faq_data in faqs:
            injector.create_faq(**faq_data)

        print(f"Created {len(faqs)} FAQs")

        # Create sample baggage tracking reports
        print("Creating sample baggage tracking reports...")
        baggage_reports = [
            {
                "user_id": default_user.id,
                "flight_number": first_flight.flight_number,
                "flight_time": first_flight.departure_time,
                "passenger_name": f"{default_user.first_name} {default_user.last_name}",
                "passenger_phone": default_user.phone,
                "passenger_email": default_user.email,
                "baggage_description": "Black Samsonite suitcase with red ribbon",
                "seat_number": "12A",
                "loss_details": "Last seen at JFK airport baggage claim",
                "status": "processing",
            }
        ]

        for report_data in baggage_reports:
            injector.create_baggage_report(**report_data)

        print(f"Created {len(baggage_reports)} baggage tracking reports")

        print("\n" + "=" * 60)
        print("Database seeding completed successfully!")
        print("=" * 60)
        print("Created:")
        print(f"  - 1 default user (Peter Griffin, ID={default_user.id})")
        print("  - 2 test users")
        print(f"  - {flight_number - 100} flights")
        print("  - 1 booking")
        print(f"  - {len(announcements)} announcements")
        print(f"  - {len(faqs)} FAQs")
        print(f"  - {len(baggage_reports)} baggage reports")
        print("=" * 60)


if __name__ == "__main__":
    seed_database()
