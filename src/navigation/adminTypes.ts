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
  ManageFacilities: { venueId: string };
  AdminSlots: { venueId: string; courtId: string; courtName: string };
  VenueBookings: { venueId: string };
};
