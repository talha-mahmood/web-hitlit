import { supabase } from "../supabase";
import { isUniqueViolation } from "../nameValidation";
import type { Database } from "../../types/database.types";

type TeamRow = Database["public"]["Tables"]["tournament_teams"]["Row"];
type TeamMemberRow = Database["public"]["Tables"]["tournament_team_members"]["Row"];
type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

export type TournamentTeam = TeamRow & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  tournament_team_members: (Pick<
    TeamMemberRow,
    "id" | "status" | "user_id" | "joined_at" | "skill_level" | "location"
  > & {
    profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  })[];
};

const TEAM_SELECT =
  "*, profiles!tournament_teams_captain_id_fkey(id, full_name, avatar), tournament_team_members(id, status, user_id, joined_at, skill_level, location, profiles(id, full_name, avatar))";

export async function fetchTeamsForTournament(gameId: string): Promise<TournamentTeam[]> {
  const { data, error } = await supabase
    .from("tournament_teams")
    .select(TEAM_SELECT)
    .eq("game_id", gameId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TournamentTeam[];
}

export async function createTeam(
  gameId: string,
  captainId: string,
  name: string
): Promise<TeamRow> {
  const { data, error } = await supabase
    .from("tournament_teams")
    .insert({ game_id: gameId, captain_id: captainId, name, status: "FORMING" })
    .select()
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A team with this name already exists in this tournament. Please choose a different name.");
    }
    throw new Error(error.message);
  }

  // Captain automatically joins their own team
  const { error: memberError } = await supabase.from("tournament_team_members").insert({
    team_id: data.id,
    user_id: captainId,
    status: "JOINED",
    joined_at: new Date().toISOString(),
  });
  if (memberError) throw new Error(memberError.message);

  return data;
}

export async function requestToJoinTeam(
  teamId: string,
  userId: string,
  skillLevel: SkillLevel,
  location: string
): Promise<void> {
  const { error } = await supabase.from("tournament_team_members").insert({
    team_id: teamId,
    user_id: userId,
    status: "PENDING",
    skill_level: skillLevel,
    location: location || null,
  });
  if (error) throw new Error(error.message);
}

// A DB trigger (check_tournament_team_full) auto-flips the team to
// PENDING_HOST_APPROVAL once this approval fills the last slot.
export async function approveTeamMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_team_members")
    .update({ status: "JOINED", joined_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function rejectTeamMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_team_members")
    .update({ status: "DECLINED" })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function removeTeamMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_team_members")
    .update({ status: "REMOVED" })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function leaveTeam(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_team_members")
    .update({ status: "LEFT" })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .in("status", ["JOINED", "PENDING"]);
  if (error) throw new Error(error.message);
}

// Captain-only: submit a full team to the tournament host for approval
// (or resubmit after a rejection). The DB enforces that the caller is the
// captain and that the team is actually full before allowing this.
export async function submitTeamForApproval(teamId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_teams")
    .update({ status: "PENDING_HOST_APPROVAL" })
    .eq("id", teamId);
  if (error) throw new Error(error.message);
}

// Host-only actions: approve/reject a team once it's full and awaiting them.
export async function approveTeam(teamId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_teams")
    .update({ status: "APPROVED" })
    .eq("id", teamId);
  if (error) throw new Error(error.message);
}

export async function rejectTeam(teamId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_teams")
    .update({ status: "REJECTED" })
    .eq("id", teamId);
  if (error) throw new Error(error.message);
}
