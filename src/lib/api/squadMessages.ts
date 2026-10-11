import { supabase } from "../supabase";
import { uniqueChannelName } from "../realtimeChannel";
import type { Database } from "../../types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type SquadMessageRow = Database["public"]["Tables"]["squad_messages"]["Row"];

export type SquadMessage = Pick<
  SquadMessageRow,
  "id" | "squad_id" | "sender_id" | "message" | "created_at" | "parent_id" | "deleted_at" | "poll_id"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};

const MESSAGE_SELECT =
  "id, squad_id, sender_id, message, created_at, parent_id, deleted_at, poll_id, profiles(id, full_name, avatar)";

// One flat, chronological list — replies show inline (WhatsApp-style, with
// a quoted preview of the message they're replying to) rather than in a
// separate thread screen. A soft-deleted message (deleted_at set) stays in
// the list too — the caller renders "This message was deleted" in its
// place instead of removing it, same as WhatsApp.
export async function fetchSquadMessages(squadId: string): Promise<SquadMessage[]> {
  const { data, error } = await supabase
    .from("squad_messages")
    .select(MESSAGE_SELECT)
    .eq("squad_id", squadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SquadMessage[];
}

export async function sendSquadMessage(
  squadId: string,
  senderId: string,
  message: string,
  parentId?: string,
  pollId?: string
): Promise<void> {
  const { error } = await supabase
    .from("squad_messages")
    .insert({ squad_id: squadId, sender_id: senderId, message, parent_id: parentId ?? null, poll_id: pollId ?? null });
  if (error) throw new Error(error.message);
}

export async function fetchSquadChatUnreadCount(squadId: string, userId: string): Promise<number> {
  const { data: readRow, error: readError } = await supabase
    .from("squad_chat_reads")
    .select("last_read_at")
    .eq("user_id", userId)
    .eq("squad_id", squadId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  let query = supabase
    .from("squad_messages")
    .select("id", { count: "exact", head: true })
    .eq("squad_id", squadId)
    .is("deleted_at", null)
    .neq("sender_id", userId);
  if (readRow?.last_read_at) {
    query = query.gt("created_at", readRow.last_read_at);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markSquadChatRead(squadId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("squad_chat_reads")
    .upsert({ user_id: userId, squad_id: squadId, last_read_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// Messages older than 24h are hard-deleted by a DB cron job (a real DELETE
// event — the message is gone, drop it from the list); a user deleting
// their own message is a soft delete instead (UPDATE setting deleted_at) —
// the message stays in the list, just rendered as "This message was
// deleted" (see onUpdate).
export function subscribeToSquadMessages(
  squadId: string,
  onInsert: (message: SquadMessage) => void,
  onUpdate: (message: SquadMessage) => void,
  onDelete: (messageId: string) => void
): RealtimeChannel {
  return supabase
    .channel(uniqueChannelName(`squad_messages:${squadId}`))
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "squad_messages", filter: `squad_id=eq.${squadId}` },
      async (payload) => {
        const row = payload.new as SquadMessageRow;
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, avatar")
          .eq("id", row.sender_id)
          .single();
        onInsert({
          id: row.id,
          squad_id: row.squad_id,
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
      { event: "UPDATE", schema: "public", table: "squad_messages", filter: `squad_id=eq.${squadId}` },
      (payload) => {
        const row = payload.new as SquadMessageRow;
        onUpdate({
          id: row.id,
          squad_id: row.squad_id,
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
      { event: "DELETE", schema: "public", table: "squad_messages", filter: `squad_id=eq.${squadId}` },
      (payload) => {
        const row = payload.old as Pick<SquadMessageRow, "id">;
        onDelete(row.id);
      }
    )
    .subscribe();
}
