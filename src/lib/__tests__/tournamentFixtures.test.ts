import {
  computeKnockoutFixtures,
  computeLeagueFixtures,
  computeStandings,
  pairTeamsForFixtures,
  getRoundWinners,
  knockoutRoundLabel,
} from "../tournamentFixtures";

describe("computeKnockoutFixtures", () => {
  it("pairs teams consecutively with no bye for an even count", () => {
    expect(computeKnockoutFixtures(["A", "B", "C", "D"])).toEqual([
      { teamA: "A", teamB: "B" },
      { teamA: "C", teamB: "D" },
    ]);
  });

  it("gives the last team a bye for an odd count", () => {
    expect(computeKnockoutFixtures(["A", "B", "C"])).toEqual([
      { teamA: "A", teamB: "B" },
      { teamA: "C", teamB: null },
    ]);
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

  it("awards 3 points for a win, 1 each for a draw, 0 for a loss", () => {
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: "b", winner_team_id: "a", is_draw: false },
      { status: "COMPLETED", team_a_id: "a", team_b_id: "c", winner_team_id: null, is_draw: true },
    ];
    const standings = computeStandings(teams, matches);
    const byId = Object.fromEntries(standings.map((s) => [s.teamId, s]));
    expect(byId.a).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4 });
    expect(byId.b).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, points: 0 });
    expect(byId.c).toMatchObject({ played: 1, won: 0, drawn: 1, lost: 0, points: 1 });
  });

  it("ranks by points first, then wins as a tie-break", () => {
    // a: 1 win (3pts); b: 3 draws (3pts) but more wins should NOT outrank
    // equal points — points come first, wins only break a points tie.
    const matches = [
      { status: "COMPLETED", team_a_id: "a", team_b_id: "b", winner_team_id: "a", is_draw: false },
      { status: "COMPLETED", team_a_id: "b", team_b_id: "c", winner_team_id: null, is_draw: true },
      { status: "COMPLETED", team_a_id: "a", team_b_id: "c", winner_team_id: null, is_draw: true },
    ];
    const standings = computeStandings(teams, matches);
    // a: 1W 1D = 4pts, b: 1L 1D = 1pt, c: 2D = 2pts
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
