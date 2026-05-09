import { initSchema } from "./db/schema";
import { generateSeats } from "./db/seat-generation";
import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { fmt, AIRPORTS, FLIGHT_CONFIGS } from "./seed/data";
import { createUsers } from "./seed/users";
import { createAnnouncements, createFaqs } from "./seed/announcements";
import { createTaskSpecificData } from "./seed/tasks";

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
          const needsGKD2001 = ["flight-seat-selection", "flight-seat-selection-failed", "flight-cancel-claim", "flight-info-change-notice"].includes(effectiveTaskName);
          if (needsGKD2001 && flightNumber === 2000) {
            flightNumber = 2100;
          }

          const departureTime = new Date(
            now.getTime() + dayOffset * 86400000 + timeSlot * 3600000
          );
          const arrivalTime = new Date(departureTime.getTime() + config.hours * 3600000);

          const flightId = Number(insertFlight.run(
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
          ).lastInsertRowid);

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
