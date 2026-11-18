import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSquadMessages,
  sendSquadMessage,
  subscribeToSquadMessages,
  fetchSquadChatUnreadCount,
  type SquadMessage,
} from "../lib/api/squadMessages";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

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
      // A soft-delete arrives as an UPDATE — only deleted_at actually
      // changed, so merge just that in rather than overwriting the row
      // (the realtime payload doesn't carry the joined profile).
      (message) => {
        qc.setQueryData<SquadMessage[]>(["squadMessages", squadId], (prev) =>
          prev ? prev.map((m) => (m.id === message.id ? { ...m, deleted_at: message.deleted_at } : m)) : prev
        );
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
    mutationFn: ({ senderId, message, parentId, pollId }: { senderId: string; message: string; parentId?: string; pollId?: string }) =>
      sendSquadMessage(squadId, senderId, message, parentId, pollId),
  });
}

// Powers the red unread-count badge on the chat icon (SquadDetailScreen) —
// stays in sync as new messages arrive or the chat gets marked read
// elsewhere (e.g. the chat screen itself, via markSquadChatRead).
export function useSquadChatUnreadCount(squadId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squadChatUnread", squadId, userId],
    queryFn: () => fetchSquadChatUnreadCount(squadId as string, userId as string),
    enabled: !!squadId && !!userId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!squadId || !userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`squadChatUnread:${squadId}:${userId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "squad_messages", filter: `squad_id=eq.${squadId}` },
        () => qc.invalidateQueries({ queryKey: ["squadChatUnread", squadId, userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "squad_chat_reads", filter: `squad_id=eq.${squadId}` },
        () => qc.invalidateQueries({ queryKey: ["squadChatUnread", squadId, userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [squadId, userId, qc]);

  return query;
}
