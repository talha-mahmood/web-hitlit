export type SlotPickerParams = {
  courtId: string;
  courtName: string;
  pricePerHour: number;
  venueName: string;
  venueId: string;
  venueStartTime: string; // "HH:MM:SS"
  venueEndTime: string;   // "HH:MM:SS"
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
};

export type BookingConfirmationParams = {
  bookingIds: string[];
  venueName: string;
  courtName: string;
  date: string;
  slots: { startTime: string; endTime: string }[];
  totalAmount: number;
};
