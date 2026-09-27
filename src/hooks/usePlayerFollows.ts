import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFollowState, followPlayer, unfollowPlayer } from "../lib/api/playerFollows";

export function useFollowState(viewerId: string | undefined, profileUserId: string | undefined) {
  return useQuery({
    queryKey: ["followState", profileUserId, viewerId],
    queryFn: () => fetchFollowState(viewerId, profileUserId as string),
    enabled: !!profileUserId,
    staleTime: 15_000,
  });
}

export function useToggleFollow(profileUserId: string | undefined, viewerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (follow: boolean) => {
      if (!viewerId || !profileUserId) return Promise.resolve();
      return follow ? followPlayer(viewerId, profileUserId) : unfollowPlayer(viewerId, profileUserId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followState", profileUserId] });
    },
  });
}
