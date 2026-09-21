import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/main/ProfileScreen";
import AccountSettingsScreen from "../screens/main/AccountSettingsScreen";
import MyBookingsScreen from "../screens/main/MyBookingsScreen";
import BlockedUsersScreen from "../screens/main/BlockedUsersScreen";
import GameDetailScreen from "../screens/games/GameDetailScreen";
import GameChatScreen from "../screens/games/GameChatScreen";
import TeamChatScreen from "../screens/games/TeamChatScreen";
import EditGameScreen from "../screens/games/EditGameScreen";
import TournamentMatchesScreen from "../screens/games/TournamentMatchesScreen";
import SquadDetailScreen from "../screens/squads/SquadDetailScreen";
import SquadChatScreen from "../screens/squads/SquadChatScreen";
import EditSquadScreen from "../screens/squads/EditSquadScreen";
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
import type { SlotPickerParams, BookingCheckoutParams, BookingConfirmationParams } from "./bookingTypes";
import type { ScorecardPrefill } from "../lib/api/tournamentMatches";
import type { ManualScoreParams } from "../lib/manualScore";

export type ProfileStackParamList = {
  ProfileHome: undefined;
  AccountSettings: undefined;
  MyBookings: undefined;
  BlockedUsers: undefined;
  // Reachable from the Profile stats screen's "currently enrolled" lists —
  // hosted here (not just GamesStackNavigator/SquadsStackNavigator) so
  // tapping through never switches the active tab, matching the same
  // pattern HomeStackNavigator uses for its own Games shortcuts.
  GameDetail: { gameId: string };
  GameChat: { gameId: string; gameTitle?: string; isTournament?: boolean };
  TeamChat: { teamId: string; teamName?: string };
  EditGame: { gameId: string };
  TournamentMatches: { gameId: string };
  SquadDetail: { squadId: string };
  SquadChat: { squadId: string; squadName?: string };
  EditSquad: { squadId: string };
  // Reachable from a tournament's "Book Venue" button (see GameDetailScreen)
  // and its "Go To Scorecard" button (see TournamentMatchesScreen) — hosted
  // here too so browsing/booking from Profile never jumps the tab
  // highlight to Venues/Scorecard.
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
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="GameChat" component={GameChatScreen} />
      <Stack.Screen name="TeamChat" component={TeamChatScreen} />
      <Stack.Screen name="EditGame" component={EditGameScreen} />
      <Stack.Screen name="TournamentMatches" component={TournamentMatchesScreen} />
      <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
      <Stack.Screen name="SquadChat" component={SquadChatScreen} />
      <Stack.Screen name="EditSquad" component={EditSquadScreen} />
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
    </Stack.Navigator>
  );
}
