import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityScreen from "../screens/community/CommunityScreen";
import CommentThreadScreen from "../screens/community/CommentThreadScreen";
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
import PlayerProfileScreen from "../screens/players/PlayerProfileScreen";
import VenueDetailScreen from "../screens/venues/VenueDetailScreen";
import SlotPickerScreen from "../screens/venues/SlotPickerScreen";
import BookingCheckoutScreen from "../screens/venues/BookingCheckoutScreen";
import BookingConfirmationScreen from "../screens/venues/BookingConfirmationScreen";
import LiveScoringScreen from "../screens/scorecard/LiveScoringScreen";
import FullScorecardScreen from "../screens/scorecard/FullScorecardScreen";
import type { SlotPickerParams, BookingCheckoutParams, BookingConfirmationParams } from "./bookingTypes";
import type { Database } from "../types/database.types";

// The Community tab hosts its own copies of the Games/Squads/Players screens
// (same components GamesStackNavigator/SquadsStackNavigator/HomeStackNavigator
// use) so browsing from here never jumps the bottom tab bar's highlight over
// to the Squads tab — same reasoning HomeStackNavigator already uses for
// Tournaments.
//
// "My Community"/"Top Players"/"Community Chat" are all rendered in-place
// inside CommunityScreen itself (a fixed segmented header, content swaps
// below it) rather than as separate pushed screens — so there's no
// standalone "CommunityChat" or "PlayersDashboard" route here; only
// CommentThread (reached via "Reply") and PlayerProfile (reached via a
// player row) are still real pushes, since those are drill-down detail
// views, not one of the three segments.
export type CommunityStackParamList = {
  CommunityHome: undefined;
  CommentThread: { rootId: string };
  GamesList:
    | { sportId?: string; gameType?: Database["public"]["Enums"]["game_type_type"] }
    | undefined;
  CreateGame: { gameType?: Database["public"]["Enums"]["game_type_type"] } | undefined;
  GameDetail: { gameId: string };
  GameChat: { gameId: string; gameTitle?: string };
  TeamChat: { teamId: string; teamName?: string };
  EditGame: { gameId: string };
  TournamentMatches: { gameId: string };
  SquadsList: undefined;
  CreateSquad: undefined;
  SquadDetail: { squadId: string };
  SquadChat: { squadId: string; squadName?: string };
  EditSquad: { squadId: string };
  PlayerProfile: { userId: string };
  // Reachable from a tournament's "Book Venue" button (see GameDetailScreen)
  // and its "Go To Scorecard" button (see TournamentMatchesScreen) —
  // duplicated here like the Games/Squads screens above so neither jumps
  // the bottom tab bar's highlight over to Venues/Scorecard.
  VenueDetail: { venueId: string; forGameId?: string };
  SlotPicker: SlotPickerParams;
  BookingCheckout: BookingCheckoutParams;
  BookingConfirmation: BookingConfirmationParams;
  LiveScoring: { matchId: string };
  FullScorecard: { matchId: string };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityHome" component={CommunityScreen} />
      <Stack.Screen name="CommentThread" component={CommentThreadScreen} />
      <Stack.Screen name="GamesList" component={GamesListScreen} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} />
      <Stack.Screen name="GameChat" component={GameChatScreen} />
      <Stack.Screen name="TeamChat" component={TeamChatScreen} />
      <Stack.Screen name="EditGame" component={EditGameScreen} />
      <Stack.Screen name="TournamentMatches" component={TournamentMatchesScreen} />
      <Stack.Screen name="SquadsList" component={SquadsListScreen} />
      <Stack.Screen name="CreateSquad" component={CreateSquadScreen} />
      <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
      <Stack.Screen name="SquadChat" component={SquadChatScreen} />
      <Stack.Screen name="EditSquad" component={EditSquadScreen} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
      <Stack.Screen name="VenueDetail" component={VenueDetailScreen} />
      <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />
      <Stack.Screen name="BookingCheckout" component={BookingCheckoutScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="LiveScoring" component={LiveScoringScreen} />
      <Stack.Screen name="FullScorecard" component={FullScorecardScreen} />
    </Stack.Navigator>
  );
}
