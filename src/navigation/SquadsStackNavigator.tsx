import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SquadsListScreen from "../screens/squads/SquadsListScreen";
import CreateSquadScreen from "../screens/squads/CreateSquadScreen";
import SquadDetailScreen from "../screens/squads/SquadDetailScreen";
import SquadChatScreen from "../screens/squads/SquadChatScreen";
import EditSquadScreen from "../screens/squads/EditSquadScreen";
import PlayerProfileScreen from "../screens/players/PlayerProfileScreen";

export type SquadsStackParamList = {
  SquadsList: undefined;
  CreateSquad: undefined;
  SquadDetail: { squadId: string };
  SquadChat: { squadId: string; squadName?: string };
  EditSquad: { squadId: string };
  PlayerProfile: { userId: string; sportId?: string; sportName?: string };
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
    </Stack.Navigator>
  );
}
