export type SlotPickerParams = {
  courtId: string;
  courtName: string;
  pricePerHour: number;
  venueName: string;
  venueId: string;
  venueStartTime: string; // "HH:MM:SS"
  venueEndTime: string;   // "HH:MM:SS"
  // Set only when this booking flow was launched from a tournament's "Book
  // Venue" button — carried through to BookingCheckout so a completed
  // booking there can be linked back to that game and redirect to it
  // instead of the normal BookingConfirmation screen.
  forGameId?: string;
};

// One or more slots picked in one visit — price is per-slot since a price
// rule can make different hours of the same day cost differently.
export type BookingSlotSelection = { startTime: string; endTime: string; price: number };

export type BookingCheckoutParams = {
  courtId: string;
  courtName: string;
  venueName: string;
  date: string; // YYYY-MM-DD
  slots: BookingSlotSelection[];
  forGameId?: string;
};

export type BookingConfirmationParams = {
  bookingIds: string[];
  venueName: string;
  courtName: string;
  date: string;
  slots: { startTime: string; endTime: string }[];
  totalAmount: number;
};
