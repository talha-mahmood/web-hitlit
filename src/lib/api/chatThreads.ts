import { supabase } from "../supabase";

// Shared delete layer for the four ephemeral chat tables (game_messages,
// team_messages, squad_messages, event_messages) — they're structurally
// identical, so one generic module covers all four instead of quadrupling
// this logic. Replies themselves are handled inline in each chat screen
// (WhatsApp-style quoted reply, same flat message list) via parent_id on
// the message itself.
export type ChatKind = "game" | "team" | "squad" | "event";

const TABLE: Record<ChatKind, "game_messages" | "team_messages" | "squad_messages" | "event_messages"> = {
  game: "game_messages",
  team: "team_messages",
  squad: "squad_messages",
  event: "event_messages",
};

// Soft-deletes the sender's own message (deleted_at) — only that single
// message; a reply someone else made to it keeps its own text, same as
// WhatsApp. The caller renders "This message was deleted" in its place
// rather than removing it from the list.
export async function deleteChatMessage(kind: ChatKind, messageId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_own_chat_message", { p_table: TABLE[kind], p_message_id: messageId });
  if (error) throw new Error(error.message);
}
