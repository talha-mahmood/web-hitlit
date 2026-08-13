// Shared slot-generation logic for court booking — used by both the
// customer-facing SlotPickerScreen and the admin block/unblock slot grid,
// so "what counts as an available hour" never drifts between the two.

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function getNext14Days(): string[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return toLocalDateStr(d);
  });
}

export type Slot = { start: string; end: string; label: string };

// One slot per whole hour, capped at 23:00, between the venue's operating hours.
export function generateSlots(venueStart: string, venueEnd: string): Slot[] {
  const startHour = parseInt(venueStart.split(":")[0], 10);
  const endHour = Math.min(parseInt(venueEnd.split(":")[0], 10), 23);
  return Array.from({ length: endHour - startHour }, (_, i) => {
    const h = startHour + i;
    const nh = h + 1;
    const startStr = `${String(h).padStart(2, "0")}:00`;
    const endStr = `${String(nh).padStart(2, "0")}:00`;
    const fmt = (hr: number) =>
      hr === 0 ? "12:00 AM" : hr < 12 ? `${hr}:00 AM` : hr === 12 ? "12:00 PM" : `${hr - 12}:00 PM`;
    return { start: startStr, end: endStr, label: `${fmt(h)} – ${fmt(nh)}` };
  });
}

// The app is Pakistan-only, so a date + 'HH:MM' pair is always +05:00.
export function isSlotBooked(
  slot: Slot,
  date: string,
  booked: Array<{ start_time: string; end_time: string }>
): boolean {
  const s = new Date(`${date}T${slot.start}:00+05:00`).getTime();
  const e = new Date(`${date}T${slot.end}:00+05:00`).getTime();
  return booked.some((b) => {
    const bs = new Date(b.start_time).getTime();
    const be = new Date(b.end_time).getTime();
    return s < be && e > bs;
  });
}

export function isSlotPast(slot: Slot, date: string): boolean {
  return new Date(`${date}T${slot.start}:00+05:00`) < new Date();
}
