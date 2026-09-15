import { supabase } from "../supabase";
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

export async function fetchCricketMatch(matchId: string): Promise<CricketMatchDetail> {
  const { data, error } = await supabase
    .from("cricket_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as CricketMatchDetail;
}

export async function createCricketMatch(params: {
  userId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  oversLimit: number;
  tossWinner: "A" | "B";
  tossDecision: "BAT" | "BOWL";
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
      toss_winner: params.tossWinner,
      toss_decision: params.tossDecision,
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
  battingTeam: "A" | "B"
): Promise<{ inningsId: string }> {
  const { data, error } = await supabase
    .from("cricket_innings")
    .insert({ match_id: matchId, innings_number: 2, batting_team: battingTeam })
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

export async function completeCricketMatch(matchId: string, resultSummary: string): Promise<void> {
  const { error } = await supabase
    .from("cricket_matches")
    .update({ status: "COMPLETED", result_summary: resultSummary, completed_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deleteCricketMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("cricket_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function addCricketBall(inningsId: string, seq: number, ball: BallEvent): Promise<void> {
  const { error } = await supabase.from("cricket_balls").insert({
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
  });
  if (error) throw new Error(error.message);
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
