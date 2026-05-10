import type { Database } from "bun:sqlite";
import { generateBookingReference, generateWerkzeugHashSync } from "../helpers";
import { fmt, AIRPORTS, FLIGHT_CONFIGS, calculateNextMonday } from "./data";
import { generateSeats } from "../db/seat-generation";

export function createTaskSpecificData(db: Database, taskName: string, userIds: number[], now: Date): void {
  const peterId = userIds[0];

  switch (taskName) {
    case "flight-booking":
      createFlightBookingData(db, peterId, now);
      break;
    case "flight-seat-selection":
      createFlightSeatSelectionData(db, peterId, now);
      break;
    case "flight-seat-selection-failed":
      createFlightSeatSelectionFailedData(db, peterId, now);
      break;
    case "flight-cancel-claim":
      createFlightCancelClaimData(db, peterId, now);
      break;
    case "flight-info-change-notice":
      createFlightInfoChangeNoticeData(db, peterId, now);
      break;
    case "baggage-tracking-application":
      createBaggageTrackingData(db, peterId, now);
      break;
  }

  // Create common booking scenarios
  createBookingScenarios(db, userIds, now);
}

function createFlightBookingData(db: Database, peterId: number, now: Date): void {
  // Next Monday JFK-LAX flights GKD1001-1005
  const nextMonday = calculateNextMonday(now);
  const nextMondayStr = nextMonday.toISOString().split("T")[0];

  // Remove existing seats and flights for JFK-LAX on next Monday (seats first for FK constraint)
  db.query(
    "DELETE FROM seats WHERE flight_id IN (SELECT id FROM flights WHERE origin_code = 'JFK' AND destination_code = 'LAX' AND departure_time LIKE ?)"
  ).run(`${nextMondayStr}%`);
  db.query(
    "DELETE FROM flights WHERE origin_code = 'JFK' AND destination_code = 'LAX' AND departure_time LIKE ?"
  ).run(`${nextMondayStr}%`);

  const insertFlight = db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status, gate, terminal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertSeat = db.query(
    `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
      is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const departureHours = [4, 6, 10, 21, 23];
  const gates = ["A2", "B4", "C6", "D8", "E10"];

  for (let i = 0; i < 5; i++) {
    const departureTime = new Date(nextMonday);
    departureTime.setHours(departureHours[i], 0, 0, 0);
    const arrivalTime = new Date(departureTime.getTime() + 5.5 * 3600000);
    const price = 349.99 + i * 50;

    const flightId = Number(insertFlight.run(
      `GKD${1001 + i}`,
      "GKD Airlines",
      "JFK",
      AIRPORTS.JFK.city,
      AIRPORTS.JFK.airport,
      "LAX",
      AIRPORTS.LAX.city,
      AIRPORTS.LAX.airport,
      fmt(departureTime),
      fmt(arrivalTime),
      330,
      price,
      price * 2,
      price * 3,
      i % 2 === 0 ? "Boeing 737" : "Airbus A320",
      "scheduled",
      gates[i],
      "4",
    ).lastInsertRowid);

    const seats = generateSeats(price, price * 2, price * 3);
    for (const seat of seats) {
      insertSeat.run(
        flightId,
        seat.seatNumber,
        seat.cabinClass,
        seat.price,
        seat.isAvailable ? 1 : 0,
        seat.isWindow ? 1 : 0,
        seat.isAisle ? 1 : 0,
        seat.hasExtraLegroom ? 1 : 0,
        seat.rowNumber,
        seat.seatLetter,
      );
    }
  }

  console.log("airline: created GKD1001-GKD1005 next Monday flights");
}

function createFlightSeatSelectionData(db: Database, peterId: number, now: Date): void {
  // GKD2001: tomorrow, scheduled (matches Python inject_data.py)
  const departureTime = new Date(now.getTime() + 1 * 86400000);
  const arrivalTime = new Date(departureTime.getTime() + 5.5 * 3600000);

  const flightId = Number(db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status, gate, terminal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "GKD2001",
    "GKD Airlines",
    "JFK",
    AIRPORTS.JFK.city,
    AIRPORTS.JFK.airport,
    "LAX",
    AIRPORTS.LAX.city,
    AIRPORTS.LAX.airport,
    fmt(departureTime),
    fmt(arrivalTime),
    330,
    349.99,
    699.99,
    1049.99,
    "Boeing 787",
    "scheduled",
    "B22",
    "4",
  ).lastInsertRowid);

  // Create seats for GKD2001
  const seats = generateSeats(349.99, 699.99, 1049.99);
  for (const seat of seats) {
    db.query(
      `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
        is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flightId,
      seat.seatNumber,
      seat.cabinClass,
      seat.price,
      seat.isAvailable ? 1 : 0,
      seat.isWindow ? 1 : 0,
      seat.isAisle ? 1 : 0,
      seat.hasExtraLegroom ? 1 : 0,
      seat.rowNumber,
      seat.seatLetter,
    );
  }

  // Create Peter's booking (confirmed, NOT checked in, NO seat selected)
  const ref = generateBookingReference();
  const bookingId = Number(db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99).lastInsertRowid);

  // Create passenger (no seat assigned)
  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, nationality) VALUES (?, 'Peter', 'Griffin', '1975-04-12', 'US')"
  ).run(bookingId);

  // Create payment
  db.query(
    "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4532', 'visa', 'Peter Griffin', ?, datetime('now'))"
  ).run(bookingId, 349.99, `TXN-${Date.now()}`);

  console.log("airline: created GKD2001 with Peter's un-checked-in booking (no seat)");
}

function createFlightSeatSelectionFailedData(db: Database, peterId: number, now: Date): void {
  // GKD2001: tomorrow, scheduled
  const departureTime = new Date(now.getTime() + 1 * 86400000);
  const arrivalTime = new Date(departureTime.getTime() + 5 * 3600000);

  const flightId = Number(db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status, gate, terminal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "GKD2001",
    "GKD Airlines",
    "JFK",
    AIRPORTS.JFK.city,
    AIRPORTS.JFK.airport,
    "LAX",
    AIRPORTS.LAX.city,
    AIRPORTS.LAX.airport,
    fmt(departureTime),
    fmt(arrivalTime),
    300,
    349.99,
    699.99,
    1049.99,
    "Boeing 737",
    "scheduled",
    "B22",
    "4",
  ).lastInsertRowid);

  // Create seats for GKD2001
  const seats = generateSeats(349.99, 699.99, 1049.99);
  for (const seat of seats) {
    db.query(
      `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
        is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flightId,
      seat.seatNumber,
      seat.cabinClass,
      seat.price,
      seat.isAvailable ? 1 : 0,
      seat.isWindow ? 1 : 0,
      seat.isAisle ? 1 : 0,
      seat.hasExtraLegroom ? 1 : 0,
      seat.rowNumber,
      seat.seatLetter,
    );
  }

  // Create Peter's booking (no seat selected)
  const ref = generateBookingReference();
  const bookingId = Number(db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99).lastInsertRowid);

  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth) VALUES (?, 'Peter', 'Griffin', '1975-04-12')"
  ).run(bookingId);

  // Create payment
  db.query(
    "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4532', 'visa', 'Peter Griffin', ?, datetime('now'))"
  ).run(bookingId, 349.99, `TXN-${Date.now()}`);

  // Pre-book all economy window seats by test users
  const windowSeats = db.query(
    "SELECT id FROM seats WHERE flight_id = ? AND cabin_class = 'economy' AND is_window = 1 AND is_available = 1"
  ).all(flightId) as { id: number }[];

  // All filler accounts share the same password; hash once outside the loop.
  const fillerPasswordHash = generateWerkzeugHashSync("password123");

  for (let i = 0; i < windowSeats.length; i++) {
    const userEmail = `windowseat.user${i + 1}@test.com`;
    const userId = Number(db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, is_verified, is_active) VALUES (?, ?, ?, ?, 1, 1)"
    ).run(userEmail, fillerPasswordHash, `Window${i + 1}`, `Passenger${i + 1}`).lastInsertRowid);

    const bookingRef = generateBookingReference();
    const bsBookingId = Number(db.query(
      "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 1)"
    ).run(bookingRef, userId, flightId, "economy", 349.99).lastInsertRowid);

    db.query(
      "INSERT INTO passengers (booking_id, seat_id, first_name, last_name, date_of_birth) VALUES (?, ?, ?, ?, '1990-01-01')"
    ).run(bsBookingId, windowSeats[i].id, `Window${i + 1}`, `Passenger${i + 1}`);

    db.query("UPDATE seats SET is_available = 0 WHERE id = ?").run(windowSeats[i].id);

    db.query(
      "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4532', 'visa', ?, ?, datetime('now'))"
    ).run(bsBookingId, 349.99, `Window${i + 1} Passenger${i + 1}`, `TXN-${Date.now()}-${i}`);
  }

  console.log(`airline: created GKD2001 with ${windowSeats.length} economy window seats pre-booked`);
}

function createFlightCancelClaimData(db: Database, peterId: number, now: Date): void {
  // GKD2001: day after tomorrow at 10:00 AM, cancelled
  const departureDate = new Date(now.getTime() + 2 * 86400000);
  departureDate.setHours(10, 0, 0, 0);
  const arrivalTime = new Date(departureDate.getTime() + 5.5 * 3600000);

  // Remove all data for conflicting flights in correct FK order:
  // passengers/payments/claims/baggage_tracking/chat → bookings → seats → price_history/flight_status_history → flights
  const conflictingFilters = [
    "flight_number = 'GKD2001'",
    `origin_code = 'JFK' AND destination_code = 'LAX' AND departure_time LIKE '${departureDate.toISOString().split("T")[0]}%'`,
  ];
  for (const filter of conflictingFilters) {
    const conflictingFlightIds = db.query(`SELECT id FROM flights WHERE ${filter}`).all().map(r => (r as Record<string, number>).id);
    if (conflictingFlightIds.length === 0) continue;

    const conflictingBookingIds = db.query(
      `SELECT id FROM bookings WHERE flight_id IN (${conflictingFlightIds.join(",")})`
    ).all().map(r => (r as Record<string, number>).id);

    if (conflictingBookingIds.length > 0) {
      const bookingList = conflictingBookingIds.join(",");
      db.query(`DELETE FROM passengers WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM payments WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM baggage_tracking WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM claims WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM email_notifications WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM calendar_events WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM bookings WHERE id IN (${bookingList})`).run();
    }

    const flightList = conflictingFlightIds.join(",");
    db.query(`DELETE FROM seats WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM price_history WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM flight_status_history WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM flights WHERE id IN (${flightList})`).run();
  }

  const flightId = Number(db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status, gate, terminal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "GKD2001",
    "GKD Airlines",
    "JFK",
    AIRPORTS.JFK.city,
    AIRPORTS.JFK.airport,
    "LAX",
    AIRPORTS.LAX.city,
    AIRPORTS.LAX.airport,
    fmt(departureDate),
    fmt(arrivalTime),
    330,
    349.99,
    699.99,
    1049.99,
    "Boeing 737",
    "cancelled",
    "B22",
    "4",
  ).lastInsertRowid);

  // Create seats
  const seats = generateSeats(349.99, 699.99, 1049.99);
  for (const seat of seats) {
    db.query(
      `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
        is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flightId,
      seat.seatNumber,
      seat.cabinClass,
      seat.price,
      seat.isAvailable ? 1 : 0,
      seat.isWindow ? 1 : 0,
      seat.isAisle ? 1 : 0,
      seat.hasExtraLegroom ? 1 : 0,
      seat.rowNumber,
      seat.seatLetter,
    );
  }

  // Create Peter's booking
  const ref = generateBookingReference();
  const bookingId = Number(db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99).lastInsertRowid);

  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth) VALUES (?, 'Peter', 'Griffin', '1975-04-12')"
  ).run(bookingId);

  // Create payment
  db.query(
    "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4532', 'visa', 'Peter Griffin', ?, datetime('now'))"
  ).run(bookingId, 349.99, `TXN-${Date.now()}`);

  console.log("airline: created cancelled GKD2001 for flight-cancel-claim");
}

function createFlightInfoChangeNoticeData(db: Database, peterId: number, now: Date): void {
  // GKD2001: day after tomorrow at 10:00 AM, initially scheduled, then delayed 4 hours
  const departureDate = new Date(now.getTime() + 2 * 86400000);
  departureDate.setHours(10, 0, 0, 0);
  const arrivalTime = new Date(departureDate.getTime() + 5.5 * 3600000);

  // Remove conflicting flights in correct FK order
  const conflictingFilters = [
    "flight_number = 'GKD2001'",
    `origin_code = 'JFK' AND destination_code = 'LAX' AND departure_time LIKE '${departureDate.toISOString().split("T")[0]}%'`,
  ];
  for (const filter of conflictingFilters) {
    const conflictingFlightIds = db.query(`SELECT id FROM flights WHERE ${filter}`).all().map(r => (r as Record<string, number>).id);
    if (conflictingFlightIds.length === 0) continue;

    const conflictingBookingIds = db.query(
      `SELECT id FROM bookings WHERE flight_id IN (${conflictingFlightIds.join(",")})`
    ).all().map(r => (r as Record<string, number>).id);

    if (conflictingBookingIds.length > 0) {
      const bookingList = conflictingBookingIds.join(",");
      db.query(`DELETE FROM passengers WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM payments WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM baggage_tracking WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM claims WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM email_notifications WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM calendar_events WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM bookings WHERE id IN (${bookingList})`).run();
    }

    const flightList = conflictingFlightIds.join(",");
    db.query(`DELETE FROM seats WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM price_history WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM flight_status_history WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM flights WHERE id IN (${flightList})`).run();
  }

  const flightId = Number(db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status, gate, terminal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "GKD2001",
    "GKD Airlines",
    "JFK",
    AIRPORTS.JFK.city,
    AIRPORTS.JFK.airport,
    "LAX",
    AIRPORTS.LAX.city,
    AIRPORTS.LAX.airport,
    fmt(departureDate),
    fmt(arrivalTime),
    330,
    349.99,
    699.99,
    1049.99,
    "Boeing 787",
    "scheduled",
    "B22",
    "4",
  ).lastInsertRowid);

  // Create seats
  const seats = generateSeats(349.99, 699.99, 1049.99);
  for (const seat of seats) {
    db.query(
      `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
        is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flightId,
      seat.seatNumber,
      seat.cabinClass,
      seat.price,
      seat.isAvailable ? 1 : 0,
      seat.isWindow ? 1 : 0,
      seat.isAisle ? 1 : 0,
      seat.hasExtraLegroom ? 1 : 0,
      seat.rowNumber,
      seat.seatLetter,
    );
  }

  // Create Peter's booking
  const ref = generateBookingReference();
  const bookingId = Number(db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99).lastInsertRowid);

  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, nationality) VALUES (?, 'Peter', 'Griffin', '1975-04-12', 'US')"
  ).run(bookingId);

  // Create payment
  db.query(
    "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4532', 'visa', 'Peter Griffin', ?, datetime('now'))"
  ).run(bookingId, 349.99, `TXN-${Date.now()}`);

  // Delay the flight by 4 hours
  const delayedDeparture = new Date(departureDate.getTime() + 4 * 3600000);
  const delayedArrival = new Date(arrivalTime.getTime() + 4 * 3600000);

  db.query(
    "UPDATE flights SET status = ?, departure_time = ?, arrival_time = ?, delay_minutes = ?, delay_reason = ?, updated_at = datetime('now') WHERE id = ?"
  ).run("delayed", fmt(delayedDeparture), fmt(delayedArrival), 240, "Weather conditions", flightId);

  // Add flight status history entry
  db.query(
    "INSERT INTO flight_status_history (flight_id, old_status, new_status, delay_minutes, reason, changed_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).run(flightId, "scheduled", "delayed", 240, "Weather conditions");

  console.log("airline: created delayed GKD2001 for flight-info-change-notice");
}

function createBaggageTrackingData(db: Database, peterId: number, now: Date): void {
  // Create GKD888 as past flight (95 days ago, landed) for baggage report
  const pastFlightTime = new Date(now.getTime() - 95 * 86400000);
  const pastArrivalTime = new Date(pastFlightTime.getTime() + 5.5 * 3600000);

  const pastFlightId = Number(db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status, gate, terminal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "GKD888",
    "GKD Airlines",
    "JFK",
    AIRPORTS.JFK.city,
    AIRPORTS.JFK.airport,
    "LAX",
    AIRPORTS.LAX.city,
    AIRPORTS.LAX.airport,
    fmt(pastFlightTime),
    fmt(pastArrivalTime),
    330,
    299.99,
    599.99,
    899.99,
    "Boeing 737",
    "landed",
    "A12",
    "4",
  ).lastInsertRowid);

  // Create seats for GKD888
  const pastSeats = generateSeats(299.99, 599.99, 899.99);
  for (const seat of pastSeats) {
    db.query(
      `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
        is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      pastFlightId,
      seat.seatNumber,
      seat.cabinClass,
      seat.price,
      seat.isAvailable ? 1 : 0,
      seat.isWindow ? 1 : 0,
      seat.isAisle ? 1 : 0,
      seat.hasExtraLegroom ? 1 : 0,
      seat.rowNumber,
      seat.seatLetter,
    );
  }

  // Create baggage report for Peter on GKD888 (verifier expects GKD888 and "20-inch")
  db.query(
    `INSERT INTO baggage_tracking (user_id, booking_id, flight_number, flight_time, passenger_name, passenger_phone, passenger_email, baggage_description, seat_number, loss_details, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    peterId,
    null,
    "GKD888",
    fmt(pastFlightTime),
    "Peter Griffin",
    "+1-555-0100",
    "peter.griffin@work.mosi.inc",
    "Black 20-inch Samsonite suitcase with red ribbon handle",
    "12A",
    "Last seen at baggage claim carousel 3 at JFK airport",
    "processed",
    fmt(pastFlightTime),
    fmt(new Date(now.getTime() - 90 * 86400000)),
  );

  // Also create GKD2001 (tomorrow, scheduled) with Peter's booking — Python calls create_specific_data too
  const departureTime = new Date(now.getTime() + 1 * 86400000);
  const arrivalTime = new Date(departureTime.getTime() + 5.5 * 3600000);

  const flightId = Number(db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status, gate, terminal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "GKD2001",
    "GKD Airlines",
    "JFK",
    AIRPORTS.JFK.city,
    AIRPORTS.JFK.airport,
    "LAX",
    AIRPORTS.LAX.city,
    AIRPORTS.LAX.airport,
    fmt(departureTime),
    fmt(arrivalTime),
    330,
    349.99,
    699.99,
    1049.99,
    "Boeing 787",
    "scheduled",
    "B22",
    "4",
  ).lastInsertRowid);

  const seats = generateSeats(349.99, 699.99, 1049.99);
  for (const seat of seats) {
    db.query(
      `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
        is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flightId,
      seat.seatNumber,
      seat.cabinClass,
      seat.price,
      seat.isAvailable ? 1 : 0,
      seat.isWindow ? 1 : 0,
      seat.isAisle ? 1 : 0,
      seat.hasExtraLegroom ? 1 : 0,
      seat.rowNumber,
      seat.seatLetter,
    );
  }

  // Create Peter's booking on GKD2001
  const ref = generateBookingReference();
  const bookingId = Number(db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99).lastInsertRowid);

  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, nationality) VALUES (?, 'Peter', 'Griffin', '1975-04-12', 'US')"
  ).run(bookingId);

  db.query(
    "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4532', 'visa', 'Peter Griffin', ?, datetime('now'))"
  ).run(bookingId, 349.99, `TXN-${Date.now()}`);

  console.log("airline: created GKD888 baggage report and GKD2001 for baggage-tracking-application");
}

function createBookingScenarios(db: Database, userIds: number[], now: Date): void {
  // Find a flight for creating bookings
  const flight = db.query("SELECT * FROM flights WHERE status = 'scheduled' LIMIT 1").get() as Record<string, unknown> | null;
  if (!flight) return;

  const flightId = Number(flight.id);
  const basePrice = Number(flight.base_price_economy ?? 299.99);

  // Past bookings (-30, -20, -15 days)
  for (const days of [-30, -20, -15]) {
    const ref = generateBookingReference();
    const bookedAt = new Date(now.getTime() + days * 86400000);
    db.query(
      "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in, booked_at) VALUES (?, ?, ?, ?, ?, 'confirmed', 1, ?)"
    ).run(ref, userIds[1], flightId, "economy", basePrice, fmt(bookedAt));
  }

  // Current bookings (+2, +5, +7 days)
  for (const days of [2, 5, 7]) {
    const ref = generateBookingReference();
    const bookedAt = now;
    db.query(
      "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in, booked_at) VALUES (?, ?, ?, ?, ?, 'confirmed', 0, ?)"
    ).run(ref, userIds[2], flightId, "economy", basePrice, fmt(bookedAt));
  }

  // Future bookings (+14, +21, +28 days)
  for (const days of [14, 21, 28]) {
    const ref = generateBookingReference();
    db.query(
      "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
    ).run(ref, userIds[3], flightId, "economy", basePrice);
  }

  // Cancelled bookings (+10, +25 days)
  for (const days of [10, 25]) {
    const ref = generateBookingReference();
    db.query(
      "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'cancelled', 0)"
    ).run(ref, userIds[4], flightId, "economy", basePrice);
  }

  // Pending booking (+12 days)
  const ref = generateBookingReference();
  db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'pending', 0)"
  ).run(ref, userIds[5], flightId, "economy", basePrice);
}
