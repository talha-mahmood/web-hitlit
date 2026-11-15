import { supabase } from "../supabase";
import { uniqueChannelName } from "../realtimeChannel";
import type { Database } from "../../types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type GameMessageRow = Database["public"]["Tables"]["game_messages"]["Row"];

export type GameMessage = Pick<
  GameMessageRow,
  "id" | "game_id" | "sender_id" | "message" | "created_at" | "parent_id" | "deleted_at" | "poll_id"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};

const MESSAGE_SELECT =
  "id, game_id, sender_id, message, created_at, parent_id, deleted_at, poll_id, profiles(id, full_name, avatar)";

// One flat, chronological list — replies show inline (WhatsApp-style, with
// a quoted preview of the message they're replying to) rather than in a
// separate thread screen. A soft-deleted message (deleted_at set) stays in
// the list too — the caller renders "This message was deleted" in its
// place instead of removing it, same as WhatsApp.
export async function fetchGameMessages(gameId: string): Promise<GameMessage[]> {
  const { data, error } = await supabase
    .from("game_messages")
    .select(MESSAGE_SELECT)
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GameMessage[];
}

export async function sendGameMessage(
  gameId: string,
  senderId: string,
  message: string,
  parentId?: string,
  pollId?: string
): Promise<void> {
  const { error } = await supabase
    .from("game_messages")
    .insert({ game_id: gameId, sender_id: senderId, message, parent_id: parentId ?? null, poll_id: pollId ?? null });
  if (error) throw new Error(error.message);
}

export async function fetchGameChatUnreadCount(gameId: string, userId: string): Promise<number> {
  const { data: readRow, error: readError } = await supabase
    .from("game_chat_reads")
    .select("last_read_at")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  let query = supabase
    .from("game_messages")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .is("deleted_at", null)
    .neq("sender_id", userId);
  if (readRow?.last_read_at) {
    query = query.gt("created_at", readRow.last_read_at);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markGameChatRead(gameId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("game_chat_reads")
    .upsert({ user_id: userId, game_id: gameId, last_read_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// Messages older than 24h are hard-deleted by a DB cron job (a real DELETE
// event — the message is gone, drop it from the list); a user deleting
// their own message is a soft delete instead (UPDATE setting deleted_at) —
// the message stays in the list, just rendered as "This message was
// deleted" (see onUpdate).
export function subscribeToGameMessages(
  gameId: string,
  onInsert: (message: GameMessage) => void,
  onUpdate: (message: GameMessage) => void,
  onDelete: (messageId: string) => void
): RealtimeChannel {
  return supabase
    .channel(uniqueChannelName(`game_messages:${gameId}`))
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_messages", filter: `game_id=eq.${gameId}` },
      async (payload) => {
        const row = payload.new as GameMessageRow;
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, avatar")
          .eq("id", row.sender_id)
          .single();
        onInsert({
          id: row.id,
          game_id: row.game_id,
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
      { event: "UPDATE", schema: "public", table: "game_messages", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new as GameMessageRow;
        onUpdate({
          id: row.id,
          game_id: row.game_id,
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
      { event: "DELETE", schema: "public", table: "game_messages", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.old as Pick<GameMessageRow, "id">;
        onDelete(row.id);
      }
    )
    .subscribe();
}
