import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEventMessages,
  sendEventMessage,
  subscribeToEventMessages,
  fetchEventChatUnreadCount,
  type EventMessage,
} from "../lib/api/eventMessages";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

export function useEventMessages(eventId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["eventMessages", eventId],
    queryFn: () => fetchEventMessages(eventId),
    staleTime: 0,
  });

  useEffect(() => {
    const channel = subscribeToEventMessages(
      eventId,
      (message) => {
        qc.setQueryData<EventMessage[]>(["eventMessages", eventId], (prev) => {
          if (!prev) return [message];
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      // A soft-delete arrives as an UPDATE — only deleted_at actually
      // changed, so merge just that in rather than overwriting the row
      // (the realtime payload doesn't carry the joined profile).
      (message) => {
        qc.setQueryData<EventMessage[]>(["eventMessages", eventId], (prev) =>
          prev ? prev.map((m) => (m.id === message.id ? { ...m, deleted_at: message.deleted_at } : m)) : prev
        );
      },
      (messageId) => {
        qc.setQueryData<EventMessage[]>(["eventMessages", eventId], (prev) =>
          prev ? prev.filter((m) => m.id !== messageId) : prev
        );
      }
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  return query;
}

export function useSendEventMessage(eventId: string) {
  return useMutation({
    mutationFn: ({ senderId, message, parentId, pollId }: { senderId: string; message: string; parentId?: string; pollId?: string }) =>
      sendEventMessage(eventId, senderId, message, parentId, pollId),
  });
}

// Powers the red unread-count badge on the chat icon (EventDetailScreen) —
// stays in sync as new messages arrive or the chat gets marked read
// elsewhere (e.g. the chat screen itself, via markEventChatRead).
export function useEventChatUnreadCount(eventId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["eventChatUnread", eventId, userId],
    queryFn: () => fetchEventChatUnreadCount(eventId as string, userId as string),
    enabled: !!eventId && !!userId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!eventId || !userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`eventChatUnread:${eventId}:${userId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["eventChatUnread", eventId, userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_chat_reads", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["eventChatUnread", eventId, userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId, qc]);

  return query;
}
