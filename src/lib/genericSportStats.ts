// Player-level stats for every scorecard sport other than cricket (which
// keeps its own richer, ball-by-ball-derived system in playerCricketStats.ts
// — cricket's data genuinely supports much more than this). These sports'
// point-by-point tables only ever record which SIDE (A/B) won a point, not
// which individual teammate did it in doubles — so unlike cricket there is
// no real per-player stat finer than "which side this player was on, and
// whether that side won" for a given match. Match-level win/loss, plus a
// real per-player scorer count for football, is the full honest ceiling for
// this group's stats; nothing here is guessed or invented beyond that.
import { supabase } from "./supabase";

export type GenericSport = "football" | "padel" | "badminton" | "pickleball" | "table_tennis" | "tennis";

type SportConfig = {
  table: string;
  sideAPlayersCol: string;
  sideBPlayersCol: string;
  sideANameCol: string;
  sideBNameCol: string;
  winnerCol: string;
  hasDraw: boolean;
  scorer?: { table: string; nameCol: string; teamCol: string };
  dbSportNames: string[];
  tournamentMatchIdCol: string;
  headline: "goals" | null;
};

export const SPORT_CONFIGS: Record<GenericSport, SportConfig> = {
  football: {
    table: "football_matches",
    sideAPlayersCol: "team_a_players",
    sideBPlayersCol: "team_b_players",
    sideANameCol: "team_a_name",
    sideBNameCol: "team_b_name",
    winnerCol: "winner_team",
    hasDraw: true,
    scorer: { table: "football_goals", nameCol: "scorer_name", teamCol: "team" },
    dbSportNames: ["football", "futsal"],
    tournamentMatchIdCol: "football_match_id",
    headline: "goals",
  },
  padel: {
    table: "padel_matches",
    sideAPlayersCol: "team_a_players",
    sideBPlayersCol: "team_b_players",
    sideANameCol: "team_a_name",
    sideBNameCol: "team_b_name",
    winnerCol: "winner_team",
    hasDraw: false,
    dbSportNames: ["padel"],
    tournamentMatchIdCol: "padel_match_id",
    headline: null,
  },
  badminton: {
    table: "badminton_matches",
    sideAPlayersCol: "team_a_players",
    sideBPlayersCol: "team_b_players",
    sideANameCol: "team_a_name",
    sideBNameCol: "team_b_name",
    winnerCol: "winner_team",
    hasDraw: false,
    dbSportNames: ["badminton"],
    tournamentMatchIdCol: "badminton_match_id",
    headline: null,
  },
  pickleball: {
    table: "pickleball_matches",
    sideAPlayersCol: "team_a_players",
    sideBPlayersCol: "team_b_players",
    sideANameCol: "team_a_name",
    sideBNameCol: "team_b_name",
    winnerCol: "winner_team",
    hasDraw: false,
    dbSportNames: ["pickleball"],
    tournamentMatchIdCol: "pickleball_match_id",
    headline: null,
  },
  table_tennis: {
    table: "table_tennis_matches",
    sideAPlayersCol: "team_a_players",
    sideBPlayersCol: "team_b_players",
    sideANameCol: "team_a_name",
    sideBNameCol: "team_b_name",
    winnerCol: "winner_team",
    hasDraw: false,
    dbSportNames: ["table tennis"],
    tournamentMatchIdCol: "table_tennis_match_id",
    headline: null,
  },
  tennis: {
    table: "tennis_matches",
    sideAPlayersCol: "player_a_players",
    sideBPlayersCol: "player_b_players",
    sideANameCol: "player_a_name",
    sideBNameCol: "player_b_name",
    winnerCol: "winner_player",
    hasDraw: false,
    dbSportNames: ["tennis"],
    tournamentMatchIdCol: "tennis_match_id",
    headline: null,
  },
};

// Maps a real `sports.name` value to the generic-sport key that covers it —
// null for sports with no scorecard module at all (Basketball/Squash/
// Volleyball) and for the cricket-family names, which use the richer
// cricket-specific system instead of this one.
export function classifyGenericSport(sportName: string | null | undefined): GenericSport | null {
  const name = (sportName ?? "").trim().toLowerCase();
  for (const [key, cfg] of Object.entries(SPORT_CONFIGS) as [GenericSport, SportConfig][]) {
    if (cfg.dbSportNames.includes(name)) return key;
  }
  return null;
}

export type GenericMatchRow = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  venue: string | null;
  resultSummary: string | null;
  sideAName: string;
  sideBName: string;
  sideAPlayers: string[];
  sideBPlayers: string[];
  winner: string | null;
  isDraw: boolean;
};

function quoteArrayElement(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Every match (any status) this player appears in for the given sport — same
// select-any RLS pattern as cricket, so this covers matches created/scored
// by teammates too, not just the viewer's own.
export async function fetchGenericMatches(sport: GenericSport, fullName: string): Promise<GenericMatchRow[]> {
  const cfg = SPORT_CONFIGS[sport];
  const quoted = quoteArrayElement(fullName);
  // Table/column names are picked from the fixed SPORT_CONFIGS map, not
  // user input — the `any` here is only to get past supabase-js wanting a
  // literal table-name union, since this function is deliberately generic
  // across sports.
  const { data, error } = await supabase
    .from(cfg.table as any)
    .select("*")
    .or(`${cfg.sideAPlayersCol}.cs.{${quoted}},${cfg.sideBPlayersCol}.cs.{${quoted}}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    status: row.status as string,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    venue: (row.venue as string | null) ?? null,
    resultSummary: (row.result_summary as string | null) ?? null,
    sideAName: row[cfg.sideANameCol] as string,
    sideBName: row[cfg.sideBNameCol] as string,
    sideAPlayers: (row[cfg.sideAPlayersCol] as string[] | null) ?? [],
    sideBPlayers: (row[cfg.sideBPlayersCol] as string[] | null) ?? [],
    winner: (row[cfg.winnerCol] as string | null) ?? null,
    isDraw: cfg.hasDraw ? !!row.is_draw : false,
  }));
}

// Football only — real per-player goal counts, keyed by match id.
async function fetchGoalsByMatch(fullName: string, matchIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (matchIds.length === 0) return map;
  const { data, error } = await supabase
    .from("football_goals")
    .select("match_id")
    .eq("scorer_name", fullName)
    .in("match_id", matchIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.match_id, (map.get(row.match_id) ?? 0) + 1);
  }
  return map;
}

export type GenericFigures = {
  matchId: string;
  date: string;
  format: null;
  mySideName: string;
  opponentName: string;
  venue: string | null;
  result: "WIN" | "LOSS" | "DRAW";
  goals: number;
};

export async function fetchPlayerGenericFigures(sport: GenericSport, fullName: string): Promise<GenericFigures[]> {
  const cfg = SPORT_CONFIGS[sport];
  const matches = await fetchGenericMatches(sport, fullName);
  const completed = matches.filter((m) => m.status === "COMPLETED");
  const goalsByMatch = cfg.scorer ? await fetchGoalsByMatch(fullName, completed.map((m) => m.id)) : undefined;

  const figures: GenericFigures[] = [];
  for (const m of completed) {
    const onA = m.sideAPlayers.includes(fullName);
    const onB = m.sideBPlayers.includes(fullName);
    if (!onA && !onB) continue;
    const mySide = onA ? "A" : "B";
    const mySideName = onA ? m.sideAName : m.sideBName;
    const opponentName = onA ? m.sideBName : m.sideAName;
    const result: GenericFigures["result"] = m.isDraw ? "DRAW" : m.winner === mySide ? "WIN" : "LOSS";
    figures.push({
      matchId: m.id,
      date: m.completedAt ?? m.createdAt,
      format: null,
      mySideName,
      opponentName,
      venue: m.venue,
      result,
      goals: goalsByMatch?.get(m.id) ?? 0,
    });
  }
  return figures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export type GenericTotals = {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPercent: number;
  goals: number;
};

export function aggregateGeneric(figures: GenericFigures[]): GenericTotals {
  const wins = figures.filter((f) => f.result === "WIN").length;
  const losses = figures.filter((f) => f.result === "LOSS").length;
  const draws = figures.filter((f) => f.result === "DRAW").length;
  return {
    matches: figures.length,
    wins,
    losses,
    draws,
    winPercent: figures.length > 0 ? (wins / figures.length) * 100 : 0,
    goals: figures.reduce((s, f) => s + f.goals, 0),
  };
}

export function genericRecentForm(figures: GenericFigures[], limit = 5): { matchId: string; letter: "W" | "L" | "D" }[] {
  return figures.slice(0, limit).map((f) => ({ matchId: f.matchId, letter: f.result[0] as "W" | "L" | "D" }));
}

export type GenericYearlyRow = { label: string; matches: number; wins: number; losses: number; draws: number; winPercent: number; goals: number };

export function genericYearlyOverview(figures: GenericFigures[]): { thisYear: GenericYearlyRow; lastYear: GenericYearlyRow } {
  const now = new Date();
  const thisYearNum = now.getFullYear();
  const build = (year: number): GenericYearlyRow => {
    const rows = figures.filter((f) => new Date(f.date).getFullYear() === year);
    const t = aggregateGeneric(rows);
    return { label: year === thisYearNum ? "This Year So Far" : "Last Year", ...t };
  };
  return { thisYear: build(thisYearNum), lastYear: build(thisYearNum - 1) };
}

export type GenericOpponentRow = { opponentName: string; matches: number; wins: number; losses: number; draws: number; goals: number };

export function genericBestAgainstOpponent(figures: GenericFigures[], limit = 3): GenericOpponentRow[] {
  const byOpponent = new Map<string, GenericFigures[]>();
  for (const f of figures) {
    const list = byOpponent.get(f.opponentName) ?? [];
    list.push(f);
    byOpponent.set(f.opponentName, list);
  }
  const rows = Array.from(byOpponent.entries()).map(([opponentName, list]) => {
    const t = aggregateGeneric(list);
    return { opponentName, matches: t.matches, wins: t.wins, losses: t.losses, draws: t.draws, goals: t.goals };
  });
  return rows.sort((a, b) => b.matches - a.matches).slice(0, limit);
}
