import { supabase } from "../supabase";
import type { Database, Json } from "../../types/database.types";
import { pairTeamsForFixtures } from "../tournamentFixtures";
import type { ManualScore } from "../manualScore";

type MatchRow = Database["public"]["Tables"]["tournament_matches"]["Row"];
type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

export type TournamentMatch = MatchRow & {
  team_a: { id: string; name: string } | null;
  team_b: { id: string; name: string } | null;
  winner_team: { id: string; name: string } | null;
};

// Each team also pulls its joined members so a team with just one player
// can be shown by that player's name (see soloAwareTeamName).
const TEAM_FIELDS = "id, name, tournament_team_members(status, profiles(full_name))";
const MATCH_SELECT = `*, team_a:tournament_teams!tournament_matches_team_a_id_fkey(${TEAM_FIELDS}), team_b:tournament_teams!tournament_matches_team_b_id_fkey(${TEAM_FIELDS}), winner_team:tournament_teams!tournament_matches_winner_team_id_fkey(${TEAM_FIELDS})`;

type TeamWithMembers = {
  id: string;
  name: string;
  tournament_team_members?: { status: string; profiles: { full_name: string | null } | null }[] | null;
};

// A team with exactly one joined player is really just that player — show
// their name instead of the generic "Team A".
export function soloAwareTeamName(
  name: string,
  members: { status: string; full_name: string | null | undefined }[]
): string {
  const joined = members.filter((m) => m.status === "JOINED");
  return joined.length === 1 && joined[0].full_name ? joined[0].full_name : name;
}

function toDisplayTeam(team: TeamWithMembers | null): { id: string; name: string } | null {
  if (!team) return null;
  const members = (team.tournament_team_members ?? []).map((m) => ({ status: m.status, full_name: m.profiles?.full_name }));
  return { id: team.id, name: soloAwareTeamName(team.name, members) };
}

export async function fetchMatchesForTournament(gameId: string): Promise<TournamentMatch[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(MATCH_SELECT)
    .eq("game_id", gameId)
    .order("round", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (MatchRow & { team_a: TeamWithMembers | null; team_b: TeamWithMembers | null; winner_team: TeamWithMembers | null })[]).map(
    (m) => ({ ...m, team_a: toDisplayTeam(m.team_a), team_b: toDisplayTeam(m.team_b), winner_team: toDisplayTeam(m.winner_team) })
  );
}

// Shared by every round's generation — a bye (no second team) is inserted
// already COMPLETED with team_a as the winner, so it never blocks the round
// from being considered "decided" and doesn't need a manual result.
async function insertRound(
  gameId: string,
  round: number,
  pairs: { teamA: { id: string }; teamB: { id: string } | null }[],
  poolId: string | null = null
): Promise<void> {
  if (pairs.length === 0) return;
  const { error } = await supabase.from("tournament_matches").insert(
    pairs.map((p, i) => ({
      game_id: gameId,
      round,
      pool_id: poolId,
      team_a_id: p.teamA.id,
      team_b_id: p.teamB?.id ?? null,
      sort_order: i,
      ...(p.teamB
        ? {}
        : { status: "COMPLETED" as const, winner_team_id: p.teamA.id, played_at: new Date().toISOString() }),
    }))
  );
  if (error) throw new Error(error.message);
}

// Host-only, and only meant to be called once the tournament's team slots
// are full — round 1, paired according to the tournament's actual format
// (round-robin for LEAGUE, single-elimination for KNOCKOUT).
export async function generateMatches(
  gameId: string,
  format: TournamentFormat,
  teams: { id: string; name: string }[]
): Promise<void> {
  await insertRound(gameId, 1, pairTeamsForFixtures(format, teams));
}

// Host-only: the next bracket round, seeded from whichever teams are
// advancing (knockout winners, or a league's top standings for playoffs).
// Always knockout-paired — a semi-final/final stage is inherently
// single-elimination even inside a league tournament.
export async function generateNextRound(
  gameId: string,
  round: number,
  teams: { id: string; name: string }[]
): Promise<void> {
  await insertRound(gameId, round, pairTeamsForFixtures("KNOCKOUT", teams));
}

// Host-only, and only meant to be called once every approved team has been
// assigned to a group — round-robin *within* each pool separately (teams in
// different pools never play each other in the group stage).
export async function generatePoolMatches(
  gameId: string,
  pools: { poolId: string; teams: { id: string; name: string }[] }[]
): Promise<void> {
  for (const pool of pools) {
    await insertRound(gameId, 1, pairTeamsForFixtures("LEAGUE", pool.teams), pool.poolId);
  }
}

// Records a result the host typed in by hand (see ManualScoreScreen) — the
// winner/draw plus the score detail the match card shows. The tournament
// match's team ids are looked up here so the screen only has to say A or B.
export async function enterManualScore(
  matchId: string,
  result: { winner: "A" | "B" | null; isDraw: boolean; manualScore: ManualScore }
): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("tournament_matches")
    .select("team_a_id, team_b_id")
    .eq("id", matchId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const winnerTeamId = result.isDraw ? null : result.winner === "A" ? data.team_a_id : data.team_b_id;
  const { error } = await supabase
    .from("tournament_matches")
    .update({
      status: "COMPLETED",
      winner_team_id: winnerTeamId,
      is_draw: result.isDraw,
      played_at: new Date().toISOString(),
      manual_score: result.manualScore as unknown as Json,
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Tournament-only: the host assigns one tournament member as the scorer for
// this specific match — only that member (or the host themselves) then sees
// "Go To Scorecard"/"Enter Score Manually" for it. Enforced server-side by
// tournament_matches_write_host/tournament_matches_write_scorer.
export async function setMatchScorer(matchId: string, scorerUserId: string | null): Promise<void> {
  const { error } = await supabase
    .from("tournament_matches")
    .update({ scorer_user_id: scorerUserId })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Remembers which cricket_matches row "Go To Scorecard" created for this
// tournament match, so tapping it again re-opens the same live-scoring
// session instead of starting a duplicate one.
export async function linkCricketMatch(matchId: string, cricketMatchId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_matches")
    .update({ cricket_match_id: cricketMatchId })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Called once a Live Scoring match finishes — if that cricket match was
// started from a tournament match (via "Go To Scorecard"), carries its
// result straight into tournament_matches so the host never has to
// manually re-enter "Team X won" for a match that was actually scored ball
// by ball. teamAWon is null for a tie (cricket's "A"/"B" sides map 1:1 to
// this tournament match's team_a/team_b, since that's how the cricket match
// was created in the first place). A no-op if this cricket match isn't
// linked to any tournament match (e.g. a standalone scorecard).
export async function syncCricketMatchResult(cricketMatchId: string, teamAWon: boolean | null): Promise<void> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("id, team_a_id, team_b_id")
    .eq("cricket_match_id", cricketMatchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;

  const winnerTeamId = teamAWon === null ? null : teamAWon ? data.team_a_id : data.team_b_id;
  const { error: updateError } = await supabase
    .from("tournament_matches")
    .update({
      status: "COMPLETED",
      winner_team_id: winnerTeamId,
      is_draw: teamAWon === null,
      played_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (updateError) throw new Error(updateError.message);
}

// The same "Go To Scorecard" link/sync plumbing as cricket's, generalized
// across the other six sports (padel, tennis, badminton, pickleball, table
// tennis, football) — unlike the scoring engines, this is plain CRUD with
// no sport-specific rules, so one parametrized pair of functions covers all
// six instead of duplicating linkCricketMatch/syncCricketMatchResult six times.
export type ScorecardSport = "padel" | "tennis" | "badminton" | "pickleball" | "table_tennis" | "football";

// What "Go To Scorecard" hands off to a sport's New Match screen for a
// tournament match — team names/rosters/venue are already known (from the
// tournament team roster and the game's booked venue), so that screen
// locks those specific fields instead of asking the host to retype them,
// while every match-rule field (format, points/games targets, play mode,
// server, etc.) stays a normal, editable choice.
export type ScorecardPrefill = {
  tournamentMatchId: string;
  gameId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  venue?: string;
};

const SPORT_MATCH_ID_COLUMN: Record<ScorecardSport, string> = {
  padel: "padel_match_id",
  tennis: "tennis_match_id",
  badminton: "badminton_match_id",
  pickleball: "pickleball_match_id",
  table_tennis: "table_tennis_match_id",
  football: "football_match_id",
};

// Remembers which <sport>_matches row "Go To Scorecard" created for this
// tournament match, so opening it again re-opens the same live-scoring
// session instead of starting a duplicate one.
export async function linkScorecardMatch(matchId: string, sport: ScorecardSport, scorecardMatchId: string): Promise<void> {
  const column = SPORT_MATCH_ID_COLUMN[sport];
  const { error } = await supabase
    .from("tournament_matches")
    .update({ [column]: scorecardMatchId } as never)
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Called once a Live Scoring match finishes — if it was started from a
// tournament match (via "Go To Scorecard"), carries its result straight
// into tournament_matches, same as syncCricketMatchResult. A no-op if this
// scorecard match isn't linked to any tournament match (e.g. a standalone
// scorecard created from the Scorecard tab directly).
export async function syncScorecardMatchResult(
  sport: ScorecardSport,
  scorecardMatchId: string,
  teamAWon: boolean | null
): Promise<void> {
  const column = SPORT_MATCH_ID_COLUMN[sport];
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("id, team_a_id, team_b_id")
    .eq(column, scorecardMatchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;

  const winnerTeamId = teamAWon === null ? null : teamAWon ? data.team_a_id : data.team_b_id;
  const { error: updateError } = await supabase
    .from("tournament_matches")
    .update({
      status: "COMPLETED",
      winner_team_id: winnerTeamId,
      is_draw: teamAWon === null,
      played_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (updateError) throw new Error(updateError.message);
}
