export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getNext14Days(): { iso: string; label: string; day: string }[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      iso: toLocalDateStr(d),
      label: String(d.getDate()),
      day: d.toLocaleDateString("en-PK", { weekday: "short" }),
    };
  });
}

// Hour slots from 06:00 to 23:00
export function buildTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  for (let h = 6; h <= 23; h++) {
    const hh = String(h).padStart(2, "0");
    const suffix = h < 12 ? "AM" : h === 12 ? "PM" : "PM";
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push({ label: `${displayH}:00 ${suffix}`, value: `${hh}:00` });
  }
  return slots;
}

// Adds `minutes` to `timeValue` ('HH:MM'), wrapping past midnight rather
// than clamping — `daysOverflow` says how many calendar days that wrap
// crossed (0 for a same-day end time, 1 for a game that runs past
// midnight; DURATIONS tops out at 4 hrs, so it can never be more than 1).
// Callers use daysOverflow to set the game's end_date, since a plain TIME
// column can't otherwise distinguish "ends at 00:30 the same night" from
// "ends at 00:30 the next day".
export function addMinutesWithOverflow(
  timeValue: string,
  minutes: number
): { time: string; daysOverflow: number } {
  const [hh, mm] = timeValue.split(":").map(Number);
  const total = hh * 60 + mm + minutes;
  const daysOverflow = Math.floor(total / (24 * 60));
  const wrapped = total - daysOverflow * 24 * 60;
  const nh = Math.floor(wrapped / 60);
  const nm = wrapped % 60;
  return { time: `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`, daysOverflow };
}

// dateIso is a 'YYYY-MM-DD' local date string (see toLocalDateStr) — parsed as
// local components (not via `new Date(dateIso)`, which treats it as UTC and
// can shift the day depending on the device's timezone).
export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return toLocalDateStr(dt);
}

// Inclusive day count between two 'YYYY-MM-DD' dates — e.g. a tournament
// running startIso..endIso on the same day is "1 Day", the next day is "2 Days".
export function diffDays(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.round((end - start) / 86_400_000) + 1;
}

// Hours between two 'HH:MM' values, rounded to the nearest supported
// DURATIONS step. A game's duration is always positive, so an end time
// that's numerically earlier than the start time (an overnight game whose
// end_time wrapped past midnight) is treated as having crossed into the
// next day rather than as a negative duration.
export function diffHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 2) / 2; // nearest 0.5
}

// The app is Pakistan-only (see GameDetailScreen's time formatting), so a
// dateIso + 'HH:MM' pair is always treated as +05:00 when comparing to now.
export function isTimeSlotPast(dateIso: string, timeValue: string): boolean {
  return new Date(`${dateIso}T${timeValue}:00+05:00`).getTime() < Date.now();
}

export const TIME_SLOTS = buildTimeSlots();
export const DAYS = getNext14Days();
export const DURATIONS = [1, 2, 3, 4, 5, 6] as const;
export const TOURNAMENT_DURATIONS_DAYS = [1, 2, 3, 4, 5] as const;
export const MAX_PLAYERS_OPTIONS = Array.from({ length: 29 }, (_, i) => i + 2); // 2..30
export const NUMBER_OF_TEAMS_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 2); // 2..32
export const PLAYERS_PER_TEAM_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
// Pool format groups must be even, so both teams eliminated in a group and
// a possible knockout stage afterward pair up cleanly.
export const NUMBER_OF_GROUPS_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 2); // 2,4,...,20
// Pool format's per-group team count — total teams is groups × this, so it
// stays small; a group needs at least 2 teams to have any match at all.
export const TEAMS_PER_GROUP_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 2); // 2..16
