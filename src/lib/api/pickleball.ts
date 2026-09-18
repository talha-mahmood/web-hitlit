import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import type { PlayMode, RallyEvent, ScoringMode, Team } from "../pickleballScoring";

export type PickleballMatch = Database["public"]["Tables"]["pickleball_matches"]["Row"];
export type PickleballRallyRow = Database["public"]["Tables"]["pickleball_rallies"]["Row"];

export type PickleballMatchDetail = PickleballMatch & { pickleball_rallies: PickleballRallyRow[] };

const MATCH_DETAIL_SELECT = "*, pickleball_rallies(*)";

// Same idea as friendlyCricketError/friendlyPadelError/friendlyTennisError
// — raw Postgres/PostgREST error text is never something a player should see.
export function friendlyPickleballError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That rally may have already been recorded — pull to refresh and check the score before scoring the next one.";
  }
  if (!message || /violates|constraint|relation .* does not exist|column .* does not exist|syntax error/i.test(message)) {
    return fallback;
  }
  return message;
}

export async function fetchMyPickleballMatches(userId: string): Promise<PickleballMatchDetail[]> {
  const { data, error } = await supabase
    .from("pickleball_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PickleballMatchDetail[];
}

export async function fetchPickleballMatch(matchId: string): Promise<PickleballMatchDetail> {
  const { data, error } = await supabase
    .from("pickleball_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as PickleballMatchDetail;
}

export async function createPickleballMatch(params: {
  userId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  scoringMode: ScoringMode;
  playMode: PlayMode;
  firstServingTeam: Team;
  venue?: string;
}): Promise<{ matchId: string }> {
  const { data, error } = await supabase
    .from("pickleball_matches")
    .insert({
      user_id: params.userId,
      team_a_name: params.teamAName,
      team_b_name: params.teamBName,
      team_a_players: params.teamAPlayers,
      team_b_players: params.teamBPlayers,
      scoring_mode: params.scoringMode,
      play_mode: params.playMode,
      first_serving_team: params.firstServingTeam,
      venue: params.venue?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { matchId: data.id };
}

export async function completePickleballMatch(matchId: string, winnerTeam: Team, resultSummary: string): Promise<void> {
  const { error } = await supabase
    .from("pickleball_matches")
    .update({
      status: "COMPLETED",
      winner_team: winnerTeam,
      result_summary: resultSummary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deletePickleballMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("pickleball_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function addPickleballRally(matchId: string, seq: number, winner: Team): Promise<void> {
  const { error } = await supabase.from("pickleball_rallies").insert({ match_id: matchId, seq, winner });
  if (error) throw new Error(error.message);
}

export async function deleteLastPickleballRally(matchId: string, seq: number): Promise<void> {
  const { error } = await supabase.from("pickleball_rallies").delete().eq("match_id", matchId).eq("seq", seq);
  if (error) throw new Error(error.message);
}

export function rallyRowToEvent(row: PickleballRallyRow): RallyEvent {
  return { seq: row.seq, winner: row.winner as Team };
}
