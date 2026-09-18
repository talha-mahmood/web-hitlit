import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import type { GoalEvent, PenaltyKick, Phase, Team } from "../footballScoring";

export type FootballMatch = Database["public"]["Tables"]["football_matches"]["Row"];
export type FootballGoalRow = Database["public"]["Tables"]["football_goals"]["Row"];
export type FootballPenaltyKickRow = Database["public"]["Tables"]["football_penalty_kicks"]["Row"];

export type FootballMatchDetail = FootballMatch & {
  football_goals: FootballGoalRow[];
  football_penalty_kicks: FootballPenaltyKickRow[];
};

const MATCH_DETAIL_SELECT = "*, football_goals(*), football_penalty_kicks(*)";

// Same idea as the other sports' friendly-error helpers — raw Postgres/
// PostgREST error text is never something a player should see.
export function friendlyFootballError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That event may have already been recorded — pull to refresh and check the score before continuing.";
  }
  if (!message || /violates|constraint|relation .* does not exist|column .* does not exist|syntax error/i.test(message)) {
    return fallback;
  }
  return message;
}

export async function fetchMyFootballMatches(userId: string): Promise<FootballMatchDetail[]> {
  const { data, error } = await supabase
    .from("football_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FootballMatchDetail[];
}

export async function fetchFootballMatch(matchId: string): Promise<FootballMatchDetail> {
  const { data, error } = await supabase
    .from("football_matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as FootballMatchDetail;
}

export async function createFootballMatch(params: {
  userId: string;
  teamAName: string;
  teamBName: string;
  requiresWinner: boolean;
  halfDurationMinutes: number;
  venue?: string;
}): Promise<{ matchId: string }> {
  const { data, error } = await supabase
    .from("football_matches")
    .insert({
      user_id: params.userId,
      team_a_name: params.teamAName,
      team_b_name: params.teamBName,
      requires_winner: params.requiresWinner,
      half_duration_minutes: params.halfDurationMinutes,
      venue: params.venue?.trim() || null,
      // Kicks off immediately — this app has no "scheduled, not yet
      // started" state for any of the other sports either, matches that.
      phase: "FIRST_HALF",
      first_half_kickoff_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { matchId: data.id };
}

export type RunningPhase = "FIRST_HALF" | "SECOND_HALF" | "EXTRA_TIME_FIRST" | "EXTRA_TIME_SECOND";
export type BreakPhase = "HALF_TIME" | "FULL_TIME" | "EXTRA_TIME_BREAK" | "EXTRA_TIME_FULL_TIME";

const KICKOFF_COLUMN: Record<Exclude<RunningPhase, "FIRST_HALF">, string> = {
  SECOND_HALF: "second_half_kickoff_at",
  EXTRA_TIME_FIRST: "extra_time_first_kickoff_at",
  EXTRA_TIME_SECOND: "extra_time_second_kickoff_at",
};

const ADDED_MINUTES_COLUMN: Record<RunningPhase, string> = {
  FIRST_HALF: "first_half_added_minutes",
  SECOND_HALF: "second_half_added_minutes",
  EXTRA_TIME_FIRST: "extra_time_first_added_minutes",
  EXTRA_TIME_SECOND: "extra_time_second_added_minutes",
};

// Kicks off the second half, or either extra-time period — records "now"
// as that period's kickoff instant, which is what the continuous match
// clock is measured from.
export async function startRunningPeriod(
  matchId: string,
  phase: Exclude<RunningPhase, "FIRST_HALF">
): Promise<void> {
  const column = KICKOFF_COLUMN[phase];
  const { error } = await supabase
    .from("football_matches")
    .update({ phase, [column]: new Date().toISOString() } as never)
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Ends a running period (first half, second half, or either extra-time
// period), recording the referee's added time and moving to the
// corresponding break/decision phase.
export async function endRunningPeriod(
  matchId: string,
  endingPhase: RunningPhase,
  addedMinutes: number,
  resultingPhase: BreakPhase
): Promise<void> {
  const column = ADDED_MINUTES_COLUMN[endingPhase];
  const { error } = await supabase
    .from("football_matches")
    .update({ phase: resultingPhase, [column]: addedMinutes } as never)
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function startPenalties(matchId: string): Promise<void> {
  const { error } = await supabase.from("football_matches").update({ phase: "PENALTIES" }).eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function completeFootballMatch(
  matchId: string,
  completion: { winnerTeam: Team | null; isDraw: boolean; resultSummary: string }
): Promise<void> {
  const { error } = await supabase
    .from("football_matches")
    .update({
      phase: "COMPLETE",
      status: "COMPLETED",
      winner_team: completion.winnerTeam,
      is_draw: completion.isDraw,
      result_summary: completion.resultSummary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deleteFootballMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("football_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function addFootballGoal(matchId: string, seq: number, team: Team, phase: Phase, minuteLabel: string): Promise<void> {
  const { error } = await supabase
    .from("football_goals")
    .insert({ match_id: matchId, seq, team, phase, minute_label: minuteLabel });
  if (error) throw new Error(error.message);
}

export async function deleteLastFootballGoal(matchId: string, seq: number): Promise<void> {
  const { error } = await supabase.from("football_goals").delete().eq("match_id", matchId).eq("seq", seq);
  if (error) throw new Error(error.message);
}

export async function addPenaltyKick(matchId: string, seq: number, team: Team, scored: boolean): Promise<void> {
  const { error } = await supabase.from("football_penalty_kicks").insert({ match_id: matchId, seq, team, scored });
  if (error) throw new Error(error.message);
}

export async function deleteLastPenaltyKick(matchId: string, seq: number): Promise<void> {
  const { error } = await supabase.from("football_penalty_kicks").delete().eq("match_id", matchId).eq("seq", seq);
  if (error) throw new Error(error.message);
}

export function goalRowToEvent(row: FootballGoalRow): GoalEvent {
  return { seq: row.seq, team: row.team as Team, phase: row.phase as Phase, minuteLabel: row.minute_label };
}

export function penaltyKickRowToEvent(row: FootballPenaltyKickRow): PenaltyKick {
  return { seq: row.seq, team: row.team as Team, scored: row.scored };
}
