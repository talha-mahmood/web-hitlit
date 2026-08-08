import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSquadMessages,
  sendSquadMessage,
  subscribeToSquadMessages,
  type SquadMessage,
} from "../lib/api/squadMessages";
import { supabase } from "../lib/supabase";

export function useSquadMessages(squadId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squadMessages", squadId],
    queryFn: () => fetchSquadMessages(squadId),
    staleTime: 0,
  });

  useEffect(() => {
    const channel = subscribeToSquadMessages(
      squadId,
      (message) => {
        qc.setQueryData<SquadMessage[]>(["squadMessages", squadId], (prev) => {
          if (!prev) return [message];
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      (messageId) => {
        qc.setQueryData<SquadMessage[]>(["squadMessages", squadId], (prev) =>
          prev ? prev.filter((m) => m.id !== messageId) : prev
        );
      }
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [squadId, qc]);

  return query;
}

export function useSendSquadMessage(squadId: string) {
  return useMutation({
    mutationFn: ({ senderId, message }: { senderId: string; message: string }) =>
      sendSquadMessage(squadId, senderId, message),
  });
}
