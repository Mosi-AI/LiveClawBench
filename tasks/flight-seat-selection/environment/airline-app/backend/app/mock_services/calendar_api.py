import uuid
from datetime import datetime, timedelta

from app.models import db
from app.models.mock_services import CalendarEvent


class MockCalendarAPI:
    """Mock calendar API simulating Google Calendar"""

    def __init__(self):
        """Initialize mock calendar API"""
        pass

    def create_event(self, booking):
        """
        Create calendar event for a booking

        Args:
            booking (Booking): Booking object

        Returns:
            CalendarEvent: Created event record
        """
        user = booking.user
        flight = booking.flight

        # Generate event ID
        event_id = str(uuid.uuid4())

        # Event details
        title = f"Flight {flight.flight_number}: {flight.origin_code} → {flight.destination_code}"
        description = f"""
Flight Booking Reference: {booking.booking_reference}
Flight: {flight.flight_number}
Route: {flight.origin_city} ({flight.origin_code}) → {flight.destination_city} ({flight.destination_code})
Departure: {flight.departure_time.strftime("%Y-%m-%d %H:%M")}
Arrival: {flight.arrival_time.strftime("%Y-%m-%d %H:%M")}
Aircraft: {flight.aircraft_type}
Cabin Class: {booking.cabin_class.title()}
Passengers: {booking.passengers.count()}
Gate: {flight.gate or "TBD"}
Terminal: {flight.terminal or "TBD"}

Check-in opens 24 hours before departure.
Arrive at the airport at least 2 hours before departure.
        """.strip()

        location = f"{flight.origin_airport} ({flight.origin_code})"

        # Set reminder for 24 hours before departure (check-in time)
        reminder_minutes = 24 * 60  # 24 hours

        # Create calendar event
        event = CalendarEvent(
            booking_id=booking.id,
            user_id=user.id,
            event_id=event_id,
            title=title,
            description=description,
            start_time=flight.departure_time,
            end_time=flight.arrival_time,
            location=location,
            reminder_minutes=reminder_minutes,
        )

        db.session.add(event)
        db.session.commit()

        return event

    def update_event(self, booking, updates):
        """
        Update calendar event

        Args:
            booking (Booking): Booking object
            updates (dict): Fields to update

        Returns:
            CalendarEvent: Updated event
        """
        event = CalendarEvent.query.filter_by(booking_id=booking.id).first()

        if not event:
            return None

        # Update allowed fields
        if "title" in updates:
            event.title = updates["title"]
        if "description" in updates:
            event.description = updates["description"]
        if "start_time" in updates:
            event.start_time = updates["start_time"]
        if "end_time" in updates:
            event.end_time = updates["end_time"]
        if "location" in updates:
            event.location = updates["location"]
        if "reminder_minutes" in updates:
            event.reminder_minutes = updates["reminder_minutes"]

        event.updated_at = datetime.now()
        db.session.commit()

        return event

    def delete_event(self, booking_id):
        """
        Delete calendar event

        Args:
            booking_id (int): Booking ID

        Returns:
            bool: Success status
        """
        event = CalendarEvent.query.filter_by(booking_id=booking_id).first()

        if event:
            db.session.delete(event)
            db.session.commit()
            return True

        return False

    def get_event(self, booking_id):
        """
        Get calendar event for a booking

        Args:
            booking_id (int): Booking ID

        Returns:
            CalendarEvent: Event record or None
        """
        return CalendarEvent.query.filter_by(booking_id=booking_id).first()

    def get_upcoming_events(self, user_id, days=30):
        """
        Get upcoming calendar events for a user

        Args:
            user_id (int): User ID
            days (int): Number of days to look ahead

        Returns:
            list: List of CalendarEvent objects
        """
        start_time = datetime.now()
        end_time = start_time + timedelta(days=days)

        events = (
            CalendarEvent.query.filter(
                CalendarEvent.user_id == user_id,
                CalendarEvent.start_time >= start_time,
                CalendarEvent.start_time <= end_time,
            )
            .order_by(CalendarEvent.start_time)
            .all()
        )

        return events

    def sync_booking_to_calendar(self, booking):
        """
        Sync a booking to calendar (create or update)

        Args:
            booking (Booking): Booking object

        Returns:
            CalendarEvent: Event record
        """
        existing_event = self.get_event(booking.id)

        if existing_event:
            # Update existing event
            flight = booking.flight
            return self.update_event(
                booking,
                {"start_time": flight.departure_time, "end_time": flight.arrival_time},
            )
        else:
            # Create new event
            return self.create_event(booking)
