import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllVenues,
  lookupProfileByEmail,
  assignVenueAdmin,
  removeVenueAdmin,
  deleteVenue,
  fetchVenueAdmins,
  grantVenueAdmin,
  revokeVenueAdminAccess,
} from "../lib/api/superadmin";
import { createVenue, type CreateVenueInput } from "../lib/api/venuesAdmin";

export function useAllVenues(search?: string) {
  return useQuery({
    queryKey: ["allVenues", search],
    queryFn: () => fetchAllVenues(search),
  });
}

export function useCreateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVenueInput) => createVenue(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allVenues"] }),
  });
}

export function useLookupProfileByEmail() {
  return useMutation({
    mutationFn: (email: string) => lookupProfileByEmail(email),
  });
}

export function useAssignVenueAdmin(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => assignVenueAdmin(venueId, profileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allVenues"] });
      qc.invalidateQueries({ queryKey: ["venue", venueId] });
    },
  });
}

export function useRemoveVenueAdmin(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => removeVenueAdmin(venueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allVenues"] });
      qc.invalidateQueries({ queryKey: ["venue", venueId] });
    },
  });
}

export function useVenueAdmins(venueId: string) {
  return useQuery({
    queryKey: ["venueAdmins", venueId],
    queryFn: () => fetchVenueAdmins(venueId),
    enabled: !!venueId,
  });
}

export function useGrantVenueAdmin(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => grantVenueAdmin(venueId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venueAdmins", venueId] });
      qc.invalidateQueries({ queryKey: ["myVenues"] });
    },
  });
}

export function useRevokeVenueAdminAccess(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => revokeVenueAdminAccess(venueId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venueAdmins", venueId] });
      qc.invalidateQueries({ queryKey: ["myVenues"] });
    },
  });
}

export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (venueId: string) => deleteVenue(venueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allVenues"] }),
  });
}
