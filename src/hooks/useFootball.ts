import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  fetchMyFootballMatches,
  fetchFootballMatch,
  createFootballMatch,
  startRunningPeriod,
  endRunningPeriod,
  pauseFootballMatch,
  resumeFootballMatch,
  startPenalties,
  completeFootballMatch,
  deleteFootballMatch,
  addFootballGoal,
  deleteLastFootballGoal,
  addPenaltyKick,
  deleteLastPenaltyKick,
  KICKOFF_COLUMN,
  ADDED_MINUTES_COLUMN,
  RUNNING_KICKOFF_COLUMN,
  type RunningPhase,
  type BreakPhase,
  type FootballMatch,
  type FootballMatchDetail,
  type FootballGoalRow,
  type FootballPenaltyKickRow,
} from "../lib/api/football";
import { OFFLINE_PATTERN } from "../lib/friendlyError";
import { fetchMatchWithOfflineFallback } from "../lib/matchSnapshot";
import { enqueue, getQueueForMatch, removeFromQueue, removeLastForMatch, usePendingCount } from "../lib/offlineQueue";
import { useNetworkStore } from "../store/networkStore";
import type { Phase, Team } from "../lib/footballScoring";

// Goals and penalty kicks (the actual scoring events) are offline-capable,
// the same way as the other six sports — see useCricket.ts for the fullest
// writeup of why/how.
const GOAL_NAMESPACE = "football-goal";
const PENALTY_NAMESPACE = "football-penalty";
// Phase/clock actions (half start-end, pause, resume, penalties kickoff,
// final completion) are offline-capable too — they're all just plain field
// writes on the match row, no server logic to replicate. The only wrinkle:
// a couple of them (startRunningPeriod, pauseFootballMatch, completeMatch)
// normally stamp "now" themselves — captured here at tap time instead and
// threaded through explicitly, so a write that's queued for a while still
// lands with the time it actually happened, not whenever it's replayed.
// resumeFootballMatch already takes its timestamp from the caller the same
// way, so it needs no such change.
const PHASE_NAMESPACE = "football-phase";

type GoalPayload = { seq: number; team: Team; phase: Phase; minuteLabel: string; scorerName?: string | null };
type PenaltyPayload = { seq: number; team: Team; scored: boolean };

type QueuedFootballPhasePayload =
  | { type: "startRunningPeriod"; phase: Exclude<RunningPhase, "FIRST_HALF">; startedAt: string }
  | { type: "endRunningPeriod"; endingPhase: RunningPhase; addedMinutes: number; resultingPhase: BreakPhase }
  | { type: "pause"; pausedAt: string }
  | { type: "resume"; phase: RunningPhase; newKickoffAt: string }
  | { type: "startPenalties" }
  | { type: "complete"; completion: { winnerTeam: Team | null; isDraw: boolean; resultSummary: string }; completedAt: string };

function isOfflineError(err: unknown): boolean {
  return err instanceof Error && OFFLINE_PATTERN.test(err.message);
}

// A duplicate-key error on (match_id, seq) can only mean the goal/kick
// already exists on the server — never actually a failure. Treating it as
// one (see useCricket.ts's isDuplicateKeyError for the fuller writeup) used
// to leave scoring stuck: rolling it back made the next tap recompute the
// same "next seq" and hit the same error forever. Treated as success
// instead, same tolerance the reconnect-queue flush already had.
function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message);
}

function goalToRow(payload: GoalPayload, id: string): FootballGoalRow {
  return {
    id,
    match_id: "",
    seq: payload.seq,
    team: payload.team,
    phase: payload.phase,
    minute_label: payload.minuteLabel,
    scorer_name: payload.scorerName ?? null,
    created_at: new Date().toISOString(),
  };
}

function penaltyToRow(payload: PenaltyPayload, id: string): FootballPenaltyKickRow {
  return {
    id,
    match_id: "",
    seq: payload.seq,
    team: payload.team,
    scored: payload.scored,
    created_at: new Date().toISOString(),
  };
}

function patchGoals(qc: QueryClient, matchId: string, update: (rows: FootballGoalRow[]) => FootballGoalRow[]) {
  qc.setQueryData<FootballMatchDetail>(["footballMatch", matchId], (old) =>
    old ? { ...old, football_goals: update(old.football_goals) } : old
  );
}

function patchPenalties(qc: QueryClient, matchId: string, update: (rows: FootballPenaltyKickRow[]) => FootballPenaltyKickRow[]) {
  qc.setQueryData<FootballMatchDetail>(["footballMatch", matchId], (old) =>
    old ? { ...old, football_penalty_kicks: update(old.football_penalty_kicks) } : old
  );
}

function patchFootballMatch(qc: QueryClient, matchId: string, partial: Partial<FootballMatch>): void {
  qc.setQueryData<FootballMatchDetail>(["footballMatch", matchId], (old) => (old ? { ...old, ...partial } : old));
}

// Only used for completeFootballMatch — moving status to COMPLETED needs to
// be reflected on every cached "my matches" list (any userId — partial key
// match) too, or the list keeps showing it as live while offline, which
// also means tapping back into it from there routes to live scoring (and
// lets you keep "playing" an already-finished match) instead of the
// read-only final scorecard the list's own status decides between.
function patchFootballMatchList(qc: QueryClient, matchId: string, partial: Partial<FootballMatch>): void {
  qc.setQueriesData<FootballMatchDetail[]>({ queryKey: ["footballMatches"], exact: false }, (old) =>
    old ? old.map((m) => (m.id === matchId ? { ...m, ...partial } : m)) : old
  );
}

// Runs before flushFootballQueues (goals/penalties) on every reconnect —
// phase state (which half is running, whether penalties have started) is
// what goals/penalties are scored against, so it has to land first.
async function flushFootballPhaseQueue(qc: QueryClient, matchId: string): Promise<void> {
  const items = await getQueueForMatch<QueuedFootballPhasePayload>(PHASE_NAMESPACE, matchId);
  if (items.length === 0) return;
  let flushedAny = false;
  for (const item of items) {
    try {
      const p = item.payload;
      switch (p.type) {
        case "startRunningPeriod":
          await startRunningPeriod(matchId, p.phase, p.startedAt);
          break;
        case "endRunningPeriod":
          await endRunningPeriod(matchId, p.endingPhase, p.addedMinutes, p.resultingPhase);
          break;
        case "pause":
          await pauseFootballMatch(matchId, p.pausedAt);
          break;
        case "resume":
          await resumeFootballMatch(matchId, p.phase, p.newKickoffAt);
          break;
        case "startPenalties":
          await startPenalties(matchId);
          break;
        case "complete":
          await completeFootballMatch(matchId, p.completion, p.completedAt);
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
  if (flushedAny) {
    qc.invalidateQueries({ queryKey: ["footballMatch", matchId] });
    qc.invalidateQueries({ queryKey: ["footballMatches"] });
  }
}

async function flushFootballQueues(qc: QueryClient, matchId: string): Promise<void> {
  let flushedAny = false;

  const goals = await getQueueForMatch<GoalPayload>(GOAL_NAMESPACE, matchId);
  for (const item of goals) {
    try {
      await addFootballGoal(matchId, item.payload.seq, item.payload.team, item.payload.phase, item.payload.minuteLabel, item.payload.scorerName);
      await removeFromQueue(GOAL_NAMESPACE, item.localId);
      flushedAny = true;
    } catch (err) {
      if (err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message)) {
        await removeFromQueue(GOAL_NAMESPACE, item.localId);
        flushedAny = true;
        continue;
      }
      break;
    }
  }

  const penalties = await getQueueForMatch<PenaltyPayload>(PENALTY_NAMESPACE, matchId);
  for (const item of penalties) {
    try {
      await addPenaltyKick(matchId, item.payload.seq, item.payload.team, item.payload.scored);
      await removeFromQueue(PENALTY_NAMESPACE, item.localId);
      flushedAny = true;
    } catch (err) {
      if (err instanceof Error && /duplicate key value|violates unique constraint/i.test(err.message)) {
        await removeFromQueue(PENALTY_NAMESPACE, item.localId);
        flushedAny = true;
        continue;
      }
      break;
    }
  }

  if (flushedAny) qc.invalidateQueries({ queryKey: ["footballMatch", matchId] });
}

export function useMyFootballMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["footballMatches", userId],
    queryFn: () => fetchMyFootballMatches(userId as string),
    enabled: !!userId,
  });
}

export function useFootballMatch(matchId: string | undefined) {
  const qc = useQueryClient();
  const isOnline = useNetworkStore((s) => s.isOnline);

  useEffect(() => {
    if (!matchId || !isOnline) return;
    flushFootballPhaseQueue(qc, matchId).then(() => flushFootballQueues(qc, matchId));
  }, [isOnline, matchId, qc]);

  const queryKey = ["footballMatch", matchId];
  return useQuery({
    queryKey,
    queryFn: () => fetchMatchWithOfflineFallback("football", matchId as string, queryKey, qc, () => fetchFootballMatch(matchId as string)),
    enabled: !!matchId,
    staleTime: 0,
    retry: (failureCount, err) => !isOfflineError(err) && failureCount < 2,
  });
}

export function useCreateFootballMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createFootballMatch,
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ["footballMatches", params.userId] });
    },
  });
}

// Offline-aware, same recipe as every scoring mutation in this file: patch
// the match row immediately, try the real write, and only queue it
// (instead of erroring) if that fails for lack of a connection. Shared by
// all six phase actions below — each just supplies its own optimistic
// patch, its real API call, and (when it needs one — see
// QueuedFootballPhasePayload) a tap-time-captured timestamp.
function useFootballPhaseMutation<TArgs>(
  matchId: string,
  optimisticPatch: (qc: QueryClient, args: TArgs) => void,
  toQueuePayload: (args: TArgs) => QueuedFootballPhasePayload,
  realCall: (args: TArgs) => Promise<void>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs): Promise<{ synced: boolean }> => {
      optimisticPatch(qc, args);

      if (!useNetworkStore.getState().isOnline) {
        await enqueue<QueuedFootballPhasePayload>(PHASE_NAMESPACE, matchId, toQueuePayload(args));
        return { synced: false };
      }
      try {
        await realCall(args);
        return { synced: true };
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue<QueuedFootballPhasePayload>(PHASE_NAMESPACE, matchId, toQueuePayload(args));
          return { synced: false };
        }
        // A genuine failure rolls back by re-fetching — these patches touch
        // several interdependent columns at once, so re-deriving "what it
        // was before" here would just be fetchFootballMatch all over again.
        qc.invalidateQueries({ queryKey: ["footballMatch", matchId] });
        throw err;
      }
    },
    onSuccess: ({ synced }) => {
      if (!synced) return;
      qc.invalidateQueries({ queryKey: ["footballMatch", matchId] });
      // Every goal/phase/completion change also has to be reflected on the
      // match list card (score, LIVE/COMPLETED badge, phase label) — the
      // other five sports' equivalent hooks invalidate both queries too.
      qc.invalidateQueries({ queryKey: ["footballMatches"] });
    },
  });
}

export function useStartRunningPeriod(matchId: string) {
  return useFootballPhaseMutation<Exclude<RunningPhase, "FIRST_HALF">>(
    matchId,
    (qc, phase) => {
      const startedAt = new Date().toISOString();
      patchFootballMatch(qc, matchId, { phase, [KICKOFF_COLUMN[phase]]: startedAt, paused_at: startedAt } as Partial<FootballMatch>);
    },
    (phase) => ({ type: "startRunningPeriod", phase, startedAt: new Date().toISOString() }),
    (phase) => startRunningPeriod(matchId, phase)
  );
}

export function useEndRunningPeriod(matchId: string) {
  return useFootballPhaseMutation<{ endingPhase: RunningPhase; addedMinutes: number; resultingPhase: BreakPhase }>(
    matchId,
    (qc, args) =>
      patchFootballMatch(qc, matchId, {
        phase: args.resultingPhase,
        [ADDED_MINUTES_COLUMN[args.endingPhase]]: args.addedMinutes,
      } as Partial<FootballMatch>),
    (args) => ({ type: "endRunningPeriod", ...args }),
    (args) => endRunningPeriod(matchId, args.endingPhase, args.addedMinutes, args.resultingPhase)
  );
}

export function usePauseFootballMatch(matchId: string) {
  return useFootballPhaseMutation<void>(
    matchId,
    (qc) => patchFootballMatch(qc, matchId, { paused_at: new Date().toISOString() }),
    () => ({ type: "pause", pausedAt: new Date().toISOString() }),
    () => pauseFootballMatch(matchId)
  );
}

export function useResumeFootballMatch(matchId: string) {
  return useFootballPhaseMutation<{ phase: RunningPhase; newKickoffAt: string }>(
    matchId,
    (qc, args) =>
      patchFootballMatch(qc, matchId, { [RUNNING_KICKOFF_COLUMN[args.phase]]: args.newKickoffAt, paused_at: null } as Partial<FootballMatch>),
    (args) => ({ type: "resume", ...args }),
    (args) => resumeFootballMatch(matchId, args.phase, args.newKickoffAt)
  );
}

export function useStartPenalties(matchId: string) {
  return useFootballPhaseMutation<void>(
    matchId,
    (qc) => patchFootballMatch(qc, matchId, { phase: "PENALTIES" }),
    () => ({ type: "startPenalties" }),
    () => startPenalties(matchId)
  );
}

export function useCompleteFootballMatch(matchId: string) {
  return useFootballPhaseMutation<{ winnerTeam: Team | null; isDraw: boolean; resultSummary: string }>(
    matchId,
    (qc, completion) => {
      const partial: Partial<FootballMatch> = {
        phase: "COMPLETE",
        status: "COMPLETED",
        winner_team: completion.winnerTeam,
        is_draw: completion.isDraw,
        result_summary: completion.resultSummary,
        completed_at: new Date().toISOString(),
      };
      patchFootballMatch(qc, matchId, partial);
      patchFootballMatchList(qc, matchId, partial);
    },
    (completion) => ({ type: "complete", completion, completedAt: new Date().toISOString() }),
    (completion) => completeFootballMatch(matchId, completion)
  );
}

export function useDeleteFootballMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deleteFootballMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["footballMatches"] }),
  });
}

// Offline-aware, same recipe as every other sport's scoring mutation:
// reflect it immediately, try the real insert, queue it locally only if
// that fails for lack of a connection.
// Returns whether this actually reached the server — invalidating (and so
// refetching) when it didn't would ask fetchFootballMatch for fresh data it
// can't get, and its offline fallback is the last snapshot from *before*
// this goal/kick, which would overwrite the optimistic add above with stale
// data the instant it lands. Only a real sync should trigger a refetch; a
// queued one leaves the optimistic cache entry as-is, exactly like every
// other queued event already sitting in it.
export function useAddFootballGoal(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    // A synced goal swaps its placeholder id for the real one in place
    // instead of invalidating the single-match detail — see
    // useCricketMatch's addCricketBall for why (racing refetches from
    // consecutive goals could resolve out of order and briefly revert the
    // score). The match list's score display isn't part of that race
    // (different query), so it still just invalidates normally below.
    mutationFn: async (args: GoalPayload): Promise<void> => {
      const placeholderId = `pending-goal-${args.seq}`;
      patchGoals(qc, matchId, (rows) => [...rows, { ...goalToRow(args, placeholderId), match_id: matchId }]);

      if (!useNetworkStore.getState().isOnline) {
        await enqueue<GoalPayload>(GOAL_NAMESPACE, matchId, args);
        return;
      }
      try {
        const { id } = await addFootballGoal(matchId, args.seq, args.team, args.phase, args.minuteLabel, args.scorerName);
        patchGoals(qc, matchId, (rows) => rows.map((r) => (r.seq === args.seq ? { ...r, id } : r)));
        qc.invalidateQueries({ queryKey: ["footballMatches"] });
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue<GoalPayload>(GOAL_NAMESPACE, matchId, args);
          return;
        }
        if (isDuplicateKeyError(err)) return;
        patchGoals(qc, matchId, (rows) => rows.filter((r) => r.seq !== args.seq));
        throw err;
      }
    },
  });
}

export function useDeleteLastFootballGoal(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seq: number): Promise<{ synced: boolean }> => {
      const removed = await removeLastForMatch<GoalPayload>(GOAL_NAMESPACE, matchId);
      if (removed) {
        patchGoals(qc, matchId, (rows) => rows.filter((r) => r.seq !== removed.payload.seq));
        return { synced: false };
      }
      await deleteLastFootballGoal(matchId, seq);
      return { synced: true };
    },
    onSuccess: ({ synced }) => {
      if (!synced) return;
      qc.invalidateQueries({ queryKey: ["footballMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["footballMatches"] });
    },
  });
}

export function useAddPenaltyKick(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Same id-swap-instead-of-invalidate reasoning as useAddFootballGoal.
    mutationFn: async (args: PenaltyPayload): Promise<void> => {
      const placeholderId = `pending-pk-${args.seq}`;
      patchPenalties(qc, matchId, (rows) => [...rows, { ...penaltyToRow(args, placeholderId), match_id: matchId }]);

      if (!useNetworkStore.getState().isOnline) {
        await enqueue<PenaltyPayload>(PENALTY_NAMESPACE, matchId, args);
        return;
      }
      try {
        const { id } = await addPenaltyKick(matchId, args.seq, args.team, args.scored);
        patchPenalties(qc, matchId, (rows) => rows.map((r) => (r.seq === args.seq ? { ...r, id } : r)));
        qc.invalidateQueries({ queryKey: ["footballMatches"] });
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue<PenaltyPayload>(PENALTY_NAMESPACE, matchId, args);
          return;
        }
        if (isDuplicateKeyError(err)) return;
        patchPenalties(qc, matchId, (rows) => rows.filter((r) => r.seq !== args.seq));
        throw err;
      }
    },
  });
}

export function useDeleteLastPenaltyKick(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seq: number): Promise<{ synced: boolean }> => {
      const removed = await removeLastForMatch<PenaltyPayload>(PENALTY_NAMESPACE, matchId);
      if (removed) {
        patchPenalties(qc, matchId, (rows) => rows.filter((r) => r.seq !== removed.payload.seq));
        return { synced: false };
      }
      await deleteLastPenaltyKick(matchId, seq);
      return { synced: true };
    },
    onSuccess: ({ synced }) => {
      if (!synced) return;
      qc.invalidateQueries({ queryKey: ["footballMatch", matchId] });
      qc.invalidateQueries({ queryKey: ["footballMatches"] });
    },
  });
}

// Live count of this match's not-yet-synced goals + penalty kicks, for the
// scoring screen's "Offline — N pending" banner.
export function useFootballPendingCount(matchId: string | undefined): number {
  const goals = usePendingCount(GOAL_NAMESPACE, matchId);
  const penalties = usePendingCount(PENALTY_NAMESPACE, matchId);
  const phase = usePendingCount(PHASE_NAMESPACE, matchId);
  return goals + penalties + phase;
}
