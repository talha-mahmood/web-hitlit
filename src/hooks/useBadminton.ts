import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyBadmintonMatches,
  fetchBadmintonMatch,
  createBadmintonMatch,
  completeBadmintonMatch,
  deleteBadmintonMatch,
  addBadmintonRally,
  deleteLastBadmintonRally,
} from "../lib/api/badminton";
import type { Team } from "../lib/badmintonScoring";

export function useMyBadmintonMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["badmintonMatches", userId],
    queryFn: () => fetchMyBadmintonMatches(userId as string),
    enabled: !!userId,
  });
}

export function useBadmintonMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["badmintonMatch", matchId],
    queryFn: () => fetchBadmintonMatch(matchId as string),
    enabled: !!matchId,
    staleTime: 0,
  });
}

export function useCreateBadmintonMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBadmintonMatch,
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ["badmintonMatches", params.userId] });
    },
  });
}

export function useCompleteBadmintonMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, winnerTeam, resultSummary }: { matchId: string; winnerTeam: Team; resultSummary: string }) =>
      completeBadmintonMatch(matchId, winnerTeam, resultSummary),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: ["badmintonMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["badmintonMatches"] });
    },
  });
}

export function useDeleteBadmintonMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deleteBadmintonMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badmintonMatches"] }),
  });
}

export function useAddBadmintonRally(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seq, winner }: { seq: number; winner: Team }) => addBadmintonRally(matchId, seq, winner),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badmintonMatch", matchId] }),
  });
}

export function useDeleteLastBadmintonRally(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seq: number) => deleteLastBadmintonRally(matchId, seq),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badmintonMatch", matchId] }),
  });
}
