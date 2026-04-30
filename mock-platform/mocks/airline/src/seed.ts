import { initSchema } from "./db/schema";
import { generateSeats } from "./db/seat-generation";
import type { Database } from "bun:sqlite";

export function seedDatabase(db: Database) {
  initSchema(db);

  const userCount = db.query("SELECT COUNT(*) as count FROM users").get() as {
    count: number;
  };
  if (userCount.count > 0) {
    console.log("airline: database already seeded, skipping");
    return;
  }

  const insertUser = db.query(`
    INSERT INTO users (email, password_hash, first_name, last_name, phone, is_verified, is_active)
    VALUES ($email, $passwordHash, $firstName, $lastName, $phone, $isVerified, $isActive)
  `);

  insertUser.run({
    $email: "peter.griffin@work.mosi.inc",
    $passwordHash: "$2b$12$placeholder_hash_for_peter",
    $firstName: "Peter",
    $lastName: "Griffin",
    $phone: "+1-555-0100",
    $isVerified: 1,
    $isActive: 1,
  });

  const insertFlight = db.query(`
    INSERT INTO flights (flight_number, airline, origin_code, origin_city, origin_airport,
      destination_code, destination_city, destination_airport, departure_time, arrival_time,
      duration_minutes, base_price_economy, base_price_business, base_price_first,
      aircraft_type, status)
    VALUES ($flightNumber, $airline, $originCode, $originCity, $originAirport,
      $destinationCode, $destinationCity, $destinationAirport, $departureTime, $arrivalTime,
      $durationMinutes, $basePriceEconomy, $basePriceBusiness, $basePriceFirst,
      $aircraftType, $status)
  `);

  const insertSeat = db.query(`
    INSERT INTO seats (flight_id, seat_number, cabin_class, price, is_available,
      is_window, is_aisle, has_extra_legroom, row_number, seat_letter)
    VALUES ($flightId, $seatNumber, $cabinClass, $price, $isAvailable,
      $isWindow, $isAisle, $hasExtraLegroom, $rowNumber, $seatLetter)
  `);

  const airports: Record<string, { city: string; airport: string }> = {
    JFK: {
      city: "New York",
      airport: "John F. Kennedy International Airport",
    },
    LAX: {
      city: "Los Angeles",
      airport: "Los Angeles International Airport",
    },
    SFO: {
      city: "San Francisco",
      airport: "San Francisco International Airport",
    },
    SEA: { city: "Seattle", airport: "Seattle-Tacoma International Airport" },
    MIA: { city: "Miami", airport: "Miami International Airport" },
    ORD: { city: "Chicago", airport: "O'Hare International Airport" },
    DFW: {
      city: "Dallas",
      airport: "Dallas/Fort Worth International Airport",
    },
    BOS: { city: "Boston", airport: "Logan International Airport" },
    ATL: {
      city: "Atlanta",
      airport: "Hartsfield-Jackson Atlanta International Airport",
    },
    DEN: { city: "Denver", airport: "Denver International Airport" },
  };

  const flightConfigs = [
    { origin: "JFK", dest: "LAX", hours: 5, price: 299.99, time: 8 },
    { origin: "LAX", dest: "SFO", hours: 1.5, price: 149.99, time: 10 },
    { origin: "SFO", dest: "SEA", hours: 2, price: 199.99, time: 14 },
    { origin: "JFK", dest: "MIA", hours: 3, price: 179.99, time: 9 },
    { origin: "ORD", dest: "DFW", hours: 2.5, price: 159.99, time: 11 },
    { origin: "BOS", dest: "ATL", hours: 2.5, price: 189.99, time: 13 },
    { origin: "SEA", dest: "DEN", hours: 2.5, price: 209.99, time: 15 },
    { origin: "LAX", dest: "JFK", hours: 5, price: 279.99, time: 7 },
    { origin: "MIA", dest: "JFK", hours: 3, price: 169.99, time: 16 },
    { origin: "ATL", dest: "BOS", hours: 2.5, price: 179.99, time: 12 },
  ];

  const now = new Date();
  let flightNumber = 100;

  const seedFlights = db.transaction(() => {
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      for (const config of flightConfigs) {
        const origin = config.origin;
        const dest = config.dest;
        const departureTime = new Date(
          now.getTime() +
            dayOffset * 86400000 +
            config.time * 3600000,
        );
        const arrivalTime = new Date(
          departureTime.getTime() + config.hours * 3600000,
        );

        const fmt = (d: Date) =>
          d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

        insertFlight.run({
          $flightNumber: `AA${flightNumber}`,
          $airline: "GKD Airlines",
          $originCode: origin,
          $originCity: airports[origin].city,
          $originAirport: airports[origin].airport,
          $destinationCode: dest,
          $destinationCity: airports[dest].city,
          $destinationAirport: airports[dest].airport,
          $departureTime: fmt(departureTime),
          $arrivalTime: fmt(arrivalTime),
          $durationMinutes: Math.round(config.hours * 60),
          $basePriceEconomy: config.price,
          $basePriceBusiness: config.price * 2,
          $basePriceFirst: config.price * 3,
          $aircraftType: "Boeing 737",
          $status: "scheduled",
        });

        const flightId = (
          db.query("SELECT last_insert_rowid() as id").get() as { id: number }
        ).id;

        const seats = generateSeats(config.price, config.price * 2, config.price * 3);
        for (const seat of seats) {
          insertSeat.run({
            $flightId: flightId,
            $seatNumber: seat.seatNumber,
            $cabinClass: seat.cabinClass,
            $price: seat.price,
            $isAvailable: seat.isAvailable ? 1 : 0,
            $isWindow: seat.isWindow ? 1 : 0,
            $isAisle: seat.isAisle ? 1 : 0,
            $hasExtraLegroom: seat.hasExtraLegroom ? 1 : 0,
            $rowNumber: seat.rowNumber,
            $seatLetter: seat.seatLetter,
          });
        }

        flightNumber++;
      }
    }
  });

  seedFlights();
  console.log(`airline: seeded ${flightNumber - 100} flights with seats`);
}
