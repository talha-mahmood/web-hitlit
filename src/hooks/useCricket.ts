import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "../lib/api/cricket";
import type { BallEvent } from "../lib/cricketScoring";

export function useMyCricketMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["cricketMatches", userId],
    queryFn: () => fetchMyCricketMatches(userId as string),
    enabled: !!userId,
  });
}

export function useCricketMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["cricketMatch", matchId],
    queryFn: () => fetchCricketMatch(matchId as string),
    enabled: !!matchId,
    staleTime: 0,
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

export function useStartSecondInnings(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (battingTeam: "A" | "B") => startSecondInnings(matchId, battingTeam),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] }),
  });
}

export function useMarkInningsComplete(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inningsId: string) => markInningsComplete(inningsId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] }),
  });
}

export function useCompleteCricketMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, resultSummary }: { matchId: string; resultSummary: string }) =>
      completeCricketMatch(matchId, resultSummary),
    onSuccess: (_data, { matchId }) => {
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

export function useAddCricketBall(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inningsId, seq, ball }: { inningsId: string; seq: number; ball: BallEvent }) =>
      addCricketBall(inningsId, seq, ball),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] }),
  });
}

export function useDeleteLastCricketBall(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inningsId, seq }: { inningsId: string; seq: number }) =>
      deleteLastCricketBall(inningsId, seq),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] }),
  });
}
