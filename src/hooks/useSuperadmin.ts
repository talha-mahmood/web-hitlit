import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllVenues,
  lookupProfileByEmail,
  assignVenueAdmin,
  removeVenueAdmin,
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
