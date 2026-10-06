import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyBadmintonMatches,
  fetchBadmintonMatch,
  createBadmintonMatch,
  completeBadmintonMatch,
  deleteBadmintonMatch,
  addBadmintonRally,
  deleteLastBadmintonRally,
  type BadmintonMatchDetail,
} from "../lib/api/badminton";
import { createOfflinePointScoring } from "../lib/offlinePointScoring";
import type { Team } from "../lib/badmintonScoring";

export function useMyBadmintonMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["badmintonMatches", userId],
    queryFn: () => fetchMyBadmintonMatches(userId as string),
    enabled: !!userId,
  });
}

// Offline-aware add/delete/pending-count + the match query itself (which
// flushes any queued points as soon as there's a connection) — see
// offlinePointScoring.ts for why this is shared across the five point/rally
// sports instead of hand-duplicated like their friendlyXError wording.
const offline = createOfflinePointScoring<BadmintonMatchDetail>({
  namespace: "badminton",
  matchQueryKeyPrefix: "badmintonMatch",
  fetchMatch: fetchBadmintonMatch,
  // The shared helper's queue only ever stores/replays whatever "winner"
  // string this sport's own UI already validated and passed in, so this
  // narrowing (Team -> string) is safe in practice.
  addPoint: addBadmintonRally as (matchId: string, seq: number, winner: string) => Promise<{ id: string }>,
  deleteLastPoint: deleteLastBadmintonRally,
  getRows: (detail) => detail.badminton_rallies,
  setRows: (detail, rows) => ({ ...detail, badminton_rallies: rows }),
});

export function useBadmintonMatch(matchId: string | undefined) {
  return offline.useMatch(matchId);
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
  return offline.useAddPoint(matchId);
}

export function useDeleteLastBadmintonRally(matchId: string) {
  return offline.useDeleteLastPoint(matchId);
}

export function useBadmintonPendingCount(matchId: string | undefined): number {
  return offline.usePendingPointCount(matchId);
}
