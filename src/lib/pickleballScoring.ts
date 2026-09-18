// Pure pickleball scoring engine — no I/O, no React. Same philosophy as
// cricketScoring.ts / padelScoring.ts / tennisScoring.ts: the database only
// ever stores the rally-by-rally log (one row per rally, just "who won
// it"); everything else (score, server/side-out state, games won, match
// status, and Game/Match point indicators) is derived by replaying that
// log through replayPickleballMatch(). Undo is just dropping the last
// rally and re-deriving.
//
// A separate module from the other three rather than sharing code with
// them — pickleball's hierarchy is Point → Rally → Game → Match (no set
// layer), games go to 11 (not 6) with no tiebreak, and its serving model
// (side-out scoring, doubles server 1/2 rotation, rally scoring as an
// alternative) has no equivalent in tennis/padel.

export type Team = "A" | "B";
export type ScoringMode = "SIDE_OUT" | "RALLY";
export type PlayMode = "SINGLES" | "DOUBLES";

export type RallyEvent = {
  seq: number;
  winner: Team; // which side won the rally itself (not necessarily who scored — see SIDE_OUT mode)
};

export type PickleballMatchConfig = {
  scoringMode: ScoringMode;
  playMode: PlayMode;
  firstServingTeam: Team;
};

export type GameResult = {
  scoreA: number;
  scoreB: number;
  winner: Team | null; // null only for the in-progress current game
};

export type ServerState = {
  servingTeam: Team;
  // Which partner of the serving team is currently serving — always 1 in
  // singles (no partner to rotate to; any rally loss is an immediate
  // side-out) and meaningful in doubles.
  serverNumber: 1 | 2;
  // Right/left serving court, by the standard singles convention (even
  // server score serves from the right, odd from the left). Not used for
  // doubles, where court position isn't determined by the score alone.
  servingSide: "RIGHT" | "LEFT";
};

export type RallyAnnotation = {
  winner: Team;
  wasSideOut: boolean; // the serve changed hands as a result of this rally
  serverAfter: ServerState;
};

export type Indicator = "GAME_POINT" | "MATCH_POINT" | null;

export type PickleballMatchState = {
  games: GameResult[]; // completed games, plus the in-progress one last (unless the match just finished)
  gamesWonA: number;
  gamesWonB: number;
  gamesToWin: number;
  server: ServerState;
  indicator: Indicator;
  indicatorFor: Team | null;
  // One annotation per rally across the whole match (not reset per game),
  // so the UI can mark side-outs/server changes in the rally history.
  history: RallyAnnotation[];
  isComplete: boolean;
  winner: Team | null;
};

const GAMES_TO_WIN = 2; // best of 3 — the only match format this spec calls for

// First to `target` points, win by 2 clear — pickleball's game-to-11 rule
// (11-7, 11-9, 12-10, 15-13 all fit this the same way tennis/padel's
// tiebreaks do).
function evaluateRace(scoreA: number, scoreB: number, target: number): Team | null {
  if (scoreA >= target && scoreA - scoreB >= 2) return "A";
  if (scoreB >= target && scoreB - scoreA >= 2) return "B";
  return null;
}

function servingSideFor(servingTeam: Team, scoreA: number, scoreB: number): "RIGHT" | "LEFT" {
  const ownScore = servingTeam === "A" ? scoreA : scoreB;
  return ownScore % 2 === 0 ? "RIGHT" : "LEFT";
}

export function replayPickleballMatch(rallies: RallyEvent[], config: PickleballMatchConfig): PickleballMatchState {
  const games: GameResult[] = [];
  const history: RallyAnnotation[] = [];
  let gamesWonA = 0;
  let gamesWonB = 0;
  let scoreA = 0;
  let scoreB = 0;
  let servingTeam: Team = config.firstServingTeam;
  // Traditional doubles quirk: the very first serving turn of a game only
  // gets one "life" (as if the starting team's first partner had already
  // been sided out) — hence a game commonly opens at "0-0-2". Starting the
  // counter at 2 makes the normal 1→2→side-out transition below produce
  // that behavior for free, with no special-casing needed. Doesn't affect
  // singles, where any rally loss is an immediate side-out regardless.
  let serverNumber: 1 | 2 = 2;
  let matchComplete = false;
  let matchWinner: Team | null = null;

  for (const rally of rallies) {
    if (matchComplete) break;

    if (config.scoringMode === "RALLY") {
      // Every rally scores for whoever wins it, regardless of serve.
      if (rally.winner === "A") scoreA++;
      else scoreB++;
    } else if (rally.winner === servingTeam) {
      // SIDE_OUT: only the serving team can add to the score.
      if (servingTeam === "A") scoreA++;
      else scoreB++;
    }

    // Serve rotation is the same in both scoring modes — it's a separate
    // rule from how the score itself is kept.
    let wasSideOut = false;
    if (rally.winner !== servingTeam) {
      if (config.playMode === "DOUBLES" && serverNumber === 1) {
        serverNumber = 2;
      } else {
        servingTeam = servingTeam === "A" ? "B" : "A";
        serverNumber = 1;
        wasSideOut = true;
      }
    }

    history.push({
      winner: rally.winner,
      wasSideOut,
      serverAfter: { servingTeam, serverNumber, servingSide: servingSideFor(servingTeam, scoreA, scoreB) },
    });

    const gameWinner = evaluateRace(scoreA, scoreB, 11);
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
        // New game: starting server alternates by game (a common,
        // deterministic convention — not the only house rule in casual
        // play, but a reasonable default absent a per-match choice).
        servingTeam = games.length % 2 === 1 ? (config.firstServingTeam === "A" ? "B" : "A") : config.firstServingTeam;
        serverNumber = 2;
      }
    }
  }

  if (!matchComplete) {
    games.push({ scoreA, scoreB, winner: null });
  }

  const server: ServerState = {
    servingTeam,
    serverNumber,
    servingSide: servingSideFor(servingTeam, scoreA, scoreB),
  };

  // Live indicators — simulate "what if this side wins the very next
  // rally" through game → match, using the same evaluator the real replay
  // uses, so the label can never drift from what actually happens.
  let indicator: Indicator = null;
  let indicatorFor: Team | null = null;
  if (!matchComplete) {
    for (const candidate of ["A", "B"] as const) {
      // Only the serving team can ever score next in side-out mode, so
      // only they can be "one point from winning."
      if (config.scoringMode === "SIDE_OUT" && candidate !== servingTeam) continue;
      const nextA = scoreA + (candidate === "A" ? 1 : 0);
      const nextB = scoreB + (candidate === "B" ? 1 : 0);
      const wouldWinGame = evaluateRace(nextA, nextB, 11) === candidate;
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

// "7 - 5 - 2" — serving team score, receiving team score, server number.
// Only meaningful for doubles side-out scoring (the only format that
// actually uses a three-number call); returns null otherwise.
export function formatTraditionalDoublesScore(state: PickleballMatchState, config: PickleballMatchConfig): string | null {
  if (config.playMode !== "DOUBLES" || config.scoringMode !== "SIDE_OUT") return null;
  const current = state.games[state.games.length - 1];
  const servingScore = state.server.servingTeam === "A" ? current.scoreA : current.scoreB;
  const receivingScore = state.server.servingTeam === "A" ? current.scoreB : current.scoreA;
  return `${servingScore} - ${receivingScore} - ${state.server.serverNumber}`;
}

export function matchResultSummary(teamAName: string, teamBName: string, state: PickleballMatchState): string {
  if (!state.winner) return "";
  const winnerName = state.winner === "A" ? teamAName : teamBName;
  return `${winnerName} won ${state.gamesWonA}-${state.gamesWonB}`;
}
