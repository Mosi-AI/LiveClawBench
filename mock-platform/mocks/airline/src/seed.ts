import { initSchema } from "./db/schema";
import { generateSeats } from "./db/seat-generation";
import { formatDateTime } from "./helpers";
import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { generateBookingReference } from "./helpers";
import bcryptjs from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "mock-lib";

const SEAT_LETTERS = ["A", "B", "C", "D", "E", "F"];
const AISLE_LETTERS: readonly string[] = ["C", "D"];
const WINDOW_LETTERS: readonly string[] = ["A", "F"];
const aisleset = new Set(AISLE_LETTERS);
const windowSet = new Set(WINDOW_LETTERS);

interface AirportInfo {
  city: string;
  airport: string;
}

const AIRPORTS: Record<string, AirportInfo> = {
  JFK: { city: "New York", airport: "John F. Kennedy International Airport" },
  LAX: { city: "Los Angeles", airport: "Los Angeles International Airport" },
  SFO: { city: "San Francisco", airport: "San Francisco International Airport" },
  SEA: { city: "Seattle", airport: "Seattle-Tacoma International Airport" },
  MIA: { city: "Miami", airport: "Miami International Airport" },
  ORD: { city: "Chicago", airport: "O'Hare International Airport" },
  DFW: { city: "Dallas", airport: "Dallas/Fort Worth International Airport" },
  BOS: { city: "Boston", airport: "Logan International Airport" },
  ATL: { city: "Atlanta", airport: "Hartsfield-Jackson Atlanta International Airport" },
  DEN: { city: "Denver", airport: "Denver International Airport" },
};

const FLIGHT_CONFIGS = [
  { origin: "JFK", dest: "LAX", hours: 5, price: 299.99, times: [6, 10, 14, 18] },
  { origin: "LAX", dest: "JFK", hours: 5, price: 279.99, times: [7, 11, 15, 19] },
  { origin: "JFK", dest: "SFO", hours: 5.5, price: 319.99, times: [8, 16] },
  { origin: "SFO", dest: "JFK", hours: 5.5, price: 309.99, times: [9, 17] },
  { origin: "JFK", dest: "MIA", hours: 3, price: 179.99, times: [7, 12, 17] },
  { origin: "MIA", dest: "JFK", hours: 3, price: 169.99, times: [8, 13, 18] },
  { origin: "LAX", dest: "SFO", hours: 1.5, price: 149.99, times: [9, 15] },
  { origin: "SFO", dest: "SEA", hours: 2, price: 199.99, times: [10, 16] },
  { origin: "SEA", dest: "DEN", hours: 2.5, price: 209.99, times: [8, 14] },
  { origin: "ORD", dest: "DFW", hours: 2.5, price: 159.99, times: [7, 13] },
  { origin: "DFW", dest: "ORD", hours: 2.5, price: 159.99, times: [8, 14] },
  { origin: "BOS", dest: "ATL", hours: 2.5, price: 189.99, times: [9, 15] },
  { origin: "ATL", dest: "BOS", hours: 2.5, price: 179.99, times: [10, 16] },
  { origin: "ORD", dest: "LAX", hours: 4.5, price: 259.99, times: [7, 15] },
  { origin: "LAX", dest: "ORD", hours: 4.5, price: 249.99, times: [8, 16] },
];

function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

function calculateNextMonday(from?: Date): Date {
  const base = from ?? new Date();
  const dayOfWeek = base.getDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(base);
  nextMonday.setDate(base.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

function createUsers(db: Database, taskMode: boolean): number[] {
  const rawUsers = taskMode
    ? [
        { email: "peter.griffin@work.mosi.inc", password: "password123", first_name: "Peter", last_name: "Griffin", phone: "+1-555-0100", dob: "1975-04-12" },
        { email: "john.doe@email.com", password: "password123", first_name: "John", last_name: "Doe", phone: "+1-555-0101", dob: "1988-06-15" },
        { email: "jane.smith@email.com", password: "password123", first_name: "Jane", last_name: "Smith", phone: "+1-555-0102", dob: "1990-03-22" },
        { email: "mike.johnson@email.com", password: "password123", first_name: "Mike", last_name: "Johnson", phone: "+1-555-0103", dob: "1985-11-08" },
        { email: "sarah.williams@email.com", password: "password123", first_name: "Sarah", last_name: "Williams", phone: "+1-555-0104", dob: "1992-09-30" },
        { email: "david.brown@email.com", password: "password123", first_name: "David", last_name: "Brown", phone: "+1-555-0105", dob: "1980-01-18" },
      ]
    : [
        { email: "peter.griffin@work.mosi.inc", password: "password123", first_name: "Peter", last_name: "Griffin", phone: "+1-555-0100", dob: "1975-04-12" },
      ];

  const ids: number[] = [];
  for (const u of rawUsers) {
    const hash = bcryptjs.hashSync(u.password, BCRYPT_SALT_ROUNDS);
    db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, 1, 1)"
    ).run(u.email, hash, u.first_name, u.last_name, u.phone, u.dob);
    ids.push(Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id));
  }
  return ids;
}

function createAnnouncements(db: Database): void {
  const announcements = [
    { title: "New Route Announcement", content: "We are excited to announce new routes to Europe starting next month.", category: "general", priority: "high", expires_at: null },
    { title: "Summer Sale", content: "Book your summer vacation now and save up to 30% on selected routes.", category: "promotion", priority: "high", expires_at: null },
    { title: "Baggage Policy Update", content: "Updated baggage policies effective immediately. Check our website for details.", category: "policy", priority: "normal", expires_at: null },
    { title: "COVID-19 Guidelines", content: "Please follow updated health and safety guidelines during your travel.", category: "safety", priority: "high", expires_at: null },
    { title: "Loyalty Program", content: "Join our new loyalty program and earn points on every flight.", category: "promotion", priority: "normal", expires_at: null },
    { title: "Mobile App Update", content: "Download our updated mobile app for a better booking experience.", category: "general", priority: "low", expires_at: null },
  ];

  for (const a of announcements) {
    db.query(
      "INSERT INTO announcements (title, content, category, priority, expires_at) VALUES (?, ?, ?, ?, ?)"
    ).run(a.title, a.content, a.category, a.priority, a.expires_at);
  }
}

function createFaqs(db: Database): void {
  const faqs = [
    { question: "How do I book a flight?", answer: "You can book a flight through our website or mobile app.", category: "booking", display_order: 1 },
    { question: "What is your baggage policy?", answer: "Economy passengers can check one bag up to 23kg.", category: "baggage", display_order: 2 },
    { question: "How do I cancel my booking?", answer: "You can cancel your booking through the 'My Bookings' section.", category: "booking", display_order: 3 },
    { question: "How do I file a claim?", answer: "Submit a claim through our claims portal with your booking reference.", category: "claims", display_order: 4 },
    { question: "What is your refund policy?", answer: "Refunds depend on your ticket type and cancellation timing.", category: "booking", display_order: 5 },
  ];

  for (const f of faqs) {
    db.query(
      "INSERT INTO faqs (question, answer, category, display_order) VALUES (?, ?, ?, ?)"
    ).run(f.question, f.answer, f.category, f.display_order);
  }
}

export function seedDatabase(db: Database, taskName?: string) {
  initSchema(db);

  const effectiveTaskName = taskName ?? process.env.TASK_NAME ?? "";

  const userCount = db.query("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count > 0) {
    console.log("airline: database already seeded, skipping");
    return;
  }

  const now = new Date();
  const anchorTime = fmt(now);

  // Write seed-meta.json for verifier-side anchor consistency
  const seedMetaDir = "/var/lib/mock-data";
  const seedMeta = { anchor_time: anchorTime, task_name: effectiveTaskName, seeded_at: anchorTime };
  try { mkdirSync(seedMetaDir, { recursive: true }); } catch {}
  Bun.write(`${seedMetaDir}/seed-meta.json`, JSON.stringify(seedMeta, null, 2)).catch(() => {});

  const taskMode = !!effectiveTaskName;
  const userIds = createUsers(db, taskMode);

  if (taskMode) {
    createAnnouncements(db);
    createFaqs(db);
  }

  // Default: 30 days, no skip (300 flights). Task mode: 60 days, 30% skip.
  const dayCount = taskMode ? 60 : 30;
  const skipRate = taskMode ? 0.3 : 0;

  let flightNumber = 100;
  const insertFlight = db.query(
    `INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertSeat = db.query(
    `INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
      is_window, is_aisle, has_extra_legroom, row_number, seat_letter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const seedFlights = db.transaction(() => {
    for (let dayOffset = 0; dayOffset < dayCount; dayOffset++) {
      for (const config of FLIGHT_CONFIGS) {
        for (const timeSlot of config.times) {
          if (Math.random() < skipRate) {
            flightNumber++;
            continue;
          }

          // Skip flight number 2000 range only for tasks that need GKD2001
          // (flight-seat-selection, flight-seat-selection-failed, flight-cancel-claim)
          const needsGKD2001 = ["flight-seat-selection", "flight-seat-selection-failed", "flight-cancel-claim"].includes(effectiveTaskName);
          if (needsGKD2001 && flightNumber === 2000) {
            flightNumber = 2100;
          }

          const departureTime = new Date(
            now.getTime() + dayOffset * 86400000 + timeSlot * 3600000
          );
          const arrivalTime = new Date(departureTime.getTime() + config.hours * 3600000);

          insertFlight.run(
            `GKD${flightNumber}`,
            "GKD Airlines",
            config.origin,
            AIRPORTS[config.origin].city,
            AIRPORTS[config.origin].airport,
            config.dest,
            AIRPORTS[config.dest].city,
            AIRPORTS[config.dest].airport,
            fmt(departureTime),
            fmt(arrivalTime),
            Math.round(config.hours * 60),
            config.price,
            config.price * 2,
            config.price * 3,
            "Boeing 737",
            "scheduled",
          );

          const flightId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

          const seats = generateSeats(config.price, config.price * 2, config.price * 3);
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

          flightNumber++;
        }
      }
    }
  });

  seedFlights();
  console.log(`airline: seeded ${flightNumber - 100} flights`);

  // Create task-specific data
  if (taskMode) {
    createTaskSpecificData(db, effectiveTaskName, userIds, now);
  }
}

function createTaskSpecificData(db: Database, taskName: string, userIds: number[], now: Date): void {
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

    insertFlight.run(
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
    );

    const flightId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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

  db.query(
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
  );

  const flightId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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
  db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99);

  const bookingId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

  // Create passenger (no seat assigned)
  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, nationality) VALUES (?, 'Peter', 'Griffin', '1985-06-15', 'US')"
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

  db.query(
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
  );

  const flightId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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
  db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99);

  const bookingId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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

  for (let i = 0; i < windowSeats.length; i++) {
    const userEmail = `windowseat.user${i + 1}@test.com`;
    const wsHash = bcryptjs.hashSync("password123", BCRYPT_SALT_ROUNDS);
    db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, is_verified, is_active) VALUES (?, ?, ?, ?, 1, 1)"
    ).run(userEmail, wsHash, `Window${i + 1}`, `Passenger${i + 1}`);

    const userId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

    const bookingRef = generateBookingReference();
    db.query(
      "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 1)"
    ).run(bookingRef, userId, flightId, "economy", 349.99);

    const bsBookingId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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
  // passengers/payments/baggage_tracking/claims/chat_messages/chat_sessions → bookings → seats → price_history/flight_status_history → flights
  const conflictingFilters = [
    "flight_number = 'GKD2001'",
    `origin_code = 'JFK' AND destination_code = 'LAX' AND departure_time LIKE '${departureDate.toISOString().split("T")[0]}%'`,
  ];
  for (const filter of conflictingFilters) {
    const conflictingFlightIds = (db.query(`SELECT id FROM flights WHERE ${filter}`).all() as Record<string, number>[]).map((r) => r.id);
    if (conflictingFlightIds.length === 0) continue;

    const conflictingBookingIds = (db.query(
      `SELECT id FROM bookings WHERE flight_id IN (${conflictingFlightIds.join(",")})`
    ).all() as Record<string, number>[]).map((r) => r.id);

    if (conflictingBookingIds.length > 0) {
      const bookingList = conflictingBookingIds.join(",");
      db.query(`DELETE FROM passengers WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM payments WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM baggage_tracking WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM claims WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE booking_id IN (${bookingList}))`).run();
      db.query(`DELETE FROM chat_sessions WHERE booking_id IN (${bookingList})`).run();
      db.query(`DELETE FROM bookings WHERE id IN (${bookingList})`).run();
    }

    const flightList = conflictingFlightIds.join(",");
    db.query(`DELETE FROM seats WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM price_history WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM flight_status_history WHERE flight_id IN (${flightList})`).run();
    db.query(`DELETE FROM flights WHERE id IN (${flightList})`).run();
  }

  db.query(
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
  );

  const flightId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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
  db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99);

  const bookingId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth) VALUES (?, 'Peter', 'Griffin', '1975-04-12')"
  ).run(bookingId);

  // Create payment
  db.query(
    "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4532', 'visa', 'Peter Griffin', ?, datetime('now'))"
  ).run(bookingId, 349.99, `TXN-${Date.now()}`);

  console.log("airline: created cancelled GKD2001 for flight-cancel-claim");
}

function createBaggageTrackingData(db: Database, peterId: number, now: Date): void {
  // Create GKD888 as past flight (95 days ago, landed) for baggage report
  const pastFlightTime = new Date(now.getTime() - 95 * 86400000);
  const pastArrivalTime = new Date(pastFlightTime.getTime() + 5.5 * 3600000);

  db.query(
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
  );

  const pastFlightId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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

  db.query(
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
  );

  const flightId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

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
  db.query(
    "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'confirmed', 0)"
  ).run(ref, peterId, flightId, "economy", 349.99);

  const bookingId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);

  db.query(
    "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, nationality) VALUES (?, 'Peter', 'Griffin', '1985-06-15', 'US')"
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
