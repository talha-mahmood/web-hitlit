export type TournamentFormat = "KNOCKOUT" | "LEAGUE" | "POOL";

export type Fixture = { teamA: string; teamB: string | null };

// League: round-robin — every team plays every other team once. Correct
// for any team count, including odd ones (every team still plays n-1
// matches; there's just no literal "rest round" assignment since matches
// aren't scheduled round-by-round in this app).
export function computeLeagueFixtures(teamNames: string[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (let i = 0; i < teamNames.length; i++) {
    for (let j = i + 1; j < teamNames.length; j++) {
      fixtures.push({ teamA: teamNames[i], teamB: teamNames[j] });
    }
  }
  return fixtures;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Same pairing algorithms as above, generalized to operate on team objects
// (not just names) so real match rows can be generated with team IDs —
// used once, when the host generates persisted matches; the name-only
// functions above stay untouched for the pre-generation fixtures preview.
export type FixturePair<T> = { teamA: T; teamB: T | null };

// A real single-elimination bracket with byes, not naive consecutive
// pairing — handles any team count. The bracket is padded up to the next
// power of 2; the shortfall (byeCount) gets a bye straight through this
// round instead of a match. A bye is represented as {teamB: null}, same
// shape insertRound()/getRoundWinners() already auto-complete as a win for
// teamA, so no changes are needed anywhere else in the generation/
// advancement pipeline — only this pairing step. Verified against the
// standard reference table (n=9: 1 match + 7 byes -> 8 teams -> QF -> SF
// -> Final = 8 total matches = n-1) in tournamentFixtures.test.ts.
// Reused as-is for qualifier seeding (any count, not just powers of 2) and
// for round 2+ (where the incoming team count is already a power of 2, so
// byeCount is always 0 there — this degrades to plain consecutive pairing).
function knockoutBracketPairs<T>(teams: T[]): FixturePair<T>[] {
  const n = teams.length;
  if (n === 0) return [];
  if (n === 1) return [{ teamA: teams[0], teamB: null }];
  const bracketSize = nextPowerOfTwo(n);
  const byeCount = bracketSize - n;
  const byeTeams = teams.slice(0, byeCount);
  const playingTeams = teams.slice(byeCount);
  const pairs: FixturePair<T>[] = [];
  for (let i = 0; i < playingTeams.length; i += 2) {
    pairs.push({ teamA: playingTeams[i], teamB: playingTeams[i + 1] });
  }
  for (const t of byeTeams) pairs.push({ teamA: t, teamB: null });
  return pairs;
}

export function computeKnockoutFixtures(teamNames: string[]): Fixture[] {
  return knockoutBracketPairs(teamNames);
}

// Pool format's group-stage fixtures are per-group (see generatePoolMatches
// / the pool-aware panel), not a single flat list, so there's nothing
// meaningful to preview here — this just returns empty for POOL.
export function computeFixtures(
  format: TournamentFormat | null,
  teamNames: string[]
): Fixture[] {
  if (!format || teamNames.length < 2) return [];
  if (format === "KNOCKOUT") return computeKnockoutFixtures(teamNames);
  if (format === "LEAGUE") return computeLeagueFixtures(teamNames);
  return [];
}

export const TOURNAMENT_FORMAT_LABEL: Record<TournamentFormat, string> = {
  KNOCKOUT: "Knockout",
  LEAGUE: "League",
  POOL: "Pool",
};

// POOL isn't paired at the whole-tournament level (see generatePoolMatches,
// which calls this per-pool with "LEAGUE" directly) — passing "POOL" here
// returns empty, same as an unset format.
export function pairTeamsForFixtures<T>(format: TournamentFormat | null, teams: T[]): FixturePair<T>[] {
  if (!format || format === "POOL" || teams.length < 2) return [];
  if (format === "KNOCKOUT") return knockoutBracketPairs(teams);
  const pairs: FixturePair<T>[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push({ teamA: teams[i], teamB: teams[j] });
    }
  }
  return pairs;
}

// Balances `total` teams across `groupCount` groups as evenly as possible —
// uneven splits allowed (7 teams / 3 groups -> 3,2,2), the larger groups
// listed first.
export function distributeTeamsIntoGroups(total: number, groupCount: number): number[] {
  if (groupCount <= 0 || total <= 0) return [];
  const base = Math.floor(total / groupCount);
  const remainder = total % groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

// League round-robin, display-only stats (matches aren't actually
// scheduled round-by-round in this app — scheduling is per-match/manual
// via scheduled_at — so these are informational, not enforced). The
// circle method needs one extra "round" for an odd team count, since one
// team rests each round instead of every round pairing everyone up.
export function leagueRoundsAndMatchesPerTeam(teamCount: number): { rounds: number; matchesPerTeam: number } {
  if (teamCount < 2) return { rounds: 0, matchesPerTeam: 0 };
  const rounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  return { rounds, matchesPerTeam: teamCount - 1 };
}

export type TeamStanding = {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  // Net run rate — cricket only, null when unavailable (no linked
  // ball-by-ball data for any of this team's matches yet). See
  // src/lib/netRunRate.ts for how this is actually computed.
  nrr: number | null;
};

// ICC Men's T20 World Cup 2026-style preset: win=2, tie/no-result=1,
// loss=0. A draw (is_draw) covers both a genuinely tied match and a
// no-result in this app's data model, since there's no separate
// "abandoned" status — both get the tie/no-result point value.
const POINTS_WIN = 2;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

// Derived purely from completed matches — nothing about standings is
// persisted, so it can never drift from the recorded results. Ranked by
// points, then wins, then NRR (when available), then the input order
// (stable sort) as the final tie-break — standing in for "organizer
// seeding or a recorded draw of lots" per the competition rules this is
// modeled on, since there's no UI here for recording an actual draw.
export function computeStandings<
  M extends { status: string; team_a_id: string | null; team_b_id: string | null; winner_team_id: string | null; is_draw: boolean }
>(teams: { id: string; name: string }[], matches: M[], nrrByTeam?: Map<string, number>): TeamStanding[] {
  const table = new Map<string, TeamStanding>();
  for (const t of teams)
    table.set(t.id, { teamId: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, points: 0, nrr: nrrByTeam?.get(t.id) ?? null });

  for (const m of matches) {
    if (m.status !== "COMPLETED" || !m.team_a_id || !m.team_b_id) continue; // skip byes/pending
    const a = table.get(m.team_a_id);
    const b = table.get(m.team_b_id);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    if (m.is_draw) {
      a.drawn++;
      b.drawn++;
      a.points += POINTS_DRAW;
      b.points += POINTS_DRAW;
    } else if (m.winner_team_id === m.team_a_id) {
      a.won++;
      b.lost++;
      a.points += POINTS_WIN;
      b.points += POINTS_LOSS;
    } else if (m.winner_team_id === m.team_b_id) {
      b.won++;
      a.lost++;
      b.points += POINTS_WIN;
      a.points += POINTS_LOSS;
    }
  }

  return Array.from(table.values()).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.won !== x.won) return y.won - x.won;
    const xNrr = x.nrr ?? -Infinity;
    const yNrr = y.nrr ?? -Infinity;
    if (yNrr !== xNrr) return yNrr - xNrr;
    return 0; // stable — keeps input (seed) order as the final tie-break
  });
}

// A finer tie-break for an exact 2-team standings tie still level on
// points/wins/NRR — swaps them into head-to-head order if they played a
// decisive match against each other. Intentionally narrow: a 3+-way tie,
// or a pair that never played or only drew, is left in whatever order
// computeStandings already put them in (seed order) — a real multi-team
// head-to-head mini-table is a materially bigger, separately-scoped
// feature (see tournament rules spec's own note that it needs a defined
// comparison method).
export function applyHeadToHeadTiebreak<
  M extends { status: string; team_a_id: string | null; team_b_id: string | null; winner_team_id: string | null; is_draw: boolean }
>(standings: TeamStanding[], matches: M[]): TeamStanding[] {
  const result = [...standings];
  for (let i = 0; i < result.length - 1; i++) {
    const a = result[i];
    const b = result[i + 1];
    const tied = a.points === b.points && a.won === b.won && (a.nrr ?? null) === (b.nrr ?? null);
    if (!tied) continue;
    const headToHead = matches.find(
      (m) =>
        m.status === "COMPLETED" &&
        !m.is_draw &&
        ((m.team_a_id === a.teamId && m.team_b_id === b.teamId) || (m.team_a_id === b.teamId && m.team_b_id === a.teamId))
    );
    if (headToHead && headToHead.winner_team_id === b.teamId) {
      [result[i], result[i + 1]] = [result[i + 1], result[i]];
    }
  }
  return result;
}

// Round labels for a knockout bracket, derived from how many teams entered
// that round — nothing is stored, so it can never drift from the actual
// matches. A league's own round 1 (the round-robin group stage) isn't a
// bracket round at all, so it's labeled separately by the caller.
export function knockoutRoundLabel(teamsInRound: number): string {
  if (teamsInRound <= 2) return "Final";
  if (teamsInRound <= 4) return "Semi Final";
  if (teamsInRound <= 8) return "Quarterfinal";
  return `Round of ${teamsInRound}`;
}

// The winner of each completed match in a round, in match order — a bye
// (no team_b) counts team_a as having won it automatically. Used to seed
// the next round's pairing. Returns null if the round isn't fully decided
// yet (a match still pending), since the next round can't be generated
// until every match in this one has a winner.
export function getRoundWinners<
  M extends { status: string; team_a: { id: string; name: string } | null; team_b: { id: string; name: string } | null; winner_team: { id: string; name: string } | null; is_draw: boolean }
>(roundMatches: M[]): { id: string; name: string }[] | null {
  const winners: { id: string; name: string }[] = [];
  for (const m of roundMatches) {
    if (!m.team_b) {
      if (m.team_a) winners.push(m.team_a);
      continue; // bye
    }
    if (m.status !== "COMPLETED" || m.is_draw || !m.winner_team) return null;
    winners.push(m.winner_team);
  }
  return winners;
}
