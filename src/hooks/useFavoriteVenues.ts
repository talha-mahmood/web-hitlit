import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFavoriteVenueIds, setFavoriteVenue } from "../lib/api/venues";
import { useAuthStore } from "../store/authStore";

export function useFavoriteVenueIds() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ["favoriteVenues", userId],
    queryFn: () => fetchFavoriteVenueIds(userId as string),
    enabled: !!userId,
  });
}

export function useToggleFavoriteVenue() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ venueId, isFavorite }: { venueId: string; isFavorite: boolean }) =>
      setFavoriteVenue(userId as string, venueId, isFavorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favoriteVenues", userId] });
    },
  });
}
