// Pure table tennis scoring engine — no I/O, no React. Same philosophy as
// cricketScoring.ts / padelScoring.ts / tennisScoring.ts /
// pickleballScoring.ts / badmintonScoring.ts: the database only ever
// stores the rally-by-rally log (one row per rally, just "who won it");
// everything else (score, server, service sequence, games won, match
// status, and Game/Deuce/Match point indicators) is derived by replaying
// that log through replayTableTennisMatch(). Undo is just dropping the
// last rally and re-deriving.
//
// A separate module from the others — table tennis is pure rally scoring
// to 11 (no hard cap the way badminton's 29-29 rule has one) and its
// server model is unlike anything else built so far: service rotates every
// 2 points *regardless of who wins the rally* (not on a point loss), then
// every 1 point once the score reaches 10-10 — plus doubles has a fixed
// diagonal serve/receive rotation among all four players.

export type Team = "A" | "B";
export type PlayMode = "SINGLES" | "DOUBLES";

export type RallyEvent = {
  seq: number;
  winner: Team;
};

export type TableTennisMatchConfig = {
  playMode: PlayMode;
  firstServingTeam: Team; // who serves first in game 1
  firstServerIndex: 0 | 1; // which player of that team serves the very first point (doubles only)
  pointsToWin: number; // standard is 11; host can shorten the game
  gamesToWin: number; // standard is 3 (best of 5); host can shorten the match
};

export type GameResult = {
  scoreA: number;
  scoreB: number;
  winner: Team | null; // null only for the in-progress current game
};

export type ServerState = {
  servingTeam: Team;
  serverIndex: 0 | 1; // which player of the serving team — always 0 in singles
  receiverIndex: 0 | 1; // which player of the receiving side is the designated receiver — doubles only
};

export type RallyAnnotation = {
  winner: Team;
  wasServiceChange: boolean; // the server (player or side) changed as of this rally
  serverAfter: ServerState;
};

export type Indicator = "GAME_POINT" | "MATCH_POINT" | "DEUCE" | null;

export type TableTennisMatchState = {
  games: GameResult[]; // completed games, plus the in-progress one last (unless the match just finished)
  gamesWonA: number;
  gamesWonB: number;
  gamesToWin: number;
  server: ServerState;
  indicator: Indicator;
  indicatorFor: Team | null;
  history: RallyAnnotation[]; // one annotation per rally across the whole match
  isComplete: boolean;
  winner: Team | null;
};

// First to `target`, win by 2 clear — no hard cap the way badminton has
// one; the score genuinely just keeps climbing (12-10, 13-11, 15-13, ...)
// until someone gets 2 clear.
function evaluateGame(scoreA: number, scoreB: number, target: number): Team | null {
  if (scoreA >= target && scoreA - scoreB >= 2) return "A";
  if (scoreB >= target && scoreB - scoreA >= 2) return "B";
  return null;
}

// The fixed doubles diagonal: server → receiver is always the next slot in
// this 4-cycle (A1 serves to B1, B1 serves to A2, A2 serves to B2, B2
// serves to A1), seeded so slot 0 is whichever player the match config
// names as the very first server.
function buildDoublesRotation(firstTeam: Team, firstIndex: 0 | 1): { team: Team; index: 0 | 1 }[] {
  const base: { team: Team; index: 0 | 1 }[] = [
    { team: "A", index: 0 },
    { team: "B", index: 0 },
    { team: "A", index: 1 },
    { team: "B", index: 1 },
  ];
  const startIdx = base.findIndex((s) => s.team === firstTeam && s.index === firstIndex);
  if (startIdx <= 0) return base;
  return [...base.slice(startIdx), ...base.slice(0, startIdx)];
}

// Which rotation slot serves the next point, given how many points have
// already been played in the current game — alternates every 2 points until
// the score reaches (target-1)-(target-1) (10-10 for an 11-point game),
// then alternates every single point for the rest of the game (the score
// can never drop back below that once reached, since it only moves in +1
// steps from there, so a simple points-played threshold is all that's
// needed).
function serviceSlotIndex(pointsPlayedInGame: number, target: number): number {
  const deuceThreshold = (target - 1) * 2;
  if (pointsPlayedInGame < deuceThreshold) return Math.floor(pointsPlayedInGame / 2) % 2;
  return (pointsPlayedInGame - deuceThreshold) % 2;
}

// Which team/index owns rotation slot N, for singles (a plain 2-slot
// alternation — no separate doubles-style 4-cycle needed).
function singlesSlotOwner(firstTeam: Team, slotParity: number): Team {
  return slotParity === 0 ? firstTeam : firstTeam === "A" ? "B" : "A";
}

export function replayTableTennisMatch(rallies: RallyEvent[], config: TableTennisMatchConfig): TableTennisMatchState {
  const gamesToWin = config.gamesToWin;
  const doublesRotation =
    config.playMode === "DOUBLES" ? buildDoublesRotation(config.firstServingTeam, config.firstServerIndex) : null;

  const games: GameResult[] = [];
  const history: RallyAnnotation[] = [];
  let gamesWonA = 0;
  let gamesWonB = 0;
  let scoreA = 0;
  let scoreB = 0;
  let pointsPlayedInGame = 0;
  let gameIndex = 0; // 0-based count of completed games, also used to alternate who serves first each game
  let matchComplete = false;
  let matchWinner: Team | null = null;

  const currentServer = (): ServerState => {
    const parity = serviceSlotIndex(pointsPlayedInGame, config.pointsToWin) % 2;
    // Every game alternates who serves first (the player who served first
    // in a game receives first in the next — the actual ITTF rule), so the
    // "base" for this game's slot 0 shifts by one position each game.
    if (config.playMode === "SINGLES") {
      const gameFirstServer = gameIndex % 2 === 0 ? config.firstServingTeam : (config.firstServingTeam === "A" ? "B" : "A");
      const servingTeam = singlesSlotOwner(gameFirstServer, parity);
      return { servingTeam, serverIndex: 0, receiverIndex: 0 };
    }
    const rotation = doublesRotation!;
    // Shift the whole 4-cycle by one slot per game, so a different player
    // opens serving each game (a reasonable reading of the ITTF rotation
    // rule — the spec doesn't spell out every inter-game edge case for
    // doubles, so this keeps the rotation fair and deterministic).
    const slot = (gameIndex + serviceSlotIndex(pointsPlayedInGame, config.pointsToWin)) % 4;
    const server = rotation[slot];
    const receiver = rotation[(slot + 1) % 4];
    return { servingTeam: server.team, serverIndex: server.index, receiverIndex: receiver.index };
  };

  for (const rally of rallies) {
    if (matchComplete) break;

    const before = currentServer();

    if (rally.winner === "A") scoreA++;
    else scoreB++;
    pointsPlayedInGame++;

    const after = currentServer();
    history.push({
      winner: rally.winner,
      wasServiceChange: before.servingTeam !== after.servingTeam || before.serverIndex !== after.serverIndex,
      serverAfter: after,
    });

    const gameWinner = evaluateGame(scoreA, scoreB, config.pointsToWin);
    if (gameWinner) {
      games.push({ scoreA, scoreB, winner: gameWinner });
      if (gameWinner === "A") gamesWonA++;
      else gamesWonB++;
      scoreA = 0;
      scoreB = 0;
      pointsPlayedInGame = 0;
      gameIndex++;
      if (gamesWonA === gamesToWin || gamesWonB === gamesToWin) {
        matchComplete = true;
        matchWinner = gameWinner;
      }
    }
  }

  if (!matchComplete) {
    games.push({ scoreA, scoreB, winner: null });
  }

  const server = currentServer();

  // Live indicators — simulate "what if this side wins the very next
  // rally" through game → match, exactly like tennis/badminton. DEUCE is
  // shown whenever the score is level at 10 or higher (mutually exclusive
  // with game/match point, since a level score is never one point from
  // winning under a win-by-2 rule).
  let indicator: Indicator = null;
  let indicatorFor: Team | null = null;
  if (!matchComplete) {
    for (const candidate of ["A", "B"] as const) {
      const nextA = scoreA + (candidate === "A" ? 1 : 0);
      const nextB = scoreB + (candidate === "B" ? 1 : 0);
      const wouldWinGame = evaluateGame(nextA, nextB, config.pointsToWin) === candidate;
      if (!wouldWinGame) continue;
      const nextGamesA = gamesWonA + (candidate === "A" ? 1 : 0);
      const nextGamesB = gamesWonB + (candidate === "B" ? 1 : 0);
      const wouldWinMatch = (candidate === "A" ? nextGamesA : nextGamesB) === gamesToWin;
      indicator = wouldWinMatch ? "MATCH_POINT" : "GAME_POINT";
      indicatorFor = candidate;
      break;
    }
    if (!indicator && scoreA === scoreB && scoreA >= config.pointsToWin - 1) {
      indicator = "DEUCE";
    }
  }

  return {
    games,
    gamesWonA,
    gamesWonB,
    gamesToWin,
    server,
    indicator,
    indicatorFor,
    history,
    isComplete: matchComplete,
    winner: matchWinner,
  };
}

export function matchResultSummary(playerAName: string, playerBName: string, state: TableTennisMatchState): string {
  if (!state.winner) return "";
  const winnerName = state.winner === "A" ? playerAName : playerBName;
  return `${winnerName} won ${state.gamesWonA}-${state.gamesWonB}`;
}
