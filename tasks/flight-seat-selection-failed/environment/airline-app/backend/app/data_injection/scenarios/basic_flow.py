"""Basic Flow Test Scenario"""

from datetime import datetime, timedelta


def create_basic_flow_scenario(injector):
    """
    Creates a basic booking flow scenario with:
    - 3 users (verified and unverified)
    - 5 flights on different routes
    - 10 bookings in various states
    - 2 delayed flights
    - 1 cancelled booking
    - 2 claims
    """

    # Create users
    user1 = injector.create_user(
        email="user1@test.com",
        password="password123",
        first_name="John",
        last_name="Doe",
        is_verified=True,
    )

    user2 = injector.create_user(
        email="user2@test.com",
        password="password123",
        first_name="Jane",
        last_name="Smith",
        is_verified=True,
    )

    user3 = injector.create_user(
        email="user3@test.com",
        password="password123",
        first_name="Bob",
        last_name="Johnson",
        is_verified=False,
    )

    # Create flights
    now = datetime.utcnow()

    flights = []

    # Flight 1: JFK to LAX
    flight1 = injector.create_flight_with_seats(
        {
            "flight_number": "AA101",
            "origin_code": "JFK",
            "origin_city": "New York",
            "origin_airport": "John F. Kennedy International Airport",
            "destination_code": "LAX",
            "destination_city": "Los Angeles",
            "destination_airport": "Los Angeles International Airport",
            "departure_time": now + timedelta(days=7, hours=8),
            "arrival_time": now + timedelta(days=7, hours=14),
            "base_price_economy": 299.99,
            "aircraft_type": "Boeing 777",
        }
    )
    flights.append(flight1)

    # Flight 2: LAX to SFO
    flight2 = injector.create_flight_with_seats(
        {
            "flight_number": "AA102",
            "origin_code": "LAX",
            "origin_city": "Los Angeles",
            "origin_airport": "Los Angeles International Airport",
            "destination_code": "SFO",
            "destination_city": "San Francisco",
            "destination_airport": "San Francisco International Airport",
            "departure_time": now + timedelta(days=5, hours=10),
            "arrival_time": now + timedelta(days=5, hours=11, minutes=30),
            "base_price_economy": 149.99,
            "aircraft_type": "Airbus A320",
        }
    )
    flights.append(flight2)

    # Flight 3: SFO to SEA
    flight3 = injector.create_flight_with_seats(
        {
            "flight_number": "AA103",
            "origin_code": "SFO",
            "origin_city": "San Francisco",
            "origin_airport": "San Francisco International Airport",
            "destination_code": "SEA",
            "destination_city": "Seattle",
            "destination_airport": "Seattle-Tacoma International Airport",
            "departure_time": now + timedelta(days=3, hours=14),
            "arrival_time": now + timedelta(days=3, hours=16),
            "base_price_economy": 199.99,
            "aircraft_type": "Boeing 737",
        }
    )
    flights.append(flight3)

    # Flight 4: DELAYED FLIGHT
    flight4 = injector.create_flight_with_seats(
        {
            "flight_number": "AA104",
            "origin_code": "JFK",
            "origin_city": "New York",
            "origin_airport": "John F. Kennedy International Airport",
            "destination_code": "MIA",
            "destination_city": "Miami",
            "destination_airport": "Miami International Airport",
            "departure_time": now + timedelta(hours=3),
            "arrival_time": now + timedelta(hours=6),
            "base_price_economy": 179.99,
            "aircraft_type": "Airbus A321",
        }
    )
    injector.set_flight_status(
        flight4.id, "delayed", delay_minutes=120, reason="Weather conditions"
    )
    flights.append(flight4)

    # Flight 5: CANCELLED FLIGHT
    flight5 = injector.create_flight_with_seats(
        {
            "flight_number": "AA105",
            "origin_code": "ORD",
            "origin_city": "Chicago",
            "origin_airport": "O'Hare International Airport",
            "destination_code": "DFW",
            "destination_city": "Dallas",
            "destination_airport": "Dallas/Fort Worth International Airport",
            "departure_time": now + timedelta(days=2),
            "arrival_time": now + timedelta(days=2, hours=3),
            "base_price_economy": 159.99,
            "aircraft_type": "Boeing 737",
        }
    )
    injector.set_flight_status(flight5.id, "cancelled", reason="Operational issues")
    flights.append(flight5)

    # Create bookings
    bookings = []

    # Booking 1: User1 on Flight1 - Confirmed
    booking1 = injector.create_booking(
        user_id=user1.id,
        flight_id=flight1.id,
        passengers_data=[
            {"first_name": "John", "last_name": "Doe", "date_of_birth": "1990-01-15"}
        ],
        cabin_class="economy",
        booking_status="confirmed",
    )
    injector.create_payment(booking1.id, booking1.total_price, status="completed")
    bookings.append(booking1)

    # Booking 2: User1 on Flight2 - Confirmed with 2 passengers
    booking2 = injector.create_booking(
        user_id=user1.id,
        flight_id=flight2.id,
        passengers_data=[
            {"first_name": "John", "last_name": "Doe", "date_of_birth": "1990-01-15"},
            {"first_name": "Jane", "last_name": "Doe", "date_of_birth": "1992-05-20"},
        ],
        cabin_class="business",
        booking_status="confirmed",
    )
    injector.create_payment(booking2.id, booking2.total_price, status="completed")
    bookings.append(booking2)

    # Booking 3: User2 on Flight3 - Pending
    booking3 = injector.create_booking(
        user_id=user2.id,
        flight_id=flight3.id,
        passengers_data=[
            {"first_name": "Jane", "last_name": "Smith", "date_of_birth": "1985-06-10"}
        ],
        cabin_class="economy",
        booking_status="pending",
    )
    bookings.append(booking3)

    # Booking 4: User2 on Flight4 (Delayed) - With claim
    booking4 = injector.create_booking(
        user_id=user2.id,
        flight_id=flight4.id,
        passengers_data=[
            {"first_name": "Jane", "last_name": "Smith", "date_of_birth": "1985-06-10"}
        ],
        cabin_class="economy",
        booking_status="confirmed",
    )
    injector.create_payment(booking4.id, booking4.total_price, status="completed")
    # Create claim for delay
    injector.create_claim(
        booking_id=booking4.id,
        claim_type="delay",
        claim_amount=50.00,
        claim_reason="Flight delayed by 2 hours",
        claim_status="pending",
    )
    bookings.append(booking4)

    # Booking 5: User3 on Flight5 (Cancelled) - Cancelled
    booking5 = injector.create_booking(
        user_id=user3.id,
        flight_id=flight5.id,
        passengers_data=[
            {"first_name": "Bob", "last_name": "Johnson", "date_of_birth": "1978-03-22"}
        ],
        cabin_class="economy",
        booking_status="cancelled",
    )
    injector.create_payment(booking5.id, booking5.total_price, status="completed")
    # Create claim for cancellation
    injector.create_claim(
        booking_id=booking5.id,
        claim_type="cancellation",
        claim_amount=booking5.total_price,
        claim_reason="Flight cancelled by airline",
        claim_status="pending",
    )
    bookings.append(booking5)

    return {"users": [user1, user2, user3], "flights": flights, "bookings": bookings}
