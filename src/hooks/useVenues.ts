import { useQuery } from "@tanstack/react-query";
import { fetchVenues, type VenueFilters } from "../lib/api/venues";

export function useVenues(filters: VenueFilters) {
  return useQuery({
    queryKey: ["venues", filters],
    queryFn: () => fetchVenues(filters),
  });
}
