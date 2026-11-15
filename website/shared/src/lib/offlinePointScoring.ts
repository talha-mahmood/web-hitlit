import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { OFFLINE_PATTERN } from "./friendlyError";
import { fetchMatchWithOfflineFallback } from "./matchSnapshot";
import { enqueue, getQueueForMatch, removeFromQueue, removeLastForMatch, usePendingCount } from "./offlineQueue";
import { useNetworkStore } from "../store/networkStore";

// Shared offline-scoring machinery for the five point/rally-based sports
// (tennis, padel, badminton, pickleball, table tennis) — unlike their
// per-sport friendlyXError wording (deliberately duplicated so "ball" vs
// "rally" vs "point" reads right), the actual add/undo/offline-queue/
// optimistic-update logic is byte-for-byte identical across all five: one
// row per point with a plain (match_id, seq) insert and a matching unique
// constraint, same as cricket_balls — so it lives here once instead of
// five times. Cricket keeps its own copy (useCricket.ts) since its ball
// payload is a whole object, not a single "winner" value, and its query
// shape (innings -> balls) doesn't fit this one.
type PointRow = { id: string; match_id: string; seq: number; winner: string; created_at: string };

function isOfflineError(err: unknown): boolean {
  return err instanceof Error && OFFLINE_PATTERN.test(err.message);
}

// A duplicate-key error on (match_id, seq) can only mean the point already
// exists on the server — never actually a failure. Treating it as one (see
// useCricket.ts's isDuplicateKeyError for the fuller writeup) used to leave
// scoring stuck: rolling the point back made the next tap recompute the
// same "next seq" and hit the same error forever. Treated as success
// instead, same tolerance the reconnect-queue flush already had.
function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message);
}

export function createOfflinePointScoring<Detail>(config: {
  // "tennis" | "padel" | "badminton" | "pickleball" | "tableTennis" — keeps
  // each sport's offline queue and AsyncStorage snapshot separate.
  namespace: string;
  matchQueryKeyPrefix: string; // "tennisMatch", so the key is [prefix, matchId]
  fetchMatch: (matchId: string) => Promise<Detail>;
  addPoint: (matchId: string, seq: number, winner: string) => Promise<{ id: string }>;
  deleteLastPoint: (matchId: string, seq: number) => Promise<void>;
  // Reads/writes the sport's own points array on its own Detail shape
  // (tennis_points, padel_points, badminton_rallies, ...) — the one place
  // each sport's hook has to supply something sport-specific.
  getRows: (detail: Detail) => PointRow[];
  setRows: (detail: Detail, rows: PointRow[]) => Detail;
}) {
  const { namespace, matchQueryKeyPrefix, fetchMatch, addPoint, deleteLastPoint, getRows, setRows } = config;
  type Payload = { seq: number; winner: string };

  function patchRows(qc: QueryClient, matchId: string, update: (rows: PointRow[]) => PointRow[]) {
    qc.setQueryData<Detail>([matchQueryKeyPrefix, matchId], (old) => {
      if (!old) return old;
      return setRows(old, update(getRows(old)));
    });
  }

  async function flushQueue(qc: QueryClient, matchId: string): Promise<void> {
    const items = await getQueueForMatch<Payload>(namespace, matchId);
    if (items.length === 0) return;
    let flushedAny = false;
    for (const item of items) {
      try {
        await addPoint(matchId, item.payload.seq, item.payload.winner);
        await removeFromQueue(namespace, item.localId);
        flushedAny = true;
      } catch (err) {
        if (err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message)) {
          await removeFromQueue(namespace, item.localId);
          flushedAny = true;
          continue;
        }
        break; // still offline, or a real error — stop, don't reorder points
      }
    }
    if (flushedAny) qc.invalidateQueries({ queryKey: [matchQueryKeyPrefix, matchId] });
  }

  function useMatch(matchId: string | undefined, options?: Partial<UseQueryOptions<Detail>>) {
    const qc = useQueryClient();
    const isOnline = useNetworkStore((s) => s.isOnline);

    useEffect(() => {
      if (matchId && isOnline) flushQueue(qc, matchId);
    }, [isOnline, matchId, qc]);

    const queryKey = [matchQueryKeyPrefix, matchId];
    return useQuery({
      queryKey,
      queryFn: () => fetchMatchWithOfflineFallback(namespace, matchId as string, queryKey, qc, () => fetchMatch(matchId as string)),
      enabled: !!matchId,
      staleTime: 0,
      retry: (failureCount, err) => !isOfflineError(err) && failureCount < 2,
      ...options,
    });
  }

  // Offline-aware: reflects the point in the UI immediately regardless of
  // connectivity, tries the real insert, and queues it locally (instead of
  // erroring) only when that fails specifically because there's no
  // connection — scoring continues point after point with no signal at all.
  function useAddPoint(matchId: string) {
    const qc = useQueryClient();
    return useMutation({
      // Invalidating (and so refetching) on every successful sync used to
      // both: (a) ask fetchMatch for fresh data it can't get while offline,
      // falling back to a stale snapshot that overwrote this optimistic add
      // the instant it landed, and (b) even online, race a *second*
      // refetch from whichever point got tapped next — two overlapping
      // "give me the whole match" requests can resolve out of order, and
      // whichever (possibly older) one lands last would briefly overwrite a
      // newer point with a response that doesn't have it yet. Since the
      // optimistic row added above is already correct in every way that
      // actually affects the score (replay goes by its content, not its
      // id), a synced point now just has its placeholder id swapped for the
      // real one instead — no refetch, no race, nothing to revert. A queued
      // (offline) one leaves the optimistic entry exactly as it is.
      mutationFn: async ({ seq, winner }: Payload): Promise<void> => {
        const placeholderId = `pending-${matchId}-${seq}`;
        patchRows(qc, matchId, (rows) => [
          ...rows,
          { id: placeholderId, match_id: matchId, seq, winner, created_at: new Date().toISOString() },
        ]);

        if (!useNetworkStore.getState().isOnline) {
          await enqueue<Payload>(namespace, matchId, { seq, winner });
          return;
        }
        try {
          const { id } = await addPoint(matchId, seq, winner);
          patchRows(qc, matchId, (rows) => rows.map((r) => (r.seq === seq ? { ...r, id } : r)));
        } catch (err) {
          if (isOfflineError(err)) {
            await enqueue<Payload>(namespace, matchId, { seq, winner });
            return;
          }
          if (isDuplicateKeyError(err)) return;
          patchRows(qc, matchId, (rows) => rows.filter((r) => r.seq !== seq));
          throw err;
        }
      },
    });
  }

  // Undoing a point that's still only queued locally just drops it from the
  // queue and the optimistic row — no network call, works offline. Undoing
  // an already-synced point still needs a connection, like every other write.
  function useDeleteLastPoint(matchId: string) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (seq: number): Promise<{ synced: boolean }> => {
        const removed = await removeLastForMatch<Payload>(namespace, matchId);
        if (removed) {
          patchRows(qc, matchId, (rows) => rows.filter((r) => r.seq !== removed.payload.seq));
          return { synced: false };
        }
        await deleteLastPoint(matchId, seq);
        return { synced: true };
      },
      onSuccess: ({ synced }) => {
        if (synced) qc.invalidateQueries({ queryKey: [matchQueryKeyPrefix, matchId] });
      },
    });
  }

  function usePendingPointCount(matchId: string | undefined): number {
    return usePendingCount(namespace, matchId);
  }

  return { useMatch, useAddPoint, useDeleteLastPoint, usePendingPointCount };
}
