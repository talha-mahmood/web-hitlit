import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export async function fetchNotificationById(id: string): Promise<NotificationRow | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Soft delete, matching the deleted_at convention used elsewhere in this
// app — already permitted by the existing "update own notifications" RLS
// policy, no new policy needed.
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Soft-deletes every one of the user's notifications in one go — same
// deleted_at convention (and the same "update own notifications" RLS
// policy) as deleteNotification above.
export async function deleteAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
}
