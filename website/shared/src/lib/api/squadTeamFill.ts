import { supabase } from "../supabase";
import { isUniqueViolation } from "../nameValidation";
import type { Database } from "../../types/database.types";

type InviteStatus = Database["public"]["Enums"]["game_invite_status_type"];

export type GameSquadInvite = {
  id: string;
  game_id: string;
  squad_id: string;
  invited_by: string;
  status: InviteStatus;
  created_at: string;
};

export type GameSquadInviteWithSquad = GameSquadInvite & {
  squads: { id: string; name: string } | null;
};

export type GameSquadInviteWithGame = GameSquadInvite & {
  games: { id: string; title: string; game_type: Database["public"]["Enums"]["game_type_type"] } | null;
};

// Squad owner registers exactly the required number of active squad
// members into a genuinely empty tournament team — server-side validated
// in full (ownership, exact count, active membership, team emptiness) by
// the squad_fill_tournament_team RPC; this call is not itself the security
// boundary.
export async function squadFillTournamentTeam(
  teamId: string,
  squadId: string,
  memberUserIds: string[],
  teamName?: string
): Promise<void> {
  const { error } = await supabase.rpc("squad_fill_tournament_team", {
    p_team_id: teamId,
    p_squad_id: squadId,
    p_member_user_ids: memberUserIds,
    p_team_name: teamName ?? null,
  });
  if (error) throw new Error(error.message);
}

// Adds a partial set of a squad's own active members directly onto an
// already-forming team (JOINED, no approval) — unlike
// squadFillTournamentTeam above, which only works for claiming a still-
// empty team and filling its exact required headcount in one shot. Used by
// "Fill With My Group" when the acting user is that group's own owner/host.
export async function squadAddMembersToTeam(teamId: string, squadId: string, memberUserIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("squad_add_members_to_team", {
    p_team_id: teamId,
    p_squad_id: squadId,
    p_member_user_ids: memberUserIds,
  });
  if (error) throw new Error(error.message);
}

// Same idea for a regular game's remaining open slots (max_players minus
// currently JOINED players) — see squad_fill_game_slots RPC.
export async function squadFillGameSlots(gameId: string, squadId: string, memberUserIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("squad_fill_game_slots", {
    p_game_id: gameId,
    p_squad_id: squadId,
    p_member_user_ids: memberUserIds,
  });
  if (error) throw new Error(error.message);
}

// Host-only (tournament or regular game — both are just `games` rows):
// invite a squad to come fill an empty team/open slots. This only sends a
// notification-style invite; accepting doesn't itself register anyone —
// the squad owner still completes the fill via the functions above.
export async function sendGameSquadInvite(gameId: string, squadId: string, invitedBy: string): Promise<void> {
  const { error } = await supabase.from("game_squad_invites").insert({
    game_id: gameId,
    squad_id: squadId,
    invited_by: invitedBy,
  });
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("This group has already been invited to this game.");
    }
    throw new Error(error.message);
  }
}

export async function fetchGameSquadInvitesForGame(gameId: string): Promise<GameSquadInviteWithSquad[]> {
  const { data, error } = await supabase
    .from("game_squad_invites")
    .select("*, squads(id, name)")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GameSquadInviteWithSquad[];
}

export async function fetchPendingSquadInvites(squadId: string): Promise<GameSquadInviteWithGame[]> {
  const { data, error } = await supabase
    .from("game_squad_invites")
    .select("*, games(id, title, game_type)")
    .eq("squad_id", squadId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GameSquadInviteWithGame[];
}

export async function respondToSquadInvite(inviteId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from("game_squad_invites")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", inviteId);
  if (error) throw new Error(error.message);
}
