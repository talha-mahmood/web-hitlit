import { supabase } from "../supabase";
import { OFFLINE_PATTERN } from "../friendlyError";
import type { Database } from "../../types/database.types";
import type { PlayMode, RallyEvent, Team } from "../badmintonScoring";

export type BadmintonMatch = Database["public"]["Tables"]["badminton_matches"]["Row"];
export type BadmintonRallyRow = Database["public"]["Tables"]["badminton_rallies"]["Row"];

export type BadmintonMatchDetail = BadmintonMatch & { badminton_rallies: BadmintonRallyRow[] };

const MATCH_DETAIL_SELECT = "*, badminton_rallies(*)";

// Same idea as friendlyCricketError/friendlyPadelError/friendlyTennisError/
// friendlyPickleballError — raw Postgres/PostgREST error text is never
// something a player should see.
export function friendlyBadmintonError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (OFFLINE_PATTERN.test(message)) {
    return "You're offline — please check your internet connection and try again.";
  }
  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That rally may have already been recorded — pull to refresh and check the score before scoring the next one.";
  }
  if (!message || /violates|constraint|relation .* does not exist|column .* does not exist|syntax error/i.test(message)) {
    return fallback;
  }
  return message;
}

export async function fetchMyBadmintonMatches(userId: string): Promise<BadmintonMatchDetail[]> {
  const { data, error } = await supabase
    .from("badminton_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BadmintonMatchDetail[];
}

// Network-only — no offline fallback here. That lives in
// fetchMatchWithOfflineFallback (matchSnapshot.ts), used by the matching
// useXMatch hook, which needs access to the live query cache to do it
// correctly.
export async function fetchBadmintonMatch(matchId: string): Promise<BadmintonMatchDetail> {
  const { data, error } = await supabase
    .from("badminton_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as BadmintonMatchDetail;
}

export async function createBadmintonMatch(params: {
  userId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  playMode: PlayMode;
  firstServingTeam: Team;
  teamAServerIndex: 0 | 1;
  teamBServerIndex: 0 | 1;
  pointsToWin: number;
  gamesToWin: number;
  venue?: string;
}): Promise<{ matchId: string }> {
  const { data, error } = await supabase
    .from("badminton_matches")
    .insert({
      user_id: params.userId,
      team_a_name: params.teamAName,
      team_b_name: params.teamBName,
      team_a_players: params.teamAPlayers,
      team_b_players: params.teamBPlayers,
      play_mode: params.playMode,
      first_serving_team: params.firstServingTeam,
      team_a_server_index: params.teamAServerIndex,
      team_b_server_index: params.teamBServerIndex,
      points_to_win: params.pointsToWin,
      games_to_win: params.gamesToWin,
      venue: params.venue?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { matchId: data.id };
}

export async function completeBadmintonMatch(matchId: string, winnerTeam: Team, resultSummary: string): Promise<void> {
  const { error } = await supabase
    .from("badminton_matches")
    .update({
      status: "COMPLETED",
      winner_team: winnerTeam,
      result_summary: resultSummary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deleteBadmintonMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("badminton_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Returns the inserted row's real id so the caller can swap it into the
// already-showing optimistic row in place, instead of invalidating (and so
// refetching) the whole match on every single point — which could race a
// second refetch from whichever point got tapped next and occasionally
// resolve out of order, briefly reverting the score before it self-corrected.
export async function addBadmintonRally(matchId: string, seq: number, winner: Team): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("badminton_rallies")
    .insert({ match_id: matchId, seq, winner })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteLastBadmintonRally(matchId: string, seq: number): Promise<void> {
  const { error } = await supabase.from("badminton_rallies").delete().eq("match_id", matchId).eq("seq", seq);
  if (error) throw new Error(error.message);
}

export function rallyRowToEvent(row: BadmintonRallyRow): RallyEvent {
  return { seq: row.seq, winner: row.winner as Team };
}
