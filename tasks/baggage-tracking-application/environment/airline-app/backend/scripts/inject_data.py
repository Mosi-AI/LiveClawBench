#!/usr/bin/env python
"""
Data injection script for airline application.
Creates simulated users, flights, bookings, and other airline-related data.
All dates are current-time-sensitive to avoid data staleness.
"""

import os
import sys

# Add parent directory to path to import models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
from datetime import datetime, timedelta

from app import create_app, db
from app.data_injection import DataInjector
from app.models.announcement import Announcement
from app.models.baggage import BaggageTracking
from app.models.booking import Booking, Passenger, Payment
from app.models.faq import FAQ
from app.models.flight import Flight, Seat
from app.models.user import User


def get_or_create_default_user(injector):
    """Get or create the default user for auto-login."""
    print("Getting/Creating default user for auto-login...")

    default_user = User.query.filter_by(email="peter.griffin@work.mosi.inc").first()
    if not default_user:
        default_user = injector.create_user(
            email="peter.griffin@work.mosi.inc",
            password="default123",
            first_name="Peter",
            last_name="Griffin",
            phone="+1-555-0100",
            is_verified=True,
        )
        print("  Created default user: peter.griffin@work.mosi.inc")
    else:
        print("  Default user already exists")

    return default_user


def create_test_users(injector):
    """Create test users with various profiles."""
    print("\nCreating test users...")

    users_data = [
        {
            "email": "john.doe@email.com",
            "password": "password123",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "+1-555-1001",
            "date_of_birth": "1985-03-15",
            "is_verified": True,
        },
        {
            "email": "jane.smith@email.com",
            "password": "password123",
            "first_name": "Jane",
            "last_name": "Smith",
            "phone": "+1-555-1002",
            "date_of_birth": "1990-07-22",
            "is_verified": True,
        },
        {
            "email": "mike.johnson@email.com",
            "password": "password123",
            "first_name": "Mike",
            "last_name": "Johnson",
            "phone": "+1-555-1003",
            "date_of_birth": "1978-11-08",
            "is_verified": True,
        },
        {
            "email": "sarah.williams@email.com",
            "password": "password123",
            "first_name": "Sarah",
            "last_name": "Williams",
            "phone": "+1-555-1004",
            "date_of_birth": "1992-05-30",
            "is_verified": True,
        },
        {
            "email": "david.brown@email.com",
            "password": "password123",
            "first_name": "David",
            "last_name": "Brown",
            "phone": "+1-555-1005",
            "date_of_birth": "1988-09-12",
            "is_verified": True,
        },
    ]

    created_users = []
    for user_data in users_data:
        # Check if user already exists
        existing = User.query.filter_by(email=user_data["email"]).first()
        if existing:
            print(f"  User '{user_data['email']}' already exists, skipping...")
            created_users.append(existing)
            continue

        user = injector.create_user(**user_data)
        created_users.append(user)
        print(f"  Created user: {user_data['email']}")

    return created_users


def create_flights_with_seats(injector):
    """Create flights with seats for next 60 days."""
    print("\nCreating flights with seats...")

    now = datetime.now()

    # Airport data
    airports = {
        "JFK": {"city": "New York", "airport": "John F. Kennedy International Airport"},
        "LAX": {"city": "Los Angeles", "airport": "Los Angeles International Airport"},
        "SFO": {
            "city": "San Francisco",
            "airport": "San Francisco International Airport",
        },
        "SEA": {"city": "Seattle", "airport": "Seattle-Tacoma International Airport"},
        "MIA": {"city": "Miami", "airport": "Miami International Airport"},
        "ORD": {"city": "Chicago", "airport": "O'Hare International Airport"},
        "DFW": {"city": "Dallas", "airport": "Dallas/Fort Worth International Airport"},
        "BOS": {"city": "Boston", "airport": "Logan International Airport"},
        "ATL": {
            "city": "Atlanta",
            "airport": "Hartsfield-Jackson Atlanta International Airport",
        },
        "DEN": {"city": "Denver", "airport": "Denver International Airport"},
        "PHX": {
            "city": "Phoenix",
            "airport": "Phoenix Sky Harbor International Airport",
        },
        "LAS": {"city": "Las Vegas", "airport": "McCarran International Airport"},
    }

    # Flight configurations
    flight_configs = [
        {
            "origin": "JFK",
            "dest": "LAX",
            "hours": 6,
            "price": 299.99,
            "times": [6, 10, 14, 18],
        },
        {
            "origin": "LAX",
            "dest": "SFO",
            "hours": 1.5,
            "price": 149.99,
            "times": [7, 11, 15, 19],
        },
        {
            "origin": "SFO",
            "dest": "SEA",
            "hours": 2,
            "price": 199.99,
            "times": [8, 12, 16, 20],
        },
        {
            "origin": "JFK",
            "dest": "MIA",
            "hours": 3,
            "price": 179.99,
            "times": [7, 11, 15, 19],
        },
        {
            "origin": "ORD",
            "dest": "DFW",
            "hours": 2.5,
            "price": 159.99,
            "times": [6, 10, 14, 18],
        },
        {
            "origin": "BOS",
            "dest": "ATL",
            "hours": 2.5,
            "price": 189.99,
            "times": [7, 11, 15],
        },
        {
            "origin": "SEA",
            "dest": "DEN",
            "hours": 2.5,
            "price": 209.99,
            "times": [8, 12, 16],
        },
        {
            "origin": "LAX",
            "dest": "JFK",
            "hours": 5,
            "price": 279.99,
            "times": [6, 10, 14, 18],
        },
        {
            "origin": "MIA",
            "dest": "JFK",
            "hours": 3,
            "price": 169.99,
            "times": [7, 11, 15, 19],
        },
        {
            "origin": "ATL",
            "dest": "BOS",
            "hours": 2.5,
            "price": 179.99,
            "times": [8, 12, 16],
        },
        {
            "origin": "DFW",
            "dest": "PHX",
            "hours": 2,
            "price": 139.99,
            "times": [7, 11, 15, 19],
        },
        {
            "origin": "LAS",
            "dest": "LAX",
            "hours": 1,
            "price": 99.99,
            "times": [6, 10, 14, 18, 22],
        },
        {
            "origin": "DEN",
            "dest": "ORD",
            "hours": 2,
            "price": 159.99,
            "times": [7, 11, 15, 19],
        },
        {
            "origin": "PHX",
            "dest": "SEA",
            "hours": 3,
            "price": 189.99,
            "times": [8, 12, 16],
        },
        {
            "origin": "JFK",
            "dest": "BOS",
            "hours": 1.5,
            "price": 129.99,
            "times": [6, 10, 14, 18, 22],
        },
    ]

    flight_number = 100
    created_flights = []

    # Create flights for next 60 days
    for day_offset in range(60):
        for config in flight_configs:
            origin = config["origin"]
            dest = config["dest"]

            # Create flights at different times of day
            for hour in config["times"]:
                # Skip some flights randomly to make it more realistic
                if random.random() < 0.3:
                    continue

                flight_data = {
                    "flight_number": f"GKD{flight_number}",
                    "origin_code": origin,
                    "origin_city": airports[origin]["city"],
                    "origin_airport": airports[origin]["airport"],
                    "destination_code": dest,
                    "destination_city": airports[dest]["city"],
                    "destination_airport": airports[dest]["airport"],
                    "departure_time": now + timedelta(days=day_offset, hours=hour),
                    "arrival_time": now
                    + timedelta(days=day_offset, hours=hour + config["hours"]),
                    "base_price_economy": config["price"],
                    "aircraft_type": random.choice(
                        ["Boeing 737", "Boeing 787", "Airbus A320", "Airbus A321"]
                    ),
                    "status": "scheduled",
                }

                flight = injector.create_flight_with_seats(flight_data)
                created_flights.append(flight)
                flight_number += 1

    print(f"  Created {len(created_flights)} flights with seats")
    return created_flights


def create_bookings_for_users(injector, users, flights):
    """Create various bookings for users."""
    print("\nCreating bookings for users...")

    booking_count = 0

    # Create different types of bookings
    booking_scenarios = [
        # Past bookings (completed trips)
        {"days_offset": -30, "status": "confirmed", "checked_in": True, "user_idx": 0},
        {"days_offset": -20, "status": "confirmed", "checked_in": True, "user_idx": 1},
        {"days_offset": -15, "status": "confirmed", "checked_in": True, "user_idx": 2},
        # Current bookings (upcoming trips within next week)
        {"days_offset": 2, "status": "confirmed", "checked_in": False, "user_idx": 0},
        {"days_offset": 5, "status": "confirmed", "checked_in": False, "user_idx": 1},
        {"days_offset": 7, "status": "confirmed", "checked_in": False, "user_idx": 3},
        # Future bookings (trips in 2-4 weeks)
        {"days_offset": 14, "status": "confirmed", "checked_in": False, "user_idx": 2},
        {"days_offset": 21, "status": "confirmed", "checked_in": False, "user_idx": 4},
        {"days_offset": 28, "status": "confirmed", "checked_in": False, "user_idx": 0},
        # Cancelled bookings
        {"days_offset": 10, "status": "cancelled", "checked_in": False, "user_idx": 3},
        {"days_offset": 25, "status": "cancelled", "checked_in": False, "user_idx": 1},
        # Pending payment
        {"days_offset": 12, "status": "pending", "checked_in": False, "user_idx": 2},
    ]

    for scenario in booking_scenarios:
        # Find a flight for the scenario
        target_date = datetime.now() + timedelta(days=scenario["days_offset"])

        # Find a flight close to the target date
        suitable_flight = None
        for flight in flights:
            if (
                abs((flight.departure_time - target_date).total_seconds()) < 86400
            ):  # Within 1 day
                suitable_flight = flight
                break

        if not suitable_flight:
            continue

        user = users[scenario["user_idx"] % len(users)]

        # Create booking
        booking = injector.create_booking(
            user_id=user.id,
            flight_id=suitable_flight.id,
            passengers_data=[
                {
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "date_of_birth": "1990-01-01",
                    "nationality": "US",
                }
            ],
            cabin_class=random.choice(["economy", "economy", "economy", "business"]),
            booking_status=scenario["status"],
            checked_in=scenario["checked_in"],
            check_in_time=datetime.now() if scenario["checked_in"] else None,
        )

        # Create payment for confirmed bookings
        if scenario["status"] in ["confirmed", "cancelled"]:
            payment_status = (
                "completed" if scenario["status"] == "confirmed" else "refunded"
            )
            injector.create_payment(
                booking_id=booking.id, amount=booking.total_price, status=payment_status
            )

        booking_count += 1
        print(f"  Created booking: {booking.booking_reference} for user {user.email}")

    print(f"  Total bookings created: {booking_count}")
    return booking_count


def create_announcements(injector):
    """Create airline announcements with current dates."""
    print("\nCreating announcements...")

    now = datetime.now()

    announcements = [
        {
            "title": f"Spring Travel Deals - Book Now for March-April {now.year}!",
            "content": f"""GKD Airlines is excited to announce special spring travel deals!

Take advantage of our limited-time offers:
- 25% off all domestic flights booked before {(now + timedelta(days=7)).strftime("%B %d")}
- Free seat selection on bookings over $300
- Double miles on all international routes

Popular destinations on sale:
- New York to Los Angeles starting at $249
- Chicago to Miami starting at $179
- Seattle to Denver starting at $159

Book by {(now + timedelta(days=14)).strftime("%B %d, %Y")} to lock in these rates!

Terms and conditions apply. Limited availability.""",
            "category": "promotion",
            "priority": "high",
            "expires_at": now + timedelta(days=30),
        },
        {
            "title": "Enhanced Mobile Check-In Experience",
            "content": """We've upgraded our mobile check-in system!

New features include:
- Streamlined interface for faster check-in
- Real-time seat map updates
- Mobile boarding passes with Apple Wallet and Google Pay integration
- Automated gate change notifications
- Family check-in for multiple passengers

Download our app or check in through our website 24 hours before departure.

Available now on iOS and Android.""",
            "category": "general",
            "priority": "normal",
        },
        {
            "title": f"Flight Schedule Update - {now.strftime('%B %Y')}",
            "content": f"""Please note the following schedule adjustments effective {(now + timedelta(days=7)).strftime("%B %d, %Y")}:

New Routes Added:
- JFK to Las Vegas: Daily flights
- LAX to Phoenix: 3 flights daily
- Seattle to Boston: Weekend service

Discontinued Routes:
- Miami to Dallas: Last flight on {(now + timedelta(days=14)).strftime("%B %d")}

Schedule Changes:
- JFK-LAX morning departure moved from 6:00 AM to 6:30 AM
- Additional late-night flights added on Fridays and Sundays

We apologize for any inconvenience and appreciate your understanding.""",
            "category": "flight",
            "priority": "normal",
        },
        {
            "title": "New Premium Economy Class Available",
            "content": """Introducing Premium Economy - the perfect balance of comfort and value!

Premium Economy benefits:
- 6 inches of extra legroom
- Priority boarding
- Enhanced meal service
- Complimentary premium beverages
- Dedicated cabin crew
- 50% more baggage allowance

Available now on select routes:
- All transcontinental flights
- International routes from JFK, LAX, and SFO

Upgrade from just $79 per segment.""",
            "category": "promotion",
            "priority": "low",
        },
        {
            "title": "Important: Enhanced Security Measures",
            "content": f"""Effective {(now + timedelta(days=3)).strftime("%B %d, %Y")}, GKD Airlines will implement enhanced security measures at all airports.

What you need to know:
- Arrive at least 2.5 hours before domestic flights
- Arrive at least 3.5 hours before international flights
- Additional security screening may be required
- Liquids and electronics rules remain unchanged

Tips for faster screening:
- Have your ID and boarding pass ready
- Remove laptops from bags
- Empty pockets before screening
- Follow TSA PreCheck guidelines if enrolled

Your safety is our top priority.""",
            "category": "general",
            "priority": "urgent",
        },
        {
            "title": "Partnership Announcement: Hotel Discounts",
            "content": """GKD Airlines has partnered with leading hotel chains to bring you exclusive discounts!

Partner hotels offering 15-25% off:
- Marriott Hotels & Resorts
- Hilton Hotels
- Hyatt Regency
- InterContinental Hotels

How to book:
1. Visit our website's "Travel Partners" section
2. Enter your GKD booking reference
3. Access exclusive member rates
4. Earn bonus miles on hotel stays

Valid for bookings made within 30 days of your flight.""",
            "category": "promotion",
            "priority": "low",
        },
    ]

    for ann_data in announcements:
        injector.create_announcement(**ann_data)
        print(f"  Created announcement: {ann_data['title']}")

    print(f"  Total announcements created: {len(announcements)}")


def create_faqs(injector):
    """Create frequently asked questions."""
    print("\nCreating FAQs...")

    faqs = [
        #         {
        #             'question': 'What is the baggage allowance for my flight?',
        #             'answer': '''Economy class passengers are allowed one carry-on bag (max 7kg) and one checked bag (max 23kg).
        # Business class passengers can bring two checked bags (max 32kg each).
        # First class passengers enjoy three checked bags (max 32kg each).
        # Additional baggage can be purchased during booking or at the airport (higher fees apply at airport).''',
        #             'category': 'baggage',
        #             'display_order': 1
        #         },
        #         {
        #             'question': 'How can I change or cancel my booking?',
        #             'answer': '''You can modify or cancel your booking through our website or mobile app up to 24 hours before departure.
        # Cancellation fees:
        # - More than 7 days before departure: No fee
        # - 3-7 days before departure: $75 fee
        # - 24-72 hours before departure: $150 fee
        # - Less than 24 hours: No refund available
        # Refunds for flights cancelled by GKD Airlines are processed automatically within 7-10 business days.''',
        #             'category': 'booking',
        #             'display_order': 2
        #         },
        #         {
        #             'question': 'When can I check in for my flight?',
        #             'answer': '''Online check-in opens 24 hours before your scheduled departure time and closes 2 hours before departure.
        # Airport check-in counters:
        # - International flights: Open 3 hours before departure
        # - Domestic flights: Open 2 hours before departure
        # We recommend checking in online to save time at the airport and select your preferred seat.''',
        #             'category': 'check-in',
        #             'display_order': 3
        #         },
        #         {
        #             'question': 'What payment methods are accepted?',
        #             'answer': '''We accept:
        # - All major credit cards (Visa, MasterCard, American Express, Discover)
        # - Debit cards with Visa or MasterCard logo
        # - PayPal
        # - Apple Pay and Google Pay
        # - Bank transfers (for bookings made 7+ days in advance)
        # - GKD Airlines travel credits and gift cards
        # Installment payment plans are available for bookings over $500.''',
        #             'category': 'payment',
        #             'display_order': 4
        #         },
        {
            "question": "How do I get a refund for a cancelled flight?",
            "answer": """If GKD Airlines cancels your flight, you are entitled to a full refund automatically processed to your original payment method within 7-10 business days.

Options for cancelled flights:
1. Full refund to original payment method
2. Travel credits for future flights with a 10% bonus value
3. Rebooking on the next available flight at no extra cost

Contact our customer service for assistance with refunds and rebooking.""",
            "category": "booking",
            "display_order": 1,
        },
        #         {
        #             'question': 'Can I select my seat in advance?',
        #             'answer': '''Yes! You can select your preferred seat during booking or through "Manage Booking".
        # Seat selection fees:
        # - Standard seats: Complimentary (based on availability)
        # - Preferred seats (extra legroom): $25-50
        # - Exit row seats: $45-75
        # - Window and aisle seats: May have additional fees
        # Business and First class passengers: Complimentary seat selection for all seats.''',
        #             'category': 'booking',
        #             'display_order': 6
        #         },
        {
            "question": "What happens if my flight is delayed?",
            "answer": """We will notify you via email and SMS about any delays.

Compensation for delays:
- Delays under 2 hours: No compensation
- Delays 2-4 hours: Meal vouchers provided
- Delays over 4 hours (airline fault): Compensation up to $200 depending on flight distance
- Overnight delays: Hotel accommodation provided

Check your flight status on our website or app for real-time updates.""",
            "category": "general",
            "display_order": 2,
        },
        {
            "question": "How early should I arrive at the airport?",
            "answer": """Recommended arrival times:

Domestic flights:
- Without checked bags: 90 minutes before departure
- With checked bags: 2 hours before departure

International flights:
- Standard: 3 hours before departure
- With TSA PreCheck: 2.5 hours before departure

Peak travel times (holidays, weekends): Add an extra 30-60 minutes.""",
            "category": "check-in",
            "display_order": 5,
        },
        {
            "question": "How do I file a claim for a cancelled flight?",
            "answer": """If your flight was cancelled by GKD Airlines under circumstances that qualify for compensation, you may file a claim for reimbursement or additional compensation.

**Qualifying Circumstances for Flight Cancellation Claims:**

Your flight cancellation may qualify for a claim if it was caused by:
- Aircraft mechanical issues or maintenance problems
- Crew shortages or scheduling issues
- Airline operational failures
- Air traffic control restrictions (when compensation is applicable)
- Weather-related cancellations when the airline failed to provide adequate notice or assistance

*Note: Force majeure events (natural disasters, acts of war, security threats, air traffic control strikes, etc.) may not qualify for additional compensation beyond a refund.*

**Steps to File a Claim:**

1. **Prepare Your Documentation:**
   - Flight information (flight number, date, departure and arrival cities)
   - Booking reference number
   - Your personal information (full name, contact details)
   - Screenshot of your flight booking confirmation
   - Reason for the claim (detailed explanation of the cancellation impact)

2. **Submit Your Claim:**
   Send your claim application to our dedicated customer service email:
   **claims@gkdairlines.com**

   Your email should include:
   - Subject line: "Flight Cancellation Claim - [Booking Reference] - [Flight Number]"
   - Detailed description of the cancellation and its impact
   - All supporting documents as attachments

3. **Processing Timeline:**
   - Claims are typically reviewed within 5-7 business days
   - Complex cases may take up to 14 business days
   - You will receive email confirmation of your claim receipt
   - Status updates will be sent to your registered email
   - Our staff will contact you to discuss a specific claim plan. Please see the next section for details on the possible options.

4. **Compensation Options:**
   - Full refund of ticket price
   - Travel credits with bonus value (up to 10% additional)
   - Reimbursement for documented expenses
   - Vouchers for future travel

**Important Notes:**
- Claims must be submitted within 30 days of the cancelled flight
- Ensure all documents are clear and legible
- Keep copies of all submitted materials
- Provide accurate contact information for follow-up""",
            "category": "booking",
            "display_order": 4,
        },
        {
            "question": "What should I do if my luggage is lost?",
            "answer": """If you discover that your luggage is missing, please follow these steps:

**Step 1: At the Airport**

Wait patiently at the baggage carousel for your flight. Sometimes luggage takes longer to arrive due to:
- Heavy passenger volume
- Security screenings
- Weather conditions
- Aircraft loading procedures

If your luggage does not appear after a reasonable waiting period:
- Check all carousel monitors for your flight number
- Verify with airport staff that all bags from your flight have been unloaded
- Ask nearby passengers if they may have accidentally taken a similar bag

**Step 2: Report to Airport Staff**

If your luggage is confirmed missing, immediately:
- Locate the GKD Airlines baggage service office in the baggage claim area
- Speak with a baggage service representative
- Provide your baggage claim tag and flight details
- Airport staff will initiate an immediate search

**Step 3: File a Lost Baggage Report Online**

After confirming your luggage is lost, file a detailed report on the GKD Airlines official website:


**Step 4: Track Your Report**

After submission:
- Monitor your report status online 24/7
- Our system provides real-time updates on the search progress

**Step 5: Wait for Results**

Our airline and airport staff will:
- Conduct a comprehensive search across all airports in your flight's route
- Check baggage handling systems and storage areas
- Coordinate with connecting flights and partner airlines
- Contact you immediately once your luggage is located

**Notification Timeline:**
- Initial search results: Within 24-48 hours
- Updates provided via email and SMS
- You will be notified as soon as there is any progress

**Compensation:**
If your luggage is not found within 72 hours, you may be eligible for:
- Emergency expense reimbursement for essential items
- Interim compensation for delayed baggage
- Full compensation if luggage is declared lost after 21 days

**Important Tips:**
- Keep your baggage claim tag safe until your luggage is recovered
- Save all receipts for essential purchases during the delay
- Provide accurate and complete contact information
- Respond promptly to any requests for additional information""",
            "category": "baggage",
            "display_order": 3,
        },
    ]

    for faq_data in faqs:
        injector.create_faq(**faq_data)
        print(f"  Created FAQ: {faq_data['question'][:50]}...")

    print(f"  Total FAQs created: {len(faqs)}")


def create_baggage_reports(injector, users, flights):
    """Create baggage tracking reports."""
    print("\nCreating baggage tracking reports...")

    now = datetime.now()

    # Create a past flight for the first baggage report (at least 3 months ago)
    past_flight_time = now - timedelta(days=95)  # About 3 months ago
    past_flight_data = {
        "flight_number": "GKD777",
        "origin_code": "JFK",
        "origin_city": "New York",
        "origin_airport": "John F. Kennedy International Airport",
        "destination_code": "LAX",
        "destination_city": "Los Angeles",
        "destination_airport": "Los Angeles International Airport",
        "departure_time": past_flight_time,
        "arrival_time": past_flight_time + timedelta(hours=5, minutes=30),
        "base_price_economy": 299.99,
        "aircraft_type": "Boeing 737",
        "status": "landed",
    }
    past_flight = injector.create_flight_with_seats(past_flight_data)
    print(f"  Created past flight: {past_flight.flight_number} for baggage report")

    baggage_reports = [
        {
            "user_id": users[0].id,
            "flight_number": past_flight.flight_number,
            "flight_time": past_flight.departure_time,
            "passenger_name": f"{users[0].first_name} {users[0].last_name}",
            "passenger_phone": users[0].phone,
            "passenger_email": users[0].email,
            "baggage_description": "Black Samsonite suitcase with red ribbon handle",
            "seat_number": "12A",
            "loss_details": "Last seen at baggage claim carousel 3 at JFK airport",
            "status": "processed",
        },
        {
            "user_id": users[1].id,
            "flight_number": flights[5].flight_number,
            "flight_time": flights[5].departure_time,
            "passenger_name": f"{users[1].first_name} {users[1].last_name}",
            "passenger_phone": users[1].phone,
            "passenger_email": users[1].email,
            "baggage_description": "Blue hard-shell suitcase with TSA lock",
            "seat_number": "8F",
            "loss_details": "Bag did not arrive at final destination",
            "status": "located",
        },
        {
            "user_id": users[2].id,
            "flight_number": flights[10].flight_number,
            "flight_time": flights[10].departure_time,
            "passenger_name": f"{users[2].first_name} {users[2].last_name}",
            "passenger_phone": users[2].phone,
            "passenger_email": users[2].email,
            "baggage_description": "Grey duffel bag with golf club tag",
            "seat_number": "22C",
            "loss_details": "Missing after connecting flight",
            "status": "delivered",
        },
    ]

    # Create the first report with a past created_at timestamp
    first_report_data = baggage_reports[0]
    report = BaggageTracking(
        user_id=first_report_data["user_id"],
        flight_number=first_report_data["flight_number"],
        flight_time=first_report_data["flight_time"],
        passenger_name=first_report_data["passenger_name"],
        passenger_phone=first_report_data["passenger_phone"],
        passenger_email=first_report_data["passenger_email"],
        baggage_description=first_report_data["baggage_description"],
        seat_number=first_report_data["seat_number"],
        loss_details=first_report_data["loss_details"],
        status=first_report_data["status"],
    )
    # Set created_at to be 3 months ago
    report.created_at = now - timedelta(days=95)
    report.updated_at = now - timedelta(days=90)  # Updated 5 days after creation
    db.session.add(report)
    db.session.commit()
    print(
        f"  Created baggage report for flight {first_report_data['flight_number']} (processed, 3 months old)"
    )

    # Create remaining reports normally
    for report_data in baggage_reports[1:]:
        injector.create_baggage_report(**report_data)
        print(f"  Created baggage report for flight {report_data['flight_number']}")

    print(f"  Total baggage reports created: {len(baggage_reports)}")


def create_specific_data(injector):
    """Create specific flight from JFK to LAX for Peter Griffin that has arrived."""
    print("\nCreating specific flight for Peter Griffin...")

    now = datetime.now()

    # Calculate times: flight arrived about 1 hour ago
    # JFK to LAX is typically 5-6 hours flight time
    arrival_time = now - timedelta(hours=1)
    departure_time = arrival_time - timedelta(hours=5, minutes=30)

    # Get the default user (Peter Griffin) first to filter out same-day flights
    default_user = User.query.filter_by(email="peter.griffin@work.mosi.inc").first()
    if not default_user:
        print("  Warning: Default user not found!")
        return

    # Remove any existing bookings for Peter Griffin on the same day as the specific flight
    # This ensures he doesn't have other scheduled flights on the same day
    flight_date = departure_time.date()
    from app.models.booking import Booking

    same_day_bookings = Booking.query.filter_by(user_id=default_user.id).all()
    removed_count = 0
    for existing_booking in same_day_bookings:
        if existing_booking.flight.departure_time.date() == flight_date:
            # Delete this booking
            db.session.delete(existing_booking)
            removed_count += 1

    if removed_count > 0:
        db.session.commit()
        print(
            f"  Removed {removed_count} existing same-day booking(s) for Peter Griffin"
        )

    # Create the flight
    flight_data = {
        "flight_number": "GKD888",
        "origin_code": "JFK",
        "origin_city": "New York",
        "origin_airport": "John F. Kennedy International Airport",
        "destination_code": "LAX",
        "destination_city": "Los Angeles",
        "destination_airport": "Los Angeles International Airport",
        "departure_time": departure_time,
        "arrival_time": arrival_time,
        "base_price_economy": 299.99,
        "aircraft_type": "Boeing 737",
        "status": "landed",  # Flight has arrived
        "gate": "A12",
        "terminal": "4",
    }

    flight = injector.create_flight_with_seats(flight_data)
    print(f"  Created flight: {flight.flight_number} from JFK to LAX")

    # Create booking for Peter Griffin
    booking = injector.create_booking(
        user_id=default_user.id,
        flight_id=flight.id,
        passengers_data=[
            {
                "first_name": default_user.first_name,
                "last_name": default_user.last_name,
                "date_of_birth": "1985-01-01",
                "nationality": "US",
            }
        ],
        cabin_class="economy",
        booking_status="confirmed",
        checked_in=True,
        check_in_time=departure_time
        - timedelta(hours=2),  # Checked in 2 hours before departure
    )

    # Assign a seat to the passenger
    from app.models.flight import Seat

    # Get the passenger
    passenger = Passenger.query.filter_by(booking_id=booking.id).first()

    # Get an available economy seat
    available_seat = Seat.query.filter_by(
        flight_id=flight.id, cabin_class="economy", is_available=True
    ).first()

    if available_seat and passenger:
        # Assign the seat to the passenger
        passenger.seat_id = available_seat.id
        available_seat.is_available = False
        db.session.commit()
        print(f"  Assigned seat {available_seat.seat_number} to passenger")
    else:
        print("  Warning: Could not assign seat to passenger")

    # Create payment for the booking
    injector.create_payment(
        booking_id=booking.id, amount=booking.total_price, status="completed"
    )

    print(
        f"  Created booking: {booking.booking_reference} for {default_user.first_name} {default_user.last_name}"
    )
    print(f"  Flight departed at: {departure_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"  Flight arrived at: {arrival_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"  User has checked in: {booking.checked_in}")

    return flight


def main():
    """Main entry point."""
    print("=" * 60)
    print("Data Injection Script - GKD Airlines")
    print("=" * 60)

    # Create Flask app
    app = create_app("development")

    with app.app_context():
        # Initialize data injector
        injector = DataInjector()

        # Clear existing data
        print("\nClearing existing data...")
        injector.clear_all_data()
        print("  Database cleared")

        # Create default user (Peter Griffin)
        default_user = get_or_create_default_user(injector)

        # Create test users
        users = create_test_users(injector)
        users.insert(0, default_user)  # Add default user to the list

        # Create flights with seats
        flights = create_flights_with_seats(injector)

        # Create bookings
        bookings_count = create_bookings_for_users(injector, users, flights)

        # Create announcements
        create_announcements(injector)

        # Create FAQs
        create_faqs(injector)

        # Create baggage reports
        create_baggage_reports(injector, users, flights)

        # Create specific data (JFK to LAX flight for Peter Griffin)
        create_specific_data(injector)

        print("\n" + "=" * 60)
        print("Data injection completed successfully!")
        print("=" * 60)

        # Print summary
        print("\nSummary:")
        print(f"  Total Users: {User.query.count()}")
        print(f"  Total Flights: {Flight.query.count()}")
        print(f"  Total Seats: {Seat.query.count()}")
        print(f"  Total Bookings: {Booking.query.count()}")
        print(f"  Total Payments: {Payment.query.count()}")
        print(f"  Total Announcements: {Announcement.query.count()}")
        print(f"  Total FAQs: {FAQ.query.count()}")
        print(f"  Total Baggage Reports: {BaggageTracking.query.count()}")

        print("\nBooking Status Breakdown:")
        print(
            f"  Confirmed: {Booking.query.filter_by(booking_status='confirmed').count()}"
        )
        print(f"  Pending: {Booking.query.filter_by(booking_status='pending').count()}")
        print(
            f"  Cancelled: {Booking.query.filter_by(booking_status='cancelled').count()}"
        )
        print(f"  Checked In: {Booking.query.filter_by(checked_in=True).count()}")

        print("\nFlight Status Breakdown:")
        print(f"  Scheduled: {Flight.query.filter_by(status='scheduled').count()}")

        print(
            f"\nAll dates are relative to current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        print("=" * 60)


if __name__ == "__main__":
    main()
