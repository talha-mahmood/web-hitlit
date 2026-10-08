import { supabase } from "../supabase";
import { OFFLINE_PATTERN } from "../friendlyError";
import type { Database } from "../../types/database.types";
import type { BallEvent, ExtraType, WicketType } from "../cricketScoring";

export type CricketMatch = Database["public"]["Tables"]["cricket_matches"]["Row"];
export type CricketInnings = Database["public"]["Tables"]["cricket_innings"]["Row"];
export type CricketBallRow = Database["public"]["Tables"]["cricket_balls"]["Row"];

// Postgres/PostgREST error text ("duplicate key value violates unique
// constraint ...") is never something a player should see — this maps the
// telltale raw-database phrasing to a plain-language message, and falls
// back to the caller's own fallback text for anything else unrecognized.
// Errors we throw ourselves elsewhere (e.g. "Team names must be unique...")
// already read fine and pass through untouched.
export function friendlyCricketError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (OFFLINE_PATTERN.test(message)) {
    return "You're offline — please check your internet connection and try again.";
  }
  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That ball may have already been recorded — pull to refresh and check the score before scoring the next one.";
  }
  if (!message || /violates|constraint|relation .* does not exist|column .* does not exist|syntax error/i.test(message)) {
    return fallback;
  }
  return message;
}

export type CricketMatchDetail = CricketMatch & {
  cricket_innings: (CricketInnings & { cricket_balls: CricketBallRow[] })[];
};

const MATCH_DETAIL_SELECT = "*, cricket_innings(*, cricket_balls(*))";

export async function fetchMyCricketMatches(userId: string): Promise<CricketMatchDetail[]> {
  const { data, error } = await supabase
    .from("cricket_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CricketMatchDetail[];
}

// Network-only — no offline fallback here. That lives in
// fetchMatchWithOfflineFallback (matchSnapshot.ts), used by useCricketMatch,
// which needs access to the live query cache to do it correctly.
export async function fetchCricketMatch(matchId: string): Promise<CricketMatchDetail> {
  const { data, error } = await supabase
    .from("cricket_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as CricketMatchDetail;
}

// "View Scoring" — looks up any match (not just the viewer's own) by its
// short scoring_code, for the read-only FullScorecard view. Relies on the
// cricket_matches_select_any RLS policy (any signed-in user can SELECT),
// unlike every other read in this file which is implicitly scoped to the
// caller's own matches by the owner-only policy.
export async function findCricketMatchByCode(code: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("cricket_matches")
    .select("id")
    .eq("scoring_code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCricketMatch(params: {
  userId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  oversLimit: number;
  format: "T10" | "T20" | "ODI" | "Club";
  tossWinner: "A" | "B";
  tossDecision: "BAT" | "BOWL";
  venue?: string;
}): Promise<{ matchId: string; inningsId: string; battingTeam: "A" | "B" }> {
  const { data: match, error } = await supabase
    .from("cricket_matches")
    .insert({
      user_id: params.userId,
      team_a_name: params.teamAName,
      team_b_name: params.teamBName,
      team_a_players: params.teamAPlayers,
      team_b_players: params.teamBPlayers,
      overs_limit: params.oversLimit,
      format: params.format,
      toss_winner: params.tossWinner,
      toss_decision: params.tossDecision,
      venue: params.venue?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const battingTeam: "A" | "B" =
    (params.tossWinner === "A") === (params.tossDecision === "BAT") ? "A" : "B";

  const { data: innings, error: inningsError } = await supabase
    .from("cricket_innings")
    .insert({ match_id: match.id, innings_number: 1, batting_team: battingTeam })
    .select()
    .single();
  if (inningsError) throw new Error(inningsError.message);

  return { matchId: match.id, inningsId: innings.id, battingTeam };
}

export async function startSecondInnings(
  matchId: string,
  battingTeam: "A" | "B",
  // Lets the caller pin the row to an id it already generated and is using
  // locally (so scoring can continue offline before this insert has ever
  // reached the server — see useCricket.ts) — omitted, the column's own
  // gen_random_uuid() default applies, same as before this existed.
  inningsId?: string
): Promise<{ inningsId: string }> {
  const { data, error } = await supabase
    .from("cricket_innings")
    .insert({ id: inningsId, match_id: matchId, innings_number: 2, batting_team: battingTeam })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { inningsId: data.id };
}

export async function markInningsComplete(inningsId: string): Promise<void> {
  const { error } = await supabase
    .from("cricket_innings")
    .update({ is_completed: true })
    .eq("id", inningsId);
  if (error) throw new Error(error.message);
}

export async function completeCricketMatch(matchId: string, resultSummary: string, completedAt?: string): Promise<void> {
  const { error } = await supabase
    .from("cricket_matches")
    .update({ status: "COMPLETED", result_summary: resultSummary, completed_at: completedAt ?? new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deleteCricketMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("cricket_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function abandonCricketMatch(matchId: string): Promise<void> {
  const { error } = await supabase
    .from("cricket_matches")
    .update({ status: "ABANDONED", completed_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Mid-match roster addition (Match Centre > Select Batsman > Add/Create
// Player) — appends a name to whichever side is currently batting. Players
// are plain name text everywhere in this schema (see matchNameValidation's
// disambiguateRoster), so this just appends to the same array the match was
// created with.
export async function addRosterPlayer(matchId: string, team: "A" | "B", name: string, existingPlayers: string[]): Promise<void> {
  const nextRoster = [...existingPlayers, name];
  const { error } = await supabase
    .from("cricket_matches")
    .update(team === "A" ? { team_a_players: nextRoster } : { team_b_players: nextRoster })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export type CricketMatchSettingsUpdate = {
  oversLimit?: number;
  format?: "T10" | "T20" | "ODI" | "Club";
  venue?: string | null;
  targetOverride?: number | null;
};

export async function updateCricketMatchSettings(matchId: string, updates: CricketMatchSettingsUpdate): Promise<void> {
  const { error } = await supabase
    .from("cricket_matches")
    .update({
      ...(updates.oversLimit !== undefined ? { overs_limit: updates.oversLimit } : {}),
      ...(updates.format !== undefined ? { format: updates.format } : {}),
      ...(updates.venue !== undefined ? { venue: updates.venue } : {}),
      ...(updates.targetOverride !== undefined ? { target_override: updates.targetOverride } : {}),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Returns the inserted row's real id so the caller can swap it into the
// already-showing optimistic row in place (see useAddCricketBall) instead
// of having to refetch the whole match to find out what the server actually
// assigned — refetching here raced a *second* refetch from whichever ball
// got tapped next, and the two could resolve out of order, which is what
// briefly reverted the score before self-correcting on the next one.
export async function addCricketBall(inningsId: string, seq: number, ball: BallEvent): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("cricket_balls")
    .insert({
      innings_id: inningsId,
      seq,
      striker_name: ball.strikerName,
      non_striker_name: ball.nonStrikerName,
      bowler_name: ball.bowlerName,
      runs_batted: ball.runsBatted,
      extra_type: ball.extraType,
      extra_runs: ball.extraRuns,
      is_wicket: ball.isWicket,
      wicket_type: ball.wicketType,
      dismissed_name: ball.dismissedName,
      fielder_name: ball.fielderName,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteLastCricketBall(inningsId: string, seq: number): Promise<void> {
  const { error } = await supabase
    .from("cricket_balls")
    .delete()
    .eq("innings_id", inningsId)
    .eq("seq", seq);
  if (error) throw new Error(error.message);
}

export function ballRowToEvent(row: CricketBallRow): BallEvent {
  return {
    seq: row.seq,
    strikerName: row.striker_name,
    nonStrikerName: row.non_striker_name,
    bowlerName: row.bowler_name,
    runsBatted: row.runs_batted,
    extraType: row.extra_type as ExtraType,
    extraRuns: row.extra_runs,
    isWicket: row.is_wicket,
    wicketType: row.wicket_type as WicketType | null,
    dismissedName: row.dismissed_name,
    fielderName: row.fielder_name,
  };
}
