// Shared booking-status classification, used anywhere admin screens need to
// decide what counts toward booking counts, revenue, or slot occupancy —
// keeps that business logic in one place instead of drifting across screens.

// Bookings that represent a real customer request; BLOCKED (admin-held slot) and
// CANCELLED/EXPIRED (never went through) don't count toward booking-count stats.
export const COUNTED_STATUSES = new Set(["PENDING", "CONFIRMED", "COMPLETED"]);
// Only bookings the venue actually collects money for count toward revenue.
export const REVENUE_STATUSES = new Set(["CONFIRMED", "COMPLETED"]);
// Slot occupancy also includes admin-blocked slots, since those aren't available either.
export const OCCUPIED_STATUSES = new Set(["PENDING", "CONFIRMED", "COMPLETED", "BLOCKED"]);

export const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-orange-50", text: "text-orange-600", label: "Pending" },
  CONFIRMED: { bg: "bg-green-50", text: "text-green-700", label: "Confirmed" },
  COMPLETED: { bg: "bg-blue-50", text: "text-blue-600", label: "Completed" },
  BLOCKED: { bg: "bg-red-50", text: "text-red-600", label: "Blocked by you" },
};
