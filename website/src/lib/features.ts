// In the app, the court booking flow (slot picker → checkout → confirmation
// → My Bookings) is fully built but switched off: courts on Venue Detail are
// info-only until online payment is integrated, and players book through
// the venue's WhatsApp / phone instead. The website mirrors that by default;
// set VITE_ENABLE_ONLINE_BOOKING=true (when the app turns it on) to make
// courts bookable here too.
export const ONLINE_BOOKING_ENABLED = import.meta.env.VITE_ENABLE_ONLINE_BOOKING === "true";
