import { toLocalDateStr, generateSlots } from "./slots";
import { COUNTED_STATUSES, REVENUE_STATUSES, OCCUPIED_STATUSES } from "./bookingStatus";
import type { VenueBooking } from "./api/venuesAdmin";
import type { Venue } from "./api/venues";

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function computeDashboardStats(bookings: VenueBooking[], venue: Venue, courtsCount: number) {
  const today = dateOffset(0);
  const yesterday = dateOffset(-1);

  const todaysBookings = bookings.filter((b) => toLocalDateStr(new Date(b.start_time)) === today);
  const yesterdaysBookings = bookings.filter((b) => toLocalDateStr(new Date(b.start_time)) === yesterday);

  const countedToday = todaysBookings.filter((b) => COUNTED_STATUSES.has(b.status));
  const countedYesterday = yesterdaysBookings.filter((b) => COUNTED_STATUSES.has(b.status));

  const todaysRevenue = todaysBookings
    .filter((b) => REVENUE_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.total_amount, 0);
  const yesterdaysRevenue = yesterdaysBookings
    .filter((b) => REVENUE_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.total_amount, 0);

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;

  const slotsPerCourt = generateSlots(venue.start_time ?? "08:00", venue.end_time ?? "23:00").length;
  const totalSlotsToday = slotsPerCourt * Math.max(courtsCount, 1);
  const occupiedToday = todaysBookings.filter((b) => OCCUPIED_STATUSES.has(b.status)).length;
  const occupiedYesterday = yesterdaysBookings.filter((b) => OCCUPIED_STATUSES.has(b.status)).length;
  const occupancyRate = totalSlotsToday > 0 ? Math.min(100, Math.round((occupiedToday / totalSlotsToday) * 100)) : 0;
  const occupancyYesterday =
    totalSlotsToday > 0 ? Math.min(100, Math.round((occupiedYesterday / totalSlotsToday) * 100)) : 0;

  return {
    todaysBookingsCount: countedToday.length,
    bookingsDelta: pctChange(countedToday.length, countedYesterday.length),
    todaysRevenue,
    revenueDelta: pctChange(todaysRevenue, yesterdaysRevenue),
    occupancyRate,
    occupancyDelta: occupancyRate - occupancyYesterday,
    pendingCount,
    todaysSchedule: todaysBookings.slice().sort((a, b) => a.start_time.localeCompare(b.start_time)),
  };
}

export function computeWeeklyRevenue(bookings: VenueBooking[]) {
  const days = Array.from({ length: 7 }, (_, i) => dateOffset(i - 6));
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const b of bookings) {
    if (!REVENUE_STATUSES.has(b.status)) continue;
    const day = toLocalDateStr(new Date(b.start_time));
    if (byDay.has(day)) {
      byDay.set(day, (byDay.get(day) ?? 0) + b.total_amount);
    }
  }
  const values = days.map((d) => byDay.get(d) ?? 0);
  const total = values.reduce((a, b) => a + b, 0);

  const thisWeekStart = dateOffset(-6);
  const lastWeekBookings = bookings.filter((b) => {
    const day = toLocalDateStr(new Date(b.start_time));
    return day < thisWeekStart && day >= dateOffset(-13) && REVENUE_STATUSES.has(b.status);
  });
  const lastWeekTotal = lastWeekBookings.reduce((sum, b) => sum + b.total_amount, 0);
  const weekDelta = pctChange(total, lastWeekTotal);

  const labels = days.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }));

  return { days, labels, values, total, weekDelta };
}

export function computeUpcomingBookings(bookings: VenueBooking[], limit = 3) {
  const now = Date.now();
  return bookings
    .filter((b) => new Date(b.start_time).getTime() > now && COUNTED_STATUSES.has(b.status))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, limit);
}

export function computeRecentActivity(bookings: VenueBooking[], limit = 4) {
  return bookings
    .filter((b) => b.status !== "BLOCKED")
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export type VenueAggregate = {
  venueId: string;
  name: string;
  bookingsCount: number;
  revenue: number;
};

export function computeTopVenues(
  venues: { id: string; name: string }[],
  bookingsByVenue: (VenueBooking[] | undefined)[]
): VenueAggregate[] {
  return venues
    .map((v, i) => {
      const bookings = bookingsByVenue[i] ?? [];
      const counted = bookings.filter((b) => COUNTED_STATUSES.has(b.status));
      const revenue = bookings
        .filter((b) => REVENUE_STATUSES.has(b.status))
        .reduce((sum, b) => sum + b.total_amount, 0);
      return { venueId: v.id, name: v.name, bookingsCount: counted.length, revenue };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
