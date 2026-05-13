# Airline Website - Full-Stack Implementation

A comprehensive full-stack airline website with front-end and back-end database support, including all core airline functionalities plus integrated mock services to simulate real-world operations without external dependencies.

## Features

### Core Features
- **User Authentication**: Registration, login, JWT-based authentication
- **Flight Search**: Search flights by route, date, passengers, and cabin class
- **Booking System**: Multi-passenger booking with seat selection
- **Payment Processing**: Mock payment gateway with Visa card simulation
- **Check-in & Boarding Passes**: Online check-in and boarding pass generation
- **Claims & Refunds**: Submit and track claims for delays/cancellations

### Mock Services
- **Mock Email Client**: View confirmation emails, delay notifications, boarding passes
- **Mock Calendar API**: Google Calendar simulation with automatic flight event creation
- **Mock Payment Gateway**: Visa payment simulation with 90% success rate
- **Mock Chat Bot**: Conversational customer support with predefined responses

### Data Injection API
Standardized Python API for injecting test data into the database, enabling automated testing programs to create test cases efficiently.

## Tech Stack

- **Frontend**: React 18 with Vite, React Router, Axios, date-fns
- **Backend**: Python Flask, SQLAlchemy, Flask-Bcrypt, PyJWT
- **Database**: SQLite
- **Authentication**: JWT tokens (1-hour access, 7-day refresh)

## Project Structure

```
airline/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page-level components
│   │   ├── services/           # API service layer
│   │   └── context/            # React Context (Auth)
│   └── package.json
│
├── backend/                     # Flask backend
│   ├── app/
│   │   ├── models/             # SQLAlchemy models
│   │   ├── routes/             # API blueprints
│   │   ├── services/           # Business logic
│   │   ├── mock_services/      # Mock implementations
│   │   └── data_injection/     # Test data injection API
│   ├── instance/
│   │   └── airline.db          # SQLite database
│   └── requirements.txt
│
└── scripts/                    # Utility scripts
    ├── init_db.py              # Initialize database
    └── seed_data.py            # Seed sample data
```

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Initialize database:
```bash
cd ..
python scripts/init_db.py
```

5. Seed sample data (optional):
```bash
python scripts/seed_data.py
```

6. Run backend server:
```bash
cd backend
python run.py
```

Backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

4. Open browser and navigate to `http://localhost:5173`

## Test User Accounts

After running the seed script, you can login with:
- **Email**: `john@example.com` or `jane@example.com`
- **Password**: `password123`

## Using the Data Injection API

The data injection interface allows automated testing programs to create test data programmatically:

```python
from app.data_injection import DataInjector

# Initialize injector
injector = DataInjector()

# Create test user
user = injector.create_user(
    email="test@example.com",
    password="password123",
    first_name="Test",
    last_name="User"
)

# Create flight with seats
flight = injector.create_flight_with_seats({
    'flight_number': 'TEST001',
    'origin_code': 'JFK',
    'destination_code': 'LAX',
    'departure_time': '2026-03-10 08:00:00',
    'arrival_time': '2026-03-10 11:00:00',
    'base_price_economy': 299.99
})

# Create booking with payment
booking = injector.create_booking_with_payment(
    booking_data={
        'user_email': 'test@example.com',
        'flight_number': 'TEST001',
        'passengers': [
            {'first_name': 'Jane', 'last_name': 'Doe', 'date_of_birth': '1990-01-15'}
        ]
    },
    payment_data={'amount': 299.99, 'status': 'completed'}
)

# Clean up
injector.clear_all_data()
```

## Testing Scenarios

### Manual Testing Flow

1. Register a new user account
2. Search for flights (e.g., JFK to LAX)
3. Select a flight and complete booking
4. Process mock payment (use test card: 4111111111111111)
5. View confirmation email in Mock Inbox
6. Check-in for the flight
7. Download boarding pass
8. View flight in Mock Calendar
9. Test customer support chat
10. Submit a claim (for delayed/cancelled flights)

### Testing Payment Gateway

Use these test card numbers:
- **Visa**: 4111111111111111 (90% success rate)
- **Any valid future expiry date**: MM/YY format
- **Any 3-digit CVV**: 123

The payment gateway simulates:
- Card validation
- Transaction processing
- 90% success rate for approved payments
- Realistic failure reasons (insufficient funds, declined, etc.)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

### Flights
- `GET /api/flights` - Get all flights
- `POST /api/flights/search` - Search flights
- `GET /api/flights/:id` - Get flight by ID
- `GET /api/flights/:id/seats` - Get flight seats

### Bookings
- `GET /api/bookings` - Get user bookings
- `GET /api/bookings/:reference` - Get booking by reference
- `POST /api/bookings` - Create booking
- `POST /api/bookings/:reference/seats` - Assign seats
- `POST /api/bookings/:reference/cancel` - Cancel booking

### Check-in
- `POST /api/checkin/:reference` - Check-in
- `GET /api/checkin/:reference/boarding-pass` - Get boarding pass
- `GET /api/checkin/eligible` - Get eligible check-ins

### Claims
- `GET /api/claims` - Get user claims
- `POST /api/claims` - Create claim
- `POST /api/claims/calculate-refund/:reference` - Calculate refund

### Mock Services
- `GET /api/emails` - Get mock emails
- `GET /api/calendar/events` - Get calendar events
- `POST /api/payment/process` - Process payment
- `POST /api/chat/sessions` - Create chat session
- `POST /api/chat/sessions/:id/messages` - Send message

## Database Schema

### Core Tables

#### users
User accounts and profiles
- `id` (Integer, Primary Key)
- `email` (String(120), Unique, Required)
- `password_hash` (String(255), Required)
- `first_name` (String(50))
- `last_name` (String(50))
- `phone` (String(20))
- `date_of_birth` (Date)
- `passport_number` (String(20))
- `passport_expiry` (Date)
- `is_verified` (Boolean, default: False)
- `is_active` (Boolean, default: True)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### flights
Flight details and status
- `id` (Integer, Primary Key)
- `flight_number` (String(10), Required, Indexed)
- `airline` (String(50), Required, default: 'GKD Airlines')
- `origin_code` (String(3), Required, Indexed)
- `origin_city` (String(100), Required)
- `origin_airport` (String(200), Required)
- `destination_code` (String(3), Required, Indexed)
- `destination_city` (String(100), Required)
- `destination_airport` (String(200), Required)
- `departure_time` (DateTime, Required, Indexed)
- `arrival_time` (DateTime, Required)
- `duration_minutes` (Integer, Required)
- `aircraft_type` (String(50), default: 'Boeing 737')
- `base_price_economy` (Float, Required)
- `base_price_business` (Float)
- `base_price_first` (Float)
- `status` (String(20), default: 'scheduled', Indexed)
- `delay_minutes` (Integer, default: 0)
- `delay_reason` (Text)
- `gate` (String(10))
- `terminal` (String(10))
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### seats
Individual seat records
- `id` (Integer, Primary Key)
- `flight_id` (Integer, Foreign Key → flights.id, Required, Indexed)
- `seat_number` (String(5), Required)
- `cabin_class` (String(20), Required) - economy, business, first
- `price` (Float, Required)
- `is_available` (Boolean, default: True, Indexed)
- `is_window` (Boolean, default: False)
- `is_aisle` (Boolean, default: False)
- `has_extra_legroom` (Boolean, default: False)
- `row_number` (Integer, Required)
- `seat_letter` (String(1), Required)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### bookings
Booking records
- `id` (Integer, Primary Key)
- `booking_reference` (String(10), Unique, Required)
- `user_id` (Integer, Foreign Key → users.id, Required, Indexed)
- `flight_id` (Integer, Foreign Key → flights.id, Required)
- `cabin_class` (String(20), Required)
- `total_price` (Float, Required)
- `booking_status` (String(20), default: 'pending') - pending, confirmed, cancelled, checked_in
- `checked_in` (Boolean, default: False)
- `check_in_time` (DateTime)
- `booked_at` (DateTime, default: current time)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### passengers
Passenger details
- `id` (Integer, Primary Key)
- `booking_id` (Integer, Foreign Key → bookings.id, Required)
- `seat_id` (Integer, Foreign Key → seats.id)
- `first_name` (String(50), Required)
- `last_name` (String(50), Required)
- `date_of_birth` (Date, Required)
- `passport_number` (String(20))
- `passport_expiry` (Date)
- `nationality` (String(50))
- `meal_preference` (String(20))
- `special_assistance` (Text)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### payments
Payment transactions
- `id` (Integer, Primary Key)
- `booking_id` (Integer, Foreign Key → bookings.id, Required)
- `amount` (Float, Required)
- `currency` (String(3), default: 'USD')
- `payment_method` (String(20), default: 'credit_card')
- `payment_status` (String(20), Required) - pending, completed, failed, refunded
- `card_last_four` (String(4))
- `card_type` (String(20))
- `card_holder_name` (String(100))
- `transaction_id` (String(100))
- `payment_gateway_response` (Text)
- `refund_amount` (Float)
- `refund_reason` (Text)
- `refunded_at` (DateTime)
- `paid_at` (DateTime)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### claims
Customer claims
- `id` (Integer, Primary Key)
- `booking_id` (Integer, Foreign Key → bookings.id, Required)
- `claim_type` (String(20), Required) - delay, cancellation, refund, other
- `claim_amount` (Float, Required)
- `claim_reason` (Text, Required)
- `claim_status` (String(20), default: 'pending') - pending, approved, rejected
- `resolution_notes` (Text)
- `resolved_amount` (Float)
- `resolved_at` (DateTime)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### announcements
Announcements and news
- `id` (Integer, Primary Key)
- `title` (String(200), Required)
- `content` (Text, Required)
- `category` (String(50), Required) - general, flight, promotion, emergency
- `priority` (String(20), default: 'normal') - low, normal, high, urgent
- `is_active` (Boolean, default: True, Indexed)
- `published_at` (DateTime, default: current time)
- `expires_at` (DateTime)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### faqs
Frequently asked questions
- `id` (Integer, Primary Key)
- `question` (String(500), Required)
- `answer` (Text, Required)
- `category` (String(50), Required) - booking, check-in, baggage, payment, general
- `is_active` (Boolean, default: True, Indexed)
- `display_order` (Integer, default: 0)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### baggage_tracking
Lost baggage reports
- `id` (Integer, Primary Key)
- `user_id` (Integer, Foreign Key → users.id, Required, Indexed)
- `booking_id` (Integer, Foreign Key → bookings.id)
- `flight_number` (String(10), Required)
- `flight_time` (DateTime, Required)
- `seat_number` (String(5))
- `passenger_name` (String(100), Required)
- `passenger_phone` (String(20), Required)
- `passenger_email` (String(120), Required)
- `baggage_description` (Text, Required)
- `loss_details` (Text)
- `status` (String(20), default: 'processing', Indexed) - processing, resolved
- `location` (String(200))
- `created_at` (DateTime)
- `updated_at` (DateTime)

### Mock Service Tables

#### flight_status_history
Flight status change tracking
- `id` (Integer, Primary Key)
- `flight_id` (Integer, Foreign Key → flights.id, Required, Indexed)
- `old_status` (String(20))
- `new_status` (String(20), Required)
- `delay_minutes` (Integer)
- `reason` (Text)
- `changed_at` (DateTime)

#### email_notifications
Mock email storage
- `id` (Integer, Primary Key)
- `user_id` (Integer, Foreign Key → users.id, Required, Indexed)
- `booking_id` (Integer, Foreign Key → bookings.id)
- `email_type` (String(50), Required)
- `recipient_email` (String(120), Required)
- `subject` (String(200), Required)
- `body` (Text, Required)
- `is_read` (Boolean, default: False)
- `sent_at` (DateTime, default: current time)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### calendar_events
Mock calendar events
- `id` (Integer, Primary Key)
- `event_id` (String(100), Unique, Required)
- `user_id` (Integer, Foreign Key → users.id, Required, Indexed)
- `booking_id` (Integer, Foreign Key → bookings.id)
- `title` (String(200), Required)
- `description` (Text)
- `start_time` (DateTime, Required)
- `end_time` (DateTime, Required)
- `location` (String(200))
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### chat_sessions
Support chat sessions
- `id` (Integer, Primary Key)
- `session_id` (String(100), Unique, Required)
- `user_id` (Integer, Foreign Key → users.id, Required, Indexed)
- `status` (String(20), default: 'active') - active, closed
- `started_at` (DateTime, default: current time)
- `closed_at` (DateTime)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### chat_messages
Chat message records
- `id` (Integer, Primary Key)
- `session_id` (Integer, Foreign Key → chat_sessions.id, Required)
- `message` (Text, Required)
- `sender_type` (String(20), Required) - user, bot
- `sender_name` (String(100))
- `sent_at` (DateTime, default: current time)
- `created_at` (DateTime)
- `updated_at` (DateTime)

#### price_history
Dynamic pricing tracking
- `id` (Integer, Primary Key)
- `flight_id` (Integer, Foreign Key → flights.id, Required, Indexed)
- `cabin_class` (String(20), Required)
- `price` (Float, Required)
- `recorded_at` (DateTime, default: current time)
- `created_at` (DateTime)
- `updated_at` (DateTime)

## Development

### Running Tests

Backend tests (when implemented):
```bash
cd backend
pytest tests/ -v
```

### Database Inspection

```bash
sqlite3 backend/instance/airline.db
sqlite> .tables
sqlite> SELECT * FROM flights LIMIT 5;
sqlite> .quit
```

### Environment Variables

Create a `.env` file in the backend directory:
```
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
```

## Features for Testing

1. **Mock Email Client**: All emails are stored in the database and can be viewed through the UI
2. **Mock Calendar**: Flight events are automatically created when bookings are confirmed
3. **Mock Payment**: Test payment processing without real transactions
4. **Mock Chat Bot**: Predefined responses for common customer queries
5. **Data Injection API**: Programmatically create test data for automated testing

## Architecture Highlights

- **JWT Authentication**: Secure token-based auth with refresh tokens
- **RESTful API**: Consistent JSON responses with proper HTTP status codes
- **Transaction Management**: Database transactions for data integrity
- **Seat Locking**: Prevents double-booking of seats
- **Dynamic Pricing**: Track price changes over time
- **Automated Notifications**: Email generation for key events
- **Session Management**: Track user sessions and chat history

## License

This project is for educational and testing purposes.

## Support

For issues or questions, please refer to the inline documentation in the code or check the database schema in the models.
