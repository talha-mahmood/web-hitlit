import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGameMessages,
  sendGameMessage,
  subscribeToGameMessages,
  fetchGameChatUnreadCount,
  type GameMessage,
} from "../lib/api/gameMessages";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";


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
      // A soft-delete arrives as an UPDATE — only deleted_at actually
      // changed, so merge just that in rather than overwriting the row
      // (the realtime payload doesn't carry the joined profile).
      (message) => {
        qc.setQueryData<GameMessage[]>(["gameMessages", gameId], (prev) =>
          prev ? prev.map((m) => (m.id === message.id ? { ...m, deleted_at: message.deleted_at } : m)) : prev
        );
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
    mutationFn: ({ senderId, message, parentId }: { senderId: string; message: string; parentId?: string }) =>
      sendGameMessage(gameId, senderId, message, parentId),
  });
}

// Powers the red unread-count badge on the chat icon (GameDetailScreen) —
// stays in sync as new messages arrive or the chat gets marked read
// elsewhere (e.g. the chat screen itself, via markGameChatRead).
export function useGameChatUnreadCount(gameId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["gameChatUnread", gameId, userId],
    queryFn: () => fetchGameChatUnreadCount(gameId as string, userId as string),
    enabled: !!gameId && !!userId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!gameId || !userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`gameChatUnread:${gameId}:${userId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_messages", filter: `game_id=eq.${gameId}` },
        () => qc.invalidateQueries({ queryKey: ["gameChatUnread", gameId, userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_chat_reads", filter: `game_id=eq.${gameId}` },
        () => qc.invalidateQueries({ queryKey: ["gameChatUnread", gameId, userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, userId, qc]);

  return query;
}
