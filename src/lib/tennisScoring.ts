// Pure tennis scoring engine — no I/O, no React. Same philosophy as
// cricketScoring.ts and padelScoring.ts: the database only ever stores the
// point-by-point log (one row per point, just "who won it"); everything
// else (current game score, games won, sets won, deuce/advantage, tiebreak,
// server, and live indicators like Game/Break/Set/Match point) is derived
// by replaying that log through replayTennisMatch(). Undo is just dropping
// the last point and re-deriving.
//
// Deliberately a separate module from padelScoring.ts rather than sharing
// code with it — tennis is singles (one player per side, not a two-player
// team with its own service rotation) and only ever uses traditional
// Advantage scoring (no Golden Point / Star Point), so a shared abstraction
// would just be extra indirection for the few formulas that do overlap.

export type Player = "A" | "B";
export type MatchFormat = "BEST_OF_1" | "BEST_OF_3" | "BEST_OF_5";

export type PointEvent = {
  seq: number;
  winner: Player;
};

export type SetResult = {
  gamesA: number;
  gamesB: number;
  winner: Player | null; // null only for the in-progress current set
  tiebreak: { a: number; b: number } | null; // final/live score of a 6-6 tiebreak, if one was (or is being) played
};

export type CurrentGameState = {
  pointsA: number;
  pointsB: number;
  display: string; // "0 - 0" / "40 - 30" / "DEUCE" / "ADVANTAGE A" / "TIEBREAK"
  isTiebreak: boolean;
};

// Which standard tennis situation the very next point represents, and for
// whom — GAME_POINT/SET_POINT/MATCH_POINT favor whoever's about to win;
// BREAK_POINT is the special case of a game point held by the receiver
// (winning it breaks the opponent's serve) rather than the server.
export type Indicator = "GAME_POINT" | "BREAK_POINT" | "SET_POINT" | "MATCH_POINT" | null;

export type ServerInfo = { player: Player };

export type TennisMatchConfig = {
  format: MatchFormat;
  firstServer: Player;
  gamesPerSet: number; // standard is 6 (tiebreak at 6-6); host can shorten each set
};

export type TennisMatchState = {
  sets: SetResult[]; // completed sets, plus the in-progress one last (unless the match just finished)
  setsWonA: number;
  setsWonB: number;
  setsToWin: number;
  currentGame: CurrentGameState;
  server: ServerInfo;
  indicator: Indicator;
  indicatorFor: Player | null;
  isComplete: boolean;
  winner: Player | null;
};

const GAME_POINT_LABELS = ["0", "15", "30", "40"];
function labelForPoints(n: number): string {
  return GAME_POINT_LABELS[Math.min(n, 3)];
}

type GameEval = { winner: Player | null; display: string };

// Traditional Advantage scoring — the only deuce rule this spec calls for.
// Below 40-40 it's the plain 0/15/30/40 ladder; once both sides reach 40,
// it's win-by-2 (Deuce / Advantage X / Game X).
function evaluateGamePoints(pointsA: number, pointsB: number): GameEval {
  if (pointsA < 3 || pointsB < 3) {
    if (pointsA >= 4) return { winner: "A", display: "GAME" };
    if (pointsB >= 4) return { winner: "B", display: "GAME" };
    return { winner: null, display: `${labelForPoints(pointsA)} - ${labelForPoints(pointsB)}` };
  }
  const net = pointsA - pointsB;
  if (net >= 2) return { winner: "A", display: "GAME" };
  if (net <= -2) return { winner: "B", display: "GAME" };
  if (net === 0) return { winner: null, display: "DEUCE" };
  return { winner: null, display: net === 1 ? "ADVANTAGE A" : "ADVANTAGE B" };
}

// First to `target` points, win by 2 clear — the 6-6 set tiebreak (target 7).
function evaluateRace(pointsA: number, pointsB: number, target: number): Player | null {
  if (pointsA >= target && pointsA - pointsB >= 2) return "A";
  if (pointsB >= target && pointsB - pointsA >= 2) return "B";
  return null;
}

// Games-per-set win check. A 1-game set can't have a "win by 2 clear"
// margin — winning the only game that exists has to be enough on its own,
// or the set (and, under Best of 1, the whole match) could never end. Any
// longer set keeps the normal win-by-2 race (with a tiebreak at target-target).
function evaluateSetWinner(gamesA: number, gamesB: number, target: number): Player | null {
  if (target <= 1) {
    if (gamesA >= 1) return "A";
    if (gamesB >= 1) return "B";
    return null;
  }
  return evaluateRace(gamesA, gamesB, target);
}

// Within a tiebreak, whoever's next in the server rotation serves the first
// point alone, then service alternates every two points — the standard
// tiebreak serving pattern.
function tiebreakServerOffset(pointsPlayedInTiebreak: number): number {
  if (pointsPlayedInTiebreak === 0) return 0;
  return 1 + Math.floor((pointsPlayedInTiebreak - 1) / 2);
}

export function replayTennisMatch(points: PointEvent[], config: TennisMatchConfig): TennisMatchState {
  const setsToWin = config.format === "BEST_OF_5" ? 3 : config.format === "BEST_OF_1" ? 1 : 2;

  const sets: SetResult[] = [];
  let setsWonA = 0;
  let setsWonB = 0;
  let gamesA = 0;
  let gamesB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let inTiebreak = false;
  let gamesPlayedTotal = 0; // advances server rotation — a set tiebreak counts as one "game" for this purpose
  let matchComplete = false;
  let matchWinner: Player | null = null;

  for (const point of points) {
    if (matchComplete) break;

    if (inTiebreak) {
      if (point.winner === "A") pointsA++;
      else pointsB++;
      const winner = evaluateRace(pointsA, pointsB, 7);
      if (winner) {
        if (winner === "A") gamesA++;
        else gamesB++;
        sets.push({ gamesA, gamesB, winner, tiebreak: { a: pointsA, b: pointsB } });
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
    const evalResult = evaluateGamePoints(pointsA, pointsB);
    if (evalResult.winner) {
      if (evalResult.winner === "A") gamesA++;
      else gamesB++;
      pointsA = 0;
      pointsB = 0;
      gamesPlayedTotal++;

      const setWinner = evaluateSetWinner(gamesA, gamesB, config.gamesPerSet);
      if (setWinner) {
        sets.push({ gamesA, gamesB, winner: setWinner, tiebreak: null });
        if (setWinner === "A") setsWonA++;
        else setsWonB++;
        gamesA = 0;
        gamesB = 0;
        if (setsWonA === setsToWin || setsWonB === setsToWin) {
          matchComplete = true;
          matchWinner = setWinner;
        }
      } else if (gamesA === config.gamesPerSet && gamesB === config.gamesPerSet) {
        inTiebreak = true;
      }
    }
  }

  if (!matchComplete) {
    sets.push({
      gamesA,
      gamesB,
      winner: null,
      tiebreak: inTiebreak ? { a: pointsA, b: pointsB } : null,
    });
  }

  let currentGame: CurrentGameState;
  if (matchComplete) {
    currentGame = { pointsA: 0, pointsB: 0, display: "GAME", isTiebreak: false };
  } else if (inTiebreak) {
    currentGame = { pointsA, pointsB, display: "TIEBREAK", isTiebreak: true };
  } else {
    const evalResult = evaluateGamePoints(pointsA, pointsB);
    currentGame = { pointsA, pointsB, display: evalResult.display, isTiebreak: false };
  }

  let server: ServerInfo;
  if (matchComplete) {
    server = { player: config.firstServer };
  } else if (inTiebreak) {
    const offset = tiebreakServerOffset(pointsA + pointsB);
    const startsWithA = gamesPlayedTotal % 2 === 0;
    const rotationBase: Player = startsWithA ? config.firstServer : config.firstServer === "A" ? "B" : "A";
    server = { player: offset % 2 === 0 ? rotationBase : rotationBase === "A" ? "B" : "A" };
  } else {
    server = { player: gamesPlayedTotal % 2 === 0 ? config.firstServer : (config.firstServer === "A" ? "B" : "A") };
  }

  // Live scoring indicators — simulate "what if this player wins the very
  // next point" up through game → set → match, using the exact same
  // evaluators as the real replay above, so the label can never drift from
  // what actually happens when that point is scored.
  let indicator: Indicator = null;
  let indicatorFor: Player | null = null;

  if (!matchComplete) {
    for (const candidate of ["A", "B"] as const) {
      const nextPointsA = pointsA + (candidate === "A" ? 1 : 0);
      const nextPointsB = pointsB + (candidate === "B" ? 1 : 0);
      const wouldWinGame = inTiebreak
        ? evaluateRace(nextPointsA, nextPointsB, 7) === candidate
        : evaluateGamePoints(nextPointsA, nextPointsB).winner === candidate;
      if (!wouldWinGame) continue;

      const nextGamesA = gamesA + (candidate === "A" ? 1 : 0);
      const nextGamesB = gamesB + (candidate === "B" ? 1 : 0);
      const wouldWinSet = inTiebreak ? true : evaluateSetWinner(nextGamesA, nextGamesB, config.gamesPerSet) === candidate;

      if (wouldWinSet) {
        const nextSetsA = setsWonA + (candidate === "A" ? 1 : 0);
        const nextSetsB = setsWonB + (candidate === "B" ? 1 : 0);
        const wouldWinMatch = (candidate === "A" ? nextSetsA : nextSetsB) === setsToWin;
        indicator = wouldWinMatch ? "MATCH_POINT" : "SET_POINT";
      } else {
        indicator = candidate === server.player ? "GAME_POINT" : "BREAK_POINT";
      }
      indicatorFor = candidate;
      break;
    }
  }

  return {
    sets,
    setsWonA,
    setsWonB,
    setsToWin,
    currentGame,
    server,
    indicator,
    indicatorFor,
    isComplete: matchComplete,
    winner: matchWinner,
  };
}

// "6" / "7" for a plain game count, or "7(4)" when the set was decided by a
// tiebreak (the loser's tiebreak points shown small, the usual convention).
export function formatSetScore(set: SetResult, forPlayer: Player): string {
  const games = forPlayer === "A" ? set.gamesA : set.gamesB;
  if (!set.tiebreak) return String(games);
  const loserTiebreakPoints = (forPlayer === "A" ? set.gamesA > set.gamesB : set.gamesB > set.gamesA)
    ? Math.min(set.tiebreak.a, set.tiebreak.b)
    : null;
  return loserTiebreakPoints === null ? String(games) : `${games}(${loserTiebreakPoints})`;
}

export function matchResultSummary(playerAName: string, playerBName: string, state: TennisMatchState): string {
  if (!state.winner) return "";
  const winnerName = state.winner === "A" ? playerAName : playerBName;
  return `${winnerName} won ${state.setsWonA}-${state.setsWonB}`;
}
