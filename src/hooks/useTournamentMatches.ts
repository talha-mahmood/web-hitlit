import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMatchesForTournament,
  generateMatches,
  generateNextRound,
  generatePoolMatches,
  enterMatchResult,
  resetMatchResult,
  linkCricketMatch,
  syncCricketMatchResult,
} from "../lib/api/tournamentMatches";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
import type { Database } from "../types/database.types";

type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

export function useTournamentMatches(gameId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["tournamentMatches", gameId],
    queryFn: () => fetchMatchesForTournament(gameId),
    enabled: !!gameId,
  });

  useEffect(() => {
    if (!gameId) return;
    // A regular (non-tournament) 2-team game's single head-to-head match is
    // inserted by a DB trigger the moment both teams are approved — not by
    // any mutation this hook's callers fire directly — so the query needs
    // its own realtime subscription rather than relying on a mutation's
    // onSuccess to invalidate it.
    const channel = supabase
      .channel(uniqueChannelName(`tournamentMatches:${gameId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches", filter: `game_id=eq.${gameId}` },
        () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, qc]);

  return query;
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

export function useLinkCricketMatch(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, cricketMatchId }: { matchId: string; cricketMatchId: string }) =>
      linkCricketMatch(matchId, cricketMatchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}

// Callable from Live Scoring, which doesn't know its gameId up front (a
// cricket match may or may not be tournament-linked) — invalidates every
// tournament's matches broadly rather than needing one passed in.
export function useSyncCricketMatchResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cricketMatchId, teamAWon }: { cricketMatchId: string; teamAWon: boolean | null }) =>
      syncCricketMatchResult(cricketMatchId, teamAWon),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches"] }),
  });
}
