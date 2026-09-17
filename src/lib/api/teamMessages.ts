import { supabase } from "../supabase";
import { uniqueChannelName } from "../realtimeChannel";
import type { Database } from "../../types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TeamMessageRow = Database["public"]["Tables"]["team_messages"]["Row"];

export type TeamMessage = Pick<
  TeamMessageRow,
  "id" | "team_id" | "sender_id" | "message" | "created_at"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};

const MESSAGE_SELECT = "id, team_id, sender_id, message, created_at, profiles(id, full_name, avatar)";

export async function fetchTeamMessages(teamId: string): Promise<TeamMessage[]> {
  const { data, error } = await supabase
    .from("team_messages")
    .select(MESSAGE_SELECT)
    .eq("team_id", teamId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TeamMessage[];
}

export async function sendTeamMessage(
  teamId: string,
  senderId: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from("team_messages")
    .insert({ team_id: teamId, sender_id: senderId, message });
  if (error) throw new Error(error.message);
}

export async function fetchTeamChatUnreadCount(teamId: string, userId: string): Promise<number> {
  const { data: readRow, error: readError } = await supabase
    .from("team_chat_reads")
    .select("last_read_at")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  let query = supabase
    .from("team_messages")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .is("deleted_at", null)
    .neq("sender_id", userId);
  if (readRow?.last_read_at) {
    query = query.gt("created_at", readRow.last_read_at);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markTeamChatRead(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("team_chat_reads")
    .upsert({ user_id: userId, team_id: teamId, last_read_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// Messages older than 24h are hard-deleted by a DB cron job, so a DELETE event
// means "this expired," not "someone chose to remove it" — the caller drops it
// from the local list either way.
export function subscribeToTeamMessages(
  teamId: string,
  onInsert: (message: TeamMessage) => void,
  onDelete: (messageId: string) => void
): RealtimeChannel {
  return supabase
    .channel(uniqueChannelName(`team_messages:${teamId}`))
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
      async (payload) => {
        const row = payload.new as TeamMessageRow;
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, avatar")
          .eq("id", row.sender_id)
          .single();
        onInsert({
          id: row.id,
          team_id: row.team_id,
          sender_id: row.sender_id,
          message: row.message,
          created_at: row.created_at,
          profiles: data ?? null,
        });
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
      (payload) => {
        const row = payload.old as Pick<TeamMessageRow, "id">;
        onDelete(row.id);
      }
    )
    .subscribe();
}
