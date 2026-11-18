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

function formatHourLabel(hr: number): string {
  return hr === 0 ? "12:00 AM" : hr < 12 ? `${hr}:00 AM` : hr === 12 ? "12:00 PM" : `${hr - 12}:00 PM`;
}

// One slot per whole hour, capped at 23:00, between the venue's operating hours.
export function generateSlots(venueStart: string, venueEnd: string): Slot[] {
  const startHour = parseInt(venueStart.split(":")[0], 10);
  const endHour = Math.min(parseInt(venueEnd.split(":")[0], 10), 23);
  return Array.from({ length: endHour - startHour }, (_, i) => {
    const h = startHour + i;
    const nh = h + 1;
    const startStr = `${String(h).padStart(2, "0")}:00`;
    const endStr = `${String(nh).padStart(2, "0")}:00`;
    return { start: startStr, end: endStr, label: `${formatHourLabel(h)} – ${formatHourLabel(nh)}` };
  });
}

// All 24 hours of the day, independent of the venue's configured operating
// hours — used wherever the UI should show the full day rather than only
// the open window (hours outside it are marked "closed", not hidden).
// The last slot (23:00–00:00) wraps into the next calendar day, same as a
// real overnight hour — isSlotBooked/isSlotPast below already account for that.
export function generateFullDaySlots(): Slot[] {
  return Array.from({ length: 24 }, (_, h) => {
    const nh = (h + 1) % 24;
    const startStr = `${String(h).padStart(2, "0")}:00`;
    const endStr = `${String(nh).padStart(2, "0")}:00`;
    return { start: startStr, end: endStr, label: `${formatHourLabel(h)} – ${formatHourLabel(nh)}` };
  });
}

// slot.end "00:00" means midnight at the START of the next calendar day
// (the 23:00–00:00 overnight slot) — everywhere else "00:00" means the
// start of `date` itself, so that one case needs to roll the date forward.
export function slotBoundaryDateTime(date: string, time: string, isEnd: boolean): Date {
  if (isEnd && time === "00:00") {
    const next = new Date(`${date}T00:00:00+05:00`);
    next.setDate(next.getDate() + 1);
    return next;
  }
  return new Date(`${date}T${time}:00+05:00`);
}

// The app is Pakistan-only, so a date + 'HH:MM' pair is always +05:00.
export function isSlotBooked(
  slot: Slot,
  date: string,
  booked: Array<{ start_time: string; end_time: string }>
): boolean {
  const s = slotBoundaryDateTime(date, slot.start, false).getTime();
  const e = slotBoundaryDateTime(date, slot.end, true).getTime();
  return booked.some((b) => {
    const bs = new Date(b.start_time).getTime();
    const be = new Date(b.end_time).getTime();
    return s < be && e > bs;
  });
}

export function isSlotPast(slot: Slot, date: string): boolean {
  return new Date(`${date}T${slot.start}:00+05:00`) < new Date();
}

export type PriceRule = { start_time: string; end_time: string; price_per_hour: number };

// A court's price_per_hour is the default/base rate; any hour covered by a
// rule here overrides it for that window. Times are compared as "HH:MM"
// strings (zero-padded, so lexicographic order matches time order) — rules
// come from Postgres as "HH:MM:SS", hence the slice.
export function resolveSlotPrice(slot: Slot, basePrice: number, rules: PriceRule[]): number {
  const rule = rules.find((r) => slot.start >= r.start_time.slice(0, 5) && slot.start < r.end_time.slice(0, 5));
  return rule ? rule.price_per_hour : basePrice;
}
