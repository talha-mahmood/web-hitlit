import { supabase } from "../supabase";
import { OFFLINE_PATTERN } from "../friendlyError";
import type { Database } from "../../types/database.types";
import type { DeuceType, MatchFormat, PointEvent, Team } from "../padelScoring";

export type PadelMatch = Database["public"]["Tables"]["padel_matches"]["Row"];
export type PadelPointRow = Database["public"]["Tables"]["padel_points"]["Row"];

export type PadelMatchDetail = PadelMatch & { padel_points: PadelPointRow[] };

const MATCH_DETAIL_SELECT = "*, padel_points(*)";

// Same idea as friendlyCricketError — raw Postgres/PostgREST error text is
// never something a player should see.
export function friendlyPadelError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (OFFLINE_PATTERN.test(message)) {
    return "You're offline — please check your internet connection and try again.";
  }
  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That point may have already been recorded — pull to refresh and check the score before scoring the next one.";
  }
  if (!message || /violates|constraint|relation .* does not exist|column .* does not exist|syntax error/i.test(message)) {
    return fallback;
  }
  return message;
}

export async function fetchMyPadelMatches(userId: string): Promise<PadelMatchDetail[]> {
  const { data, error } = await supabase
    .from("padel_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PadelMatchDetail[];
}

// Network-only — no offline fallback here. That lives in
// fetchMatchWithOfflineFallback (matchSnapshot.ts), used by the matching
// useXMatch hook, which needs access to the live query cache to do it
// correctly.
export async function fetchPadelMatch(matchId: string): Promise<PadelMatchDetail> {
  const { data, error } = await supabase
    .from("padel_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as PadelMatchDetail;
}

// "View Scoring" — looks up any match (not just the viewer's own) by its
// short scoring_code, for the read-only FullScorecard view. Relies on the
// padel_matches_select_any RLS policy (any signed-in user can SELECT),
// unlike every other read in this file which is implicitly scoped to the
// caller's own matches by the owner-only policy.
export async function findPadelMatchByCode(code: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("padel_matches")
    .select("id")
    .eq("scoring_code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPadelMatch(params: {
  userId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  format: MatchFormat;
  deuceType: DeuceType;
  firstServerTeam: Team;
  firstServerPlayerIndex: 0 | 1;
  gamesPerSet: number;
  playMode: "SINGLES" | "DOUBLES";
  venue?: string;
}): Promise<{ matchId: string }> {
  const { data, error } = await supabase
    .from("padel_matches")
    .insert({
      user_id: params.userId,
      team_a_name: params.teamAName,
      team_b_name: params.teamBName,
      team_a_players: params.teamAPlayers,
      team_b_players: params.teamBPlayers,
      format: params.format,
      deuce_type: params.deuceType,
      first_server_team: params.firstServerTeam,
      first_server_player_index: params.firstServerPlayerIndex,
      games_per_set: params.gamesPerSet,
      play_mode: params.playMode,
      venue: params.venue?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { matchId: data.id };
}

export async function completePadelMatch(matchId: string, winnerTeam: Team, resultSummary: string): Promise<void> {
  const { error } = await supabase
    .from("padel_matches")
    .update({
      status: "COMPLETED",
      winner_team: winnerTeam,
      result_summary: resultSummary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deletePadelMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("padel_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Returns the inserted row's real id so the caller can swap it into the
// already-showing optimistic row in place, instead of invalidating (and so
// refetching) the whole match on every single point — which could race a
// second refetch from whichever point got tapped next and occasionally
// resolve out of order, briefly reverting the score before it self-corrected.
export async function addPadelPoint(matchId: string, seq: number, winner: Team): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("padel_points")
    .insert({ match_id: matchId, seq, winner })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteLastPadelPoint(matchId: string, seq: number): Promise<void> {
  const { error } = await supabase.from("padel_points").delete().eq("match_id", matchId).eq("seq", seq);
  if (error) throw new Error(error.message);
}

export function pointRowToEvent(row: PadelPointRow): PointEvent {
  return { seq: row.seq, winner: row.winner as Team };
}
