// Pure badminton scoring engine — no I/O, no React. Same philosophy as
// cricketScoring.ts / padelScoring.ts / tennisScoring.ts / pickleballScoring.ts:
// the database only ever stores the rally-by-rally log (one row per rally,
// just "who won it"); everything else (score, server, service court, games
// won, match status, and Game/Match point indicators) is derived by
// replaying that log through replayBadmintonMatch(). Undo is just dropping
// the last rally and re-deriving.
//
// A separate module from the others rather than sharing code — badminton
// is pure rally scoring (every rally scores, unlike pickleball's side-out
// mode) with its own game target (21, not 6/7/11) and its own hard cap at
// the 29-29 rule, and its server model (winner of the rally always serves
// next) has no equivalent elsewhere.

export type Team = "A" | "B";
export type PlayMode = "SINGLES" | "DOUBLES";

export type RallyEvent = {
  seq: number;
  winner: Team;
};

export type BadmintonMatchConfig = {
  playMode: PlayMode;
  firstServingTeam: Team; // who serves first in game 1
  // Which of a team's two players serves whenever that team holds serve —
  // doubles only. This spec (unlike the pickleball one) never describes a
  // server-number rotation between partners, so each team's server is
  // simply fixed for the whole match rather than alternating.
  teamAServerIndex: 0 | 1;
  teamBServerIndex: 0 | 1;
};

export type GameResult = {
  scoreA: number;
  scoreB: number;
  winner: Team | null; // null only for the in-progress current game
};

export type ServerState = {
  servingTeam: Team;
  serverIndex: 0 | 1; // meaningful in doubles; always 0 in singles
  servingSide: "RIGHT" | "LEFT"; // by the serving side's own current score parity
};

export type RallyAnnotation = {
  winner: Team;
  wasSideChange: boolean; // serve passed to the other side as a result of this rally
  serverAfter: ServerState;
};

export type Indicator = "GAME_POINT" | "MATCH_POINT" | null;

export type BadmintonMatchState = {
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

const GAMES_TO_WIN = 2; // best of 3 — the only match format this spec calls for
const GAME_TARGET = 21;
const GAME_CAP = 30; // the 29-29 rule: the 30th point always wins, no further extension

// First to 21, win by 2 clear — except once either side reaches 30 (which
// can only happen via 29-29 → 30-29, since any earlier 2-point gap would
// already have ended the game), that point wins outright regardless of
// margin. This one extra check is all the "29-29 rule" needs — every other
// example in the spec (21-18, 22-20, 24-22) already falls out of the plain
// win-by-2 comparison.
function evaluateGame(scoreA: number, scoreB: number): Team | null {
  if (scoreA >= GAME_CAP) return "A";
  if (scoreB >= GAME_CAP) return "B";
  if (scoreA >= GAME_TARGET && scoreA - scoreB >= 2) return "A";
  if (scoreB >= GAME_TARGET && scoreB - scoreA >= 2) return "B";
  return null;
}

function servingSideFor(servingTeam: Team, scoreA: number, scoreB: number): "RIGHT" | "LEFT" {
  const ownScore = servingTeam === "A" ? scoreA : scoreB;
  return ownScore % 2 === 0 ? "RIGHT" : "LEFT";
}

function serverIndexFor(config: BadmintonMatchConfig, team: Team): 0 | 1 {
  if (config.playMode === "SINGLES") return 0;
  return team === "A" ? config.teamAServerIndex : config.teamBServerIndex;
}

export function replayBadmintonMatch(rallies: RallyEvent[], config: BadmintonMatchConfig): BadmintonMatchState {
  const games: GameResult[] = [];
  const history: RallyAnnotation[] = [];
  let gamesWonA = 0;
  let gamesWonB = 0;
  let scoreA = 0;
  let scoreB = 0;
  let servingTeam: Team = config.firstServingTeam;
  let matchComplete = false;
  let matchWinner: Team | null = null;

  for (const rally of rallies) {
    if (matchComplete) break;

    if (rally.winner === "A") scoreA++;
    else scoreB++;

    // Pure rally scoring: the winner always serves next. If they were
    // already serving, that's just "the server won and continues"; if not,
    // serve passes to them (a side change) — singles' "receiver wins and
    // becomes the new server" and doubles' "same server serves again while
    // winning / receiving side becomes serving side on a loss" are both
    // just this one rule.
    const wasSideChange = rally.winner !== servingTeam;
    servingTeam = rally.winner;

    history.push({
      winner: rally.winner,
      wasSideChange,
      serverAfter: {
        servingTeam,
        serverIndex: serverIndexFor(config, servingTeam),
        servingSide: servingSideFor(servingTeam, scoreA, scoreB),
      },
    });

    const gameWinner = evaluateGame(scoreA, scoreB);
    if (gameWinner) {
      games.push({ scoreA, scoreB, winner: gameWinner });
      if (gameWinner === "A") gamesWonA++;
      else gamesWonB++;
      scoreA = 0;
      scoreB = 0;
      if (gamesWonA === GAMES_TO_WIN || gamesWonB === GAMES_TO_WIN) {
        matchComplete = true;
        matchWinner = gameWinner;
      } else {
        // Official rule: the winner of the previous game serves first in
        // the next one.
        servingTeam = gameWinner;
      }
    }
  }

  if (!matchComplete) {
    games.push({ scoreA, scoreB, winner: null });
  }

  const server: ServerState = {
    servingTeam,
    serverIndex: serverIndexFor(config, servingTeam),
    servingSide: servingSideFor(servingTeam, scoreA, scoreB),
  };

  // Live indicators — simulate "what if this side wins the very next
  // rally" through game → match, using the exact same evaluator the real
  // replay uses. Unlike pickleball's side-out mode, either side can score
  // the next rally here, so both are checked (mirrors tennis).
  let indicator: Indicator = null;
  let indicatorFor: Team | null = null;
  if (!matchComplete) {
    for (const candidate of ["A", "B"] as const) {
      const nextA = scoreA + (candidate === "A" ? 1 : 0);
      const nextB = scoreB + (candidate === "B" ? 1 : 0);
      const wouldWinGame = evaluateGame(nextA, nextB) === candidate;
      if (!wouldWinGame) continue;
      const nextGamesA = gamesWonA + (candidate === "A" ? 1 : 0);
      const nextGamesB = gamesWonB + (candidate === "B" ? 1 : 0);
      const wouldWinMatch = (candidate === "A" ? nextGamesA : nextGamesB) === GAMES_TO_WIN;
      indicator = wouldWinMatch ? "MATCH_POINT" : "GAME_POINT";
      indicatorFor = candidate;
      break;
    }
  }

  return {
    games,
    gamesWonA,
    gamesWonB,
    gamesToWin: GAMES_TO_WIN,
    server,
    indicator,
    indicatorFor,
    history,
    isComplete: matchComplete,
    winner: matchWinner,
  };
}

export function matchResultSummary(playerAName: string, playerBName: string, state: BadmintonMatchState): string {
  if (!state.winner) return "";
  const winnerName = state.winner === "A" ? playerAName : playerBName;
  return `${winnerName} won ${state.gamesWonA}-${state.gamesWonB}`;
}
