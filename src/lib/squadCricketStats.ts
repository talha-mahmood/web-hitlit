// Squad/team-level cricket stats — the team-scoped counterpart to
// playerCricketStats.ts. Reuses every low-level primitive from there
// (computePlayerFigures, aggregateBatting/Bowling/Fielding, matchTeamScores,
// the result_summary.startsWith(`${name} won`) win/loss heuristic) rather
// than inventing new math; the only genuinely new piece is fetching matches
// by team-name equality (playerCricketStats only matches player-array
// membership) and combining the per-player primitives across a whole roster.
//
// Identity is name-matching against squads.name / cricket_matches.team_a_name
// /team_b_name — the same documented limitation the rest of this app's
// cricket stats already carry (no FK from a match to a squad/tournament_team
// row), so a squad renamed after playing under its old name won't retroactively
// pick up those matches, same as a player's stats wouldn't follow a name change.
import { supabase } from "./supabase";
import type { CricketMatchDetail } from "./api/cricket";
import {
  type CricketFormat,
  type MatchFigures,
  type TeamScore,
  type BattingTotals,
  type BowlingTotals,
  type FieldingTotals,
  matchTeamScores,
  computePlayerFigures,
  aggregateBatting,
  aggregateBowling,
  aggregateFielding,
} from "./playerCricketStats";

// Every cricket match (any status) this team's name appears in, either side
// — two queries + a merge-by-id rather than a single .or() filter string, so
// a squad name containing `,`/`(`/`)` (which would otherwise break
// PostgREST's .or() syntax) never needs escaping.
export async function fetchSquadCricketMatches(teamName: string, sportId?: string | null): Promise<CricketMatchDetail[]> {
  const buildQuery = () => {
    let q = supabase.from("cricket_matches").select("*, cricket_innings(*, cricket_balls(*))");
    if (sportId) q = q.eq("sport_id", sportId);
    return q;
  };
  const [aRes, bRes] = await Promise.all([
    buildQuery().ilike("team_a_name", teamName),
    buildQuery().ilike("team_b_name", teamName),
  ]);
  if (aRes.error) throw new Error(aRes.error.message);
  if (bRes.error) throw new Error(bRes.error.message);
  const merged = new Map<string, CricketMatchDetail>();
  for (const m of (aRes.data ?? []) as unknown as CricketMatchDetail[]) merged.set(m.id, m);
  for (const m of (bRes.data ?? []) as unknown as CricketMatchDetail[]) merged.set(m.id, m);
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export type SquadMatchFigures = {
  matchId: string;
  date: string;
  format: CricketFormat;
  myTeamName: string;
  opponentTeamName: string;
  won: boolean | null;
  // true = batted first, false = bowled first, null = no innings recorded yet
  battedFirst: boolean | null;
  myScore: TeamScore;
  opponentScore: TeamScore;
  // true when this team called correctly or was awarded the toss, matching
  // the exact string in cricket_matches.toss_winner.
  tossWon: boolean;
  isTied: boolean;
};

// Team-level per-match figures — the team-scoped sibling of
// computeMatchFigures, same win/loss derivation (result_summary text, not a
// stored column — this app has never had one) so it can never disagree with
// what a player's own stats already say about the same match.
export function computeSquadMatchFigures(match: CricketMatchDetail, teamName: string): SquadMatchFigures | null {
  const norm = (s: string) => s.trim().toLowerCase();
  const onA = norm(match.team_a_name) === norm(teamName);
  const onB = norm(match.team_b_name) === norm(teamName);
  if (!onA && !onB) return null;
  const myTeamName = onA ? match.team_a_name : match.team_b_name;
  const opponentTeamName = onA ? match.team_b_name : match.team_a_name;
  const scores = matchTeamScores(match);
  const myScore = onA ? scores.A : scores.B;
  const opponentScore = onA ? scores.B : scores.A;
  const won = match.result_summary
    ? match.result_summary.startsWith(`${myTeamName} won`)
      ? true
      : /tied/i.test(match.result_summary)
        ? null
        : false
    : null;
  const firstInnings = match.cricket_innings.find((i) => i.innings_number === 1);
  const battedFirst = firstInnings ? firstInnings.batting_team === (onA ? "A" : "B") : null;
  return {
    matchId: match.id,
    date: match.completed_at ?? match.created_at,
    format: (match.format as CricketFormat) ?? "Club",
    myTeamName,
    opponentTeamName,
    won,
    battedFirst,
    myScore,
    opponentScore,
    tossWon: norm(match.toss_winner ?? "") === norm(myTeamName),
    isTied: won === null && !!match.result_summary && /tied/i.test(match.result_summary),
  };
}

export function computeSquadFigures(matches: CricketMatchDetail[], teamName: string): SquadMatchFigures[] {
  return matches
    .map((m) => computeSquadMatchFigures(m, teamName))
    .filter((f): f is SquadMatchFigures => f !== null);
}

export type SquadRecordSplit = { matches: number; won: number; lost: number; winPercent: number };

// "Both" / "Bat First" / "Bowl First" toggle on the Overview tab's Win Loss
// Ratio card — tied/unresolved matches are excluded from the denominator,
// same as how a tied/no-result match contributes nothing to a win% anywhere
// else in cricket.
export function squadWinLossRecord(
  figures: SquadMatchFigures[],
  filter: "all" | "batFirst" | "bowlFirst" = "all",
  limit?: number
): SquadRecordSplit {
  const windowed = limit ? figures.slice(0, limit) : figures;
  const rows = windowed.filter((f) => {
    if (f.won === null) return false;
    if (filter === "batFirst") return f.battedFirst === true;
    if (filter === "bowlFirst") return f.battedFirst === false;
    return true;
  });
  const won = rows.filter((f) => f.won === true).length;
  const matches = rows.length;
  return { matches, won, lost: matches - won, winPercent: matches > 0 ? (won / matches) * 100 : 0 };
}

export type SquadFormEntry = { matchId: string; letter: "W" | "L" | "T" };

export function squadRecentForm(figures: SquadMatchFigures[], limit = 5): SquadFormEntry[] {
  return figures.slice(0, limit).map((f) => ({ matchId: f.matchId, letter: f.won === true ? "W" : f.won === false ? "L" : "T" }));
}

export type SquadTrendPoint = { matchId: string; value: number };

// Feeds the "Runs Scored In Recent Matches" / "Wickets Taken In Recent
// Matches" bar charts — wickets taken by my team while bowling is just the
// opponent's wickets lost, already available from matchTeamScores with no
// extra computation.
export function squadRunsWicketsTrend(figures: SquadMatchFigures[], limit = 5): { runsScored: SquadTrendPoint[]; wicketsTaken: SquadTrendPoint[] } {
  const window = figures.slice(0, limit);
  return {
    runsScored: window.map((f) => ({ matchId: f.matchId, value: f.myScore?.runs ?? 0 })),
    wicketsTaken: window.map((f) => ({ matchId: f.matchId, value: f.opponentScore?.wickets ?? 0 })),
  };
}

// Every roster member's per-match figures, scoped to matches this team
// actually played (not every match that player has ever played, for any
// team) — computePlayerFigures just needs a match list + a name, so handing
// it the already team-filtered match list is what scopes it correctly.
export function squadPlayerFigures(matches: CricketMatchDetail[], memberFullNames: string[]): Map<string, MatchFigures[]> {
  const map = new Map<string, MatchFigures[]>();
  for (const name of memberFullNames) {
    map.set(name, computePlayerFigures(matches, name));
  }
  return map;
}

export type TopPerformerRow = { name: string; runs: number; battingAverage: number; wickets: number; bowlingAverage: number };

// A simple runs+wickets blend to rank the roster for the Overview tab's "Top
// Performers" panel — not the same thing as the Statistics tab's separate,
// explicitly-labeled MVP formula (see squadMvpPoints), just a quick "who's
// been doing the most" readout.
export function squadTopPerformers(playerFiguresByName: Map<string, MatchFigures[]>, limit = 3): TopPerformerRow[] {
  const rows = Array.from(playerFiguresByName.entries())
    .map(([name, figs]) => {
      const bat = aggregateBatting(figs);
      const bowl = aggregateBowling(figs);
      return { name, runs: bat.runs, battingAverage: bat.average, wickets: bowl.wickets, bowlingAverage: bowl.average };
    })
    .filter((r) => r.runs > 0 || r.wickets > 0);
  return rows.sort((a, b) => b.runs + b.wickets * 20 - (a.runs + a.wickets * 20)).slice(0, limit);
}

export type SquadTeamStats = {
  matches: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  winPercent: number;
  highScore: number;
  lowScore: number;
  highConceded: number;
  lowConceded: number;
  tossWonCount: number;
  battedFirstCount: number;
  bowledFirstCount: number;
  batFirstWinPercent: number;
  bowlFirstWinPercent: number;
};

// Statistics tab's Team > Overview sub-tab.
export function squadTeamOverviewStats(figures: SquadMatchFigures[]): SquadTeamStats {
  const decided = figures.filter((f) => f.won !== null);
  const won = decided.filter((f) => f.won === true).length;
  const lost = decided.filter((f) => f.won === false).length;
  const tied = figures.filter((f) => f.isTied).length;
  const scored = figures.filter((f): f is SquadMatchFigures & { myScore: NonNullable<TeamScore> } => !!f.myScore);
  const conceded = figures.filter((f): f is SquadMatchFigures & { opponentScore: NonNullable<TeamScore> } => !!f.opponentScore);
  const batFirstRecord = squadWinLossRecord(figures, "batFirst");
  const bowlFirstRecord = squadWinLossRecord(figures, "bowlFirst");
  return {
    matches: figures.length,
    won,
    lost,
    tied,
    noResult: figures.length - won - lost - tied,
    winPercent: decided.length > 0 ? (won / decided.length) * 100 : 0,
    highScore: scored.length ? Math.max(...scored.map((f) => f.myScore.runs)) : 0,
    lowScore: scored.length ? Math.min(...scored.map((f) => f.myScore.runs)) : 0,
    highConceded: conceded.length ? Math.max(...conceded.map((f) => f.opponentScore.runs)) : 0,
    lowConceded: conceded.length ? Math.min(...conceded.map((f) => f.opponentScore.runs)) : 0,
    tossWonCount: figures.filter((f) => f.tossWon).length,
    battedFirstCount: figures.filter((f) => f.battedFirst === true).length,
    bowledFirstCount: figures.filter((f) => f.battedFirst === false).length,
    batFirstWinPercent: batFirstRecord.winPercent,
    bowlFirstWinPercent: bowlFirstRecord.winPercent,
  };
}

export type ChasedDefendedRow = { opponentTeamName: string; format: CricketFormat; value: number };

// "Chased" = batted second and won (value = the target chased, opponent's
// score + 1 run); "Defended" = batted first and won (value = the total
// defended) — ranked the same direction the reference screenshots use:
// highest successful chase first, lowest successful defense first (the more
// impressive end of each list).
export function squadChasedDefended(figures: SquadMatchFigures[]): { chased: ChasedDefendedRow[]; defended: ChasedDefendedRow[] } {
  const chased = figures
    .filter((f) => f.battedFirst === false && f.won === true && f.opponentScore)
    .map((f) => ({ opponentTeamName: f.opponentTeamName, format: f.format, value: f.opponentScore!.runs + 1 }))
    .sort((a, b) => b.value - a.value);
  const defended = figures
    .filter((f) => f.battedFirst === true && f.won === true && f.myScore)
    .map((f) => ({ opponentTeamName: f.opponentTeamName, format: f.format, value: f.myScore!.runs }))
    .sort((a, b) => a.value - b.value);
  return { chased: chased.slice(0, 5), defended: defended.slice(0, 5) };
}

export type RosterAggregateRow = { name: string; batting: BattingTotals; bowling: BowlingTotals; fielding: FieldingTotals };

// One row per roster member — the shared source for every Bat/Bowl/Field
// leaderboard table and the MVP formula below, so each only has to sort by
// a different column instead of recomputing anything.
export function squadRosterAggregates(matches: CricketMatchDetail[], memberFullNames: string[]): RosterAggregateRow[] {
  const byName = squadPlayerFigures(matches, memberFullNames);
  return Array.from(byName.entries()).map(([name, figs]) => ({
    name,
    batting: aggregateBatting(figs),
    bowling: aggregateBowling(figs),
    fielding: aggregateFielding(figs),
  }));
}

export type MvpRow = { name: string; batPoints: number; bowlPoints: number; fieldPoints: number; totalPoints: number };

// No MVP formula exists anywhere else in this codebase (an explicit comment
// in lib/matchReport/cricketReport.ts notes the app deliberately doesn't
// compute one today) — this is a first-cut, clearly-labeled formula, not a
// known/official one, shown next to an "MVP Rules" explanation in the UI so
// it reads as a definition rather than a hidden ranking. Weights: a run is 1
// point, with milestone bonuses (fifty +8, hundred +16, thirty +4) on top of
// the runs already counted, and boundaries worth a little extra (four +1,
// six +2); a wicket is worth as much as 20 runs, with hauls bonused the same
// way (3-wicket +8, 5-wicket +16) and a maiden over worth 8; a catch is 8,
// a run-out 6, a stumping (the hardest fielding dismissal to pull off) 12.
export function squadMvpPoints(rows: RosterAggregateRow[]): MvpRow[] {
  const scored = rows.map((r) => {
    const batPoints = r.batting.runs + r.batting.fours + r.batting.sixes * 2 + r.batting.hundreds * 16 + r.batting.fifties * 8 + r.batting.thirties * 4;
    const bowlPoints = r.bowling.wickets * 20 + r.bowling.maidens * 8 + r.bowling.threeWickets * 8 + r.bowling.fiveWickets * 16;
    const fieldPoints = r.fielding.catches * 8 + r.fielding.stumpings * 12 + r.fielding.runouts * 6;
    return { name: r.name, batPoints, bowlPoints, fieldPoints, totalPoints: batPoints + bowlPoints + fieldPoints };
  });
  return scored.filter((r) => r.totalPoints > 0).sort((a, b) => b.totalPoints - a.totalPoints);
}
