import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/api/notifications";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

// Any insert/update on this user's own notification rows (a new one arriving,
// or one being marked read from another device) should refresh both the list
// and the badge count live, without waiting on staleTime or a manual pull.
function useNotificationsRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`notifications:${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
          qc.invalidateQueries({ queryKey: ["notificationsUnreadCount", userId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}

export function useNotifications(userId: string | undefined) {
  useNotificationsRealtime(userId);
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId as string),
    enabled: !!userId,
    staleTime: 15_000,
  });
}

export function useUnreadNotificationCount(userId: string | undefined) {
  useNotificationsRealtime(userId);
  return useQuery({
    queryKey: ["notificationsUnreadCount", userId],
    queryFn: () => fetchUnreadNotificationCount(userId as string),
    enabled: !!userId,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      qc.invalidateQueries({ queryKey: ["notificationsUnreadCount", userId] });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(userId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      qc.invalidateQueries({ queryKey: ["notificationsUnreadCount", userId] });
    },
  });
}
