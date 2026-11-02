import { supabase } from "../supabase";
import type { ChatKind } from "./chatThreads";

const READS_TABLE: Record<ChatKind, "game_chat_reads" | "team_chat_reads" | "squad_chat_reads" | "event_chat_reads"> = {
  game: "game_chat_reads",
  team: "team_chat_reads",
  squad: "squad_chat_reads",
  event: "event_chat_reads",
};

const CONTEXT_COL: Record<ChatKind, "game_id" | "team_id" | "squad_id" | "event_id"> = {
  game: "game_id",
  team: "team_id",
  squad: "squad_id",
  event: "event_id",
};

export type SeenByUser = {
  userId: string;
  fullName: string | null;
  avatar: string | null;
  lastReadAt: string;
};

// Coarse but accurate for a simple group chat: a participant's last_read_at
// only ever advances when they open the chat, or have it open when a new
// message arrives (see markGameChatRead/markTeamChatRead/markSquadChatRead)
// — so "has seen this message" is exactly last_read_at >= the message's
// own created_at. No separate per-message read-receipt table needed.
export async function fetchSeenBy(
  kind: ChatKind,
  contextId: string,
  messageCreatedAt: string,
  senderId: string
): Promise<SeenByUser[]> {
  // The context column (game_id/team_id/squad_id) differs per table and
  // isn't part of the select list above, so it falls outside what `.eq()`'s
  // types can verify against a union of three different tables — same
  // dynamic-table tradeoff as chatThreads.ts.
  const { data, error } = await (supabase.from(READS_TABLE[kind]) as any)
    .select("user_id, last_read_at, profiles(id, full_name, avatar)")
    .eq(CONTEXT_COL[kind], contextId)
    .gte("last_read_at", messageCreatedAt)
    .neq("user_id", senderId);
  if (error) throw new Error(error.message);

  type Row = { user_id: string; last_read_at: string; profiles: { full_name: string | null; avatar: string | null } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    userId: row.user_id,
    fullName: row.profiles?.full_name ?? null,
    avatar: row.profiles?.avatar ?? null,
    lastReadAt: row.last_read_at,
  }));
}
