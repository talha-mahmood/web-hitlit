import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GamesListScreen from "../screens/games/GamesListScreen";
import CreateGameScreen from "../screens/games/CreateGameScreen";
import GameDetailScreen from "../screens/games/GameDetailScreen";
import GameChatScreen from "../screens/games/GameChatScreen";
import EditGameScreen from "../screens/games/EditGameScreen";
import TournamentMatchesScreen from "../screens/games/TournamentMatchesScreen";
import type { Database } from "../types/database.types";

export type GamesStackParamList = {
  GamesList:
    | { sportId?: string; gameType?: Database["public"]["Enums"]["game_type_type"] }
    | undefined;
  CreateGame: { gameType?: Database["public"]["Enums"]["game_type_type"] } | undefined;
  GameDetail: { gameId: string };
  GameChat: { gameId: string; gameTitle?: string };
  EditGame: { gameId: string };
  TournamentMatches: { gameId: string };
};

const Stack = createNativeStackNavigator<GamesStackParamList>();

export default function GamesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GamesList" component={GamesListScreen} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="GameChat" component={GameChatScreen} />
      <Stack.Screen name="EditGame" component={EditGameScreen} />
      <Stack.Screen name="TournamentMatches" component={TournamentMatchesScreen} />
    </Stack.Navigator>
  );
}
