import {
  computeKnockoutFixtures,
  computeLeagueFixtures,
  computeStandings,
  applyHeadToHeadTiebreak,
  distributeTeamsIntoGroups,
  leagueRoundsAndMatchesPerTeam,
  pairTeamsForFixtures,
  getRoundWinners,
  knockoutRoundLabel,
} from "../tournamentFixtures";

// The standard single-elimination reference table (teams -> actual
// matches, first-round byes) that any correct bracket generator must
// match — byes = next power of 2 above n, minus n; actual matches = n-1
// always, since every match eliminates exactly one team down to 1 champion.
const BRACKET_REFERENCE: { teams: number; matches: number; byes: number }[] = [
  { teams: 2, matches: 1, byes: 0 },
  { teams: 3, matches: 2, byes: 1 },
  { teams: 4, matches: 3, byes: 0 },
  { teams: 5, matches: 4, byes: 3 },
  { teams: 6, matches: 5, byes: 2 },
  { teams: 7, matches: 6, byes: 1 },
  { teams: 8, matches: 7, byes: 0 },
  { teams: 9, matches: 8, byes: 7 },
  { teams: 10, matches: 9, byes: 6 },
];

describe("computeKnockoutFixtures", () => {
  it("pairs teams consecutively with no bye for an even count", () => {
    expect(computeKnockoutFixtures(["A", "B", "C", "D"])).toEqual([
      { teamA: "A", teamB: "B" },
      { teamA: "C", teamB: "D" },
    ]);
  });

  it("gives the first team(s) a bye, pairing the rest, for an odd count", () => {
    expect(computeKnockoutFixtures(["A", "B", "C"])).toEqual([
      { teamA: "B", teamB: "C" },
      { teamA: "A", teamB: null },
    ]);
  });

  it.each(BRACKET_REFERENCE)(
    "round 1 for $teams teams has exactly $byes byes (reference table)",
    ({ teams, byes }) => {
      const names = Array.from({ length: teams }, (_, i) => `T${i + 1}`);
      const fixtures = computeKnockoutFixtures(names);
      const byeCount = fixtures.filter((f) => f.teamB === null).length;
      const realMatchCount = fixtures.filter((f) => f.teamB !== null).length;
      expect(byeCount).toBe(byes);
      expect(realMatchCount).toBe((teams - byes) / 2);
      expect(byeCount + realMatchCount * 2).toBe(teams); // every team appears exactly once
    }
  );

  it("round 1 + advancing rounds always total n-1 matches (reference table)", () => {
    // Simulates the whole bracket: round 1 (via computeKnockoutFixtures),
    // then repeatedly re-pairing round-N winners (byes auto-advance, real
    // matches picked arbitrarily as teamA) via pairTeamsForFixtures, same
    // as generateNextRound does in the app — until one team remains.
    for (const { teams, matches } of BRACKET_REFERENCE) {
      let round = Array.from({ length: teams }, (_, i) => ({ id: `T${i + 1}` }));
      let totalMatches = 0;
      while (round.length > 1) {
        const pairs = pairTeamsForFixtures("KNOCKOUT", round);
        const winners = pairs.map((p) => {
          if (!p.teamB) return p.teamA; // bye
          totalMatches++;
          return p.teamA; // arbitrary winner — only the count matters here
        });
        round = winners;
      }
      expect(totalMatches).toBe(matches);
    }
  });
});

describe("computeLeagueFixtures", () => {
  it("produces n*(n-1)/2 fixtures with every pair exactly once", () => {
    const teams = ["A", "B", "C", "D", "E"];
    const fixtures = computeLeagueFixtures(teams);
    expect(fixtures).toHaveLength((teams.length * (teams.length - 1)) / 2);

    const seen = new Set<string>();
    for (const f of fixtures) {
      const key = [f.teamA, f.teamB].sort().join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("works for an odd count like 3, 5, 7, 9 (no longer restricted)", () => {
    for (const n of [3, 5, 7, 9]) {
      const teams = Array.from({ length: n }, (_, i) => `T${i + 1}`);
      expect(computeLeagueFixtures(teams)).toHaveLength((n * (n - 1)) / 2);
    }
  });
});

describe("leagueRoundsAndMatchesPerTeam", () => {
  it("matches the reference table for even and odd counts", () => {
    expect(leagueRoundsAndMatchesPerTeam(4)).toEqual({ rounds: 3, matchesPerTeam: 3 });
    expect(leagueRoundsAndMatchesPerTeam(5)).toEqual({ rounds: 5, matchesPerTeam: 4 });
    expect(leagueRoundsAndMatchesPerTeam(9)).toEqual({ rounds: 9, matchesPerTeam: 8 });
    expect(leagueRoundsAndMatchesPerTeam(10)).toEqual({ rounds: 9, matchesPerTeam: 9 });
  });
});

describe("distributeTeamsIntoGroups", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(distributeTeamsIntoGroups(6, 2)).toEqual([3, 3]);
    expect(distributeTeamsIntoGroups(9, 3)).toEqual([3, 3, 3]);
  });

  it("gives the larger groups to the earlier slots when uneven", () => {
    expect(distributeTeamsIntoGroups(7, 3)).toEqual([3, 2, 2]);
    expect(distributeTeamsIntoGroups(5, 2)).toEqual([3, 2]);
  });
});

describe("pairTeamsForFixtures", () => {
  it("returns empty for POOL — pools are paired per-group elsewhere", () => {
    expect(pairTeamsForFixtures("POOL", [{ id: "1" }, { id: "2" }])).toEqual([]);
  });
});

describe("computeStandings", () => {
  const teams = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];

  it("awards 2 points for a win, 1 each for a draw, 0 for a loss", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: "b", winner_team_id: "a", is_draw: false },
      { status: "COMPLETED", team_a_id: "a", team_b_id: "c", winner_team_id: null, is_draw: true },
    ];
    const standings = computeStandings(teams, matches);
    const byId = Object.fromEntries(standings.map((s) => [s.teamId, s]));
    expect(byId.a).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 3 });
    expect(byId.b).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, points: 0 });
    expect(byId.c).toMatchObject({ played: 1, won: 0, drawn: 1, lost: 0, points: 1 });
  });

  it("ranks by points first, then wins as a tie-break", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: "b", winner_team_id: "a", is_draw: false },
      { status: "COMPLETED", team_a_id: "b", team_b_id: "c", winner_team_id: null, is_draw: true },
      { status: "COMPLETED", team_a_id: "a", team_b_id: "c", winner_team_id: null, is_draw: true },
    ];
    const standings = computeStandings(teams, matches);
    // a: 1W 1D = 3pts, b: 1L 1D = 1pt, c: 2D = 2pts
    expect(standings.map((s) => s.teamId)).toEqual(["a", "c", "b"]);
  });

  it("skips byes and pending matches", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: null, winner_team_id: "a", is_draw: false },
      { status: "PENDING", team_a_id: "b", team_b_id: "c", winner_team_id: null, is_draw: false },
    ];
    const standings = computeStandings(teams, matches);
    expect(standings.every((s) => s.played === 0)).toBe(true);
  });

  it("breaks a points+wins tie by NRR when provided", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: "b", winner_team_id: "a", is_draw: false },
      { status: "COMPLETED", team_a_id: "c", team_b_id: "b", winner_team_id: "c", is_draw: false },
    ];
    // a and c both have 1 win (2pts); c has the better NRR.
    const nrrByTeam = new Map([
      ["a", 0.5],
      ["c", 1.2],
    ]);
    const standings = computeStandings(teams, matches, nrrByTeam);
    expect(standings[0].teamId).toBe("c");
    expect(standings[1].teamId).toBe("a");
  });

  it("treats a missing NRR as worse than any real NRR", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: "b", winner_team_id: "a", is_draw: false },
      { status: "COMPLETED", team_a_id: "c", team_b_id: "b", winner_team_id: "c", is_draw: false },
    ];
    const nrrByTeam = new Map([["a", -2.0]]); // c has no NRR data at all
    const standings = computeStandings(teams, matches, nrrByTeam);
    expect(standings[0].teamId).toBe("a");
  });
});

describe("applyHeadToHeadTiebreak", () => {
  const standings = [
    { teamId: "a", name: "A", played: 2, won: 1, drawn: 0, lost: 1, points: 2, nrr: null },
    { teamId: "b", name: "B", played: 2, won: 1, drawn: 0, lost: 1, points: 2, nrr: null },
  ];

  it("promotes the team that won the head-to-head match", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "b", team_b_id: "a", winner_team_id: "b", is_draw: false },
    ];
    const result = applyHeadToHeadTiebreak(standings, matches);
    expect(result.map((s) => s.teamId)).toEqual(["b", "a"]);
  });

  it("leaves order untouched when there's no decisive match between the tied pair", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: "b", winner_team_id: null, is_draw: true },
    ];
    const result = applyHeadToHeadTiebreak(standings, matches);
    expect(result.map((s) => s.teamId)).toEqual(["a", "b"]);
  });
});

describe("getRoundWinners", () => {
  it("counts a bye (no team_b) as team_a automatically winning", () => {
    const round = [
      { status: "PENDING", team_a: { id: "a", name: "A" }, team_b: null, winner_team: null, is_draw: false },
    ];
    expect(getRoundWinners(round)).toEqual([{ id: "a", name: "A" }]);
  });

  it("returns null when a match in the round is still undecided", () => {
    const round = [
      {
        status: "COMPLETED",
        team_a: { id: "a", name: "A" },
        team_b: { id: "b", name: "B" },
        winner_team: { id: "a", name: "A" },
        is_draw: false,
      },
      {
        status: "PENDING",
        team_a: { id: "c", name: "C" },
        team_b: { id: "d", name: "D" },
        winner_team: null,
        is_draw: false,
      },
    ];
    expect(getRoundWinners(round)).toBeNull();
  });
});

describe("knockoutRoundLabel", () => {
  it("labels rounds by how many teams entered them", () => {
    expect(knockoutRoundLabel(2)).toBe("Final");
    expect(knockoutRoundLabel(4)).toBe("Semi Final");
    expect(knockoutRoundLabel(8)).toBe("Quarterfinal");
    expect(knockoutRoundLabel(16)).toBe("Round of 16");
  });
});
