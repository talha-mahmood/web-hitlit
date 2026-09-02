// Shared param list for the venue-editing screens — registered on BOTH
// AdminNavigator (venue owner managing their own venue) and
// SuperAdminNavigator (superadmin managing any venue) as the exact same
// screen components, so there's one implementation, not two.
export type VenueEditingParamList = {
  AdminDashboard: { venueId: string };
  EditVenueDetails: { venueId: string };
  ManageVenueImages: { venueId: string };
  ManageCourts: { venueId: string };
  EditCourt: { venueId: string; courtId?: string };
  ManageCourtImages: { venueId: string; courtId: string; courtName: string };
  ManageFacilities: { venueId: string };
  AdminSlots: { venueId: string; courtId: string; courtName: string };
  VenueBookings: { venueId: string };
  AdminReviews: { venueId: string };
  AdminAnalytics: { venueId: string };
  AdminNotifications: undefined;
  BoostVenue: { venueId: string; venueName: string };
  // hideOwnerTransfer: true when a venue owner reaches this from their own
  // dashboard (AdminNavigator) — they can grant/revoke additional admins,
  // but reassigning or removing the primary owner (themselves) is a much
  // bigger, riskier action reserved for the superadmin flow only.
  AssignAdmin: { venueId: string; venueName: string; currentAdminEmail: string | null; hideOwnerTransfer?: boolean };
};
