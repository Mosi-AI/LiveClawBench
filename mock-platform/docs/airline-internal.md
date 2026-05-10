# Airline Internal Documentation

This document covers implementation details of the `mock-airline` service that are not part of the public API surface. For API routes and request/response schemas, see the auto-generated OpenAPI spec at `dist/openapi/airline.json`.

---

## Data Types

Key domain types are defined in `src/schemas.ts` using Zod schemas:

### Flight

```typescript
interface Flight {
  id: number;
  flight_number: string;
  airline: string;
  origin_code: string;
  origin_city: string;
  origin_airport: string;
  destination_code: string;
  destination_city: string;
  destination_airport: string;
  departure_time: string;      // ISO 8601
  arrival_time: string;        // ISO 8601
  duration_minutes: number;
  base_price_economy: number;
  base_price_business: number;
  base_price_first: number;
  aircraft_type: string;
  status: "scheduled" | "delayed" | "cancelled" | "landed";
  gate: string;
  terminal: string;
  delay_minutes: number;
}
```

### Seat

```typescript
interface Seat {
  id: number;
  flight_id: number;
  seat_number: string;         // e.g. "12A"
  cabin_class: "economy" | "business" | "first";
  price: number;
  is_available: boolean;
  is_window: boolean;
  is_aisle: boolean;
  has_extra_legroom: boolean;
  row_number: number;
  seat_letter: string;
}
```

### Booking

```typescript
interface Booking {
  id: number;
  booking_reference: string;   // 6-char alphanumeric, unique
  user_id: number;
  flight_id: number;
  cabin_class: string;
  total_price: number;
  booking_status: "pending" | "confirmed" | "cancelled";
  checked_in: boolean;
  check_in_time: string | null;
  booked_at: string;
  updated_at: string;
}
```

### Passenger

```typescript
interface Passenger {
  id: number;
  booking_id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  meal_preference: string;
  special_assistance: string;
  seat_id: number | null;
}
```

### BaggageTracking

```typescript
interface BaggageTracking {
  id: number;
  user_id: number;
  booking_id: number | null;
  flight_number: string;
  flight_time: string;
  passenger_name: string;
  passenger_phone: string;
  passenger_email: string;
  baggage_description: string;
  seat_number: string;
  loss_details: string;
  status: string;
  created_at: string;
}
```

---

## Database Schema

SQLite with WAL mode, foreign keys enabled, but **no `ON DELETE CASCADE`**. Manual cleanup is required.

Key tables:

- **users** — auth fields (`is_verified`, `is_active`), Werkzeug PBKDF2 password hashes
- **flights** — flight info with pricing tiers (`base_price_economy`, `base_price_business`, `base_price_first`), `status`, `delay_minutes`
- **seats** — per-flight seat map with `cabin_class`, `is_available`, `is_window`, `is_aisle`, `has_extra_legroom`. FK to `flights(id)`
- **bookings** — `booking_reference` (unique), `booking_status`, `checked_in`. FKs to `users` and `flights`
- **passengers** — per-booking passenger info, FKs to `bookings` and `seats`
- **payments** — one per booking, `payment_status` (`pending`/`completed`/`failed`), `refund_amount`. FK to `bookings`
- **claims** — compensation claims linked to bookings
- **baggage_tracking** — lost baggage reports, FK to `users`
- **email_notifications**, **calendar_events**, **chat_sessions**, **chat_messages**, **flight_status_history**, **price_history**, **announcements**, **faqs**

---

## Seed Logic

### Default Mode (no task)

- 30 days of flights, 15 route configs, 4 time slots each = ~300 flights
- Flight numbers start at `GKD100`
- 1 default user: Peter Griffin (user ID 1)
- Seat maps generated procedurally for every flight

### Task Mode

Controlled by `TASK_NAME` env var (or `taskName` parameter to `seedDatabase()`):

- 60 days of flights, 30% random skip rate
- 6 users seeded (Peter Griffin + 5 others)
- Special flight number skip: `2000` is skipped to avoid collision with `GKD2001` tasks

| Task | Key Fixture |
|------|-------------|
| `flight-booking` | GKD1001–GKD1005 on next Monday, JFK → LAX |
| `flight-seat-selection` | GKD2001 tomorrow; Peter has confirmed booking, **no seat assigned**, not checked in |
| `flight-seat-selection-failed` | GKD2001 tomorrow; **all economy window seats pre-booked** by fake users |
| `flight-cancel-claim` | GKD2001 day after tomorrow; status = `cancelled` |
| `flight-info-change-notice` | GKD2001 day after tomorrow; initially `scheduled`, then delayed 4 hours |
| `baggage-tracking-application` | GKD888 (95 days ago, landed); baggage report with "Black 20-inch Samsonite suitcase with red ribbon handle" |

All task modes also call `createBookingScenarios()` which creates past/current/future/cancelled/pending bookings across users 2–6.

### Seat Generation (`src/db/seat-generation.ts`)

| Cabin | Rows | Config | Count |
|-------|------|--------|-------|
| Economy | 1–30 | 6 seats (A–F) | 180 |
| Business | 31–35 | 4 seats (A–D) | 20 |
| First | 36–37 | 4 seats (A–D) | 8 |
| **Total** | | | **208** |

- Window seats: A, F
- Aisle seats: C, D
- Extra legroom rows: 1, 12, 13 (+$50)
- Pricing fallback: business = 2× economy, first = 3× economy

Seed metadata is written to `/var/lib/mock-data/seed-meta.json` with `anchor_time`, `task_name`, and `seeded_at`.

---

## Business Rules

### Seat Claiming (`POST /api/bookings/:ref/seats`)

- Wrapped in a SQLite transaction
- Validates each passenger/seat pair
- Updates `seats.is_available = 0` and assigns `passengers.seat_id`
- **Atomic seat claim**: `UPDATE seats SET is_available = 0 WHERE id = ? AND is_available = 1`; if `changes === 0`, the seat was taken (TOCTOU-safe)
- If an economy window seat is unavailable and **no economy window seats remain**, returns upgrade prompt: "You can upgrade to business class for an additional $350"

### Check-in (`POST /api/checkin/:ref`)

- Requires completed payment
- Requires all passengers have seat assignments
- Window: opens 24h before departure, closes 1h after departure
- If unseated and no economy window seats available, returns same $350 upgrade prompt

### Booking Lifecycle

1. **Create** (`POST /api/bookings`) → status `pending`; auto-creates passengers; auto-processes payment (always succeeds); sends confirmation email; updates status to `confirmed`
2. **Claim seat** (`POST /api/bookings/:ref/seats`) → assigns seat IDs; marks seats unavailable
3. **Check in** (`POST /api/checkin/:ref`) → sets `checked_in = 1`, `check_in_time = now`
4. **Cancel** (`POST /api/bookings/:ref/cancel`) → frees seats (`is_available = 1`), nulls passenger `seat_id`, sets `booking_status = 'cancelled'`
5. **Claim/refund** (`POST /api/claims` + `/api/claims/calculate-refund`) → cancellation = full refund; delay = $25/hour up to ticket price

### Cancellation Flow

- Seats are freed immediately (`is_available = 1`)
- Passenger `seat_id` is nulled
- No automatic refund; user must file a claim via the claims API

---

## Task-Specific Behavior

| Task | Special Behavior |
|------|-----------------|
| `flight-seat-selection-failed` | All economy window seats are pre-booked by fake users so Peter cannot claim one |
| `flight-cancel-claim` | Flight GKD2001 has `status = 'cancelled'`; refund calculator returns full price |
| `flight-info-change-notice` | Flight GKD2001 delayed 240 minutes; `flight_status_history` entry created |
| `baggage-tracking-application` | Hardcoded baggage description on flight GKD888 (landed 95 days ago) |

---

## Verifier Integration Notes

### Werkzeug Password Hash Compatibility

Auth system uses Python Werkzeug-compatible `pbkdf2:sha256` password hashes. `verifyWerkzeugHash()` and `generateWerkzeugHashSync()` are in `src/helpers.ts`.

### FK Chain Cleanup (No CASCADE)

The SQLite schema does **not** use `ON DELETE CASCADE`. Task-specific seeding manually deletes dependent rows in order:

1. passengers, payments, baggage_tracking, claims, email_notifications, calendar_events
2. bookings
3. seats, price_history, flight_status_history
4. flights

This mirrors how a Python verifier must clean up when modifying the same SQLite file.

### Default User

`DEFAULT_USER_ID = 1` (Peter Griffin) is hardcoded. Most routes assume the current user is ID 1.
