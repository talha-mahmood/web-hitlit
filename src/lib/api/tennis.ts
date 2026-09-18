import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import type { MatchFormat, PointEvent, Player } from "../tennisScoring";

export type TennisMatch = Database["public"]["Tables"]["tennis_matches"]["Row"];
export type TennisPointRow = Database["public"]["Tables"]["tennis_points"]["Row"];

export type TennisMatchDetail = TennisMatch & { tennis_points: TennisPointRow[] };

const MATCH_DETAIL_SELECT = "*, tennis_points(*)";

// Same idea as friendlyCricketError/friendlyPadelError — raw Postgres/
// PostgREST error text is never something a player should see.
export function friendlyTennisError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That point may have already been recorded — pull to refresh and check the score before scoring the next one.";
  }
  if (!message || /violates|constraint|relation .* does not exist|column .* does not exist|syntax error/i.test(message)) {
    return fallback;
  }
  return message;
}

export async function fetchMyTennisMatches(userId: string): Promise<TennisMatchDetail[]> {
  const { data, error } = await supabase
    .from("tennis_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TennisMatchDetail[];
}

export async function fetchTennisMatch(matchId: string): Promise<TennisMatchDetail> {
  const { data, error } = await supabase
    .from("tennis_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as TennisMatchDetail;
}

export async function createTennisMatch(params: {
  userId: string;
  playerAName: string;
  playerBName: string;
  format: MatchFormat;
  firstServer: Player;
  venue?: string;
}): Promise<{ matchId: string }> {
  const { data, error } = await supabase
    .from("tennis_matches")
    .insert({
      user_id: params.userId,
      player_a_name: params.playerAName,
      player_b_name: params.playerBName,
      format: params.format,
      first_server: params.firstServer,
      venue: params.venue?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { matchId: data.id };
}

export async function completeTennisMatch(matchId: string, winnerPlayer: Player, resultSummary: string): Promise<void> {
  const { error } = await supabase
    .from("tennis_matches")
    .update({
      status: "COMPLETED",
      winner_player: winnerPlayer,
      result_summary: resultSummary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deleteTennisMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("tennis_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function addTennisPoint(matchId: string, seq: number, winner: Player): Promise<void> {
  const { error } = await supabase.from("tennis_points").insert({ match_id: matchId, seq, winner });
  if (error) throw new Error(error.message);
}

export async function deleteLastTennisPoint(matchId: string, seq: number): Promise<void> {
  const { error } = await supabase.from("tennis_points").delete().eq("match_id", matchId).eq("seq", seq);
  if (error) throw new Error(error.message);
}

export function pointRowToEvent(row: TennisPointRow): PointEvent {
  return { seq: row.seq, winner: row.winner as Player };
}
