import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { castPollVote, createPoll, fetchPollResult, subscribeToPollVotes } from "../lib/api/polls";
import { supabase } from "../lib/supabase";

export function usePollResult(pollId: string | null | undefined, viewerId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["pollResult", pollId],
    queryFn: () => fetchPollResult(pollId as string, viewerId as string),
    enabled: !!pollId && !!viewerId,
  });

  useEffect(() => {
    if (!pollId) return;
    const channel = subscribeToPollVotes(pollId, () => {
      qc.invalidateQueries({ queryKey: ["pollResult", pollId] });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, qc]);

  return query;
}

export function useCastPollVote(pollId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ optionId, voterId }: { optionId: string; voterId: string }) =>
      castPollVote(pollId, optionId, voterId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pollResult", pollId] }),
  });
}

export function useCreatePoll() {
  return useMutation({
    mutationFn: ({ question, options, createdBy }: { question: string; options: string[]; createdBy: string }) =>
      createPoll(question, options, createdBy),
  });
}
