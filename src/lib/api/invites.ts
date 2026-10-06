import { supabase } from "../supabase";
import { isUniqueViolation } from "../nameValidation";
import type { Database } from "../../types/database.types";

export type GameInvite = Database["public"]["Tables"]["game_invites"]["Row"] & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};
export type SquadInvite = Database["public"]["Tables"]["squad_invites"]["Row"] & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};
export type TeamInvite = Database["public"]["Tables"]["tournament_team_invites"]["Row"];
export type TeamInviteWithDetails = TeamInvite & {
  tournament_teams: { id: string; name: string; game_id: string } | null;
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
};

const GAME_INVITE_SELECT = "*, profiles!game_invites_invited_by_fkey(id, full_name, avatar)";
const SQUAD_INVITE_SELECT = "*, profiles!squad_invites_invited_by_fkey(id, full_name, avatar)";
const TEAM_INVITE_SELECT =
  "*, tournament_teams!inner(id, name, game_id), profiles!tournament_team_invites_invited_by_fkey(id, full_name, avatar)";

// Host-only (enforced by game_invites_insert_inviter RLS) — invites bypass
// the normal request/approval flow entirely: accepting one joins the
// invitee directly (see accept_game_invite).
export async function createGameInvite(gameId: string, invitedUserId: string, invitedBy: string): Promise<void> {
  const { error } = await supabase
    .from("game_invites")
    .insert({ game_id: gameId, invited_user_id: invitedUserId, invited_by: invitedBy });
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("This player has already been invited.");
    }
    throw new Error(error.message);
  }
}

export async function createSquadInvite(squadId: string, invitedUserId: string, invitedBy: string): Promise<void> {
  const { error } = await supabase
    .from("squad_invites")
    .insert({ squad_id: squadId, invited_user_id: invitedUserId, invited_by: invitedBy });
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("This player has already been invited.");
    }
    throw new Error(error.message);
  }
}

// A team's own joined members (or the tournament host) inviting one specific
// player straight into that team — bypasses the normal request/approval
// flow entirely: accepting one joins the invitee directly (see
// accept_team_invite), same as game/squad invites above. Enforced
// server-side by tournament_team_invites_insert_member.
export async function createTeamInvite(teamId: string, invitedUserId: string, invitedBy: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_team_invites")
    .insert({ team_id: teamId, invited_user_id: invitedUserId, invited_by: invitedBy });
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("This player has already been invited to this team.");
    }
    throw new Error(error.message);
  }
}

// The current user's own pending invite for a given game/squad, if any —
// drives the "You're invited — Accept/Decline" banner on the detail screens.
export async function fetchMyPendingGameInvite(gameId: string, userId: string): Promise<GameInvite | null> {
  const { data, error } = await supabase
    .from("game_invites")
    .select(GAME_INVITE_SELECT)
    .eq("game_id", gameId)
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as GameInvite | null;
}

// Same idea as fetchMyPendingGameInvite/fetchMyPendingSquadInvite, but a
// team invite is scoped to a team, not the game directly — `!inner` lets
// PostgREST filter this row-level query by the embedded team's game_id.
export async function fetchMyPendingTeamInvite(gameId: string, userId: string): Promise<TeamInviteWithDetails | null> {
  const { data, error } = await supabase
    .from("tournament_team_invites")
    .select(TEAM_INVITE_SELECT)
    .eq("tournament_teams.game_id", gameId)
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as TeamInviteWithDetails | null;
}

export async function fetchMyPendingSquadInvite(squadId: string, userId: string): Promise<SquadInvite | null> {
  const { data, error } = await supabase
    .from("squad_invites")
    .select(SQUAD_INVITE_SELECT)
    .eq("squad_id", squadId)
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SquadInvite | null;
}

// Accept/decline go through SECURITY DEFINER RPCs (not a plain table update)
// since accepting must atomically flip the invite AND create the
// membership row — see the accept_game_invite/accept_squad_invite migration.
export async function acceptGameInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_game_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}

export async function declineGameInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_game_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}

export async function acceptSquadInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_squad_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}

export async function declineSquadInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_squad_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}

export async function acceptTeamInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_team_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}

export async function declineTeamInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_team_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}
