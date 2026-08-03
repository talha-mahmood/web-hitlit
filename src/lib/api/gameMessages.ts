import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type GameMessageRow = Database["public"]["Tables"]["game_messages"]["Row"];

export type GameMessage = Pick<
  GameMessageRow,
  "id" | "game_id" | "sender_id" | "message" | "created_at"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};

const MESSAGE_SELECT = "id, game_id, sender_id, message, created_at, profiles(id, full_name, avatar)";

export async function fetchGameMessages(gameId: string): Promise<GameMessage[]> {
  const { data, error } = await supabase
    .from("game_messages")
    .select(MESSAGE_SELECT)
    .eq("game_id", gameId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GameMessage[];
}

export async function sendGameMessage(
  gameId: string,
  senderId: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from("game_messages")
    .insert({ game_id: gameId, sender_id: senderId, message });
  if (error) throw new Error(error.message);
}

// Messages older than 24h are hard-deleted by a DB cron job, so a DELETE event
// means "this expired," not "someone chose to remove it" — the caller drops it
// from the local list either way.
export function subscribeToGameMessages(
  gameId: string,
  onInsert: (message: GameMessage) => void,
  onDelete: (messageId: string) => void
): RealtimeChannel {
  return supabase
    .channel(`game_messages:${gameId}`)
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
          profiles: data ?? null,
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
