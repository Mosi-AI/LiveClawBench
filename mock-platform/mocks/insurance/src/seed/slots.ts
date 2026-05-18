export const SLOT_TIMES_OF_DAY = [9, 10, 11, 13, 14, 15] as const;

export function generateSlotsForService(
  serviceIndex: number,
  count: number,
  baseDay: Date,
): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < count; i++) {
    // Deterministic spread across days 1..14 ahead, hours from SLOT_TIMES_OF_DAY.
    const dayOffset = ((serviceIndex * 3 + i * 4) % 14) + 1;
    const hour =
      SLOT_TIMES_OF_DAY[(serviceIndex + i) % SLOT_TIMES_OF_DAY.length];
    const slotStart = new Date(baseDay);
    slotStart.setUTCDate(slotStart.getUTCDate() + dayOffset);
    slotStart.setUTCHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
    });
  }
  return slots;
}
