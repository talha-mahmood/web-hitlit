import { supabase } from "../supabase";

export type MessageSource =
  | "game_message"
  | "squad_message"
  | "team_message"
  | "event_message"
  | "community_message"
  | "profile";

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

// --- Superadmin review (App Store guideline 1.2's "act on reports within
// 24 hours" requirement) ---

export type ContentReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  source: MessageSource;
  source_id: string;
  context_id: string;
  message_snapshot: string;
  reason: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  action_taken: string | null;
  reporter: { full_name: string | null; email: string | null } | null;
  reported: { full_name: string | null; email: string | null } | null;
};

// Only unreviewed reports — once a report is resolved (content removed,
// user ejected, or dismissed) it drops off this list entirely rather than
// sticking around with a "reviewed" badge. Ejecting a user from here is
// reversible later via the Users directory (setUserActive), which doesn't
// depend on the now-gone report row.
export async function fetchContentReports(): Promise<ContentReport[]> {
  const { data, error } = await supabase
    .from("content_reports")
    .select(
      "id, reporter_id, reported_user_id, source, source_id, context_id, message_snapshot, reason, created_at, reviewed_at, reviewed_by, action_taken, reporter:profiles!content_reports_reporter_id_fkey(full_name, email), reported:profiles!content_reports_reported_user_id_fkey(full_name, email)"
    )
    .is("reviewed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as ContentReport[]) ?? [];
}

// Deletes the reported row itself (via a SECURITY DEFINER RPC, since a
// superadmin has no per-table DELETE grant on every content table), then
// marks the report reviewed. Two sequential writes — acceptable for a
// low-frequency, superadmin-only action, same pattern as assignVenueAdmin.
export async function removeReportedContent(reportId: string, reviewerId: string): Promise<void> {
  const { error: rpcError } = await supabase.rpc("moderate_remove_content", { p_report_id: reportId });
  if (rpcError) throw new Error(rpcError.message);
  const { error } = await supabase
    .from("content_reports")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: reviewerId, action_taken: "content_removed" })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}

// "Ejecting" a user sets the dormant profiles.isactive flag to false —
// RootNavigator shows AccountSuspendedScreen the moment this lands, live,
// via its existing realtime profile subscription.
export async function ejectReportedUser(reportId: string, userId: string, reviewerId: string): Promise<void> {
  const { error: userError } = await supabase.from("profiles").update({ isactive: false }).eq("id", userId);
  if (userError) throw new Error(userError.message);
  const { error } = await supabase
    .from("content_reports")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: reviewerId, action_taken: "user_ejected" })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}

export async function dismissReport(reportId: string, reviewerId: string): Promise<void> {
  const { error } = await supabase
    .from("content_reports")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: reviewerId, action_taken: "dismissed" })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}
