import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTeamMessages,
  sendTeamMessage,
  subscribeToTeamMessages,
  fetchTeamChatUnreadCount,
  type TeamMessage,
} from "../lib/api/teamMessages";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

export function useTeamMessages(teamId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["teamMessages", teamId],
    queryFn: () => fetchTeamMessages(teamId),
    staleTime: 0,
  });

  useEffect(() => {
    const channel = subscribeToTeamMessages(
      teamId,
      (message) => {
        qc.setQueryData<TeamMessage[]>(["teamMessages", teamId], (prev) => {
          if (!prev) return [message];
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      // A soft-delete arrives as an UPDATE — only deleted_at actually
      // changed, so merge just that in rather than overwriting the row
      // (the realtime payload doesn't carry the joined profile).
      (message) => {
        qc.setQueryData<TeamMessage[]>(["teamMessages", teamId], (prev) =>
          prev ? prev.map((m) => (m.id === message.id ? { ...m, deleted_at: message.deleted_at } : m)) : prev
        );
      },
      (messageId) => {
        qc.setQueryData<TeamMessage[]>(["teamMessages", teamId], (prev) =>
          prev ? prev.filter((m) => m.id !== messageId) : prev
        );
      }
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, qc]);

  return query;
}

export function useSendTeamMessage(teamId: string) {
  return useMutation({
    mutationFn: ({ senderId, message, parentId, pollId }: { senderId: string; message: string; parentId?: string; pollId?: string }) =>
      sendTeamMessage(teamId, senderId, message, parentId, pollId),
  });
}

// Powers the red unread-count badge on the "Team Chat" button (TeamCard) —
// stays in sync as new messages arrive or the chat gets marked read
// elsewhere (e.g. the chat screen itself, via markTeamChatRead).
export function useTeamChatUnreadCount(teamId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["teamChatUnread", teamId, userId],
    queryFn: () => fetchTeamChatUnreadCount(teamId as string, userId as string),
    enabled: !!teamId && !!userId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!teamId || !userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`teamChatUnread:${teamId}:${userId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
        () => qc.invalidateQueries({ queryKey: ["teamChatUnread", teamId, userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_chat_reads", filter: `team_id=eq.${teamId}` },
        () => qc.invalidateQueries({ queryKey: ["teamChatUnread", teamId, userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, userId, qc]);

  return query;
}
