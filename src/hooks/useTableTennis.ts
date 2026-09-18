import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyTableTennisMatches,
  fetchTableTennisMatch,
  createTableTennisMatch,
  completeTableTennisMatch,
  deleteTableTennisMatch,
  addTableTennisRally,
  deleteLastTableTennisRally,
} from "../lib/api/tableTennis";
import type { Team } from "../lib/tableTennisScoring";

export function useMyTableTennisMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["tableTennisMatches", userId],
    queryFn: () => fetchMyTableTennisMatches(userId as string),
    enabled: !!userId,
  });
}

export function useTableTennisMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["tableTennisMatch", matchId],
    queryFn: () => fetchTableTennisMatch(matchId as string),
    enabled: !!matchId,
    staleTime: 0,
  });
}

export function useCreateTableTennisMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTableTennisMatch,
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ["tableTennisMatches", params.userId] });
    },
  });
}

export function useCompleteTableTennisMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, winnerTeam, resultSummary }: { matchId: string; winnerTeam: Team; resultSummary: string }) =>
      completeTableTennisMatch(matchId, winnerTeam, resultSummary),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: ["tableTennisMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["tableTennisMatches"] });
    },
  });
}

export function useDeleteTableTennisMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deleteTableTennisMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tableTennisMatches"] }),
  });
}

export function useAddTableTennisRally(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seq, winner }: { seq: number; winner: Team }) => addTableTennisRally(matchId, seq, winner),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tableTennisMatch", matchId] }),
  });
}

export function useDeleteLastTableTennisRally(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seq: number) => deleteLastTableTennisRally(matchId, seq),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tableTennisMatch", matchId] }),
  });
}
