import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyVenues,
  updateVenue,
  addVenueImage,
  deleteVenueImage,
  reorderVenueImage,
  addCourt,
  updateCourt,
  deleteCourt,
  addFacility,
  deleteFacility,
  fetchVenueBookings,
  type VenueUpdateInput,
  type CourtInput,
  type FacilityInput,
} from "../lib/api/venuesAdmin";
import { fetchVenueDetail } from "../lib/api/venues";

export function useMyVenues(ownerId: string | undefined) {
  return useQuery({
    queryKey: ["myVenues", ownerId],
    queryFn: () => fetchMyVenues(ownerId as string),
    enabled: !!ownerId,
  });
}

// Reused as-is from venues.ts: it doesn't filter isactive, so an admin can
// see/edit a venue they've temporarily deactivated.
export function useAdminVenueDetail(venueId: string) {
  return useQuery({
    queryKey: ["venue", venueId],
    queryFn: () => fetchVenueDetail(venueId),
    enabled: !!venueId,
  });
}

export function useUpdateVenue(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: VenueUpdateInput) => updateVenue(venueId, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venue", venueId] });
      qc.invalidateQueries({ queryKey: ["myVenues"] });
      qc.invalidateQueries({ queryKey: ["allVenues"] });
    },
  });
}

export function useAddVenueImage(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageUrl, displayOrder }: { imageUrl: string; displayOrder: number }) =>
      addVenueImage(venueId, imageUrl, displayOrder),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useDeleteVenueImage(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => deleteVenueImage(imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useReorderVenueImage(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, displayOrder }: { imageId: string; displayOrder: number }) =>
      reorderVenueImage(imageId, displayOrder),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useAddCourt(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CourtInput) => addCourt(venueId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useUpdateCourt(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courtId, input }: { courtId: string; input: CourtInput }) => updateCourt(courtId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useDeleteCourt(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courtId: string) => deleteCourt(courtId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useAddFacility(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FacilityInput) => addFacility(venueId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useDeleteFacility(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (facilityId: string) => deleteFacility(facilityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

export function useVenueBookings(venueId: string) {
  return useQuery({
    queryKey: ["venueBookings", venueId],
    queryFn: () => fetchVenueBookings(venueId),
    enabled: !!venueId,
  });
}
