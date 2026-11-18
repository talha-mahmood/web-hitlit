import type { VenueBooking } from "./api/venuesAdmin";

export const BOOKING_CSV_HEADER = ["Date", "Time", "Court", "Sport", "Customer", "Phone", "Status", "Amount (Rs)"];

export function formatBookingRowForCsv(b: VenueBooking): string[] {
  const start = new Date(b.start_time);
  return [
    start.toLocaleDateString("en-PK"),
    start.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true }),
    b.court?.name ?? "",
    b.court?.sports?.name ?? "",
    b.profiles?.full_name ?? "",
    b.profiles?.phone ?? "",
    b.status,
    String(b.total_amount),
  ];
}

// Shared filename-safety helper for exported CSVs — strips anything that
// isn't alphanumeric so venue/sport names with spaces, punctuation, etc.
// can't produce an invalid or surprising filename.
export function toSafeFilenameSegment(text: string): string {
  return text.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}
