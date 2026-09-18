import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyPadelMatches,
  fetchPadelMatch,
  createPadelMatch,
  completePadelMatch,
  deletePadelMatch,
  addPadelPoint,
  deleteLastPadelPoint,
} from "../lib/api/padel";
import type { Team } from "../lib/padelScoring";

export function useMyPadelMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["padelMatches", userId],
    queryFn: () => fetchMyPadelMatches(userId as string),
    enabled: !!userId,
  });
}

export function usePadelMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["padelMatch", matchId],
    queryFn: () => fetchPadelMatch(matchId as string),
    enabled: !!matchId,
    staleTime: 0,
  });
}

export function useCreatePadelMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPadelMatch,
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ["padelMatches", params.userId] });
    },
  });
}

export function useCompletePadelMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, winnerTeam, resultSummary }: { matchId: string; winnerTeam: Team; resultSummary: string }) =>
      completePadelMatch(matchId, winnerTeam, resultSummary),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: ["padelMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["padelMatches"] });
    },
  });
}

export function useDeletePadelMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deletePadelMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["padelMatches"] }),
  });
}

export function useAddPadelPoint(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seq, winner }: { seq: number; winner: Team }) => addPadelPoint(matchId, seq, winner),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["padelMatch", matchId] }),
  });
}

export function useDeleteLastPadelPoint(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seq: number) => deleteLastPadelPoint(matchId, seq),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["padelMatch", matchId] }),
  });
}
