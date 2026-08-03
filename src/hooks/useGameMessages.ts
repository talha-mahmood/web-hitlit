import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGameMessages,
  sendGameMessage,
  subscribeToGameMessages,
  type GameMessage,
} from "../lib/api/gameMessages";
import { supabase } from "../lib/supabase";

export function useGameMessages(gameId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["gameMessages", gameId],
    queryFn: () => fetchGameMessages(gameId),
    staleTime: 0,
  });

  useEffect(() => {
    const channel = subscribeToGameMessages(
      gameId,
      (message) => {
        qc.setQueryData<GameMessage[]>(["gameMessages", gameId], (prev) => {
          if (!prev) return [message];
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      (messageId) => {
        qc.setQueryData<GameMessage[]>(["gameMessages", gameId], (prev) =>
          prev ? prev.filter((m) => m.id !== messageId) : prev
        );
      }
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, qc]);

  return query;
}

export function useSendGameMessage(gameId: string) {
  return useMutation({
    mutationFn: ({ senderId, message }: { senderId: string; message: string }) =>
      sendGameMessage(gameId, senderId, message),
  });
}
