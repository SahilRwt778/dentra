// Shortened from the real 30-minute consult slot for faster dev/test
// iteration (more bookable slots per hour without waiting on the
// clock) — bump back to 30 before any real deployment.
export const SLOT_MINUTES = 10;

/** Slot start times between `from` and `to` (both "HH:MM"), each slot fitting entirely before `to`. */
export function generateSlots(from: string, to: string): string[] {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  const start = toMinutes(from);
  const end = toMinutes(to);
  const slots: string[] = [];
  for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
    slots.push(toHHMM(m));
  }
  return slots;
}

/** True if `date` (YYYY-MM-DD) + `time` (HH:MM) has already passed, in server local time. */
export function slotHasPassed(date: string, time: string, now = new Date()): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mins] = time.split(':').map(Number);
  const slotStart = new Date(y, m - 1, d, h, mins);
  return slotStart.getTime() <= now.getTime();
}
