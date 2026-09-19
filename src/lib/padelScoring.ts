// Pure padel scoring engine — no I/O, no React. The database only ever
// stores the point-by-point log (one row per point, just "who won it");
// everything else (current game score, games won, sets won, deuce/
// advantage/golden-point/star-point state, tiebreaks, server) is derived by
// replaying that log through replayPadelMatch(). Same philosophy as
// cricketScoring.ts: undo is just dropping the last point and re-deriving,
// and the live screen and the final scorecard both compute their numbers
// the exact same way.
//
// Rules implemented follow the 2026 FIP padel playing conditions as
// described by the product spec this was built from:
//  - Games: Love/15/30/40/Game, first to 6 games (win by 2), tiebreak at 6-6.
//  - Deuce handling is configurable per match: traditional Advantage,
//    Golden Point (sudden death at 40-40), or Star Point (two rounds of
//    deuce/advantage, then a third deuce becomes a single decisive point).
//  - Match: best of 1 set, best of 3 sets, or best of 3 where a 1-1 decider
//    is a single 10-point Match Tiebreak instead of a full third set.

export type Team = "A" | "B";
export type DeuceType = "ADVANTAGE" | "GOLDEN_POINT" | "STAR_POINT";
export type MatchFormat = "BEST_OF_1" | "BEST_OF_3" | "BEST_OF_3_MATCH_TIEBREAK";

export type PointEvent = {
  seq: number;
  winner: Team;
};

export type SetResult = {
  gamesA: number;
  gamesB: number;
  winner: Team | null; // null only for the in-progress current set
  isMatchTiebreak: boolean; // this "set" is actually a single 10-point decider, not a normal set
  tiebreak: { a: number; b: number } | null; // final/live score of a 6-6 set tiebreak, if one was (or is being) played
};

export type CurrentGameState = {
  pointsA: number;
  pointsB: number;
  display: string; // "0 - 0" / "40 - 30" / "DEUCE" / "ADVANTAGE A" / "GOLDEN POINT" / "STAR POINT" / "TIEBREAK"
  isTiebreak: boolean; // a 6-6 set tiebreak or the final match tiebreak — shown as a raw point race, never 15/30/40
  isMatchTiebreak: boolean;
  // True at 40-40 under Golden Point, or at the third deuce under Star
  // Point — the single point that decides the game. The live screen uses
  // this to prompt the receiving pair to pick a side, per FIP rules.
  isDecisivePoint: boolean;
};

export type ServerInfo = {
  team: Team;
  playerIndex: 0 | 1;
};

export type PadelMatchConfig = {
  format: MatchFormat;
  deuceType: DeuceType;
  firstServerTeam: Team;
  firstServerPlayerIndex: 0 | 1;
  gamesPerSet: number; // standard is 6 (tiebreak at 6-6); host can shorten each set
};

export type PadelMatchState = {
  sets: SetResult[]; // completed sets, plus the in-progress one last (unless the match just finished)
  setsWonA: number;
  setsWonB: number;
  setsToWin: number;
  currentGame: CurrentGameState;
  server: ServerInfo;
  isComplete: boolean;
  winner: Team | null;
};

const GAME_POINT_LABELS = ["0", "15", "30", "40"];
function labelForPoints(n: number): string {
  return GAME_POINT_LABELS[Math.min(n, 3)];
}

type GameEval = { winner: Team | null; display: string; isDecisivePoint: boolean };

// Scores one game's raw point tally into a display label and (once decided)
// a winner. Below 40-40 this is the plain 0/15/30/40 ladder; once both
// sides reach 40, behavior branches on the match's configured deuce type —
// see the module comment above and the individual branches below for the
// exact rule each one implements.
function evaluateGamePoints(pointsA: number, pointsB: number, deuceType: DeuceType): GameEval {
  if (pointsA < 3 || pointsB < 3) {
    if (pointsA >= 4) return { winner: "A", display: "GAME", isDecisivePoint: false };
    if (pointsB >= 4) return { winner: "B", display: "GAME", isDecisivePoint: false };
    return { winner: null, display: `${labelForPoints(pointsA)} - ${labelForPoints(pointsB)}`, isDecisivePoint: false };
  }

  const net = pointsA - pointsB;
  // How many points have been played since first reaching 40-40 — used to
  // count which "round" of deuce we're on (1st, 2nd, 3rd...).
  const extra = pointsA + pointsB - 6;
  const deuceRound = Math.floor(extra / 2) + 1;

  if (deuceType === "GOLDEN_POINT") {
    // No advantage at all — 40-40 is decided by a single sudden-death point.
    if (net > 0) return { winner: "A", display: "GAME", isDecisivePoint: false };
    if (net < 0) return { winner: "B", display: "GAME", isDecisivePoint: false };
    return { winner: null, display: "GOLDEN POINT", isDecisivePoint: true };
  }

  if (deuceType === "STAR_POINT" && deuceRound >= 3) {
    // Two rounds of Deuce → Advantage already happened; the third deuce
    // becomes a single decisive "Star Point" instead of a third advantage.
    if (net > 0) return { winner: "A", display: "GAME", isDecisivePoint: false };
    if (net < 0) return { winner: "B", display: "GAME", isDecisivePoint: false };
    return { winner: null, display: "STAR POINT", isDecisivePoint: true };
  }

  // Traditional advantage scoring — win by 2 clear points. STAR_POINT uses
  // this same branch for its first two deuce/advantage rounds.
  if (net >= 2) return { winner: "A", display: "GAME", isDecisivePoint: false };
  if (net <= -2) return { winner: "B", display: "GAME", isDecisivePoint: false };
  if (net === 0) return { winner: null, display: "DEUCE", isDecisivePoint: false };
  return { winner: null, display: net === 1 ? "ADVANTAGE A" : "ADVANTAGE B", isDecisivePoint: false };
}

// First to `target` points, win by 2 clear — used for both the 6-6 set
// tiebreak (target 7) and the final Match Tiebreak (target 10).
function evaluateRace(pointsA: number, pointsB: number, target: number): Team | null {
  if (pointsA >= target && pointsA - pointsB >= 2) return "A";
  if (pointsB >= target && pointsB - pointsA >= 2) return "B";
  return null;
}

// Fixed 4-slot service rotation seeded by whichever team/player serves
// first — team always alternates (A, B, A, B, ...) and each team's two
// players alternate on that team's own service turns, which is the
// standard doubles rotation. Rotated so index 0 matches the match's chosen
// first server.
function buildServerRotation(firstServerTeam: Team, firstServerPlayerIndex: 0 | 1): ServerInfo[] {
  const base: ServerInfo[] = [
    { team: "A", playerIndex: 0 },
    { team: "B", playerIndex: 0 },
    { team: "A", playerIndex: 1 },
    { team: "B", playerIndex: 1 },
  ];
  const startIdx = base.findIndex((s) => s.team === firstServerTeam && s.playerIndex === firstServerPlayerIndex);
  if (startIdx <= 0) return base;
  return [...base.slice(startIdx), ...base.slice(0, startIdx)];
}

// Within a tiebreak, the player who's next in the main rotation serves the
// first point alone, then service alternates every two points — the
// standard tiebreak serving pattern.
function tiebreakRotationOffset(pointsPlayedInTiebreak: number): number {
  if (pointsPlayedInTiebreak === 0) return 0;
  return 1 + Math.floor((pointsPlayedInTiebreak - 1) / 2);
}

export function replayPadelMatch(points: PointEvent[], config: PadelMatchConfig): PadelMatchState {
  const setsToWin = config.format === "BEST_OF_1" ? 1 : 2;
  const rotation = buildServerRotation(config.firstServerTeam, config.firstServerPlayerIndex);

  const sets: SetResult[] = [];
  let setsWonA = 0;
  let setsWonB = 0;
  let gamesA = 0;
  let gamesB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let inTiebreak = false;
  let gamesPlayedTotal = 0; // advances the main rotation — a set tiebreak counts as one "game" for this purpose
  let matchComplete = false;
  let matchWinner: Team | null = null;

  for (const point of points) {
    if (matchComplete) break;

    const isDeciderMatchTiebreak =
      config.format === "BEST_OF_3_MATCH_TIEBREAK" && setsWonA === 1 && setsWonB === 1;

    if (isDeciderMatchTiebreak) {
      if (point.winner === "A") pointsA++;
      else pointsB++;
      const winner = evaluateRace(pointsA, pointsB, 10);
      if (winner) {
        sets.push({ gamesA: pointsA, gamesB: pointsB, winner, isMatchTiebreak: true, tiebreak: null });
        if (winner === "A") setsWonA++;
        else setsWonB++;
        matchComplete = true;
        matchWinner = winner;
        pointsA = 0;
        pointsB = 0;
      }
      continue;
    }

    if (inTiebreak) {
      if (point.winner === "A") pointsA++;
      else pointsB++;
      const winner = evaluateRace(pointsA, pointsB, 7);
      if (winner) {
        if (winner === "A") gamesA++;
        else gamesB++;
        sets.push({ gamesA, gamesB, winner, isMatchTiebreak: false, tiebreak: { a: pointsA, b: pointsB } });
        if (winner === "A") setsWonA++;
        else setsWonB++;
        gamesA = 0;
        gamesB = 0;
        pointsA = 0;
        pointsB = 0;
        inTiebreak = false;
        gamesPlayedTotal++;
        if (setsWonA === setsToWin || setsWonB === setsToWin) {
          matchComplete = true;
          matchWinner = winner;
        }
      }
      continue;
    }

    // Normal game.
    if (point.winner === "A") pointsA++;
    else pointsB++;
    const evalResult = evaluateGamePoints(pointsA, pointsB, config.deuceType);
    if (evalResult.winner) {
      if (evalResult.winner === "A") gamesA++;
      else gamesB++;
      pointsA = 0;
      pointsB = 0;
      gamesPlayedTotal++;

      if (gamesA === config.gamesPerSet && gamesB === config.gamesPerSet) {
        inTiebreak = true;
      } else {
        const setWinner = evaluateRace(gamesA, gamesB, config.gamesPerSet);
        if (setWinner) {
          sets.push({ gamesA, gamesB, winner: setWinner, isMatchTiebreak: false, tiebreak: null });
          if (setWinner === "A") setsWonA++;
          else setsWonB++;
          gamesA = 0;
          gamesB = 0;
          if (setsWonA === setsToWin || setsWonB === setsToWin) {
            matchComplete = true;
            matchWinner = setWinner;
          }
        }
      }
    }
  }

  const isDeciderMatchTiebreakNow =
    !matchComplete && config.format === "BEST_OF_3_MATCH_TIEBREAK" && setsWonA === 1 && setsWonB === 1;

  if (!matchComplete) {
    sets.push({
      gamesA,
      gamesB,
      winner: null,
      isMatchTiebreak: isDeciderMatchTiebreakNow,
      tiebreak: inTiebreak ? { a: pointsA, b: pointsB } : null,
    });
  }

  let currentGame: CurrentGameState;
  if (matchComplete) {
    currentGame = { pointsA: 0, pointsB: 0, display: "GAME", isTiebreak: false, isMatchTiebreak: false, isDecisivePoint: false };
  } else if (isDeciderMatchTiebreakNow) {
    currentGame = {
      pointsA,
      pointsB,
      display: "MATCH TIEBREAK",
      isTiebreak: true,
      isMatchTiebreak: true,
      isDecisivePoint: false,
    };
  } else if (inTiebreak) {
    currentGame = {
      pointsA,
      pointsB,
      display: "TIEBREAK",
      isTiebreak: true,
      isMatchTiebreak: false,
      isDecisivePoint: false,
    };
  } else {
    const evalResult = evaluateGamePoints(pointsA, pointsB, config.deuceType);
    currentGame = {
      pointsA,
      pointsB,
      display: evalResult.display,
      isTiebreak: false,
      isMatchTiebreak: false,
      isDecisivePoint: evalResult.isDecisivePoint,
    };
  }

  let server: ServerInfo;
  if (matchComplete) {
    server = rotation[0];
  } else if (isDeciderMatchTiebreakNow || inTiebreak) {
    const offset = tiebreakRotationOffset(pointsA + pointsB);
    server = rotation[(gamesPlayedTotal + offset) % 4];
  } else {
    server = rotation[gamesPlayedTotal % 4];
  }

  return {
    sets,
    setsWonA,
    setsWonB,
    setsToWin,
    currentGame,
    server,
    isComplete: matchComplete,
    winner: matchWinner,
  };
}

// "6" / "7" for a plain game count, or "7(4)" when the set was decided by a
// tiebreak (the loser's tiebreak points shown small, the usual convention).
export function formatSetScore(set: SetResult, forTeam: Team): string {
  const games = forTeam === "A" ? set.gamesA : set.gamesB;
  if (!set.tiebreak) return String(games);
  const loserTiebreakPoints = (forTeam === "A" ? set.gamesA > set.gamesB : set.gamesB > set.gamesA)
    ? Math.min(set.tiebreak.a, set.tiebreak.b)
    : null;
  return loserTiebreakPoints === null ? String(games) : `${games}(${loserTiebreakPoints})`;
}

export function matchResultSummary(teamAName: string, teamBName: string, state: PadelMatchState): string {
  if (!state.winner) return "";
  const winnerName = state.winner === "A" ? teamAName : teamBName;
  return `${winnerName} won ${state.setsWonA}-${state.setsWonB}`;
}
