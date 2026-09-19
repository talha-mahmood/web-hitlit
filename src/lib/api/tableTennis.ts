import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import type { PlayMode, RallyEvent, Team } from "../tableTennisScoring";

export type TableTennisMatch = Database["public"]["Tables"]["table_tennis_matches"]["Row"];
export type TableTennisRallyRow = Database["public"]["Tables"]["table_tennis_rallies"]["Row"];

export type TableTennisMatchDetail = TableTennisMatch & { table_tennis_rallies: TableTennisRallyRow[] };

const MATCH_DETAIL_SELECT = "*, table_tennis_rallies(*)";

// Same idea as friendlyCricketError/friendlyPadelError/friendlyTennisError/
// friendlyPickleballError/friendlyBadmintonError — raw Postgres/PostgREST
// error text is never something a player should see.
export function friendlyTableTennisError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That rally may have already been recorded — pull to refresh and check the score before scoring the next one.";
  }
  if (!message || /violates|constraint|relation .* does not exist|column .* does not exist|syntax error/i.test(message)) {
    return fallback;
  }
  return message;
}

export async function fetchMyTableTennisMatches(userId: string): Promise<TableTennisMatchDetail[]> {
  const { data, error } = await supabase
    .from("table_tennis_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TableTennisMatchDetail[];
}

export async function fetchTableTennisMatch(matchId: string): Promise<TableTennisMatchDetail> {
  const { data, error } = await supabase
    .from("table_tennis_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as TableTennisMatchDetail;
}

export async function createTableTennisMatch(params: {
  userId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  playMode: PlayMode;
  firstServingTeam: Team;
  firstServerIndex: 0 | 1;
  pointsToWin: number;
  gamesToWin: number;
  venue?: string;
}): Promise<{ matchId: string }> {
  const { data, error } = await supabase
    .from("table_tennis_matches")
    .insert({
      user_id: params.userId,
      team_a_name: params.teamAName,
      team_b_name: params.teamBName,
      team_a_players: params.teamAPlayers,
      team_b_players: params.teamBPlayers,
      play_mode: params.playMode,
      first_serving_team: params.firstServingTeam,
      first_server_index: params.firstServerIndex,
      points_to_win: params.pointsToWin,
      games_to_win: params.gamesToWin,
      venue: params.venue?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { matchId: data.id };
}

export async function completeTableTennisMatch(matchId: string, winnerTeam: Team, resultSummary: string): Promise<void> {
  const { error } = await supabase
    .from("table_tennis_matches")
    .update({
      status: "COMPLETED",
      winner_team: winnerTeam,
      result_summary: resultSummary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deleteTableTennisMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("table_tennis_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function addTableTennisRally(matchId: string, seq: number, winner: Team): Promise<void> {
  const { error } = await supabase.from("table_tennis_rallies").insert({ match_id: matchId, seq, winner });
  if (error) throw new Error(error.message);
}

export async function deleteLastTableTennisRally(matchId: string, seq: number): Promise<void> {
  const { error } = await supabase.from("table_tennis_rallies").delete().eq("match_id", matchId).eq("seq", seq);
  if (error) throw new Error(error.message);
}

export function rallyRowToEvent(row: TableTennisRallyRow): RallyEvent {
  return { seq: row.seq, winner: row.winner as Team };
}
