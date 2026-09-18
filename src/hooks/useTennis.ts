import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyTennisMatches,
  fetchTennisMatch,
  createTennisMatch,
  completeTennisMatch,
  deleteTennisMatch,
  addTennisPoint,
  deleteLastTennisPoint,
} from "../lib/api/tennis";
import type { Player } from "../lib/tennisScoring";

export function useMyTennisMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["tennisMatches", userId],
    queryFn: () => fetchMyTennisMatches(userId as string),
    enabled: !!userId,
  });
}

export function useTennisMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["tennisMatch", matchId],
    queryFn: () => fetchTennisMatch(matchId as string),
    enabled: !!matchId,
    staleTime: 0,
  });
}

export function useCreateTennisMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTennisMatch,
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ["tennisMatches", params.userId] });
    },
  });
}

export function useCompleteTennisMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, winnerPlayer, resultSummary }: { matchId: string; winnerPlayer: Player; resultSummary: string }) =>
      completeTennisMatch(matchId, winnerPlayer, resultSummary),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: ["tennisMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["tennisMatches"] });
    },
  });
}

export function useDeleteTennisMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deleteTennisMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tennisMatches"] }),
  });
}

export function useAddTennisPoint(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seq, winner }: { seq: number; winner: Player }) => addTennisPoint(matchId, seq, winner),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tennisMatch", matchId] }),
  });
}

export function useDeleteLastTennisPoint(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seq: number) => deleteLastTennisPoint(matchId, seq),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tennisMatch", matchId] }),
  });
}
