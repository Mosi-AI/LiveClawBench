export interface SeatConfig {
  rows: number;
  seatsPerRow: number;
  price: number;
}

export interface SeatsConfig {
  economy: SeatConfig;
  business: SeatConfig;
  first: SeatConfig;
}

export interface GeneratedSeat {
  seatNumber: string;
  cabinClass: string;
  price: number;
  isAvailable: boolean;
  isWindow: boolean;
  isAisle: boolean;
  hasExtraLegroom: boolean;
  rowNumber: number;
  seatLetter: string;
}

export const SEAT_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L"];

export const WINDOW_LETTERS: readonly string[] = ["A", "F", "L"];
export const AISLE_LETTERS: readonly string[] = ["C", "D", "G", "H"];
export const EXTRA_LEGROOM_ROWS: readonly number[] = [1, 12, 13];

export const EXTRA_LEGROOM_PRICE_ADJUSTMENT = 50;

const windowSet = new Set(WINDOW_LETTERS);
const aisleSet = new Set(AISLE_LETTERS);
const legroomSet = new Set(EXTRA_LEGROOM_ROWS);

export const DEFAULT_SEAT_CONFIG: SeatsConfig = {
  economy: { rows: 30, seatsPerRow: 6, price: 0 },
  business: { rows: 5, seatsPerRow: 4, price: 0 },
  first: { rows: 2, seatsPerRow: 4, price: 0 },
};

export function generateSeats(
  economyPrice: number,
  businessPrice: number | null,
  firstPrice: number | null,
  config?: Partial<SeatsConfig>,
): GeneratedSeat[] {
  const seats: GeneratedSeat[] = [];

  const fullConfig: SeatsConfig = {
    economy: {
      ...DEFAULT_SEAT_CONFIG.economy,
      price: economyPrice,
      ...config?.economy,
    },
    business: {
      ...DEFAULT_SEAT_CONFIG.business,
      price: businessPrice ?? economyPrice * 2,
      ...config?.business,
    },
    first: {
      ...DEFAULT_SEAT_CONFIG.first,
      price: firstPrice ?? economyPrice * 3,
      ...config?.first,
    },
  };

  let rowOffset = 1;
  for (const [cabinClass, classConfig] of Object.entries(fullConfig)) {
    const { rows, seatsPerRow, price } = classConfig;

    for (let row = rowOffset; row < rowOffset + rows; row++) {
      for (let i = 0; i < seatsPerRow; i++) {
        const seatLetter = SEAT_LETTERS[i];
        const seatNumber = `${row}${seatLetter}`;
        const isWindow = windowSet.has(seatLetter);
        const isAisle = aisleSet.has(seatLetter);
        const hasExtraLegroom = legroomSet.has(row);

        seats.push({
          seatNumber,
          cabinClass,
          price: price + (hasExtraLegroom ? EXTRA_LEGROOM_PRICE_ADJUSTMENT : 0),
          isAvailable: true,
          isWindow,
          isAisle,
          hasExtraLegroom,
          rowNumber: row,
          seatLetter,
        });
      }
    }

    rowOffset += rows;
  }

  return seats;
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
