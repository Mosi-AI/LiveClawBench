import { describe, expect, test } from "bun:test";
import {
  generateSeats,
  calculateNextMonday,
  SEAT_LETTERS,
  WINDOW_LETTERS,
  AISLE_LETTERS,
  EXTRA_LEGROOM_ROWS,
  EXTRA_LEGROOM_PRICE_ADJUSTMENT,
} from "../src/db/seat-generation";

describe("seat generation", () => {
  test("generates correct total seats (208): 180 economy + 20 business + 8 first", () => {
    const seats = generateSeats(299.99, 599.98, 899.97);
    expect(seats.length).toBe(208);

    const economy = seats.filter((s) => s.cabinClass === "economy");
    const business = seats.filter((s) => s.cabinClass === "business");
    const first = seats.filter((s) => s.cabinClass === "first");

    expect(economy.length).toBe(180);
    expect(business.length).toBe(20);
    expect(first.length).toBe(8);
  });

  test("economy: rows 1-30, 6 seats per row (A-F)", () => {
    const seats = generateSeats(100, 200, 300);
    const economy = seats.filter((s) => s.cabinClass === "economy");

    expect(economy[0].rowNumber).toBe(1);
    expect(economy[0].seatLetter).toBe("A");
    expect(economy[economy.length - 1].rowNumber).toBe(30);
    expect(economy[economy.length - 1].seatLetter).toBe("F");

    const row1Seats = economy.filter((s) => s.rowNumber === 1);
    expect(row1Seats.length).toBe(6);
    expect(row1Seats.map((s) => s.seatLetter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
  });

  test("business: rows 31-35, 4 seats per row (A-D)", () => {
    const seats = generateSeats(100, 200, 300);
    const business = seats.filter((s) => s.cabinClass === "business");

    expect(business[0].rowNumber).toBe(31);
    expect(business[0].seatLetter).toBe("A");
    expect(business[business.length - 1].rowNumber).toBe(35);
    expect(business[business.length - 1].seatLetter).toBe("D");

    const row31Seats = business.filter((s) => s.rowNumber === 31);
    expect(row31Seats.length).toBe(4);
    expect(row31Seats.map((s) => s.seatLetter)).toEqual(["A", "B", "C", "D"]);
  });

  test("first: rows 36-37, 4 seats per row (A-D)", () => {
    const seats = generateSeats(100, 200, 300);
    const first = seats.filter((s) => s.cabinClass === "first");

    expect(first[0].rowNumber).toBe(36);
    expect(first[0].seatLetter).toBe("A");
    expect(first[first.length - 1].rowNumber).toBe(37);
    expect(first[first.length - 1].seatLetter).toBe("D");
  });

  test("window/aisle flags match Python logic", () => {
    const seats = generateSeats(100, 200, 300);

    for (const seat of seats) {
      if (WINDOW_LETTERS.includes(seat.seatLetter as typeof WINDOW_LETTERS[number])) {
        expect(seat.isWindow).toBe(true);
      } else {
        expect(seat.isWindow).toBe(false);
      }
      if (AISLE_LETTERS.includes(seat.seatLetter as typeof AISLE_LETTERS[number])) {
        expect(seat.isAisle).toBe(true);
      } else {
        expect(seat.isAisle).toBe(false);
      }
    }
  });

  test("extra legroom rows (1, 12, 13) get $50 price adjustment", () => {
    const BASE_PRICE = 100;
    const seats = generateSeats(BASE_PRICE, 200, 300);

    for (const seat of seats) {
      if ((EXTRA_LEGROOM_ROWS as readonly number[]).includes(seat.rowNumber)) {
        expect(seat.hasExtraLegroom).toBe(true);
        const expectedBase =
          seat.cabinClass === "economy"
            ? BASE_PRICE
            : seat.cabinClass === "business"
              ? 200
              : 300;
        expect(seat.price).toBe(expectedBase + EXTRA_LEGROOM_PRICE_ADJUSTMENT);
      } else {
        expect(seat.hasExtraLegroom).toBe(false);
      }
    }
  });

  test("all seats are initially available", () => {
    const seats = generateSeats(100, 200, 300);
    for (const seat of seats) {
      expect(seat.isAvailable).toBe(true);
    }
  });

  test("seat numbers follow pattern: row + letter", () => {
    const seats = generateSeats(100, 200, 300);
    for (const seat of seats) {
      expect(seat.seatNumber).toBe(`${seat.rowNumber}${seat.seatLetter}`);
    }
  });

  test("uses fallback pricing when business/first prices are null", () => {
    const seats = generateSeats(100, null, null);
    const business = seats.filter((s) => s.cabinClass === "business");
    const first = seats.filter((s) => s.cabinClass === "first");

    expect(business[0].price).toBe(200);
    expect(first[0].price).toBe(300);
  });
});

describe("calculateNextMonday", () => {
  test("Monday → next Monday (not same day)", () => {
    const monday = new Date("2026-04-27");
    monday.setHours(12, 0, 0, 0);
    const result = calculateNextMonday(monday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(4);
    expect(result.getMonth()).toBe(4);
  });

  test("Tuesday → next Monday", () => {
    const tuesday = new Date("2026-04-28");
    tuesday.setHours(12, 0, 0, 0);
    const result = calculateNextMonday(tuesday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(4);
    expect(result.getMonth()).toBe(4);
  });

  test("Sunday → next day Monday", () => {
    const sunday = new Date("2026-04-26");
    sunday.setHours(12, 0, 0, 0);
    const result = calculateNextMonday(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(27);
    expect(result.getMonth()).toBe(3);
  });

  test("Saturday → 2 days ahead Monday", () => {
    const saturday = new Date("2026-04-25");
    saturday.setHours(12, 0, 0, 0);
    const result = calculateNextMonday(saturday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(27);
    expect(result.getMonth()).toBe(3);
  });

  test("result has time zeroed out", () => {
    const wednesday = new Date("2026-04-29T15:30:45.123Z");
    const result = calculateNextMonday(wednesday);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  test("defaults to current date when no argument", () => {
    const result = calculateNextMonday();
    expect(result.getDay()).toBe(1);
    expect(result.getHours()).toBe(0);
  });
});
