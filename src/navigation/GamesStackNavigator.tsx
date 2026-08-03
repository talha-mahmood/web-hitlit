import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GamesListScreen from "../screens/games/GamesListScreen";
import CreateGameScreen from "../screens/games/CreateGameScreen";
import GameDetailScreen from "../screens/games/GameDetailScreen";
import GameChatScreen from "../screens/games/GameChatScreen";

export type GamesStackParamList = {
  GamesList: { sportId?: string } | undefined;
  CreateGame: undefined;
  GameDetail: { gameId: string };
  GameChat: { gameId: string; gameTitle?: string };
};

const Stack = createNativeStackNavigator<GamesStackParamList>();

export default function GamesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GamesList" component={GamesListScreen} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="GameChat" component={GameChatScreen} />
    </Stack.Navigator>
  );
}
