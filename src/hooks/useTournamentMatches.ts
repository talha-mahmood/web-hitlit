import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMatchesForTournament,
  generateMatches,
  generateNextRound,
  generatePoolMatches,
  enterMatchResult,
  resetMatchResult,
} from "../lib/api/tournamentMatches";
import type { Database } from "../types/database.types";

type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

export function useTournamentMatches(gameId: string) {
  return useQuery({
    queryKey: ["tournamentMatches", gameId],
    queryFn: () => fetchMatchesForTournament(gameId),
    enabled: !!gameId,
  });
}

export function useGenerateMatches(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { format: TournamentFormat; teams: { id: string; name: string }[] }) =>
      generateMatches(gameId, params.format, params.teams),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}

export function useGenerateNextRound(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { round: number; teams: { id: string; name: string }[] }) =>
      generateNextRound(gameId, params.round, params.teams),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}

export function useGeneratePoolMatches(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pools: { poolId: string; teams: { id: string; name: string }[] }[]) =>
      generatePoolMatches(gameId, pools),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}

export function useEnterMatchResult(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, winnerTeamId, isDraw }: { matchId: string; winnerTeamId: string | null; isDraw: boolean }) =>
      enterMatchResult(matchId, { winnerTeamId, isDraw }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}

export function useResetMatchResult(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => resetMatchResult(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}
