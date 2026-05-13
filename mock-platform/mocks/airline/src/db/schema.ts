import { Database } from "bun:sqlite";
import { getDb, resetDb, type SqliteOptions } from "mock-lib";

const AIRLINE_DB_PATH = process.env.AIRLINE_DB_PATH ?? ":memory:";

export interface AirlineDbOptions {
  dbPath?: string;
}

export function getAirlineDb(options?: AirlineDbOptions) {
  const path = options?.dbPath ?? AIRLINE_DB_PATH;
  // Bypass the process-level singleton for in-memory DBs so that
  // spec-generation (which instantiates multiple mocks in one process)
  // and tests each get a fresh database.
  if (path === ":memory:") {
    return new Database(":memory:", { create: true });
  }
  return getDb({
    path,
    autoMigrate: true,
  });
}

export function resetAirlineDb() {
  resetDb();
}

export function initSchema(db: ReturnType<typeof getAirlineDb>) {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      date_of_birth TEXT,
      is_verified INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_number TEXT NOT NULL,
      airline TEXT NOT NULL DEFAULT 'GKD Airlines',
      origin_code TEXT NOT NULL,
      origin_city TEXT NOT NULL,
      origin_airport TEXT NOT NULL,
      destination_code TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      destination_airport TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      aircraft_type TEXT NOT NULL DEFAULT 'Boeing 737',
      base_price_economy REAL NOT NULL,
      base_price_business REAL,
      base_price_first REAL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      delay_minutes INTEGER DEFAULT 0,
      delay_reason TEXT,
      gate TEXT,
      terminal TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_number ON flights(flight_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_origin ON flights(origin_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_dest ON flights(destination_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_departure ON flights(departure_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_route ON flights(origin_code, destination_code)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      seat_number TEXT NOT NULL,
      cabin_class TEXT NOT NULL,
      price REAL NOT NULL,
      is_available INTEGER DEFAULT 1,
      is_window INTEGER DEFAULT 0,
      is_aisle INTEGER DEFAULT 0,
      has_extra_legroom INTEGER DEFAULT 0,
      row_number INTEGER NOT NULL,
      seat_letter TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (flight_id) REFERENCES flights(id),
      UNIQUE(flight_id, seat_number)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_seats_flight ON seats(flight_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_seats_available ON seats(flight_id, is_available)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_reference TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      flight_id INTEGER NOT NULL,
      cabin_class TEXT NOT NULL,
      total_price REAL NOT NULL,
      booking_status TEXT NOT NULL DEFAULT 'pending',
      checked_in INTEGER DEFAULT 0,
      check_in_time TEXT,
      booked_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (flight_id) REFERENCES flights(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_reference)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_flight ON bookings(flight_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      seat_id INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      nationality TEXT,
      meal_preference TEXT,
      special_assistance TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (seat_id) REFERENCES seats(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_passengers_booking ON passengers(booking_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL UNIQUE,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      payment_method TEXT DEFAULT 'credit_card',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      card_last_four TEXT,
      card_type TEXT,
      card_holder_name TEXT,
      transaction_id TEXT UNIQUE,
      payment_gateway_response TEXT,
      refund_amount REAL,
      refund_reason TEXT,
      refunded_at TEXT,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      claim_type TEXT NOT NULL,
      claim_amount REAL NOT NULL,
      claim_reason TEXT NOT NULL,
      claim_status TEXT DEFAULT 'pending',
      resolution_notes TEXT,
      resolved_amount REAL,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_claims_booking ON claims(booking_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(claim_status)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS flight_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      delay_minutes INTEGER,
      reason TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (flight_id) REFERENCES flights(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_fsh_flight ON flight_status_history(flight_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS baggage_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      booking_id INTEGER,
      flight_number TEXT NOT NULL,
      flight_time TEXT NOT NULL,
      seat_number TEXT,
      passenger_name TEXT NOT NULL,
      passenger_phone TEXT NOT NULL,
      passenger_email TEXT NOT NULL,
      baggage_description TEXT NOT NULL,
      loss_details TEXT,
      status TEXT DEFAULT 'processing',
      location TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_baggage_user ON baggage_tracking(user_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      booking_id INTEGER,
      email_type TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_en_user ON email_notifications(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_en_type ON email_notifications(email_type)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      event_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      reminder_minutes INTEGER DEFAULT 60,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_ce_booking ON calendar_events(booking_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_cs_user ON chat_sessions(user_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_name TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_cm_session ON chat_messages(session_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      cabin_class TEXT NOT NULL,
      old_price REAL NOT NULL,
      new_price REAL NOT NULL,
      change_reason TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (flight_id) REFERENCES flights(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_ph_flight ON price_history(flight_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      is_active INTEGER DEFAULT 1,
      published_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(is_active)`);

  console.log("airline: schema initialized with WAL mode");
}
