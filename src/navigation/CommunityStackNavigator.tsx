import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityScreen from "../screens/community/CommunityScreen";
import GamesListScreen from "../screens/games/GamesListScreen";
import CreateGameScreen from "../screens/games/CreateGameScreen";
import GameDetailScreen from "../screens/games/GameDetailScreen";
import GameChatScreen from "../screens/games/GameChatScreen";
import EditGameScreen from "../screens/games/EditGameScreen";
import SquadsListScreen from "../screens/squads/SquadsListScreen";
import CreateSquadScreen from "../screens/squads/CreateSquadScreen";
import SquadDetailScreen from "../screens/squads/SquadDetailScreen";
import SquadChatScreen from "../screens/squads/SquadChatScreen";
import EditSquadScreen from "../screens/squads/EditSquadScreen";
import PlayersDashboardScreen from "../screens/players/PlayersDashboardScreen";
import PlayerProfileScreen from "../screens/players/PlayerProfileScreen";
import type { Database } from "../types/database.types";

// The Community tab hosts its own copies of the Games/Squads/Players screens
// (same components GamesStackNavigator/SquadsStackNavigator/HomeStackNavigator
// use) so browsing from here never jumps the bottom tab bar's highlight over
// to the Squads tab — same reasoning HomeStackNavigator already uses for
// Tournaments.
export type CommunityStackParamList = {
  CommunityHome: undefined;
  GamesList:
    | { sportId?: string; gameType?: Database["public"]["Enums"]["game_type_type"] }
    | undefined;
  CreateGame: { gameType?: Database["public"]["Enums"]["game_type_type"] } | undefined;
  GameDetail: { gameId: string };
  GameChat: { gameId: string; gameTitle?: string };
  EditGame: { gameId: string };
  SquadsList: undefined;
  CreateSquad: undefined;
  SquadDetail: { squadId: string };
  SquadChat: { squadId: string; squadName?: string };
  EditSquad: { squadId: string };
  PlayersDashboard: undefined;
  PlayerProfile: { userId: string };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityHome" component={CommunityScreen} />
      <Stack.Screen name="GamesList" component={GamesListScreen} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="GameChat" component={GameChatScreen} />
      <Stack.Screen name="EditGame" component={EditGameScreen} />
      <Stack.Screen name="SquadsList" component={SquadsListScreen} />
      <Stack.Screen name="CreateSquad" component={CreateSquadScreen} />
      <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
      <Stack.Screen name="SquadChat" component={SquadChatScreen} />
      <Stack.Screen name="EditSquad" component={EditSquadScreen} />
      <Stack.Screen name="PlayersDashboard" component={PlayersDashboardScreen} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
    </Stack.Navigator>
  );
}
