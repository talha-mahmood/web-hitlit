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

export type RevenueScale = "days" | "weeks" | "months";

export type RevenueBuckets = {
  labels: string[];
  // Longer, human-readable label per bar — shown when a bar is tapped.
  detailLabels: string[];
  values: number[];
  total: number;
  deltaPct: number | null;
  periodLabel: string;
};

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const daysSinceMonday = (copy.getDay() + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - daysSinceMonday);
  return copy;
}

// Powers the dashboard's revenue bar chart at three zoom levels — same
// underlying booking data, just bucketed differently, so switching scale
// doesn't require a different query.
export function computeRevenueByScale(bookings: VenueBooking[], scale: RevenueScale): RevenueBuckets {
  const now = new Date();
  const revenueBookings = bookings.filter((b) => REVENUE_STATUSES.has(b.status));

  if (scale === "days") {
    const count = 7;
    const days = Array.from({ length: count }, (_, i) => dateOffset(i - (count - 1)));
    const byDay = new Map(days.map((d) => [d, 0]));
    for (const b of revenueBookings) {
      const day = toLocalDateStr(new Date(b.start_time));
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + b.total_amount);
    }
    const values = days.map((d) => byDay.get(d) ?? 0);
    const total = values.reduce((a, b) => a + b, 0);
    const labels = days.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }));
    const detailLabels = days.map((d) =>
      new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    );

    const prevStart = dateOffset(-2 * count + 1);
    const prevEnd = dateOffset(-count);
    const prevTotal = revenueBookings
      .filter((b) => {
        const day = toLocalDateStr(new Date(b.start_time));
        return day >= prevStart && day <= prevEnd;
      })
      .reduce((sum, b) => sum + b.total_amount, 0);

    return { labels, detailLabels, values, total, deltaPct: pctChange(total, prevTotal), periodLabel: "last 7 days" };
  }

  if (scale === "weeks") {
    const count = 8;
    const thisWeekStart = startOfWeek(now);
    const weekStarts = Array.from({ length: count }, (_, i) => {
      const d = new Date(thisWeekStart);
      d.setDate(d.getDate() - (count - 1 - i) * 7);
      return d;
    });
    const values = weekStarts.map((start) => {
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return revenueBookings
        .filter((b) => {
          const t = new Date(b.start_time);
          return t >= start && t < end;
        })
        .reduce((sum, b) => sum + b.total_amount, 0);
    });
    const total = values.reduce((a, b) => a + b, 0);
    const labels = weekStarts.map((d) => `${d.getDate()}/${d.getMonth() + 1}`);
    const fmtDay = (x: Date) => x.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const detailLabels = weekStarts.map((d) => {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `Week of ${fmtDay(d)} – ${fmtDay(end)}`;
    });

    const prevStart = new Date(weekStarts[0]);
    prevStart.setDate(prevStart.getDate() - count * 7);
    const prevEnd = weekStarts[0];
    const prevTotal = revenueBookings
      .filter((b) => {
        const t = new Date(b.start_time);
        return t >= prevStart && t < prevEnd;
      })
      .reduce((sum, b) => sum + b.total_amount, 0);

    return {
      labels,
      detailLabels,
      values,
      total,
      deltaPct: pctChange(total, prevTotal),
      periodLabel: `last ${count} weeks`,
    };
  }

  // months
  const count = 6;
  const monthStarts = Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1));
  const values = monthStarts.map((start) => {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return revenueBookings
      .filter((b) => {
        const t = new Date(b.start_time);
        return t >= start && t < end;
      })
      .reduce((sum, b) => sum + b.total_amount, 0);
  });
  const total = values.reduce((a, b) => a + b, 0);
  const labels = monthStarts.map((d) => d.toLocaleDateString("en-US", { month: "short" }));
  const detailLabels = monthStarts.map((d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" }));

  const prevStart = new Date(monthStarts[0].getFullYear(), monthStarts[0].getMonth() - count, 1);
  const prevEnd = monthStarts[0];
  const prevTotal = revenueBookings
    .filter((b) => {
      const t = new Date(b.start_time);
      return t >= prevStart && t < prevEnd;
    })
    .reduce((sum, b) => sum + b.total_amount, 0);

  return {
    labels,
    detailLabels,
    values,
    total,
    deltaPct: pctChange(total, prevTotal),
    periodLabel: `last ${count} months`,
  };
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

export function computeVenueAnalytics(bookings: VenueBooking[], cancelledCount: number) {
  const counted = bookings.filter((b) => COUNTED_STATUSES.has(b.status));
  const revenueBookings = bookings.filter((b) => REVENUE_STATUSES.has(b.status));

  const totalBookings = counted.length;
  const totalRevenue = revenueBookings.reduce((sum, b) => sum + b.total_amount, 0);
  const avgBookingValue = revenueBookings.length > 0 ? Math.round(totalRevenue / revenueBookings.length) : 0;

  const sportCounts = new Map<string, number>();
  const courtCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  const userCounts = new Map<string, number>();

  for (const b of counted) {
    const sport = b.court?.sports?.name ?? "Unknown";
    sportCounts.set(sport, (sportCounts.get(sport) ?? 0) + 1);

    const court = b.court?.name ?? "Unknown";
    courtCounts.set(court, (courtCounts.get(court) ?? 0) + 1);

    const hour = new Date(b.start_time).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);

    userCounts.set(b.user_id, (userCounts.get(b.user_id) ?? 0) + 1);
  }

  const topEntry = (m: Map<string, number>): string | null => {
    let best: string | null = null;
    let bestCount = 0;
    for (const [k, v] of m) {
      if (v > bestCount) {
        best = k;
        bestCount = v;
      }
    }
    return best;
  };

  let peakHour: number | null = null;
  let peakHourCount = 0;
  for (const [h, c] of hourCounts) {
    if (c > peakHourCount) {
      peakHour = h;
      peakHourCount = c;
    }
  }
  const formatHour = (h: number) => {
    const period = h < 12 ? "AM" : "PM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display} ${period}`;
  };

  const repeatCustomers = Array.from(userCounts.values()).filter((c) => c > 1).length;
  const totalCustomers = userCounts.size;

  const totalOutcomes = totalBookings + cancelledCount;
  const cancellationRate = totalOutcomes > 0 ? Math.round((cancelledCount / totalOutcomes) * 100) : 0;

  return {
    totalBookings,
    totalRevenue,
    avgBookingValue,
    mostPopularSport: topEntry(sportCounts),
    mostPopularCourt: topEntry(courtCounts),
    peakHourLabel: peakHour !== null ? `${formatHour(peakHour)} – ${formatHour((peakHour + 1) % 24)}` : null,
    cancellationRate,
    repeatCustomers,
    totalCustomers,
  };
}

export type SportPerformance = { sportName: string; bookings: number; revenue: number };

// Per-sport bookings/revenue split — lets an admin see "Badminton earned
// this much, Cricket earned that much" instead of only one blended total.
export function computeSportBreakdown(bookings: VenueBooking[]): SportPerformance[] {
  const map = new Map<string, { bookings: number; revenue: number }>();
  for (const b of bookings) {
    if (!COUNTED_STATUSES.has(b.status)) continue;
    const sport = b.court?.sports?.name ?? "Unknown";
    const entry = map.get(sport) ?? { bookings: 0, revenue: 0 };
    entry.bookings += 1;
    if (REVENUE_STATUSES.has(b.status)) entry.revenue += b.total_amount;
    map.set(sport, entry);
  }
  return Array.from(map.entries())
    .map(([sportName, v]) => ({ sportName, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type DayTimeHeatmap = {
  dayLabels: string[];
  bandLabels: string[];
  // grid[dayIndex][bandIndex] = revenue
  grid: number[][];
  max: number;
};

const HEATMAP_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Same 4 time-of-day bands as timeBadgeColor's morning/afternoon/evening/night
// split, so "when is this venue busiest" reads consistently across the app.
const HEATMAP_BANDS: { label: string; start: number; end: number }[] = [
  { label: "Morning", start: 5, end: 12 },
  { label: "Afternoon", start: 12, end: 17 },
  { label: "Evening", start: 17, end: 21 },
  { label: "Night", start: 21, end: 5 }, // wraps past midnight
];

// Revenue broken down by day-of-week × time-of-day, across a venue's full
// booking history — reveals recurring demand patterns (e.g. "Saturday
// evenings are the biggest driver") that a single week's chart can't show.
export function computeDayTimeHeatmap(bookings: VenueBooking[]): DayTimeHeatmap {
  const grid = HEATMAP_DAY_LABELS.map(() => HEATMAP_BANDS.map(() => 0));
  for (const b of bookings) {
    if (!REVENUE_STATUSES.has(b.status)) continue;
    const d = new Date(b.start_time);
    const dayIndex = (d.getDay() + 6) % 7; // Mon=0..Sun=6
    const hour = d.getHours();
    const bandIndex = HEATMAP_BANDS.findIndex((band) =>
      band.start < band.end ? hour >= band.start && hour < band.end : hour >= band.start || hour < band.end
    );
    if (bandIndex === -1) continue;
    grid[dayIndex][bandIndex] += b.total_amount;
  }
  const max = Math.max(1, ...grid.flat());
  return { dayLabels: HEATMAP_DAY_LABELS, bandLabels: HEATMAP_BANDS.map((b) => b.label), grid, max };
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
