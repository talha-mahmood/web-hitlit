import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyFootballMatches,
  fetchFootballMatch,
  createFootballMatch,
  startRunningPeriod,
  endRunningPeriod,
  startPenalties,
  completeFootballMatch,
  deleteFootballMatch,
  addFootballGoal,
  deleteLastFootballGoal,
  addPenaltyKick,
  deleteLastPenaltyKick,
  type RunningPhase,
  type BreakPhase,
} from "../lib/api/football";
import type { Phase, Team } from "../lib/footballScoring";

export function useMyFootballMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["footballMatches", userId],
    queryFn: () => fetchMyFootballMatches(userId as string),
    enabled: !!userId,
  });
}

export function useFootballMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["footballMatch", matchId],
    queryFn: () => fetchFootballMatch(matchId as string),
    enabled: !!matchId,
    staleTime: 0,
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

function useFootballMatchMutation<TArgs>(matchId: string, mutationFn: (args: TArgs) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["footballMatch", matchId] });
      // Every goal/phase/completion change also has to be reflected on the
      // match list card (score, LIVE/COMPLETED badge, phase label) — the
      // other five sports' equivalent hooks invalidate both queries too.
      qc.invalidateQueries({ queryKey: ["footballMatches"] });
    },
  });
}

export function useStartRunningPeriod(matchId: string) {
  return useFootballMatchMutation(matchId, (phase: Exclude<RunningPhase, "FIRST_HALF">) =>
    startRunningPeriod(matchId, phase)
  );
}

export function useEndRunningPeriod(matchId: string) {
  return useFootballMatchMutation(
    matchId,
    (args: { endingPhase: RunningPhase; addedMinutes: number; resultingPhase: BreakPhase }) =>
      endRunningPeriod(matchId, args.endingPhase, args.addedMinutes, args.resultingPhase)
  );
}

export function useStartPenalties(matchId: string) {
  return useFootballMatchMutation(matchId, () => startPenalties(matchId));
}

export function useCompleteFootballMatch(matchId: string) {
  return useFootballMatchMutation(
    matchId,
    (completion: { winnerTeam: Team | null; isDraw: boolean; resultSummary: string }) =>
      completeFootballMatch(matchId, completion)
  );
}

export function useDeleteFootballMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deleteFootballMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["footballMatches"] }),
  });
}

export function useAddFootballGoal(matchId: string) {
  return useFootballMatchMutation(
    matchId,
    (args: { seq: number; team: Team; phase: Phase; minuteLabel: string }) =>
      addFootballGoal(matchId, args.seq, args.team, args.phase, args.minuteLabel)
  );
}

export function useDeleteLastFootballGoal(matchId: string) {
  return useFootballMatchMutation(matchId, (seq: number) => deleteLastFootballGoal(matchId, seq));
}

export function useAddPenaltyKick(matchId: string) {
  return useFootballMatchMutation(matchId, (args: { seq: number; team: Team; scored: boolean }) =>
    addPenaltyKick(matchId, args.seq, args.team, args.scored)
  );
}

export function useDeleteLastPenaltyKick(matchId: string) {
  return useFootballMatchMutation(matchId, (seq: number) => deleteLastPenaltyKick(matchId, seq));
}
