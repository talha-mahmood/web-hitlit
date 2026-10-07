import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GamesListScreen from "../screens/games/GamesListScreen";
import CreateGameScreen from "../screens/games/CreateGameScreen";
import GameDetailScreen from "../screens/games/GameDetailScreen";
import GameChatScreen from "../screens/games/GameChatScreen";
import TeamChatScreen from "../screens/games/TeamChatScreen";
import EditGameScreen from "../screens/games/EditGameScreen";
import TournamentMatchesScreen from "../screens/games/TournamentMatchesScreen";
import VenueDetailScreen from "../screens/venues/VenueDetailScreen";
import SlotPickerScreen from "../screens/venues/SlotPickerScreen";
import BookingCheckoutScreen from "../screens/venues/BookingCheckoutScreen";
import BookingConfirmationScreen from "../screens/venues/BookingConfirmationScreen";
import ManualScoreScreen from "../screens/scorecard/ManualScoreScreen";
import NewMatchScreen from "../screens/scorecard/NewMatchScreen";
import LiveScoringScreen from "../screens/scorecard/LiveScoringScreen";
import FullScorecardScreen from "../screens/scorecard/FullScorecardScreen";
import PadelNewMatchScreen from "../screens/scorecard/PadelNewMatchScreen";
import PadelLiveScoringScreen from "../screens/scorecard/PadelLiveScoringScreen";
import TennisNewMatchScreen from "../screens/scorecard/TennisNewMatchScreen";
import TennisLiveScoringScreen from "../screens/scorecard/TennisLiveScoringScreen";
import BadmintonNewMatchScreen from "../screens/scorecard/BadmintonNewMatchScreen";
import BadmintonLiveScoringScreen from "../screens/scorecard/BadmintonLiveScoringScreen";
import PickleballNewMatchScreen from "../screens/scorecard/PickleballNewMatchScreen";
import PickleballLiveScoringScreen from "../screens/scorecard/PickleballLiveScoringScreen";
import TableTennisNewMatchScreen from "../screens/scorecard/TableTennisNewMatchScreen";
import TableTennisLiveScoringScreen from "../screens/scorecard/TableTennisLiveScoringScreen";
import FootballNewMatchScreen from "../screens/scorecard/FootballNewMatchScreen";
import FootballLiveScoringScreen from "../screens/scorecard/FootballLiveScoringScreen";
import PlayerProfileScreen from "../screens/players/PlayerProfileScreen";
import type { SlotPickerParams, BookingCheckoutParams, BookingConfirmationParams } from "./bookingTypes";
import type { Database } from "../types/database.types";
import type { ScorecardPrefill } from "../lib/api/tournamentMatches";
import type { ManualScoreParams } from "../lib/manualScore";

export type GamesStackParamList = {
  GamesList:
    | { sportId?: string; gameType?: Database["public"]["Enums"]["game_type_type"] }
    | undefined;
  CreateGame: { gameType?: Database["public"]["Enums"]["game_type_type"] } | undefined;
  GameDetail: { gameId: string };
  GameChat: { gameId: string; gameTitle?: string; isTournament?: boolean; sportName?: string };
  TeamChat: { teamId: string; teamName?: string; sportName?: string };
  EditGame: { gameId: string };
  TournamentMatches: { gameId: string };
  VenueDetail: { venueId: string; forGameId?: string };
  SlotPicker: SlotPickerParams;
  BookingCheckout: BookingCheckoutParams;
  BookingConfirmation: BookingConfirmationParams;
  ManualScore: ManualScoreParams;
  NewMatch: { prefill?: ScorecardPrefill } | undefined;
  LiveScoring: { matchId: string };
  FullScorecard: { matchId: string };
  PadelNewMatch: { prefill?: ScorecardPrefill } | undefined;
  PadelLiveScoring: { matchId: string };
  TennisNewMatch: { prefill?: ScorecardPrefill } | undefined;
  TennisLiveScoring: { matchId: string };
  BadmintonNewMatch: { prefill?: ScorecardPrefill } | undefined;
  BadmintonLiveScoring: { matchId: string };
  PickleballNewMatch: { prefill?: ScorecardPrefill } | undefined;
  PickleballLiveScoring: { matchId: string };
  TableTennisNewMatch: { prefill?: ScorecardPrefill } | undefined;
  TableTennisLiveScoring: { matchId: string };
  FootballNewMatch: { prefill?: ScorecardPrefill } | undefined;
  FootballLiveScoring: { matchId: string };
  PlayerProfile: { userId: string; sportId?: string; sportName?: string };
};

const Stack = createNativeStackNavigator<GamesStackParamList>();

export default function GamesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GamesList" component={GamesListScreen} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="GameChat" component={GameChatScreen} />
      <Stack.Screen name="TeamChat" component={TeamChatScreen} />
      <Stack.Screen name="EditGame" component={EditGameScreen} />
      <Stack.Screen name="TournamentMatches" component={TournamentMatchesScreen} />
      <Stack.Screen name="VenueDetail" component={VenueDetailScreen} />
      <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />
      <Stack.Screen name="BookingCheckout" component={BookingCheckoutScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="ManualScore" component={ManualScoreScreen} />
      <Stack.Screen name="NewMatch" component={NewMatchScreen} />
      <Stack.Screen name="LiveScoring" component={LiveScoringScreen} />
      <Stack.Screen name="FullScorecard" component={FullScorecardScreen} />
      <Stack.Screen name="PadelNewMatch" component={PadelNewMatchScreen} />
      <Stack.Screen name="PadelLiveScoring" component={PadelLiveScoringScreen} />
      <Stack.Screen name="TennisNewMatch" component={TennisNewMatchScreen} />
      <Stack.Screen name="TennisLiveScoring" component={TennisLiveScoringScreen} />
      <Stack.Screen name="BadmintonNewMatch" component={BadmintonNewMatchScreen} />
      <Stack.Screen name="BadmintonLiveScoring" component={BadmintonLiveScoringScreen} />
      <Stack.Screen name="PickleballNewMatch" component={PickleballNewMatchScreen} />
      <Stack.Screen name="PickleballLiveScoring" component={PickleballLiveScoringScreen} />
      <Stack.Screen name="TableTennisNewMatch" component={TableTennisNewMatchScreen} />
      <Stack.Screen name="TableTennisLiveScoring" component={TableTennisLiveScoringScreen} />
      <Stack.Screen name="FootballNewMatch" component={FootballNewMatchScreen} />
      <Stack.Screen name="FootballLiveScoring" component={FootballLiveScoringScreen} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
    </Stack.Navigator>
  );
}
