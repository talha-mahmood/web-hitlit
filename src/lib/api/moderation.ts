import { supabase } from "../supabase";

export type MessageSource = "game_message" | "squad_message";

export async function reportMessage(params: {
  reporterId: string;
  reportedUserId: string;
  source: MessageSource;
  sourceId: string;
  contextId: string;
  messageSnapshot: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: params.reporterId,
    reported_user_id: params.reportedUserId,
    source: params.source,
    source_id: params.sourceId,
    context_id: params.contextId,
    message_snapshot: params.messageSnapshot,
    reason: params.reason,
  });
  if (error) throw new Error(error.message);
}

export async function fetchBlockedUserIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.blocked_id));
}

export type BlockedUser = { blocked_id: string; created_at: string; profiles: { full_name: string; avatar: string | null } | null };

export async function fetchBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocked_id, created_at, profiles!blocked_users_blocked_id_fkey(full_name, avatar)")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as BlockedUser[]) ?? [];
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("blocked_users").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw new Error(error.message);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw new Error(error.message);
}
