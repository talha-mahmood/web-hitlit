import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyTennisMatches,
  fetchTennisMatch,
  createTennisMatch,
  completeTennisMatch,
  deleteTennisMatch,
  addTennisPoint,
  deleteLastTennisPoint,
  type TennisMatchDetail,
} from "../lib/api/tennis";
import { createOfflinePointScoring } from "../lib/offlinePointScoring";
import type { Player } from "../lib/tennisScoring";

export function useMyTennisMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["tennisMatches", userId],
    queryFn: () => fetchMyTennisMatches(userId as string),
    enabled: !!userId,
  });
}

// Offline-aware add/delete/pending-count + the match query itself (which
// flushes any queued points as soon as there's a connection) — see
// offlinePointScoring.ts for why this is shared across the five point/rally
// sports instead of hand-duplicated like their friendlyXError wording.
const offline = createOfflinePointScoring<TennisMatchDetail>({
  namespace: "tennis",
  matchQueryKeyPrefix: "tennisMatch",
  fetchMatch: fetchTennisMatch,
  // The shared helper's queue only ever stores/replays whatever "winner"
  // string this sport's own UI already validated and passed in, so this
  // narrowing (Player -> string) is safe in practice.
  addPoint: addTennisPoint as (matchId: string, seq: number, winner: string) => Promise<{ id: string }>,
  deleteLastPoint: deleteLastTennisPoint,
  getRows: (detail) => detail.tennis_points,
  setRows: (detail, rows) => ({ ...detail, tennis_points: rows }),
});

export function useTennisMatch(matchId: string | undefined) {
  return offline.useMatch(matchId);
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
  return offline.useAddPoint(matchId);
}

export function useDeleteLastTennisPoint(matchId: string) {
  return offline.useDeleteLastPoint(matchId);
}

export function useTennisPendingCount(matchId: string | undefined): number {
  return offline.usePendingPointCount(matchId);
}
