import { supabase } from "../supabase";
import { isUniqueViolation } from "../nameValidation";
import type { Database } from "../../types/database.types";

type TeamRow = Database["public"]["Tables"]["tournament_teams"]["Row"];
type TeamMemberRow = Database["public"]["Tables"]["tournament_team_members"]["Row"];
type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

export type TournamentTeam = TeamRow & {
  tournament_team_members: (Pick<
    TeamMemberRow,
    "id" | "status" | "user_id" | "joined_at" | "skill_level" | "location"
  > & {
    profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  })[];
};

const TEAM_SELECT =
  "*, tournament_team_members(id, status, user_id, joined_at, skill_level, location, profiles(id, full_name, avatar))";

export async function fetchTeamsForTournament(gameId: string): Promise<TournamentTeam[]> {
  const { data, error } = await supabase
    .from("tournament_teams")
    .select(TEAM_SELECT)
    .eq("game_id", gameId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TournamentTeam[];
}

export async function createTeam(
  gameId: string,
  creatorId: string,
  name: string
): Promise<TeamRow> {
  const { data, error } = await supabase
    .from("tournament_teams")
    .insert({ game_id: gameId, captain_id: creatorId, name, status: "FORMING" })
    .select()
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A team with this name already exists in this tournament. Please choose a different name.");
    }
    throw new Error(error.message);
  }

  // The creator joins their own team as its first member, same as anyone
  // else who joins after them — there's no special role attached to this.
  const { error: memberError } = await supabase.from("tournament_team_members").insert({
    team_id: data.id,
    user_id: creatorId,
    status: "JOINED",
    joined_at: new Date().toISOString(),
  });
  if (memberError) throw new Error(memberError.message);

  return data;
}

// Host-only: pre-seed the tournament's team slots with names at creation
// time — these start with no members at all, and anyone can join one
// (see requestToJoinTeam) the same way they'd join a team someone else
// already created. sort_order preserves the host's entry order for fixture
// pairing, since a single bulk insert can give every row the same created_at.
export async function createTournamentTeamPlaceholders(
  gameId: string,
  teamNames: string[]
): Promise<TeamRow[]> {
  const { data, error } = await supabase
    .from("tournament_teams")
    .insert(
      teamNames.map((name, i) => ({
        game_id: gameId,
        name,
        captain_id: null,
        status: "FORMING" as const,
        sort_order: i,
      }))
    )
    .select();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Team names must be unique within a tournament.");
    }
    throw new Error(error.message);
  }
  return data;
}

// Joining a still-forming team always inserts straight as JOINED — there's
// no captain to approve the request, no matter who else is already on the
// roster. Who ends up leading the team on match day is sorted out in person
// once everyone's at the venue, not gated in the app.
export async function requestToJoinTeam(
  teamId: string,
  userId: string,
  skillLevel: SkillLevel,
  location: string
): Promise<void> {
  const { error } = await supabase.from("tournament_team_members").insert({
    team_id: teamId,
    user_id: userId,
    status: "JOINED",
    skill_level: skillLevel,
    location: location || null,
    joined_at: new Date().toISOString(),
  });
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

// A team joins the tournament automatically the moment its roster fills up
// (see the auto_approve_full_team DB trigger) — no captain submission or
// host approval step. This is the host's one remaining team-level action:
// pull an already-approved team back out of the tournament.
export async function rejectTeam(teamId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_teams")
    .update({ status: "REJECTED" })
    .eq("id", teamId);
  if (error) throw new Error(error.message);
}
