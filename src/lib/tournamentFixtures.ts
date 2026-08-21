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

export function computeFixtures(
  format: "KNOCKOUT" | "LEAGUE" | null,
  teamNames: string[]
): Fixture[] {
  if (!format || teamNames.length < 2) return [];
  return format === "KNOCKOUT" ? computeKnockoutFixtures(teamNames) : computeLeagueFixtures(teamNames);
}

export const TOURNAMENT_FORMAT_LABEL: Record<"KNOCKOUT" | "LEAGUE", string> = {
  KNOCKOUT: "Knockout",
  LEAGUE: "League",
};
