// Pure cricket scoring engine — no I/O, no React. The database only ever
// stores the ball-by-ball log (one row per delivery); everything else
// (current score, batting/bowling cards, run rate, fall of wickets) is
// derived by replaying that log through applyBall(). That means there's
// nothing to keep "in sync" — undo is just dropping the last ball and
// re-deriving, and the live screen and the final scorecard both compute
// their numbers the exact same way.
//
// Rule set is the common casual/box-cricket convention (this is a pickup-
// match scoring tool, not an ICC playing-conditions engine): no free hits,
// no powerplay tracking. Strike rotates on odd runs actually run between
// the wickets (byes/legbyes/no-ball runs included, the mandatory 1 for a
// wide/no-ball itself never rotates strike on its own), and always rotates
// at the end of a completed over.

export type ExtraType = "WIDE" | "NOBALL" | "BYE" | "LEGBYE" | null;
export type WicketType = "BOWLED" | "CAUGHT" | "LBW" | "RUN_OUT" | "STUMPED" | "HIT_WICKET" | "RETIRED_OUT";

export type BallEvent = {
  seq: number;
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
  runsBatted: number;
  extraType: ExtraType;
  extraRuns: number;
  isWicket: boolean;
  wicketType: WicketType | null;
  dismissedName: string | null;
  fielderName: string | null;
};

export type BatsmanStat = {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  outDescription: string | null;
  battingPosition: number;
};

export type BowlerStat = {
  name: string;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
};

export type FallOfWicket = {
  wicketNumber: number;
  teamScore: number;
  overs: string;
  playerOut: string;
};

export type InningsState = {
  battingTeam: "A" | "B";
  oversLimit: number;
  totalPlayers: number;
  runs: number;
  wickets: number;
  legalBalls: number;
  striker: string | null;
  nonStriker: string | null;
  currentBowler: string | null;
  previousOverBowler: string | null;
  ballsInCurrentOver: number;
  runsInCurrentOver: number;
  battingOrder: string[];
  battingStats: Record<string, BatsmanStat>;
  bowlingOrder: string[];
  bowlingStats: Record<string, BowlerStat>;
  fallOfWickets: FallOfWicket[];
  extras: { wide: number; noball: number; bye: number; legbye: number };
  isComplete: boolean;
};

// Splits one innings' ball log into per-over chunks — an over ends after 6
// legal deliveries, same rule the live screen already used inline for
// "this over only"; shared here so Recent Balls can show every over, not
// just the current one.
export function groupBallsByOver(balls: BallEvent[]): BallEvent[][] {
  const overs: BallEvent[][] = [];
  let current: BallEvent[] = [];
  let legalCount = 0;
  for (const b of balls) {
    current.push(b);
    const isLegal = b.extraType !== "WIDE" && b.extraType !== "NOBALL";
    if (isLegal) legalCount += 1;
    if (legalCount === 6) {
      overs.push(current);
      current = [];
      legalCount = 0;
    }
  }
  if (current.length > 0) overs.push(current);
  return overs;
}

export function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function computeRunRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return (runs / legalBalls) * 6;
}

// null once the chase is already over (no balls left or already won) — the
// caller decides what to show in that case.
export function computeRequiredRunRate(
  target: number,
  runsScored: number,
  legalBalls: number,
  oversLimit: number
): number | null {
  const ballsRemaining = oversLimit * 6 - legalBalls;
  const runsNeeded = target - runsScored;
  if (ballsRemaining <= 0 || runsNeeded <= 0) return null;
  return (runsNeeded / ballsRemaining) * 6;
}

function ensureBatsman(state: InningsState, name: string): BatsmanStat {
  const existing = state.battingStats[name];
  if (existing) return existing;
  const fresh: BatsmanStat = {
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    outDescription: null,
    battingPosition: state.battingOrder.length + 1,
  };
  state.battingOrder.push(name);
  state.battingStats[name] = fresh;
  return fresh;
}

function ensureBowler(state: InningsState, name: string): BowlerStat {
  const existing = state.bowlingStats[name];
  if (existing) return existing;
  const fresh: BowlerStat = { name, legalBalls: 0, runsConceded: 0, wickets: 0, maidens: 0 };
  state.bowlingOrder.push(name);
  state.bowlingStats[name] = fresh;
  return fresh;
}

function describeDismissal(ball: BallEvent): string {
  switch (ball.wicketType) {
    case "BOWLED":
      return `b ${ball.bowlerName}`;
    case "CAUGHT":
      return ball.fielderName ? `c ${ball.fielderName} b ${ball.bowlerName}` : `c & b ${ball.bowlerName}`;
    case "LBW":
      return `lbw b ${ball.bowlerName}`;
    case "STUMPED":
      return `st ${ball.fielderName ?? "†"} b ${ball.bowlerName}`;
    case "HIT_WICKET":
      return `hit wicket b ${ball.bowlerName}`;
    case "RUN_OUT":
      return ball.fielderName ? `run out (${ball.fielderName})` : "run out";
    case "RETIRED_OUT":
      return "retired out";
    default:
      return "out";
  }
}

export function createInitialInningsState(
  battingTeam: "A" | "B",
  oversLimit: number,
  totalPlayers: number,
  openingStriker: string,
  openingNonStriker: string
): InningsState {
  const state: InningsState = {
    battingTeam,
    oversLimit,
    totalPlayers,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    striker: openingStriker,
    nonStriker: openingNonStriker,
    currentBowler: null,
    previousOverBowler: null,
    ballsInCurrentOver: 0,
    runsInCurrentOver: 0,
    battingOrder: [],
    battingStats: {},
    bowlingOrder: [],
    bowlingStats: {},
    fallOfWickets: [],
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    isComplete: false,
  };
  ensureBatsman(state, openingStriker);
  ensureBatsman(state, openingNonStriker);
  return state;
}

// Applies one delivery and returns a new state — never mutates the input,
// so React state updates and replay-from-log both work the same way.
export function applyBall(prev: InningsState, ball: BallEvent): InningsState {
  const state: InningsState = JSON.parse(JSON.stringify(prev));
  if (state.isComplete) return state;

  const bowler = ensureBowler(state, ball.bowlerName);
  const striker = ensureBatsman(state, ball.strikerName);
  ensureBatsman(state, ball.nonStrikerName);
  state.currentBowler = ball.bowlerName;
  // Trust the names recorded on the ball itself rather than whatever the
  // reducer's own swap bookkeeping predicted — this is what makes replay
  // self-correcting (e.g. after a wicket, the live UI records whoever the
  // scorer actually picked as the replacement, and that's authoritative).
  state.striker = ball.strikerName;
  state.nonStriker = ball.nonStrikerName;

  const isLegalDelivery = ball.extraType !== "WIDE" && ball.extraType !== "NOBALL";
  // Runs actually run between the wickets — decides strike rotation. The
  // mandatory 1 for a bare wide/no-ball (no running) doesn't rotate strike;
  // any additional runs run on top of it do.
  const runsRun =
    ball.extraType === "WIDE" || ball.extraType === "NOBALL"
      ? Math.max(0, ball.extraRuns - 1) + (ball.extraType === "NOBALL" ? ball.runsBatted : 0)
      : ball.extraType === "BYE" || ball.extraType === "LEGBYE"
        ? ball.extraRuns
        : ball.runsBatted;

  const totalRunsThisBall = ball.runsBatted + ball.extraRuns;
  state.runs += totalRunsThisBall;
  state.runsInCurrentOver += totalRunsThisBall;

  if (ball.extraType === "WIDE") {
    state.extras.wide += ball.extraRuns;
    bowler.runsConceded += ball.extraRuns;
  } else if (ball.extraType === "NOBALL") {
    state.extras.noball += 1;
    bowler.runsConceded += ball.extraRuns + ball.runsBatted;
    striker.runs += ball.runsBatted;
    if (ball.runsBatted === 4) striker.fours += 1;
    if (ball.runsBatted === 6) striker.sixes += 1;
  } else if (ball.extraType === "BYE") {
    state.extras.bye += ball.extraRuns;
    bowler.runsConceded += 0;
  } else if (ball.extraType === "LEGBYE") {
    state.extras.legbye += ball.extraRuns;
    bowler.runsConceded += 0;
  } else {
    striker.runs += ball.runsBatted;
    bowler.runsConceded += ball.runsBatted;
    if (ball.runsBatted === 4) striker.fours += 1;
    if (ball.runsBatted === 6) striker.sixes += 1;
  }

  // Batsman faces the ball (counts toward their strike rate) on anything
  // except a wide.
  if (ball.extraType !== "WIDE") {
    striker.balls += 1;
  }

  if (isLegalDelivery) {
    state.legalBalls += 1;
    state.ballsInCurrentOver += 1;
    bowler.legalBalls += 1;
  }

  if (ball.isWicket && ball.dismissedName) {
    const dismissed = state.battingStats[ball.dismissedName];
    if (dismissed) {
      dismissed.isOut = true;
      dismissed.outDescription = describeDismissal(ball);
    }
    if (ball.wicketType !== "RUN_OUT" && ball.wicketType !== "RETIRED_OUT") {
      bowler.wickets += 1;
    }
    state.wickets += 1;
    state.fallOfWickets.push({
      wicketNumber: state.wickets,
      teamScore: state.runs,
      overs: formatOvers(state.legalBalls),
      playerOut: ball.dismissedName,
    });
    // The dismissed batsman leaves their end open — the live-scoring UI is
    // responsible for prompting for a replacement and filling striker/
    // nonStriker back in via setNextBatsman() before the next ball.
    if (ball.dismissedName === state.striker) state.striker = null;
    else if (ball.dismissedName === state.nonStriker) state.nonStriker = null;
  }

  // Strike rotates on odd runs actually run.
  if (state.striker && state.nonStriker && runsRun % 2 === 1) {
    [state.striker, state.nonStriker] = [state.nonStriker, state.striker];
  }

  // Over complete: rotate ends, maiden check, clear the bowler slot so the
  // UI prompts for next over's bowler (can't be the same as this one).
  if (isLegalDelivery && state.ballsInCurrentOver === 6) {
    if (state.runsInCurrentOver === 0) bowler.maidens += 1;
    if (state.striker && state.nonStriker) {
      [state.striker, state.nonStriker] = [state.nonStriker, state.striker];
    }
    state.previousOverBowler = ball.bowlerName;
    state.currentBowler = null;
    state.ballsInCurrentOver = 0;
    state.runsInCurrentOver = 0;
  }

  const allOut = state.wickets >= state.totalPlayers - 1;
  const oversUp = state.legalBalls >= state.oversLimit * 6;
  if (allOut || oversUp) state.isComplete = true;

  return state;
}

export function setNextBatsman(state: InningsState, name: string): InningsState {
  const next: InningsState = JSON.parse(JSON.stringify(state));
  ensureBatsman(next, name);
  if (!next.striker) next.striker = name;
  else if (!next.nonStriker) next.nonStriker = name;
  return next;
}

// Each persisted ball already carries the correct striker/non-striker names
// (whatever the live scorer had selected at the time, replacement batsmen
// included), so replay just needs to feed them through in order — no
// separate "who came in after each wicket" bookkeeping required.
export function replayInnings(
  balls: BallEvent[],
  battingTeam: "A" | "B",
  oversLimit: number,
  totalPlayers: number,
  openingStriker: string,
  openingNonStriker: string
): InningsState {
  let state = createInitialInningsState(battingTeam, oversLimit, totalPlayers, openingStriker, openingNonStriker);
  for (const ball of balls) {
    state = applyBall(state, ball);
  }
  return state;
}

export function matchResultSummary(
  teamAName: string,
  teamBName: string,
  firstInnings: InningsState,
  secondInnings: InningsState
): string {
  const battingSecond = secondInnings.battingTeam === "A" ? teamAName : teamBName;
  const battingFirst = firstInnings.battingTeam === "A" ? teamAName : teamBName;
  if (secondInnings.runs > firstInnings.runs) {
    const wicketsInHand = secondInnings.totalPlayers - 1 - secondInnings.wickets;
    return `${battingSecond} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`;
  }
  if (secondInnings.runs < firstInnings.runs) {
    const margin = firstInnings.runs - secondInnings.runs;
    return `${battingFirst} won by ${margin} run${margin === 1 ? "" : "s"}`;
  }
  return "Match tied";
}
