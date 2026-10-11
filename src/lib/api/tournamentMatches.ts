import { supabase } from "../supabase";
import type { Database, Json } from "../../types/database.types";
import { pairTeamsForFixtures } from "../tournamentFixtures";
import type { ManualScore } from "../manualScore";
import { fetchCricketMatchesForNRR, ballRowToEvent } from "./cricket";
import { computeInningsForNRR, aggregateNRR, type NRRMatchEntry } from "../netRunRate";

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

// Host picks a date/time for a specific match by hand — there's no
// automatic conflict-checking against venue slot/pitch availability, this
// is just "when did you plan to play this one" shown on its match card.
export async function updateMatchSchedule(matchId: string, scheduledAt: string | null): Promise<void> {
  const { error } = await supabase
    .from("tournament_matches")
    .update({ scheduled_at: scheduledAt })
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
//
// Each player carries the real tournament member's user_id (not just their
// display name) — two different real people can share a display name, and
// without the id there'd be no way to tell that apart from the same name
// typed twice by hand, so the New Match screen's duplicate-name check would
// block it even though it's a real, valid roster (see matchNameValidation.ts).
export type ScorecardPrefillPlayer = { name: string; userId: string | null };

export type ScorecardPrefill = {
  tournamentMatchId: string;
  gameId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: ScorecardPrefillPlayer[];
  teamBPlayers: ScorecardPrefillPlayer[];
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

// Net Run Rate, aggregated across every completed cricket match in a
// tournament — cricket-only (other sports have no NRR equivalent). A
// completed match with no linked cricket_match_id (e.g. a manually-entered
// result with no ball-by-ball data) simply contributes nothing; a team
// with zero eligible matches has no entry in the returned map at all
// (computeStandings/StandingsPanel treat a missing entry as "NRR
// unavailable", never a fabricated 0).
export async function computeTournamentTeamNRR(
  matches: Pick<TournamentMatch, "status" | "team_a_id" | "team_b_id" | "cricket_match_id">[]
): Promise<Map<string, number>> {
  const eligible = matches.filter(
    (m): m is typeof m & { cricket_match_id: string; team_a_id: string; team_b_id: string } =>
      m.status === "COMPLETED" && !!m.cricket_match_id && !!m.team_a_id && !!m.team_b_id
  );
  if (eligible.length === 0) return new Map();

  const cricketMatchIds = eligible.map((m) => m.cricket_match_id);
  const cricketMatches = await fetchCricketMatchesForNRR(cricketMatchIds);
  const cricketById = new Map(cricketMatches.map((cm) => [cm.id, cm]));

  const entriesByTeam = new Map<string, NRRMatchEntry[]>();
  const addEntry = (teamId: string, entry: NRRMatchEntry) => {
    const list = entriesByTeam.get(teamId) ?? [];
    list.push(entry);
    entriesByTeam.set(teamId, list);
  };

  for (const m of eligible) {
    const cm = cricketById.get(m.cricket_match_id);
    if (!cm) continue; // host can't see this scorecard, or it was deleted
    const inningsA = cm.cricket_innings.find((i) => i.batting_team === "A");
    const inningsB = cm.cricket_innings.find((i) => i.batting_team === "B");
    if (!inningsA || !inningsB) continue; // one side never actually batted

    const resultA = computeInningsForNRR(inningsA.cricket_balls.map(ballRowToEvent), cm.overs_limit, cm.team_a_players.length);
    const resultB = computeInningsForNRR(inningsB.cricket_balls.map(ballRowToEvent), cm.overs_limit, cm.team_b_players.length);

    addEntry(m.team_a_id, { runsFor: resultA.runs, ballsFor: resultA.legalBalls, runsAgainst: resultB.runs, ballsAgainst: resultB.legalBalls });
    addEntry(m.team_b_id, { runsFor: resultB.runs, ballsFor: resultB.legalBalls, runsAgainst: resultA.runs, ballsAgainst: resultA.legalBalls });
  }

  const nrrByTeam = new Map<string, number>();
  for (const [teamId, entries] of entriesByTeam) {
    const nrr = aggregateNRR(entries);
    if (nrr !== null) nrrByTeam.set(teamId, nrr);
  }
  return nrrByTeam;
}
