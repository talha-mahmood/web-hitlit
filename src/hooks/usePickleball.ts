import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyPickleballMatches,
  fetchPickleballMatch,
  createPickleballMatch,
  completePickleballMatch,
  deletePickleballMatch,
  addPickleballRally,
  deleteLastPickleballRally,
  type PickleballMatchDetail,
} from "../lib/api/pickleball";
import { createOfflinePointScoring } from "../lib/offlinePointScoring";
import type { Team } from "../lib/pickleballScoring";

export function useMyPickleballMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["pickleballMatches", userId],
    queryFn: () => fetchMyPickleballMatches(userId as string),
    enabled: !!userId,
  });
}

// Offline-aware add/delete/pending-count + the match query itself (which
// flushes any queued points as soon as there's a connection) — see
// offlinePointScoring.ts for why this is shared across the five point/rally
// sports instead of hand-duplicated like their friendlyXError wording.
const offline = createOfflinePointScoring<PickleballMatchDetail>({
  namespace: "pickleball",
  matchQueryKeyPrefix: "pickleballMatch",
  fetchMatch: fetchPickleballMatch,
  // The shared helper's queue only ever stores/replays whatever "winner"
  // string this sport's own UI already validated and passed in, so this
  // narrowing (Team -> string) is safe in practice.
  addPoint: addPickleballRally as (matchId: string, seq: number, winner: string) => Promise<{ id: string }>,
  deleteLastPoint: deleteLastPickleballRally,
  getRows: (detail) => detail.pickleball_rallies,
  setRows: (detail, rows) => ({ ...detail, pickleball_rallies: rows }),
});

export function usePickleballMatch(matchId: string | undefined) {
  return offline.useMatch(matchId);
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
  return offline.useAddPoint(matchId);
}

export function useDeleteLastPickleballRally(matchId: string) {
  return offline.useDeleteLastPoint(matchId);
}

export function usePickleballPendingCount(matchId: string | undefined): number {
  return offline.usePendingPointCount(matchId);
}
