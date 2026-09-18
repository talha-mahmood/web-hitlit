import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ScorecardHomeScreen from "../screens/scorecard/ScorecardHomeScreen";
import CricketScorecardHomeScreen from "../screens/scorecard/CricketScorecardHomeScreen";
import NewMatchScreen from "../screens/scorecard/NewMatchScreen";
import LiveScoringScreen from "../screens/scorecard/LiveScoringScreen";
import FullScorecardScreen from "../screens/scorecard/FullScorecardScreen";
import PadelHomeScreen from "../screens/scorecard/PadelHomeScreen";
import PadelNewMatchScreen from "../screens/scorecard/PadelNewMatchScreen";
import PadelLiveScoringScreen from "../screens/scorecard/PadelLiveScoringScreen";
import TennisHomeScreen from "../screens/scorecard/TennisHomeScreen";
import TennisNewMatchScreen from "../screens/scorecard/TennisNewMatchScreen";
import TennisLiveScoringScreen from "../screens/scorecard/TennisLiveScoringScreen";
import PickleballHomeScreen from "../screens/scorecard/PickleballHomeScreen";
import PickleballNewMatchScreen from "../screens/scorecard/PickleballNewMatchScreen";
import PickleballLiveScoringScreen from "../screens/scorecard/PickleballLiveScoringScreen";
import BadmintonHomeScreen from "../screens/scorecard/BadmintonHomeScreen";
import BadmintonNewMatchScreen from "../screens/scorecard/BadmintonNewMatchScreen";
import BadmintonLiveScoringScreen from "../screens/scorecard/BadmintonLiveScoringScreen";

export type ScorecardStackParamList = {
  ScorecardHome: undefined;
  CricketHome: undefined;
  NewMatch: undefined;
  LiveScoring: { matchId: string };
  FullScorecard: { matchId: string };
  PadelHome: undefined;
  PadelNewMatch: undefined;
  PadelLiveScoring: { matchId: string };
  TennisHome: undefined;
  TennisNewMatch: undefined;
  TennisLiveScoring: { matchId: string };
  PickleballHome: undefined;
  PickleballNewMatch: undefined;
  PickleballLiveScoring: { matchId: string };
  BadmintonHome: undefined;
  BadmintonNewMatch: undefined;
  BadmintonLiveScoring: { matchId: string };
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
      <Stack.Screen name="TennisHome" component={TennisHomeScreen} />
      <Stack.Screen name="TennisNewMatch" component={TennisNewMatchScreen} />
      <Stack.Screen name="TennisLiveScoring" component={TennisLiveScoringScreen} />
      <Stack.Screen name="PickleballHome" component={PickleballHomeScreen} />
      <Stack.Screen name="PickleballNewMatch" component={PickleballNewMatchScreen} />
      <Stack.Screen name="PickleballLiveScoring" component={PickleballLiveScoringScreen} />
      <Stack.Screen name="BadmintonHome" component={BadmintonHomeScreen} />
      <Stack.Screen name="BadmintonNewMatch" component={BadmintonNewMatchScreen} />
      <Stack.Screen name="BadmintonLiveScoring" component={BadmintonLiveScoringScreen} />
    </Stack.Navigator>
  );
}
