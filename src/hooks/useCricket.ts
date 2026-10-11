import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  fetchMyCricketMatches,
  fetchCricketMatch,
  createCricketMatch,
  startSecondInnings,
  markInningsComplete,
  completeCricketMatch,
  deleteCricketMatch,
  addCricketBall,
  deleteLastCricketBall,
  abandonCricketMatch,
  addRosterPlayer,
  updateCricketMatchSettings,
  type CricketMatchDetail,
  type CricketBallRow,
  type CricketMatchSettingsUpdate,
} from "../lib/api/cricket";
import { OFFLINE_PATTERN } from "../lib/friendlyError";
import { fetchMatchWithOfflineFallback } from "../lib/matchSnapshot";
import { enqueue, getQueueForMatch, removeFromQueue, removeLastForMatch, usePendingCount } from "../lib/offlineQueue";
import { useNetworkStore } from "../store/networkStore";
import { uuidv4 } from "../lib/uuid";
import type { BallEvent } from "../lib/cricketScoring";

const QUEUE_NAMESPACE = "cricket";
// Separate from the ball queue (and flushed before it — see
// useCricketMatch) since a ball belonging to a 2nd innings that was itself
// started offline can't sync until that innings' own "start" write has.
const PHASE_NAMESPACE = "cricket-phase";

type QueuedBallPayload = { inningsId: string; seq: number; ball: BallEvent };

// Mark-innings-complete, start-2nd-innings, and complete-match are each
// simple field writes (no wall-clock math to get wrong by replaying late,
// unlike some of football's phase actions — see useFootball.ts), so they're
// just as safely queueable as a ball. The one real wrinkle: starting the
// 2nd innings while offline has to hand out its row's id up front (instead
// of waiting on the server to generate one, the normal way) so that any
// balls scored in that innings before it's actually synced can reference an
// id that will still be correct once it is — see startSecondInnings's
// optional id param.
type QueuedPhasePayload =
  | { type: "markComplete"; inningsId: string }
  | { type: "startSecond"; inningsId: string; battingTeam: "A" | "B" }
  | { type: "completeMatch"; resultSummary: string; completedAt: string };

function isOfflineError(err: unknown): boolean {
  return err instanceof Error && OFFLINE_PATTERN.test(err.message);
}

// A duplicate-key error on (innings_id, seq) can only mean one thing: a
// ball with this exact seq already exists on the server. Whatever caused
// that — a retried request, a refetch landing a beat later than expected —
// the ball is safely recorded either way, so this is never actually a
// failure a user should see. Treating it as one (rolling the optimistic
// ball back and showing an error) used to leave scoring stuck: the next tap
// recomputes the same "next seq" from the now-wrongly-shortened ball list,
// hits the same duplicate-key error, rolls back again, forever. Treated as
// success instead, same tolerance the reconnect-queue flush already had.
function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message);
}

function ballEventToRow(inningsId: string, ball: BallEvent, id: string): CricketBallRow {
  return {
    // A placeholder until the insert confirms and its real id is swapped in
    // — never read anywhere ballEvents is derived (that goes by seq).
    id,
    innings_id: inningsId,
    seq: ball.seq,
    striker_name: ball.strikerName,
    non_striker_name: ball.nonStrikerName,
    bowler_name: ball.bowlerName,
    runs_batted: ball.runsBatted,
    extra_type: ball.extraType,
    extra_runs: ball.extraRuns,
    is_wicket: ball.isWicket,
    wicket_type: ball.wicketType,
    dismissed_name: ball.dismissedName,
    fielder_name: ball.fielderName,
    fielder2_name: ball.fielderName2 ?? null,
    created_at: new Date().toISOString(),
  };
}

// Splices a ball straight into the cached match so the scoring screen (and
// the ball-by-ball replay that derives overs/score/striker from it) reflects
// it the instant it's tapped — never waiting on a round trip, successful or
// not. Removing one on rollback is the same shape, minus the push.
function patchInningsBalls(
  qc: QueryClient,
  matchId: string,
  inningsId: string,
  update: (balls: CricketBallRow[]) => CricketBallRow[]
): void {
  qc.setQueryData<CricketMatchDetail>(["cricketMatch", matchId], (old) => {
    if (!old) return old;
    return {
      ...old,
      cricket_innings: old.cricket_innings.map((inn) =>
        inn.id === inningsId ? { ...inn, cricket_balls: update(inn.cricket_balls) } : inn
      ),
    };
  });
}

function patchMarkInningsComplete(qc: QueryClient, matchId: string, inningsId: string): void {
  qc.setQueryData<CricketMatchDetail>(["cricketMatch", matchId], (old) => {
    if (!old) return old;
    return {
      ...old,
      cricket_innings: old.cricket_innings.map((inn) => (inn.id === inningsId ? { ...inn, is_completed: true } : inn)),
    };
  });
}

function patchStartSecondInnings(qc: QueryClient, matchId: string, inningsId: string, battingTeam: "A" | "B"): void {
  qc.setQueryData<CricketMatchDetail>(["cricketMatch", matchId], (old) => {
    if (!old || old.cricket_innings.some((inn) => inn.id === inningsId)) return old;
    return {
      ...old,
      cricket_innings: [
        ...old.cricket_innings,
        { id: inningsId, match_id: matchId, innings_number: 2, batting_team: battingTeam, is_completed: false, cricket_balls: [] },
      ],
    };
  });
}

function patchCompleteMatch(qc: QueryClient, matchId: string, resultSummary: string, completedAt: string): void {
  const update = (m: CricketMatchDetail): CricketMatchDetail => ({
    ...m,
    status: "COMPLETED",
    result_summary: resultSummary,
    completed_at: completedAt,
  });
  qc.setQueryData<CricketMatchDetail>(["cricketMatch", matchId], (old) => (old ? update(old) : old));
  // Also patch every cached "my matches" list (any userId — partial key
  // match) so it immediately moves this match from the Live tab to
  // Completed, same as the single-match screen. Missing this left the list
  // showing it as still live while offline, which also meant tapping back
  // into it routed to LiveScoring (and let you keep "scoring" an already
  // finished match) instead of the read-only final scorecard — the list's
  // own status is what that tap decision is based on.
  qc.setQueriesData<CricketMatchDetail[]>({ queryKey: ["cricketMatches"], exact: false }, (old) =>
    old ? old.map((m) => (m.id === matchId ? update(m) : m)) : old
  );
}

// Runs before flushCricketQueue (balls) on every reconnect — a ball queued
// against a 2nd innings that was itself started offline references that
// innings' client-generated id (see QueuedPhasePayload above), which only
// becomes valid server-side once this has gone out, so these always have to
// land first.
async function flushCricketPhaseQueue(qc: QueryClient, matchId: string): Promise<void> {
  const items = await getQueueForMatch<QueuedPhasePayload>(PHASE_NAMESPACE, matchId);
  if (items.length === 0) return;
  let flushedAny = false;
  for (const item of items) {
    try {
      switch (item.payload.type) {
        case "markComplete":
          await markInningsComplete(item.payload.inningsId);
          break;
        case "startSecond":
          await startSecondInnings(matchId, item.payload.battingTeam, item.payload.inningsId);
          break;
        case "completeMatch":
          await completeCricketMatch(matchId, item.payload.resultSummary, item.payload.completedAt);
          break;
      }
      await removeFromQueue(PHASE_NAMESPACE, item.localId);
      flushedAny = true;
    } catch (err) {
      if (err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message)) {
        await removeFromQueue(PHASE_NAMESPACE, item.localId);
        flushedAny = true;
        continue;
      }
      break; // still offline, or a real error — stop, preserve order
    }
  }
  if (flushedAny) qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
}

// Replays any writes left over from a previous offline session (or ones
// that piled up while this screen's been open without a connection) in
// order, as soon as there's a connection to send them on. A duplicate-key
// response means an earlier attempt actually landed despite looking like it
// failed — treated the same as success rather than surfaced as an error.
// Stops at the first genuine (non-connectivity) failure and leaves the rest
// queued rather than risk reordering balls by skipping one.
async function flushCricketQueue(qc: QueryClient, matchId: string): Promise<void> {
  const items = await getQueueForMatch<QueuedBallPayload>(QUEUE_NAMESPACE, matchId);
  if (items.length === 0) return;
  let flushedAny = false;
  for (const item of items) {
    try {
      await addCricketBall(item.payload.inningsId, item.payload.seq, item.payload.ball);
      await removeFromQueue(QUEUE_NAMESPACE, item.localId);
      flushedAny = true;
    } catch (err) {
      if (err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message)) {
        await removeFromQueue(QUEUE_NAMESPACE, item.localId);
        flushedAny = true;
        continue;
      }
      // Still offline, or a real error — either way, stop here so later
      // balls never get sent out of order ahead of this one.
      break;
    }
  }
  if (flushedAny) qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
}

export function useMyCricketMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["cricketMatches", userId],
    queryFn: () => fetchMyCricketMatches(userId as string),
    enabled: !!userId,
  });
}

export function useCricketMatch(matchId: string | undefined) {
  const qc = useQueryClient();
  const isOnline = useNetworkStore((s) => s.isOnline);

  // Covers both: (a) reopening this match screen with leftover queued balls
  // from an earlier offline session, and (b) the connection coming back
  // while the screen is already open.
  useEffect(() => {
    if (!matchId || !isOnline) return;
    // Phase actions (starting the 2nd innings, etc.) first — a queued ball
    // can depend on one of those having landed, never the other way round.
    flushCricketPhaseQueue(qc, matchId).then(() => flushCricketQueue(qc, matchId));
  }, [isOnline, matchId, qc]);

  const queryKey = ["cricketMatch", matchId];
  return useQuery({
    queryKey,
    queryFn: () => fetchMatchWithOfflineFallback("cricket", matchId as string, queryKey, qc, () => fetchCricketMatch(matchId as string)),
    enabled: !!matchId,
    staleTime: 0,
    // Offline, this would otherwise retry a few times (burning time against
    // a dead connection) before falling back — fail straight to that
    // fallback instead.
    retry: (failureCount, err) => !isOfflineError(err) && failureCount < 2,
  });
}

export function useCreateCricketMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCricketMatch,
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ["cricketMatches", params.userId] });
    },
  });
}

// Offline-aware, same recipe as the ball mutations above: patch the cache
// immediately, try the real write, and only queue it (instead of erroring)
// if that fails for lack of a connection. The 2nd innings' row id is
// generated here rather than waiting on the server, so it's already correct
// — and ball-scoring can already reference it — even if this hasn't synced
// yet. See QueuedPhasePayload for why this has to flush before any ball
// queued against that id.
export function useStartSecondInnings(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (battingTeam: "A" | "B"): Promise<{ synced: boolean; inningsId: string }> => {
      const inningsId = uuidv4();
      patchStartSecondInnings(qc, matchId, inningsId, battingTeam);

      if (!useNetworkStore.getState().isOnline) {
        await enqueue<QueuedPhasePayload>(PHASE_NAMESPACE, matchId, { type: "startSecond", inningsId, battingTeam });
        return { synced: false, inningsId };
      }
      try {
        await startSecondInnings(matchId, battingTeam, inningsId);
        return { synced: true, inningsId };
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue<QueuedPhasePayload>(PHASE_NAMESPACE, matchId, { type: "startSecond", inningsId, battingTeam });
          return { synced: false, inningsId };
        }
        if (isDuplicateKeyError(err)) return { synced: true, inningsId };
        qc.setQueryData<CricketMatchDetail>(["cricketMatch", matchId], (old) =>
          old ? { ...old, cricket_innings: old.cricket_innings.filter((inn) => inn.id !== inningsId) } : old
        );
        throw err;
      }
    },
    onSuccess: ({ synced }) => {
      if (synced) qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
    },
  });
}

export function useMarkInningsComplete(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inningsId: string): Promise<{ synced: boolean }> => {
      patchMarkInningsComplete(qc, matchId, inningsId);

      if (!useNetworkStore.getState().isOnline) {
        await enqueue<QueuedPhasePayload>(PHASE_NAMESPACE, matchId, { type: "markComplete", inningsId });
        return { synced: false };
      }
      try {
        await markInningsComplete(inningsId);
        return { synced: true };
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue<QueuedPhasePayload>(PHASE_NAMESPACE, matchId, { type: "markComplete", inningsId });
          return { synced: false };
        }
        qc.setQueryData<CricketMatchDetail>(["cricketMatch", matchId], (old) =>
          old
            ? {
                ...old,
                cricket_innings: old.cricket_innings.map((inn) => (inn.id === inningsId ? { ...inn, is_completed: false } : inn)),
              }
            : old
        );
        throw err;
      }
    },
    onSuccess: ({ synced }) => {
      if (synced) qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
    },
  });
}

export function useCompleteCricketMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, resultSummary }: { matchId: string; resultSummary: string }): Promise<{ synced: boolean; matchId: string }> => {
      const completedAt = new Date().toISOString();
      patchCompleteMatch(qc, matchId, resultSummary, completedAt);

      if (!useNetworkStore.getState().isOnline) {
        await enqueue<QueuedPhasePayload>(PHASE_NAMESPACE, matchId, { type: "completeMatch", resultSummary, completedAt });
        return { synced: false, matchId };
      }
      try {
        await completeCricketMatch(matchId, resultSummary, completedAt);
        return { synced: true, matchId };
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue<QueuedPhasePayload>(PHASE_NAMESPACE, matchId, { type: "completeMatch", resultSummary, completedAt });
          return { synced: false, matchId };
        }
        throw err;
      }
    },
    onSuccess: ({ synced, matchId }) => {
      if (!synced) return;
      qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["cricketMatches"] });
    },
  });
}

export function useDeleteCricketMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deleteCricketMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cricketMatches"] }),
  });
}

// Match Centre > More > Abandon. Online-only, same as useDeleteCricketMatch
// above — an infrequent management action, not part of the ball-by-ball
// offline-first scoring loop.
export function useAbandonCricketMatch(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => abandonCricketMatch(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["cricketMatches"] });
    },
  });
}

// Match Centre > Select Batsman > Add/Create Player.
export function useAddRosterPlayer(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ team, name, existingPlayers }: { team: "A" | "B"; name: string; existingPlayers: string[] }) =>
      addRosterPlayer(matchId, team, name, existingPlayers),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] }),
  });
}

// Match Centre > More > Overs/Format/Wickets, Change Target, Settings —
// all edit plain cricket_matches columns, so they share one mutation.
export function useUpdateCricketMatchSettings(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: CricketMatchSettingsUpdate) => updateCricketMatchSettings(matchId, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] }),
  });
}

// Offline-aware: always reflects the ball in the UI immediately (regardless
// of connectivity), tries the real insert, and — only when that fails
// specifically because there's no connection — queues it locally instead of
// erroring out, so scoring can continue ball after ball with no signal at
// all. A genuine (non-connectivity) failure rolls the optimistic ball back
// and surfaces normally, same as before this existed.
export function useAddCricketBall(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Used to invalidate (and so refetch) on every successful sync — besides
    // the offline-fallback staleness problem noted elsewhere, refetching
    // after *every single ball* also raced the next ball's own refetch:
    // two overlapping "give me the whole match" requests can resolve out of
    // order, and whichever (possibly older) one lands last would briefly
    // overwrite a newer ball with a response that doesn't have it yet. Since
    // the optimistic row added above is already correct in every way that
    // actually affects the score (runs, overs, wickets all replay from its
    // content, not its id), a synced ball now just has its placeholder id
    // swapped for the real one — no refetch, no race, nothing to revert.
    mutationFn: async ({ inningsId, seq, ball }: QueuedBallPayload): Promise<{ synced: boolean }> => {
      const placeholderId = `pending-${inningsId}-${seq}`;
      patchInningsBalls(qc, matchId, inningsId, (balls) => [...balls, ballEventToRow(inningsId, ball, placeholderId)]);

      if (!useNetworkStore.getState().isOnline) {
        await enqueue<QueuedBallPayload>(QUEUE_NAMESPACE, matchId, { inningsId, seq, ball });
        return { synced: false };
      }
      try {
        const { id } = await addCricketBall(inningsId, seq, ball);
        patchInningsBalls(qc, matchId, inningsId, (balls) => balls.map((b) => (b.seq === seq ? { ...b, id } : b)));
        return { synced: true };
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue<QueuedBallPayload>(QUEUE_NAMESPACE, matchId, { inningsId, seq, ball });
          return { synced: false };
        }
        if (isDuplicateKeyError(err)) return { synced: true };
        patchInningsBalls(qc, matchId, inningsId, (balls) => balls.filter((b) => b.seq !== seq));
        throw err;
      }
    },
  });
}

// Undoing a ball that's still only queued locally (never reached the
// server) just drops it from the queue and the optimistic cache entry —
// works offline, no network call. Undoing an already-synced ball still
// needs a connection, same as every other write.
export function useDeleteLastCricketBall(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ inningsId, seq }: { inningsId: string; seq: number }): Promise<{ synced: boolean }> => {
      const removed = await removeLastForMatch<QueuedBallPayload>(QUEUE_NAMESPACE, matchId);
      if (removed) {
        patchInningsBalls(qc, matchId, inningsId, (balls) => balls.filter((b) => b.seq !== removed.payload.seq));
        return { synced: false };
      }
      await deleteLastCricketBall(inningsId, seq);
      return { synced: true };
    },
    onSuccess: ({ synced }) => {
      if (synced) qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
    },
  });
}

// Live count of this match's not-yet-synced balls, for the scoring screen's
// "Offline — N pending" banner.
export function useCricketPendingCount(matchId: string | undefined): number {
  const balls = usePendingCount(QUEUE_NAMESPACE, matchId);
  const phase = usePendingCount(PHASE_NAMESPACE, matchId);
  return balls + phase;
}
