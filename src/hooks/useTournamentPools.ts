import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPoolsForTournament, assignTeamToPool } from "../lib/api/tournamentPools";

export function useTournamentPools(gameId: string) {
  return useQuery({
    queryKey: ["tournamentPools", gameId],
    queryFn: () => fetchPoolsForTournament(gameId),
    enabled: !!gameId,
  });
}

export function useAssignTeamToPool(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, poolId }: { teamId: string; poolId: string }) => assignTeamToPool(teamId, poolId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] }),
  });
}
