export type SlotPickerParams = {
  courtId: string;
  courtName: string;
  pricePerHour: number;
  venueName: string;
  venueId: string;
  venueStartTime: string; // "HH:MM:SS"
  venueEndTime: string;   // "HH:MM:SS"
};

export type BookingCheckoutParams = {
  courtId: string;
  courtName: string;
  pricePerHour: number;
  venueName: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
};

export type BookingConfirmationParams = {
  bookingId: string;
  venueName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
};
