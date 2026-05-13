export const SEAT_LETTERS = ["A", "B", "C", "D", "E", "F"];
export const AISLE_LETTERS: readonly string[] = ["C", "D"];
export const WINDOW_LETTERS: readonly string[] = ["A", "F"];
export const aisleset = new Set(AISLE_LETTERS);
export const windowSet = new Set(WINDOW_LETTERS);

export interface AirportInfo {
  city: string;
  airport: string;
}

export const AIRPORTS: Record<string, AirportInfo> = {
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

export const FLIGHT_CONFIGS = [
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

export function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

export function calculateNextMonday(from?: Date): Date {
  const base = from ?? new Date();
  const dayOfWeek = base.getDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(base);
  nextMonday.setDate(base.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}
