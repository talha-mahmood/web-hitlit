export type TournamentFormat = "KNOCKOUT" | "LEAGUE" | "POOL";

export type Fixture = { teamA: string; teamB: string | null };

// Knockout: teams paired consecutively in host-specified order for Round 1.
// An odd team out gets a bye (teamB: null) — this app doesn't track match
// results, so only the first round's pairing is meaningful to show.
export function computeKnockoutFixtures(teamNames: string[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (let i = 0; i < teamNames.length; i += 2) {
    fixtures.push({ teamA: teamNames[i], teamB: teamNames[i + 1] ?? null });
  }
  return fixtures;
}

// League: round-robin — every team plays every other team once.
export function computeLeagueFixtures(teamNames: string[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (let i = 0; i < teamNames.length; i++) {
    for (let j = i + 1; j < teamNames.length; j++) {
      fixtures.push({ teamA: teamNames[i], teamB: teamNames[j] });
    }
  }
  return fixtures;
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

// Same pairing algorithms as above, generalized to operate on team objects
// (not just names) so real match rows can be generated with team IDs —
// used once, when the host generates persisted matches; the name-only
// functions above stay untouched for the pre-generation fixtures preview.
export type FixturePair<T> = { teamA: T; teamB: T | null };

// POOL isn't paired at the whole-tournament level (see generatePoolMatches,
// which calls this per-pool with "LEAGUE" directly) — passing "POOL" here
// returns empty, same as an unset format.
export function pairTeamsForFixtures<T>(format: TournamentFormat | null, teams: T[]): FixturePair<T>[] {
  if (!format || format === "POOL" || teams.length < 2) return [];
  const pairs: FixturePair<T>[] = [];
  if (format === "KNOCKOUT") {
    for (let i = 0; i < teams.length; i += 2) {
      pairs.push({ teamA: teams[i], teamB: teams[i + 1] ?? null });
    }
  } else {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        pairs.push({ teamA: teams[i], teamB: teams[j] });
      }
    }
  }
  return pairs;
}

export type TeamStanding = {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
};

// Derived purely from completed matches — nothing about standings is
// persisted, so it can never drift from the recorded results.
export function computeStandings<
  M extends { status: string; team_a_id: string | null; team_b_id: string | null; winner_team_id: string | null; is_draw: boolean }
>(teams: { id: string; name: string }[], matches: M[]): TeamStanding[] {
  const table = new Map<string, TeamStanding>();
  for (const t of teams) table.set(t.id, { teamId: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0 });

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
    } else if (m.winner_team_id === m.team_a_id) {
      a.won++;
      b.lost++;
    } else if (m.winner_team_id === m.team_b_id) {
      b.won++;
      a.lost++;
    }
  }

  return Array.from(table.values()).sort((x, y) => y.won - x.won || y.played - x.played);
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
