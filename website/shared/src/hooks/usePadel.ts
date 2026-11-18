import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyPadelMatches,
  fetchPadelMatch,
  createPadelMatch,
  completePadelMatch,
  deletePadelMatch,
  addPadelPoint,
  deleteLastPadelPoint,
  type PadelMatchDetail,
} from "../lib/api/padel";
import { createOfflinePointScoring } from "../lib/offlinePointScoring";
import type { Team } from "../lib/padelScoring";

export function useMyPadelMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["padelMatches", userId],
    queryFn: () => fetchMyPadelMatches(userId as string),
    enabled: !!userId,
  });
}

// Offline-aware add/delete/pending-count + the match query itself (which
// flushes any queued points as soon as there's a connection) — see
// offlinePointScoring.ts for why this is shared across the five point/rally
// sports instead of hand-duplicated like their friendlyXError wording.
const offline = createOfflinePointScoring<PadelMatchDetail>({
  namespace: "padel",
  matchQueryKeyPrefix: "padelMatch",
  fetchMatch: fetchPadelMatch,
  // The shared helper's queue only ever stores/replays whatever "winner"
  // string this sport's own UI already validated and passed in, so this
  // narrowing (Team -> string) is safe in practice.
  addPoint: addPadelPoint as (matchId: string, seq: number, winner: string) => Promise<{ id: string }>,
  deleteLastPoint: deleteLastPadelPoint,
  getRows: (detail) => detail.padel_points,
  setRows: (detail, rows) => ({ ...detail, padel_points: rows }),
});

export function usePadelMatch(matchId: string | undefined) {
  return offline.useMatch(matchId);
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
  return offline.useAddPoint(matchId);
}

export function useDeleteLastPadelPoint(matchId: string) {
  return offline.useDeleteLastPoint(matchId);
}

export function usePadelPendingCount(matchId: string | undefined): number {
  return offline.usePendingPointCount(matchId);
}
