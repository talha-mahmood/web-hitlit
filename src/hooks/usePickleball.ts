import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyPickleballMatches,
  fetchPickleballMatch,
  createPickleballMatch,
  completePickleballMatch,
  deletePickleballMatch,
  addPickleballRally,
  deleteLastPickleballRally,
} from "../lib/api/pickleball";
import type { Team } from "../lib/pickleballScoring";

export function useMyPickleballMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["pickleballMatches", userId],
    queryFn: () => fetchMyPickleballMatches(userId as string),
    enabled: !!userId,
  });
}

export function usePickleballMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["pickleballMatch", matchId],
    queryFn: () => fetchPickleballMatch(matchId as string),
    enabled: !!matchId,
    staleTime: 0,
  });
}

export function useCreatePickleballMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPickleballMatch,
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ["pickleballMatches", params.userId] });
    },
  });
}

export function useCompletePickleballMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, winnerTeam, resultSummary }: { matchId: string; winnerTeam: Team; resultSummary: string }) =>
      completePickleballMatch(matchId, winnerTeam, resultSummary),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: ["pickleballMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["pickleballMatches"] });
    },
  });
}

export function useDeletePickleballMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deletePickleballMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pickleballMatches"] }),
  });
}

export function useAddPickleballRally(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seq, winner }: { seq: number; winner: Team }) => addPickleballRally(matchId, seq, winner),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pickleballMatch", matchId] }),
  });
}

export function useDeleteLastPickleballRally(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seq: number) => deleteLastPickleballRally(matchId, seq),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pickleballMatch", matchId] }),
  });
}
