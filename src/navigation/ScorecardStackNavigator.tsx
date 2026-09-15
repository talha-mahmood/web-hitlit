import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ScorecardHomeScreen from "../screens/scorecard/ScorecardHomeScreen";
import NewMatchScreen from "../screens/scorecard/NewMatchScreen";
import LiveScoringScreen from "../screens/scorecard/LiveScoringScreen";
import FullScorecardScreen from "../screens/scorecard/FullScorecardScreen";

export type ScorecardStackParamList = {
  ScorecardHome: undefined;
  NewMatch: undefined;
  LiveScoring: { matchId: string };
  FullScorecard: { matchId: string };
};

const Stack = createNativeStackNavigator<ScorecardStackParamList>();

export default function ScorecardStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScorecardHome" component={ScorecardHomeScreen} />
      <Stack.Screen name="NewMatch" component={NewMatchScreen} />
      <Stack.Screen name="LiveScoring" component={LiveScoringScreen} />
      <Stack.Screen name="FullScorecard" component={FullScorecardScreen} />
    </Stack.Navigator>
  );
}
