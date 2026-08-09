import { supabase } from "../supabase";
import { uniqueChannelName } from "../realtimeChannel";
import type { Database } from "../../types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type SquadMessageRow = Database["public"]["Tables"]["squad_messages"]["Row"];

export type SquadMessage = Pick<
  SquadMessageRow,
  "id" | "squad_id" | "sender_id" | "message" | "created_at"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};

const MESSAGE_SELECT = "id, squad_id, sender_id, message, created_at, profiles(id, full_name, avatar)";

export async function fetchSquadMessages(squadId: string): Promise<SquadMessage[]> {
  const { data, error } = await supabase
    .from("squad_messages")
    .select(MESSAGE_SELECT)
    .eq("squad_id", squadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SquadMessage[];
}

export async function sendSquadMessage(
  squadId: string,
  senderId: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from("squad_messages")
    .insert({ squad_id: squadId, sender_id: senderId, message });
  if (error) throw new Error(error.message);
}

// Messages older than 24h are hard-deleted by a DB cron job, so a DELETE event
// means "this expired," not "someone chose to remove it" — the caller drops it
// from the local list either way.
export function subscribeToSquadMessages(
  squadId: string,
  onInsert: (message: SquadMessage) => void,
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
          profiles: data ?? null,
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
