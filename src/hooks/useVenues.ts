import { useQuery } from "@tanstack/react-query";
import { fetchVenues, fetchCourtPriceRules, type VenueFilters } from "../lib/api/venues";

export function useVenues(filters: VenueFilters) {
  return useQuery({
    queryKey: ["venues", filters],
    queryFn: () => fetchVenues(filters),
  });
}

export function useCourtPriceRules(courtId: string) {
  return useQuery({
    queryKey: ["courtPriceRules", courtId],
    queryFn: () => fetchCourtPriceRules(courtId),
    enabled: !!courtId,
    staleTime: 60_000,
  });
}
