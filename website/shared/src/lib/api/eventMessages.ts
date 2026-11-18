import { supabase } from "../supabase";
import { uniqueChannelName } from "../realtimeChannel";
import type { Database } from "../../types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type EventMessageRow = Database["public"]["Tables"]["event_messages"]["Row"];

export type EventMessage = Pick<
  EventMessageRow,
  "id" | "event_id" | "sender_id" | "message" | "created_at" | "parent_id" | "deleted_at" | "poll_id"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};

const MESSAGE_SELECT =
  "id, event_id, sender_id, message, created_at, parent_id, deleted_at, poll_id, profiles(id, full_name, avatar)";

// One flat, chronological list — replies show inline (WhatsApp-style, with
// a quoted preview of the message they're replying to) rather than in a
// separate thread screen. A soft-deleted message (deleted_at set) stays in
// the list too — the caller renders "This message was deleted" in its
// place instead of removing it, same as WhatsApp.
export async function fetchEventMessages(eventId: string): Promise<EventMessage[]> {
  const { data, error } = await supabase
    .from("event_messages")
    .select(MESSAGE_SELECT)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventMessage[];
}

export async function sendEventMessage(
  eventId: string,
  senderId: string,
  message: string,
  parentId?: string,
  pollId?: string
): Promise<void> {
  const { error } = await supabase
    .from("event_messages")
    .insert({ event_id: eventId, sender_id: senderId, message, parent_id: parentId ?? null, poll_id: pollId ?? null });
  if (error) throw new Error(error.message);
}

export async function fetchEventChatUnreadCount(eventId: string, userId: string): Promise<number> {
  const { data: readRow, error: readError } = await supabase
    .from("event_chat_reads")
    .select("last_read_at")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  let query = supabase
    .from("event_messages")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .neq("sender_id", userId);
  if (readRow?.last_read_at) {
    query = query.gt("created_at", readRow.last_read_at);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markEventChatRead(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("event_chat_reads")
    .upsert({ user_id: userId, event_id: eventId, last_read_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// A user deleting their own message is a soft delete (UPDATE setting
// deleted_at, via the delete_own_chat_message RPC) — the message stays in
// the list, just rendered as "This message was deleted" (see onUpdate).
export function subscribeToEventMessages(
  eventId: string,
  onInsert: (message: EventMessage) => void,
  onUpdate: (message: EventMessage) => void,
  onDelete: (messageId: string) => void
): RealtimeChannel {
  return supabase
    .channel(uniqueChannelName(`event_messages:${eventId}`))
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` },
      async (payload) => {
        const row = payload.new as EventMessageRow;
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, avatar")
          .eq("id", row.sender_id)
          .single();
        onInsert({
          id: row.id,
          event_id: row.event_id,
          sender_id: row.sender_id,
          message: row.message,
          created_at: row.created_at,
          parent_id: row.parent_id,
          deleted_at: row.deleted_at,
          poll_id: row.poll_id,
          profiles: data ?? null,
        });
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` },
      (payload) => {
        const row = payload.new as EventMessageRow;
        onUpdate({
          id: row.id,
          event_id: row.event_id,
          sender_id: row.sender_id,
          message: row.message,
          created_at: row.created_at,
          parent_id: row.parent_id,
          deleted_at: row.deleted_at,
          poll_id: row.poll_id,
          profiles: null,
        });
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` },
      (payload) => {
        const row = payload.old as Pick<EventMessageRow, "id">;
        onDelete(row.id);
      }
    )
    .subscribe();
}
