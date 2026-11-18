import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SquadsListScreen from "../screens/squads/SquadsListScreen";
import CreateSquadScreen from "../screens/squads/CreateSquadScreen";
import SquadDetailScreen from "../screens/squads/SquadDetailScreen";
import SquadChatScreen from "../screens/squads/SquadChatScreen";
import EditSquadScreen from "../screens/squads/EditSquadScreen";
import PlayerProfileScreen from "../screens/players/PlayerProfileScreen";
import GameDetailScreen from "../screens/games/GameDetailScreen";
import LiveScoringScreen from "../screens/scorecard/LiveScoringScreen";
import FullScorecardScreen from "../screens/scorecard/FullScorecardScreen";
import PadelLiveScoringScreen from "../screens/scorecard/PadelLiveScoringScreen";
import TennisLiveScoringScreen from "../screens/scorecard/TennisLiveScoringScreen";
import BadmintonLiveScoringScreen from "../screens/scorecard/BadmintonLiveScoringScreen";
import PickleballLiveScoringScreen from "../screens/scorecard/PickleballLiveScoringScreen";
import TableTennisLiveScoringScreen from "../screens/scorecard/TableTennisLiveScoringScreen";
import FootballLiveScoringScreen from "../screens/scorecard/FootballLiveScoringScreen";
import type { CreateSquadRouteParams } from "./addTeamTypes";

export type SquadsStackParamList = {
  SquadsList: undefined;
  CreateSquad: CreateSquadRouteParams;
  SquadDetail: { squadId: string };
  SquadChat: { squadId: string; squadName?: string };
  EditSquad: { squadId: string };
  PlayerProfile: { userId: string; sportId?: string; sportName?: string };
  // Reachable from a team-type squad's Overview/Matches/Tournaments tabs
  // (SquadTeamOverview etc.) — duplicated here like every other stack that
  // already carries these, so opening one from the Squads tab never jumps
  // the bottom tab bar's highlight over to Games.
  GameDetail: { gameId: string };
  LiveScoring: { matchId: string };
  FullScorecard: { matchId: string };
  PadelLiveScoring: { matchId: string };
  TennisLiveScoring: { matchId: string };
  BadmintonLiveScoring: { matchId: string };
  PickleballLiveScoring: { matchId: string };
  TableTennisLiveScoring: { matchId: string };
  FootballLiveScoring: { matchId: string };
};

const Stack = createNativeStackNavigator<SquadsStackParamList>();

export default function SquadsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SquadsList" component={SquadsListScreen} />
      <Stack.Screen name="CreateSquad" component={CreateSquadScreen} />
      <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
      <Stack.Screen name="SquadChat" component={SquadChatScreen} />
      <Stack.Screen name="EditSquad" component={EditSquadScreen} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="LiveScoring" component={LiveScoringScreen} />
      <Stack.Screen name="FullScorecard" component={FullScorecardScreen} />
      <Stack.Screen name="PadelLiveScoring" component={PadelLiveScoringScreen} />
      <Stack.Screen name="TennisLiveScoring" component={TennisLiveScoringScreen} />
      <Stack.Screen name="BadmintonLiveScoring" component={BadmintonLiveScoringScreen} />
      <Stack.Screen name="PickleballLiveScoring" component={PickleballLiveScoringScreen} />
      <Stack.Screen name="TableTennisLiveScoring" component={TableTennisLiveScoringScreen} />
      <Stack.Screen name="FootballLiveScoring" component={FootballLiveScoringScreen} />
    </Stack.Navigator>
  );
}
