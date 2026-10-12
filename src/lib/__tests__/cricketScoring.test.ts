import { createInitialInningsState, applyBall, matchResultSummary, type BallEvent } from "../cricketScoring";

function ball(overrides: Partial<BallEvent> & { seq: number }): BallEvent {
  return {
    strikerName: "P1",
    nonStrikerName: "P2",
    bowlerName: "B1",
    runsBatted: 1,
    extraType: null,
    extraRuns: 0,
    isWicket: false,
    wicketType: null,
    dismissedName: null,
    fielderName: null,
    ...overrides,
  };
}

describe("Last Man Stand", () => {
  it("ends the innings at totalPlayers-1 wickets when off (standard rule)", () => {
    // 3-player team: the innings is over once 2 wickets have fallen.
    let state = createInitialInningsState("A", 5, 3, "P1", "P2");
    state = applyBall(state, ball({ seq: 1, isWicket: true, wicketType: "BOWLED", dismissedName: "P1", strikerName: "P1" }));
    state = applyBall(
      state,
      ball({ seq: 2, isWicket: true, wicketType: "BOWLED", dismissedName: "P3", strikerName: "P3", nonStrikerName: "P2" })
    );
    expect(state.wickets).toBe(2);
    expect(state.isComplete).toBe(true);
  });

  it("lets the lone survivor keep batting with a null non-striker when on", () => {
    // Same 3-player team, but Last Man Stand is on — after 2 wickets the
    // third player keeps batting alone instead of the innings ending.
    let state = createInitialInningsState("A", 5, 3, "P1", "P2", 0, true);
    state = applyBall(state, ball({ seq: 1, isWicket: true, wicketType: "BOWLED", dismissedName: "P1", strikerName: "P1" }));
    // P3 comes in for P1; P2 is still the other end for now.
    state = applyBall(state, ball({ seq: 2, strikerName: "P3", nonStrikerName: "P2", runsBatted: 1 }));
    state = applyBall(
      state,
      ball({
        seq: 3,
        isWicket: true,
        wicketType: "RUN_OUT",
        dismissedName: "P2",
        strikerName: "P3",
        nonStrikerName: "P2",
        runsBatted: 0,
      })
    );
    expect(state.wickets).toBe(2);
    expect(state.isComplete).toBe(false);
    expect(state.striker).toBe("P3");
    expect(state.nonStriker).toBeNull();

    // P3 keeps facing deliveries alone — a null non-striker doesn't crash
    // strike rotation or batsman tracking.
    state = applyBall(state, ball({ seq: 4, strikerName: "P3", nonStrikerName: null, runsBatted: 4 }));
    expect(state.battingStats["P3"].runs).toBe(5);
    expect(state.isComplete).toBe(false);

    // The innings only ends once the last man is out too (wickets reaches
    // totalPlayers, not totalPlayers-1).
    state = applyBall(
      state,
      ball({ seq: 5, isWicket: true, wicketType: "BOWLED", dismissedName: "P3", strikerName: "P3", nonStrikerName: null })
    );
    expect(state.wickets).toBe(3);
    expect(state.isComplete).toBe(true);
  });

  it("matchResultSummary counts wickets in hand correctly under Last Man Stand", () => {
    const firstInnings = applyBall(createInitialInningsState("A", 5, 3, "X1", "X2"), ball({ seq: 1, runsBatted: 5 }));
    let secondInnings = createInitialInningsState("B", 5, 3, "P1", "P2", 0, true);
    secondInnings = applyBall(secondInnings, ball({ seq: 1, runsBatted: 6 }));
    // Chasing team wins having lost 2 wickets (the last man still in) — 1
    // wicket in hand, not 0 as the pre-Last-Man-Stand formula would give.
    secondInnings.wickets = 2;
    expect(matchResultSummary("A", "B", firstInnings, secondInnings)).toBe("B won by 1 wicket");
  });
});
