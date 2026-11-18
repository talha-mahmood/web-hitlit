import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyTableTennisMatches,
  fetchTableTennisMatch,
  createTableTennisMatch,
  completeTableTennisMatch,
  deleteTableTennisMatch,
  addTableTennisRally,
  deleteLastTableTennisRally,
  type TableTennisMatchDetail,
} from "../lib/api/tableTennis";
import { createOfflinePointScoring } from "../lib/offlinePointScoring";
import type { Team } from "../lib/tableTennisScoring";

export function useMyTableTennisMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["tableTennisMatches", userId],
    queryFn: () => fetchMyTableTennisMatches(userId as string),
    enabled: !!userId,
  });
}

// Offline-aware add/delete/pending-count + the match query itself (which
// flushes any queued points as soon as there's a connection) — see
// offlinePointScoring.ts for why this is shared across the five point/rally
// sports instead of hand-duplicated like their friendlyXError wording.
const offline = createOfflinePointScoring<TableTennisMatchDetail>({
  namespace: "tableTennis",
  matchQueryKeyPrefix: "tableTennisMatch",
  fetchMatch: fetchTableTennisMatch,
  // The shared helper's queue only ever stores/replays whatever "winner"
  // string this sport's own UI already validated and passed in, so this
  // narrowing (Team -> string) is safe in practice.
  addPoint: addTableTennisRally as (matchId: string, seq: number, winner: string) => Promise<{ id: string }>,
  deleteLastPoint: deleteLastTableTennisRally,
  getRows: (detail) => detail.table_tennis_rallies,
  setRows: (detail, rows) => ({ ...detail, table_tennis_rallies: rows }),
});

export function useTableTennisMatch(matchId: string | undefined) {
  return offline.useMatch(matchId);
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
  return offline.useAddPoint(matchId);
}

export function useDeleteLastTableTennisRally(matchId: string) {
  return offline.useDeleteLastPoint(matchId);
}

export function useTableTennisPendingCount(matchId: string | undefined): number {
  return offline.usePendingPointCount(matchId);
}
