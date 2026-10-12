import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  fetchMatchesForTournament,
  generateMatches,
  generateNextRound,
  generatePoolMatches,
  enterManualScore,
  linkCricketMatch,
  syncCricketMatchResult,
  linkScorecardMatch,
  syncScorecardMatchResult,
  setMatchScorer,
  updateMatchSchedule,
  computeTournamentTeamNRR,
  type ScorecardSport,
  type TournamentMatch,
} from "../lib/api/tournamentMatches";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
import { OFFLINE_PATTERN } from "../lib/friendlyError";
import { enqueue, getAllQueued, removeFromQueue } from "../lib/offlineQueue";
import { useNetworkStore } from "../store/networkStore";
import type { Database } from "../types/database.types";

type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

function isOfflineError(err: unknown): boolean {
  return err instanceof Error && OFFLINE_PATTERN.test(err.message);
}

// A finished match's result carries over to its tournament_matches row the
// moment Live Scoring finishes it — but by the time a connection comes
// back, the user has usually already left that match's screen (often for
// the very match list this is meant to update), so nothing with that
// match's id is still mounted to retry it the way every other sport's
// per-match offline queue does. Queued here globally instead, by namespace
// alone — see flushTournamentSyncQueue, wired into RootNavigator so it
// fires on *any* reconnect regardless of which screen is open.
const SYNC_NAMESPACE = "tournament-sync";

type SyncPayload =
  | { kind: "cricket"; cricketMatchId: string; teamAWon: boolean | null }
  | { kind: "scorecard"; sport: ScorecardSport; scorecardMatchId: string; teamAWon: boolean | null };

export async function flushTournamentSyncQueue(qc: QueryClient): Promise<void> {
  const items = await getAllQueued<SyncPayload>(SYNC_NAMESPACE);
  if (items.length === 0) return;
  let flushedAny = false;
  for (const item of items) {
    try {
      if (item.payload.kind === "cricket") {
        await syncCricketMatchResult(item.payload.cricketMatchId, item.payload.teamAWon);
      } else {
        await syncScorecardMatchResult(item.payload.sport, item.payload.scorecardMatchId, item.payload.teamAWon);
      }
      await removeFromQueue(SYNC_NAMESPACE, item.localId);
      flushedAny = true;
    } catch (err) {
      if (isOfflineError(err)) break; // still offline — leave the rest queued
      // A genuine error on one sync (e.g. the match was deleted since) is
      // this entry's problem alone — drop it and keep going with the rest
      // rather than let one bad entry block every other match's sync.
      await removeFromQueue(SYNC_NAMESPACE, item.localId);
    }
  }
  if (flushedAny) qc.invalidateQueries({ queryKey: ["tournamentMatches"] });
}

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

// Cricket-only Net Run Rate for every team in a tournament, derived by
// replaying each completed match's ball-by-ball data (see
// computeTournamentTeamNRR) — queried separately from the match list
// itself since it needs an extra round-trip (the linked cricket scorecards)
// and only matters once there's at least one completed match to replay.
export function useTournamentNRR(gameId: string, matches: TournamentMatch[] | undefined) {
  const cricketMatchIds = (matches ?? [])
    .filter((m) => m.status === "COMPLETED" && m.cricket_match_id)
    .map((m) => m.cricket_match_id as string)
    .sort();
  return useQuery({
    queryKey: ["tournamentNRR", gameId, cricketMatchIds],
    queryFn: () => computeTournamentTeamNRR(matches ?? []),
    enabled: cricketMatchIds.length > 0,
    staleTime: 30_000,
  });
}

// Cricket-only: which of this tournament's linked matches are IN_PROGRESS
// right now, for the "Live Now" section — tournament_matches.status itself
// doesn't distinguish "not started" from "live" (it only ever flips to
// COMPLETED), so this is a small extra fetch against the linked cricket
// scorecards themselves, with realtime so a match flipping to IN_PROGRESS
// (the instant a scorer starts it) appears here without a refresh.
export type LiveCricketMatchSummary = {
  id: string;
  team_a_name: string;
  team_b_name: string;
  overs_limit: number;
};

export function useLiveCricketMatches(cricketMatchIds: string[]) {
  const qc = useQueryClient();
  const sortedIds = [...cricketMatchIds].sort();
  const idsKey = sortedIds.join(",");

  const query = useQuery({
    queryKey: ["liveCricketMatches", idsKey],
    queryFn: async (): Promise<LiveCricketMatchSummary[]> => {
      const { data, error } = await supabase
        .from("cricket_matches")
        .select("id, team_a_name, team_b_name, overs_limit")
        .in("id", sortedIds)
        .eq("status", "IN_PROGRESS");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: sortedIds.length > 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (sortedIds.length === 0) return;
    const channel = supabase
      .channel(uniqueChannelName(`liveCricketMatches:${idsKey}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_matches" }, () =>
        qc.invalidateQueries({ queryKey: ["liveCricketMatches", idsKey] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, qc]);

  return query;
}

export function useSetMatchScorer(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { matchId: string; scorerUserId: string | null }) =>
      setMatchScorer(params.matchId, params.scorerUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}

export function useUpdateMatchSchedule(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { matchId: string; scheduledAt: string | null }) =>
      updateMatchSchedule(params.matchId, params.scheduledAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
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

export function useEnterManualScore(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, result }: { matchId: string; result: Parameters<typeof enterManualScore>[1] }) =>
      enterManualScore(matchId, result),
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
    mutationFn: async ({ cricketMatchId, teamAWon }: { cricketMatchId: string; teamAWon: boolean | null }) => {
      if (!useNetworkStore.getState().isOnline) {
        await enqueue(SYNC_NAMESPACE, cricketMatchId, { kind: "cricket", cricketMatchId, teamAWon } satisfies SyncPayload);
        return;
      }
      try {
        await syncCricketMatchResult(cricketMatchId, teamAWon);
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue(SYNC_NAMESPACE, cricketMatchId, { kind: "cricket", cricketMatchId, teamAWon } satisfies SyncPayload);
          return;
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches"] }),
  });
}

// Same as useLinkCricketMatch/useSyncCricketMatchResult, generalized across
// the other six sports via the `sport` tag.
export function useLinkScorecardMatch(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, sport, scorecardMatchId }: { matchId: string; sport: ScorecardSport; scorecardMatchId: string }) =>
      linkScorecardMatch(matchId, sport, scorecardMatchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches", gameId] }),
  });
}

export function useSyncScorecardMatchResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sport,
      scorecardMatchId,
      teamAWon,
    }: {
      sport: ScorecardSport;
      scorecardMatchId: string;
      teamAWon: boolean | null;
    }) => {
      const payload: SyncPayload = { kind: "scorecard", sport, scorecardMatchId, teamAWon };
      if (!useNetworkStore.getState().isOnline) {
        await enqueue(SYNC_NAMESPACE, scorecardMatchId, payload);
        return;
      }
      try {
        await syncScorecardMatchResult(sport, scorecardMatchId, teamAWon);
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue(SYNC_NAMESPACE, scorecardMatchId, payload);
          return;
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentMatches"] }),
  });
}
