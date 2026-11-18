import { useQuery } from "@tanstack/react-query";
import { fetchVenueDetail } from "../lib/api/venues";

export function useVenueDetail(venueId: string) {
  return useQuery({
    queryKey: ["venue", venueId],
    queryFn: () => fetchVenueDetail(venueId),
    enabled: !!venueId,
  });
}
