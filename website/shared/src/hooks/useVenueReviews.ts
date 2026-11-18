import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVenueReviews, respondToVenueReview } from "../lib/api/venueReviews";

export function useVenueReviews(venueId: string) {
  return useQuery({
    queryKey: ["venueReviews", venueId],
    queryFn: () => fetchVenueReviews(venueId),
    enabled: !!venueId,
  });
}

export function useRespondToVenueReview(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, response }: { reviewId: string; response: string }) =>
      respondToVenueReview(reviewId, response),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venueReviews", venueId] }),
  });
}
