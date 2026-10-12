import type { BallEvent } from "./cricketScoring";

export type InningsReplayResult = { runs: number; legalBalls: number };

// Runs/legal-balls for one innings — same reduce/filter the live "Current
// Run Rate" display already uses (MatchRunRates in
// TournamentMatchesScreen.tsx), plus the NRR-specific "all out uses the
// full allocated overs, not however many balls were actually bowled" rule.
// No need for the full replayInnings state machine here — NRR only needs
// these three aggregate totals, not who's on strike or batting order.
export function computeInningsForNRR(
  balls: BallEvent[],
  oversLimit: number,
  totalPlayers: number,
  lastManStand = false
): InningsReplayResult {
  const runs = balls.reduce((sum, b) => sum + b.runsBatted + b.extraRuns, 0);
  const legalBalls = balls.filter((b) => b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY").length;
  const wickets = balls.filter((b) => b.isWicket).length;
  const allOut = lastManStand ? wickets >= totalPlayers : wickets >= totalPlayers - 1;
  return { runs, legalBalls: allOut ? oversLimit * 6 : legalBalls };
}

export type NRRMatchEntry = {
  runsFor: number;
  ballsFor: number;
  runsAgainst: number;
  ballsAgainst: number;
};

// Sums every field across all of a team's eligible matches FIRST, then
// computes the rate from the totals — never averages per-match NRR
// (explicitly wrong per the rules this is modeled on: NRR = aggregate
// scoring rate minus aggregate conceding rate across the whole stage, not
// a mean of per-match figures). Returns null when there's nothing eligible
// yet — show "NRR unavailable" rather than inventing a value.
export function aggregateNRR(entries: NRRMatchEntry[]): number | null {
  if (entries.length === 0) return null;
  let runsFor = 0;
  let ballsFor = 0;
  let runsAgainst = 0;
  let ballsAgainst = 0;
  for (const e of entries) {
    runsFor += e.runsFor;
    ballsFor += e.ballsFor;
    runsAgainst += e.runsAgainst;
    ballsAgainst += e.ballsAgainst;
  }
  if (ballsFor === 0 || ballsAgainst === 0) return null;
  return (runsFor * 6) / ballsFor - (runsAgainst * 6) / ballsAgainst;
}
