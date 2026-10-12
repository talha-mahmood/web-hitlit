// Player-level cricket stats (Overview/Statistics/Insights on the Player
// Profile screen) — computed entirely on the client by re-running every
// match this player appears in through the same replay engine
// (cricketScoring.ts) the live scorer and the scorecard/report already use,
// so these numbers can never drift from what the scorecard itself shows.
//
// Identity is name-matching against profiles.full_name — the same
// documented limitation get_player_public_stats already has (cricket
// rosters are free-text names, not user ids), so two players sharing an
// exact full name would be merged here too.
import { supabase } from "./supabase";
import type { CricketMatchDetail } from "./api/cricket";
import { ballRowToEvent } from "./api/cricket";
import { replayInnings, type InningsState, type BallEvent } from "./cricketScoring";

export type CricketFormat = "T10" | "T20" | "ODI" | "Club";

export const FORMAT_LABEL: Record<CricketFormat, string> = {
  T10: "T10",
  T20: "T20",
  ODI: "OD",
  Club: "Club",
};

export const FORMAT_FULL_LABEL: Record<CricketFormat, string> = {
  T10: "T10",
  T20: "T20",
  ODI: "One Day",
  Club: "Club Cricket",
};

export type MatchFigures = {
  matchId: string;
  date: string;
  format: CricketFormat;
  myTeamName: string;
  opponentTeamName: string;
  won: boolean | null;
  batting: { runs: number; balls: number; fours: number; sixes: number; isOut: boolean; position: number } | null;
  bowling: { legalBalls: number; runsConceded: number; wickets: number; maidens: number; dots: number } | null;
  fielding: { catches: number; stumpings: number; runouts: number };
};

// Any signed-in user can read any cricket match row (cricket_matches_select_any
// RLS policy) — that's what makes it possible to aggregate a player's figures
// across matches someone else created/scored, the same way get_player_public_stats
// does server-side for the simpler totals on the main Profile screen.
// Every match (any status) this player appears in — the Matches tab shows
// scheduled/live matches too. Stat aggregation below filters to COMPLETED
// only, since an in-progress match's figures aren't final yet.
export async function fetchPlayerCricketMatches(fullName: string): Promise<CricketMatchDetail[]> {
  // Postgres array-literal element, double-quoted so names containing commas,
  // braces or quotes (which would otherwise break the two-condition `.or()`
  // filter string below) are passed through safely.
  const quoted = `"${fullName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const { data, error } = await supabase
    .from("cricket_matches")
    .select("*, cricket_innings(*, cricket_balls(*))")
    .or(`team_a_players.cs.{${quoted}},team_b_players.cs.{${quoted}}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CricketMatchDetail[];
}

function replayAllInnings(match: CricketMatchDetail): InningsState[] {
  return [...match.cricket_innings]
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((innings) => {
      const balls: BallEvent[] = [...innings.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
      const battingTeam = innings.batting_team as "A" | "B";
      const totalPlayers = (battingTeam === "A" ? match.team_a_players.length : match.team_b_players.length) || 11;
      if (balls.length === 0) {
        return {
          battingTeam,
          oversLimit: match.overs_limit,
          totalPlayers,
          lastManStand: match.last_man_stand,
          runs: 0,
          wickets: 0,
          legalBalls: 0,
          striker: null,
          nonStriker: null,
          currentBowler: null,
          previousOverBowler: null,
          ballsInCurrentOver: 0,
          runsInCurrentOver: 0,
          battingOrder: [],
          battingStats: {},
          bowlingOrder: [],
          bowlingStats: {},
          fallOfWickets: [],
          extras: { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 },
          isComplete: false,
        } satisfies InningsState;
      }
      return replayInnings(
        balls,
        battingTeam,
        match.overs_limit,
        totalPlayers,
        balls[0].strikerName,
        balls[0].nonStrikerName ?? "",
        0,
        match.last_man_stand
      );
    });
}

export type TeamScore = { runs: number; wickets: number; oversLabel: string } | null;

// Final (or current, if still live) score for each side — same replay engine
// as everything else here, just read back out by team instead of by player.
export function matchTeamScores(match: CricketMatchDetail): { A: TeamScore; B: TeamScore } {
  const innings = replayAllInnings(match);
  const result: { A: TeamScore; B: TeamScore } = { A: null, B: null };
  for (const state of innings) {
    const score: TeamScore = { runs: state.runs, wickets: state.wickets, oversLabel: formatOversLabel(state.legalBalls) };
    if (state.battingTeam === "A") result.A = score;
    else result.B = score;
  }
  return result;
}

function formatOversLabel(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function computeMatchFigures(match: CricketMatchDetail, fullName: string): MatchFigures | null {
  const onTeamA = match.team_a_players.includes(fullName);
  const onTeamB = match.team_b_players.includes(fullName);
  if (!onTeamA && !onTeamB) return null;
  const myTeamName = onTeamA ? match.team_a_name : match.team_b_name;
  const opponentTeamName = onTeamA ? match.team_b_name : match.team_a_name;

  const innings = replayAllInnings(match);

  let batting: MatchFigures["batting"] = null;
  const bowlingSpells: { legalBalls: number; runsConceded: number; wickets: number; maidens: number; dots: number }[] = [];
  for (const state of innings) {
    const bat = state.battingStats[fullName];
    if (bat && state.battingOrder.includes(fullName)) {
      batting = { runs: bat.runs, balls: bat.balls, fours: bat.fours, sixes: bat.sixes, isOut: bat.isOut, position: bat.battingPosition };
    }
    const bowl = state.bowlingStats[fullName];
    if (bowl && state.bowlingOrder.includes(fullName)) {
      bowlingSpells.push({ legalBalls: bowl.legalBalls, runsConceded: bowl.runsConceded, wickets: bowl.wickets, maidens: bowl.maidens, dots: 0 });
    }
  }

  let catches = 0;
  let stumpings = 0;
  let runouts = 0;
  let dots = 0;
  for (const i of match.cricket_innings) {
    for (const row of i.cricket_balls) {
      if (row.bowler_name === fullName && row.extra_type !== "WIDE" && row.extra_type !== "NOBALL" && row.runs_batted + row.extra_runs === 0) {
        dots += 1;
      }
      if (!row.is_wicket || (row.fielder_name !== fullName && row.fielder2_name !== fullName)) continue;
      if (row.wicket_type === "CAUGHT") catches += 1;
      else if (row.wicket_type === "STUMPED") stumpings += 1;
      else if (row.wicket_type === "RUN_OUT") runouts += 1;
    }
  }

  const bowling: MatchFigures["bowling"] =
    bowlingSpells.length === 0
      ? null
      : {
          legalBalls: bowlingSpells.reduce((s, b) => s + b.legalBalls, 0),
          runsConceded: bowlingSpells.reduce((s, b) => s + b.runsConceded, 0),
          wickets: bowlingSpells.reduce((s, b) => s + b.wickets, 0),
          maidens: bowlingSpells.reduce((s, b) => s + b.maidens, 0),
          dots,
        };

  const won = match.result_summary
    ? match.result_summary.startsWith(`${myTeamName} won`)
      ? true
      : /tied/i.test(match.result_summary)
        ? null
        : false
    : null;

  return {
    matchId: match.id,
    date: match.completed_at ?? match.created_at,
    format: (match.format as CricketFormat) ?? "Club",
    myTeamName,
    opponentTeamName,
    won,
    batting,
    bowling,
    fielding: { catches, stumpings, runouts },
  };
}

export function computePlayerFigures(matches: CricketMatchDetail[], fullName: string): MatchFigures[] {
  return matches
    .filter((m) => m.status === "COMPLETED")
    .map((m) => computeMatchFigures(m, fullName))
    .filter((f): f is MatchFigures => f !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export type BattingTotals = {
  innings: number;
  runs: number;
  notOuts: number;
  average: number;
  highScore: number;
  highScoreNotOut: boolean;
  balls: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  hundreds: number;
  fifties: number;
  thirties: number;
  ducks: number;
};

export function aggregateBatting(figures: MatchFigures[]): BattingTotals {
  const innings = figures.filter((f) => f.batting !== null);
  const runs = innings.reduce((s, f) => s + f.batting!.runs, 0);
  const balls = innings.reduce((s, f) => s + f.batting!.balls, 0);
  const notOuts = innings.filter((f) => !f.batting!.isOut).length;
  const outs = innings.length - notOuts;
  let highScore = 0;
  let highScoreNotOut = false;
  for (const f of innings) {
    if (f.batting!.runs > highScore || (f.batting!.runs === highScore && !f.batting!.isOut && highScoreNotOut === false)) {
      highScore = f.batting!.runs;
      highScoreNotOut = !f.batting!.isOut;
    }
  }
  return {
    innings: innings.length,
    runs,
    notOuts,
    average: outs > 0 ? runs / outs : runs > 0 ? runs : 0,
    highScore,
    highScoreNotOut,
    balls,
    strikeRate: balls > 0 ? (runs / balls) * 100 : 0,
    fours: innings.reduce((s, f) => s + f.batting!.fours, 0),
    sixes: innings.reduce((s, f) => s + f.batting!.sixes, 0),
    hundreds: innings.filter((f) => f.batting!.runs >= 100).length,
    fifties: innings.filter((f) => f.batting!.runs >= 50 && f.batting!.runs < 100).length,
    thirties: innings.filter((f) => f.batting!.runs >= 30 && f.batting!.runs < 50).length,
    ducks: innings.filter((f) => f.batting!.runs === 0 && f.batting!.isOut).length,
  };
}

export type BowlingTotals = {
  innings: number;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  dots: number;
  average: number;
  economy: number;
  strikeRate: number;
  bestWickets: number;
  bestRuns: number;
  threeWickets: number;
  fiveWickets: number;
};

export function aggregateBowling(figures: MatchFigures[]): BowlingTotals {
  const innings = figures.filter((f) => f.bowling !== null);
  const balls = innings.reduce((s, f) => s + f.bowling!.legalBalls, 0);
  const runs = innings.reduce((s, f) => s + f.bowling!.runsConceded, 0);
  const wickets = innings.reduce((s, f) => s + f.bowling!.wickets, 0);
  let bestWickets = 0;
  let bestRuns = 0;
  let bestSet = false;
  for (const f of innings) {
    const b = f.bowling!;
    if (!bestSet || b.wickets > bestWickets || (b.wickets === bestWickets && b.runsConceded < bestRuns)) {
      bestWickets = b.wickets;
      bestRuns = b.runsConceded;
      bestSet = true;
    }
  }
  return {
    innings: innings.length,
    balls,
    runs,
    wickets,
    maidens: innings.reduce((s, f) => s + f.bowling!.maidens, 0),
    dots: innings.reduce((s, f) => s + f.bowling!.dots, 0),
    average: wickets > 0 ? runs / wickets : 0,
    economy: balls > 0 ? (runs / balls) * 6 : 0,
    strikeRate: wickets > 0 ? balls / wickets : 0,
    bestWickets,
    bestRuns,
    threeWickets: innings.filter((f) => f.bowling!.wickets >= 3 && f.bowling!.wickets < 5).length,
    fiveWickets: innings.filter((f) => f.bowling!.wickets >= 5).length,
  };
}

export type FieldingTotals = { catches: number; stumpings: number; runouts: number };

export function aggregateFielding(figures: MatchFigures[]): FieldingTotals {
  return figures.reduce(
    (acc, f) => ({
      catches: acc.catches + f.fielding.catches,
      stumpings: acc.stumpings + f.fielding.stumpings,
      runouts: acc.runouts + f.fielding.runouts,
    }),
    { catches: 0, stumpings: 0, runouts: 0 }
  );
}

export type RecentFormEntry = { matchId: string; bat: string; bowl: string };

export function recentForm(figures: MatchFigures[], limit = 5): RecentFormEntry[] {
  return figures.slice(0, limit).map((f) => ({
    matchId: f.matchId,
    bat: f.batting ? `${f.batting.runs}${f.batting.isOut ? "" : "*"}` : "-",
    bowl: f.bowling ? (f.bowling.wickets > 0 || f.bowling.runsConceded > 0 ? `${f.bowling.wickets}-${f.bowling.runsConceded}` : "-") : "-",
  }));
}

export type YearlyRow = { label: string; runs: number; average: number; highScore: number; wickets: number; economy: number; bestBowling: string };

export function yearlyOverview(figures: MatchFigures[]): { thisYear: YearlyRow; lastYear: YearlyRow } {
  const now = new Date();
  const thisYearNum = now.getFullYear();
  const lastYearNum = thisYearNum - 1;
  const build = (year: number): YearlyRow => {
    const rows = figures.filter((f) => new Date(f.date).getFullYear() === year);
    const bat = aggregateBatting(rows);
    const bowl = aggregateBowling(rows);
    return {
      label: year === thisYearNum ? "This Year So Far" : "Last Year",
      runs: bat.runs,
      average: bat.average,
      highScore: bat.highScore,
      wickets: bowl.wickets,
      economy: bowl.economy,
      bestBowling: bowl.innings > 0 ? `${bowl.bestWickets}-${bowl.bestRuns}` : "-",
    };
  };
  return { thisYear: build(thisYearNum), lastYear: build(lastYearNum) };
}

export type OpponentRow = { teamName: string; runs: number; innings: number; strikeRate: number; wickets: number; economy: number };

export function bestAgainstTeam(figures: MatchFigures[], limit = 3): { batting: OpponentRow[]; bowling: OpponentRow[] } {
  const byOpponent = new Map<string, MatchFigures[]>();
  for (const f of figures) {
    const list = byOpponent.get(f.opponentTeamName) ?? [];
    list.push(f);
    byOpponent.set(f.opponentTeamName, list);
  }
  const rows = Array.from(byOpponent.entries()).map(([teamName, list]) => {
    const bat = aggregateBatting(list);
    const bowl = aggregateBowling(list);
    return {
      teamName,
      runs: bat.runs,
      innings: bat.innings,
      strikeRate: bat.strikeRate,
      wickets: bowl.wickets,
      economy: bowl.economy,
    };
  });
  return {
    batting: [...rows].sort((a, b) => b.runs - a.runs).slice(0, limit),
    bowling: [...rows].sort((a, b) => b.wickets - a.wickets).slice(0, limit),
  };
}

const ALL_FORMATS: CricketFormat[] = ["T10", "T20", "Club", "ODI"];

export function statisticsByFormat(figures: MatchFigures[]) {
  const byFormat = (fmt: CricketFormat) => figures.filter((f) => f.format === fmt);
  return {
    formats: ALL_FORMATS,
    matches: Object.fromEntries(ALL_FORMATS.map((fmt) => [fmt, byFormat(fmt).length])) as Record<CricketFormat, number>,
    batting: Object.fromEntries(ALL_FORMATS.map((fmt) => [fmt, aggregateBatting(byFormat(fmt))])) as Record<CricketFormat, BattingTotals>,
    bowling: Object.fromEntries(ALL_FORMATS.map((fmt) => [fmt, aggregateBowling(byFormat(fmt))])) as Record<CricketFormat, BowlingTotals>,
    fielding: Object.fromEntries(ALL_FORMATS.map((fmt) => [fmt, aggregateFielding(byFormat(fmt))])) as Record<CricketFormat, FieldingTotals>,
  };
}

export type BatPositionRow = { position: number; innings: number; runs: number; average: number; strikeRate: number };

export function battingPositionStats(figures: MatchFigures[]): BatPositionRow[] {
  const byPosition = new Map<number, MatchFigures[]>();
  for (const f of figures) {
    if (!f.batting) continue;
    const list = byPosition.get(f.batting.position) ?? [];
    list.push(f);
    byPosition.set(f.batting.position, list);
  }
  return Array.from(byPosition.entries())
    .map(([position, list]) => {
      const bat = aggregateBatting(list);
      return { position, innings: bat.innings, runs: bat.runs, average: bat.average, strikeRate: bat.strikeRate };
    })
    .sort((a, b) => a.position - b.position);
}

export type ConcededRunsDistribution = { byValue: { value: string; runs: number; balls: number }[]; totalRuns: number };

// Scans raw deliveries directly (not the per-match totals above) since this
// needs the run-value of every ball this player bowled, not just the sum.
export function bowlingConcededDistribution(matches: CricketMatchDetail[], fullName: string): ConcededRunsDistribution {
  const buckets: Record<string, { runs: number; balls: number }> = {
    "0": { runs: 0, balls: 0 },
    "1": { runs: 0, balls: 0 },
    "2": { runs: 0, balls: 0 },
    "3": { runs: 0, balls: 0 },
    "4": { runs: 0, balls: 0 },
    "6": { runs: 0, balls: 0 },
    Ex: { runs: 0, balls: 0 },
  };
  let totalRuns = 0;
  for (const match of matches) {
    for (const innings of match.cricket_innings) {
      for (const row of innings.cricket_balls) {
        if (row.bowler_name !== fullName) continue;
        const isExtra = row.extra_type === "WIDE" || row.extra_type === "NOBALL" || row.extra_type === "BYE" || row.extra_type === "LEGBYE";
        const runsConceded = isExtra
          ? row.extra_runs + (row.extra_type === "NOBALL" ? row.runs_batted : 0)
          : row.runs_batted;
        totalRuns += runsConceded;
        if (isExtra) {
          buckets.Ex.runs += runsConceded;
          buckets.Ex.balls += 1;
        } else {
          const key = String(row.runs_batted) in buckets ? String(row.runs_batted) : null;
          if (key) {
            buckets[key].runs += runsConceded;
            buckets[key].balls += 1;
          }
        }
      }
    }
  }
  return {
    byValue: ["1", "2", "3", "4", "6", "Ex"].map((value) => ({ value, runs: buckets[value].runs, balls: buckets[value].balls })),
    totalRuns,
  };
}

export type MatchWiseRow = {
  matchId: string;
  date: string;
  format: CricketFormat;
  opponentTeamName: string;
  batting: MatchFigures["batting"];
  bowling: MatchFigures["bowling"];
};

export function matchWiseRows(figures: MatchFigures[]): MatchWiseRow[] {
  return figures.map((f) => ({
    matchId: f.matchId,
    date: f.date,
    format: f.format,
    opponentTeamName: f.opponentTeamName,
    batting: f.batting,
    bowling: f.bowling,
  }));
}
