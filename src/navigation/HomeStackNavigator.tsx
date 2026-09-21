import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/main/HomeScreen";
import VenueDetailScreen from "../screens/venues/VenueDetailScreen";
import SlotPickerScreen from "../screens/venues/SlotPickerScreen";
import BookingCheckoutScreen from "../screens/venues/BookingCheckoutScreen";
import BookingConfirmationScreen from "../screens/venues/BookingConfirmationScreen";
import GamesListScreen from "../screens/games/GamesListScreen";
import CreateGameScreen from "../screens/games/CreateGameScreen";
import GameDetailScreen from "../screens/games/GameDetailScreen";
import GameChatScreen from "../screens/games/GameChatScreen";
import TeamChatScreen from "../screens/games/TeamChatScreen";
import EditGameScreen from "../screens/games/EditGameScreen";
import TournamentMatchesScreen from "../screens/games/TournamentMatchesScreen";
import SquadsListScreen from "../screens/squads/SquadsListScreen";
import CreateSquadScreen from "../screens/squads/CreateSquadScreen";
import SquadDetailScreen from "../screens/squads/SquadDetailScreen";
import SquadChatScreen from "../screens/squads/SquadChatScreen";
import EditSquadScreen from "../screens/squads/EditSquadScreen";
import NotificationsScreen from "../screens/main/NotificationsScreen";
import PlayersDashboardScreen from "../screens/players/PlayersDashboardScreen";
import PlayerProfileScreen from "../screens/players/PlayerProfileScreen";
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
import type { SlotPickerParams, BookingCheckoutParams, BookingConfirmationParams } from "./bookingTypes";
import type { Database } from "../types/database.types";
import type { ScorecardPrefill } from "../lib/api/tournamentMatches";

export type HomeStackParamList = {
  HomeFeed: undefined;
  Notifications: undefined;
  VenueDetail: { venueId: string; forGameId?: string };
  SlotPicker: SlotPickerParams;
  BookingCheckout: BookingCheckoutParams;
  BookingConfirmation: BookingConfirmationParams;
  // Tournaments are reachable only from the Home screen's card, deliberately
  // hosted in this stack (not GamesStackNavigator) so browsing them never
  // highlights the Games tab icon. These reuse the exact same screens as the
  // Games tab; only the route name's parent stack differs.
  GamesList:
    | { sportId?: string; gameType?: Database["public"]["Enums"]["game_type_type"] }
    | undefined;
  CreateGame: { gameType?: Database["public"]["Enums"]["game_type_type"] } | undefined;
  GameDetail: { gameId: string };
  GameChat: { gameId: string; gameTitle?: string; isTournament?: boolean };
  TeamChat: { teamId: string; teamName?: string };
  EditGame: { gameId: string };
  TournamentMatches: { gameId: string };
  PlayersDashboard: undefined;
  PlayerProfile: { userId: string };
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
  // Squads are reachable from the Home screen's "Venues near you"/squad
  // rows, hosted here for the same reason tournaments are above — so
  // browsing them never jumps the tab bar's highlight over to Community.
  SquadsList: undefined;
  CreateSquad: undefined;
  SquadDetail: { squadId: string };
  SquadChat: { squadId: string; squadName?: string };
  EditSquad: { squadId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeFeed" component={HomeScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="VenueDetail" component={VenueDetailScreen} />
      <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />
      <Stack.Screen name="BookingCheckout" component={BookingCheckoutScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="GamesList" component={GamesListScreen} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="GameChat" component={GameChatScreen} />
      <Stack.Screen name="TeamChat" component={TeamChatScreen} />
      <Stack.Screen name="EditGame" component={EditGameScreen} />
      <Stack.Screen name="TournamentMatches" component={TournamentMatchesScreen} />
      <Stack.Screen name="PlayersDashboard" component={PlayersDashboardScreen} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
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
      <Stack.Screen name="SquadsList" component={SquadsListScreen} />
      <Stack.Screen name="CreateSquad" component={CreateSquadScreen} />
      <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
      <Stack.Screen name="SquadChat" component={SquadChatScreen} />
      <Stack.Screen name="EditSquad" component={EditSquadScreen} />
    </Stack.Navigator>
  );
}
