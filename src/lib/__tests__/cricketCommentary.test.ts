import { describeBallCommentary, computePartnerships, computePlayerOfTheMatch } from "../cricketCommentary";
import { createInitialInningsState, applyBall, type BallEvent, type InningsState } from "../cricketScoring";

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

describe("describeBallCommentary", () => {
  it("describes plain runs", () => {
    expect(describeBallCommentary(ball({ seq: 1, runsBatted: 0 }))).toBe("Dot ball.");
    expect(describeBallCommentary(ball({ seq: 2, runsBatted: 1 }))).toBe("Single run.");
    expect(describeBallCommentary(ball({ seq: 3, runsBatted: 4 }))).toBe("It's a boundary. Four.");
    expect(describeBallCommentary(ball({ seq: 4, runsBatted: 6 }))).toBe("Huge. It's a six.");
  });

  it("describes extras", () => {
    expect(describeBallCommentary(ball({ seq: 1, runsBatted: 0, extraType: "WIDE", extraRuns: 1 }))).toBe("Wide");
  });

  it("describes a caught dismissal with the fielder's name", () => {
    const commentary = describeBallCommentary(
      ball({ seq: 1, isWicket: true, wicketType: "CAUGHT", dismissedName: "P1", fielderName: "Moiz" })
    );
    expect(commentary).toBe("Wicket. Caught by Moiz.");
  });

  it("describes a bowled dismissal without needing a fielder", () => {
    const commentary = describeBallCommentary(ball({ seq: 1, isWicket: true, wicketType: "BOWLED", dismissedName: "P1" }));
    expect(commentary).toBe("Bowled. It's a wicket.");
  });
});

describe("computePartnerships", () => {
  it("starts a new segment every time the batting pair changes", () => {
    const balls: BallEvent[] = [
      ball({ seq: 1, strikerName: "A", nonStrikerName: "B", runsBatted: 4 }),
      ball({ seq: 2, strikerName: "A", nonStrikerName: "B", runsBatted: 1 }),
      ball({ seq: 3, strikerName: "B", nonStrikerName: "A", runsBatted: 0, isWicket: true, wicketType: "BOWLED", dismissedName: "B" }),
      // C comes in for B.
      ball({ seq: 4, strikerName: "C", nonStrikerName: "A", runsBatted: 2 }),
    ];
    const partnerships = computePartnerships(balls);
    expect(partnerships).toHaveLength(2);
    expect(partnerships[0]).toMatchObject({ runs: 5, balls: 3 });
    expect(partnerships[1]).toMatchObject({ runs: 2, balls: 1 });
    expect(new Set([partnerships[0].batsmanA, partnerships[0].batsmanB])).toEqual(new Set(["A", "B"]));
    expect(new Set([partnerships[1].batsmanA, partnerships[1].batsmanB])).toEqual(new Set(["A", "C"]));
  });

  it("treats a Last Man Stand's null non-striker as its own segment", () => {
    const balls: BallEvent[] = [
      ball({ seq: 1, strikerName: "A", nonStrikerName: "B", runsBatted: 2 }),
      ball({ seq: 2, strikerName: "A", nonStrikerName: null, runsBatted: 3 }),
    ];
    const partnerships = computePartnerships(balls);
    expect(partnerships).toHaveLength(2);
    expect(partnerships[1]).toMatchObject({ batsmanA: "A", batsmanB: "", runs: 3, balls: 1 });
  });
});

describe("computePlayerOfTheMatch", () => {
  it("weighs wickets heavily enough to beat a modest batting score", () => {
    let innings1 = createInitialInningsState("A", 5, 3, "Batter1", "Batter2");
    innings1 = applyBall(innings1, ball({ seq: 1, strikerName: "Batter1", runsBatted: 10 }));

    let innings2 = createInitialInningsState("B", 5, 3, "Batter3", "Batter4");
    innings2 = applyBall(
      innings2,
      ball({ seq: 1, strikerName: "Batter3", nonStrikerName: "Batter4", bowlerName: "Bowler1", isWicket: true, wicketType: "BOWLED", dismissedName: "Batter3", runsBatted: 0 })
    );

    const innings: { state: InningsState }[] = [{ state: innings1 }, { state: innings2 }];
    expect(computePlayerOfTheMatch(innings)).toBe("Bowler1");
  });

  it("returns null when there's no data at all", () => {
    expect(computePlayerOfTheMatch([])).toBeNull();
  });
});
