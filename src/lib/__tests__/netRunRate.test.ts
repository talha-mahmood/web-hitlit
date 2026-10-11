import { computeInningsForNRR, aggregateNRR } from "../netRunRate";
import type { BallEvent } from "../cricketScoring";

function makeBall(overrides: Partial<BallEvent> = {}): BallEvent {
  return {
    seq: 0,
    strikerName: "P1",
    nonStrikerName: "P2",
    bowlerName: "B1",
    runsBatted: 0,
    extraType: null,
    extraRuns: 0,
    isWicket: false,
    wicketType: null,
    dismissedName: null,
    fielderName: null,
    ...overrides,
  };
}

// n legal, 1-run balls, with a wicket on every `wicketEvery`th ball (if set).
function makeLegalBalls(count: number, wicketEvery?: number): BallEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const isWicket = !!wicketEvery && n % wicketEvery === 0;
    return makeBall({ seq: n, runsBatted: 1, isWicket, wicketType: isWicket ? "BOWLED" : null });
  });
}

describe("computeInningsForNRR", () => {
  it("uses the actual legal balls faced when not all out", () => {
    // 5-over match (30 legal balls), innings stops at 22 balls (chase won
    // early) with only 3 wickets down out of 11 players — not all out.
    const balls = makeLegalBalls(22, 7); // wickets at 7,14,21 = 3 wickets
    const result = computeInningsForNRR(balls, 5, 11);
    expect(result.runs).toBe(22);
    expect(result.legalBalls).toBe(22); // actual, not padded
  });

  it("uses the full allocated overs when all out, not the balls actually bowled", () => {
    // 5-over match (30 legal balls), 11 players (all out at 10 wickets).
    // 10 wickets fall on balls 2,4,...,20 — innings effectively over at
    // ball 26 (some balls played on after the "10th wicket" purely for
    // this fixture's bookkeeping; what matters is wickets >= 10).
    const wicketBalls = Array.from({ length: 26 }, (_, i) => {
      const n = i + 1;
      const isWicket = n % 2 === 0 && n <= 20;
      return makeBall({ seq: n, runsBatted: 1, isWicket, wicketType: isWicket ? "BOWLED" : null });
    });
    const result = computeInningsForNRR(wicketBalls, 5, 11);
    expect(result.runs).toBe(26);
    expect(result.legalBalls).toBe(30); // padded to the full 5-over quota
  });

  it("excludes wides/no-balls/penalties from the legal-ball count but still counts their runs", () => {
    const balls = [
      ...makeLegalBalls(10),
      makeBall({ seq: 11, extraType: "WIDE", extraRuns: 1 }),
      makeBall({ seq: 12, extraType: "NOBALL", runsBatted: 4, extraRuns: 1 }),
    ];
    const result = computeInningsForNRR(balls, 5, 11);
    expect(result.runs).toBe(10 + 1 + 5); // 10 singles + 1 wide + (4 batted + 1 no-ball run)
    expect(result.legalBalls).toBe(10); // wide/no-ball don't count as legal deliveries
  });
});

describe("aggregateNRR", () => {
  it("returns null when there are no eligible matches", () => {
    expect(aggregateNRR([])).toBeNull();
  });

  it("sums across matches before computing the rate, instead of averaging per-match NRR", () => {
    // Match 1: scored 150/30 balls, conceded 120/30 balls -> per-match NRR = 1.0
    // Match 2: scored 60/30 balls, conceded 180/30 balls -> per-match NRR = -4.0
    // A naive average would give -1.5; the correct aggregate sums first:
    // (150+60)*6/60 - (120+180)*6/60 = 21 - 30 = -9... use a cleaner case below.
    const entries = [
      { runsFor: 150, ballsFor: 30, runsAgainst: 120, ballsAgainst: 30 },
      { runsFor: 150, ballsFor: 30, runsAgainst: 120, ballsAgainst: 30 },
    ];
    // Identical matches: aggregate must equal the single-match NRR exactly
    // (300*6/60 - 240*6/60 = 30 - 24 = 6, same as one match: 150*6/30-120*6/30=30-24=6).
    expect(aggregateNRR(entries)).toBeCloseTo(6, 5);
  });

  it("is not simply the average of two different per-match NRRs (weighted by balls, not matches)", () => {
    // Match 1: 10 overs faced, per-match NRR = 100*6/60 - 100*6/60 = 0.
    // Match 2: 5 overs faced, per-match NRR = 60*6/30 - 30*6/30 = 6.
    const entries = [
      { runsFor: 100, ballsFor: 60, runsAgainst: 100, ballsAgainst: 60 },
      { runsFor: 60, ballsFor: 30, runsAgainst: 30, ballsAgainst: 30 },
    ];
    const naiveAverage = (0 + 6) / 2; // 3 — wrong: treats both matches equally
    // Correct: sums first — (160*6/90) - (130*6/90) = 10.667 - 8.667 = 2
    const aggregate = aggregateNRR(entries);
    expect(aggregate).toBeCloseTo(2, 5);
    expect(aggregate).not.toBeCloseTo(naiveAverage, 5);
  });

  it("returns null if either side has zero legal balls (no usable data)", () => {
    expect(aggregateNRR([{ runsFor: 50, ballsFor: 0, runsAgainst: 40, ballsAgainst: 30 }])).toBeNull();
  });
});
