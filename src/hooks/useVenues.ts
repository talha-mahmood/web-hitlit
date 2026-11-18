import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchVenues, fetchCourtPriceRules, type VenueFilters } from "../lib/api/venues";

export function useVenues(filters: VenueFilters) {
  return useQuery({
    queryKey: ["venues", filters],
    queryFn: () => fetchVenues(filters),
    // Every filter (sportId, locations, search) is baked into the query key,
    // so changing any of them is technically a brand-new query with no data
    // of its own yet — without this, every filter change would otherwise
    // flash a full loading state (e.g. the venue search field on Host Game
    // disappearing behind a spinner the instant a sport is picked) instead
    // of just quietly refreshing the list it's already showing.
    placeholderData: keepPreviousData,
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
