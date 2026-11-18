import { pointRowToEvent as padelPointRow, type PadelMatchDetail } from "@app/lib/api/padel";
import { replayPadelMatch, type PadelMatchConfig, type Team as PadelTeam } from "@app/lib/padelScoring";
import { pointRowToEvent as tennisPointRow, type TennisMatchDetail } from "@app/lib/api/tennis";
import { replayTennisMatch, type TennisMatchConfig, type Player as TennisPlayer } from "@app/lib/tennisScoring";
import { rallyRowToEvent as badmintonRally, type BadmintonMatchDetail } from "@app/lib/api/badminton";
import { replayBadmintonMatch, type BadmintonMatchConfig, type Team as BadmintonTeam } from "@app/lib/badmintonScoring";
import { rallyRowToEvent as pickleballRally, type PickleballMatchDetail } from "@app/lib/api/pickleball";
import { replayPickleballMatch, type PickleballMatchConfig, type Team as PickleballTeam } from "@app/lib/pickleballScoring";
import { rallyRowToEvent as tableTennisRally, type TableTennisMatchDetail } from "@app/lib/api/tableTennis";
import { replayTableTennisMatch, type TableTennisMatchConfig, type Team as TableTennisTeam } from "@app/lib/tableTennisScoring";

// The app keeps each sport's `computeMatchState` inside its scorecard *screen*
// file (PadelHomeScreen.tsx, …), which also imports React Native UI. These
// are the same pure functions — config from the match row, then replay the
// sorted point/rally log through the shared scoring engine.

export function computePadelState(match: PadelMatchDetail) {
  const config: PadelMatchConfig = {
    format: match.format as PadelMatchConfig["format"],
    deuceType: match.deuce_type as PadelMatchConfig["deuceType"],
    firstServerTeam: match.first_server_team as PadelTeam,
    firstServerPlayerIndex: match.first_server_player_index as 0 | 1,
    gamesPerSet: match.games_per_set,
  };
  return replayPadelMatch([...match.padel_points].sort((a, b) => a.seq - b.seq).map(padelPointRow), config);
}

export function computeTennisState(match: TennisMatchDetail) {
  const config: TennisMatchConfig = {
    format: match.format as TennisMatchConfig["format"],
    firstServer: match.first_server as TennisPlayer,
    gamesPerSet: match.games_per_set,
    playMode: match.play_mode as TennisMatchConfig["playMode"],
    playerAServerIndex: match.player_a_server_index as 0 | 1,
    playerBServerIndex: match.player_b_server_index as 0 | 1,
  };
  return replayTennisMatch([...match.tennis_points].sort((a, b) => a.seq - b.seq).map(tennisPointRow), config);
}

export function computeBadmintonState(match: BadmintonMatchDetail) {
  const config: BadmintonMatchConfig = {
    playMode: match.play_mode as BadmintonMatchConfig["playMode"],
    firstServingTeam: match.first_serving_team as BadmintonTeam,
    teamAServerIndex: match.team_a_server_index as 0 | 1,
    teamBServerIndex: match.team_b_server_index as 0 | 1,
    pointsToWin: match.points_to_win,
    gamesToWin: match.games_to_win,
  };
  return replayBadmintonMatch([...match.badminton_rallies].sort((a, b) => a.seq - b.seq).map(badmintonRally), config);
}

export function computePickleballState(match: PickleballMatchDetail) {
  const config: PickleballMatchConfig = {
    scoringMode: match.scoring_mode as PickleballMatchConfig["scoringMode"],
    playMode: match.play_mode as PickleballMatchConfig["playMode"],
    firstServingTeam: match.first_serving_team as PickleballTeam,
    pointsToWin: match.points_to_win,
    gamesToWin: match.games_to_win,
  };
  return replayPickleballMatch([...match.pickleball_rallies].sort((a, b) => a.seq - b.seq).map(pickleballRally), config);
}

export function computeTableTennisState(match: TableTennisMatchDetail) {
  const config: TableTennisMatchConfig = {
    playMode: match.play_mode as TableTennisMatchConfig["playMode"],
    firstServingTeam: match.first_serving_team as TableTennisTeam,
    firstServerIndex: match.first_server_index as 0 | 1,
    pointsToWin: match.points_to_win,
    gamesToWin: match.games_to_win,
  };
  return replayTableTennisMatch([...match.table_tennis_rallies].sort((a, b) => a.seq - b.seq).map(tableTennisRally), config);
}
