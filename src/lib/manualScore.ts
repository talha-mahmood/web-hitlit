import type { ScorecardPrefill, ScorecardSport } from "./api/tournamentMatches";

// The result a host types in by hand for a tournament match (instead of
// live-scoring it) — stored as-is on the tournament match so its card can
// show the same kind of detail a live-scored one does (run rates, sets,
// games, goals). Team order is always A then B, matching the match row.
export type ManualSport = "cricket" | ScorecardSport;

// Route params for ManualScoreScreen: the same locked team/roster/venue
// hand-off the New Match screens get, plus which sport's score form to show
// and whether a draw is a valid result for this match.
export type ManualScoreParams = { sport: ManualSport; allowDraw: boolean; prefill: ScorecardPrefill };

export function manualSportForName(name: string): ManualSport | null {
  const key = name.trim().toLowerCase();
  if (key.includes("cricket")) return "cricket";
  if (key === "table tennis") return "table_tennis";
  if (key === "padel" || key === "tennis" || key === "badminton" || key === "pickleball" || key === "football") return key;
  return null;
}

export type ManualInnings = { team: "A" | "B"; runs: number; wickets: number; overs: string };

export type ManualScore =
  | { sport: "cricket"; oversLimit: number; innings: [ManualInnings, ManualInnings] }
  | { sport: "padel" | "tennis"; sets: [number, number][] }
  | { sport: "badminton" | "pickleball" | "table_tennis"; games: [number, number][] }
  | { sport: "football"; a: number; b: number; pensA?: number; pensB?: number };

export type ManualResult = { winner: "A" | "B" | null; isDraw: boolean };

// "18.3" = 18 overs and 3 balls → 18.5 overs in decimal.
export function oversToDecimal(overs: string): number {
  const [whole, balls] = overs.split(".");
  return parseInt(whole || "0", 10) + (balls ? parseInt(balls, 10) / 6 : 0);
}

export function isValidOversText(text: string): boolean {
  return /^\d+(\.[0-5])?$/.test(text);
}

export function manualRunRate(innings: ManualInnings): number | null {
  const overs = oversToDecimal(innings.overs);
  return overs > 0 ? innings.runs / overs : null;
}

export function computeManualResult(score: ManualScore): ManualResult {
  switch (score.sport) {
    case "cricket": {
      const [first, second] = score.innings;
      if (first.runs === second.runs) return { winner: null, isDraw: true };
      return { winner: first.runs > second.runs ? first.team : second.team, isDraw: false };
    }
    case "padel":
    case "tennis": {
      const a = score.sets.filter(([x, y]) => x > y).length;
      const b = score.sets.filter(([x, y]) => y > x).length;
      return a === b ? { winner: null, isDraw: true } : { winner: a > b ? "A" : "B", isDraw: false };
    }
    case "badminton":
    case "pickleball":
    case "table_tennis": {
      const a = score.games.filter(([x, y]) => x > y).length;
      const b = score.games.filter(([x, y]) => y > x).length;
      return a === b ? { winner: null, isDraw: true } : { winner: a > b ? "A" : "B", isDraw: false };
    }
    case "football": {
      if (score.a !== score.b) return { winner: score.a > score.b ? "A" : "B", isDraw: false };
      if (score.pensA !== undefined && score.pensB !== undefined && score.pensA !== score.pensB) {
        return { winner: score.pensA > score.pensB ? "A" : "B", isDraw: false };
      }
      return { winner: null, isDraw: true };
    }
  }
}

export function parseManualScore(raw: unknown): ManualScore | null {
  if (!raw || typeof raw !== "object" || !("sport" in raw)) return null;
  return raw as ManualScore;
}

// One short line for a non-cricket score, e.g. "Sets: 6-4, 3-6, 7-5".
export function manualDetailText(score: ManualScore): string | null {
  switch (score.sport) {
    case "cricket":
      return null;
    case "padel":
    case "tennis":
      return `Sets: ${score.sets.map(([a, b]) => `${a}-${b}`).join(", ")}`;
    case "badminton":
    case "pickleball":
    case "table_tennis":
      return `Games: ${score.games.map(([a, b]) => `${a}-${b}`).join(", ")}`;
    case "football": {
      const parts = [`Score: ${score.a}-${score.b}`];
      if (score.pensA !== undefined && score.pensB !== undefined) parts.push(`Pens ${score.pensA}-${score.pensB}`);
      return parts.join(" · ");
    }
  }
}
