import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ScorecardHomeScreen from "../screens/scorecard/ScorecardHomeScreen";
import CricketScorecardHomeScreen from "../screens/scorecard/CricketScorecardHomeScreen";
import NewMatchScreen from "../screens/scorecard/NewMatchScreen";
import LiveScoringScreen from "../screens/scorecard/LiveScoringScreen";
import FullScorecardScreen from "../screens/scorecard/FullScorecardScreen";
import PadelHomeScreen from "../screens/scorecard/PadelHomeScreen";
import PadelNewMatchScreen from "../screens/scorecard/PadelNewMatchScreen";
import PadelLiveScoringScreen from "../screens/scorecard/PadelLiveScoringScreen";

export type ScorecardStackParamList = {
  ScorecardHome: undefined;
  CricketHome: undefined;
  NewMatch: undefined;
  LiveScoring: { matchId: string };
  FullScorecard: { matchId: string };
  PadelHome: undefined;
  PadelNewMatch: undefined;
  PadelLiveScoring: { matchId: string };
};

const Stack = createNativeStackNavigator<ScorecardStackParamList>();

export default function ScorecardStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScorecardHome" component={ScorecardHomeScreen} />
      <Stack.Screen name="CricketHome" component={CricketScorecardHomeScreen} />
      <Stack.Screen name="NewMatch" component={NewMatchScreen} />
      <Stack.Screen name="LiveScoring" component={LiveScoringScreen} />
      <Stack.Screen name="FullScorecard" component={FullScorecardScreen} />
      <Stack.Screen name="PadelHome" component={PadelHomeScreen} />
      <Stack.Screen name="PadelNewMatch" component={PadelNewMatchScreen} />
      <Stack.Screen name="PadelLiveScoring" component={PadelLiveScoringScreen} />
    </Stack.Navigator>
  );
}
