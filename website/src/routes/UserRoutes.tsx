import { Navigate, Route, Routes, useParams } from "react-router";
import AppShell from "@/layouts/AppShell";
import HomePage from "@/pages/home/HomePage";
import ProfilePage from "@/pages/profile/ProfilePage";
import AccountSettingsPage from "@/pages/profile/AccountSettingsPage";
import BlockedUsersPage from "@/pages/profile/BlockedUsersPage";
import HelpGuidePage from "@/pages/profile/HelpGuidePage";
import MyBookingsPage from "@/pages/profile/MyBookingsPage";
import VenuesListPage from "@/pages/venues/VenuesListPage";
import VenueDetailPage from "@/pages/venues/VenueDetailPage";
import SlotPickerPage from "@/pages/venues/SlotPickerPage";
import BookingCheckoutPage from "@/pages/venues/BookingCheckoutPage";
import BookingConfirmationPage from "@/pages/venues/BookingConfirmationPage";
import { ONLINE_BOOKING_ENABLED } from "@/lib/features";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import CommunityPage from "@/pages/community/CommunityPage";
import CommentThreadPage from "@/pages/community/CommentThreadPage";
import PlayerProfilePage from "@/pages/players/PlayerProfilePage";
import GamesListPage from "@/pages/games/GamesListPage";
import GameDetailPage from "@/pages/games/GameDetailPage";
import CreateGamePage from "@/pages/games/CreateGamePage";
import TournamentMatchesPage from "@/pages/games/TournamentMatchesPage";
import { EventChatPage, GameChatPage, SquadChatPage, TeamChatPage } from "@/pages/chat/ChatPages";
import AddTeamPage from "@/pages/games/AddTeamPage";
import ExploreEventsPage from "@/pages/events/ExploreEventsPage";
import HostEventPage from "@/pages/events/HostEventPage";
import EventDetailPage from "@/pages/events/EventDetailPage";
import { ChallengeTeamsPage, TeamChallengesPage, TeamChallengeDetailsPage, TeamFixtureDetailsPage } from "@/pages/challenges/ChallengePages";
import SquadsListPage from "@/pages/squads/SquadsListPage";
import SquadDetailPage from "@/pages/squads/SquadDetailPage";
import CreateSquadPage from "@/pages/squads/CreateSquadPage";
import { MatchRoutes, ScorecardRoutes } from "@/pages/scorecard/ScorecardRoutes";
import { AuthCallbackRedirect } from "./returnTo";
import { paths } from "./paths";

// Unknown / disabled sub-pages of a venue fall back to the venue itself.
function ToVenue() {
  const { venueId = "" } = useParams();
  return <Navigate to={paths.venue(venueId)} replace />;
}

// Regular users: the five-tab app. Sections built in later phases render a
// placeholder at their final URL so links from finished pages already work.
export default function UserRoutes() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackRedirect />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="notifications" element={<NotificationsPage />} />

        <Route path="venues" element={<VenuesListPage />} />
        <Route path="venues/:venueId" element={<VenueDetailPage />} />
        {ONLINE_BOOKING_ENABLED && (
          <>
            <Route path="venues/:venueId/courts/:courtId/book" element={<SlotPickerPage />} />
            <Route path="venues/:venueId/courts/:courtId/checkout" element={<BookingCheckoutPage />} />
            <Route path="bookings/confirmed" element={<BookingConfirmationPage />} />
          </>
        )}
        <Route path="venues/:venueId/*" element={<ToVenue />} />

        <Route path="community" element={<CommunityPage segment="community" />} />
        <Route path="community/players" element={<CommunityPage segment="players" />} />
        <Route path="community/chat" element={<CommunityPage segment="chat" />} />
        <Route path="comment/:rootId" element={<CommentThreadPage />} />
        <Route path="games" element={<GamesListPage />} />
        <Route path="games/new" element={<CreateGamePage />} />
        <Route path="games/:gameId" element={<GameDetailPage />} />
        <Route path="games/:gameId/matches" element={<TournamentMatchesPage />} />
        <Route path="games/:gameId/chat" element={<GameChatPage />} />
        <Route path="games/:gameId/add-team" element={<AddTeamPage />} />
        <Route path="teams/:teamId/chat" element={<TeamChatPage />} />
        <Route path="squads/:squadId/chat" element={<SquadChatPage />} />
        <Route path="games/*" element={<Navigate to={paths.games()} replace />} />
        <Route path="squads" element={<SquadsListPage />} />
        <Route path="squads/new" element={<CreateSquadPage />} />
        <Route path="squads/:squadId" element={<SquadDetailPage />} />
        <Route path="squads/*" element={<Navigate to={paths.squads} replace />} />
        <Route path="training-camps" element={<SquadsListPage lockedGroupType="training_camp" />} />
        <Route path="events" element={<ExploreEventsPage />} />
        <Route path="events/new" element={<HostEventPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="events/:eventId/chat" element={<EventChatPage />} />
        <Route path="events/*" element={<Navigate to={paths.events()} replace />} />
        <Route path="challenges" element={<ChallengeTeamsPage />} />
        <Route path="challenges/mine" element={<TeamChallengesPage />} />
        <Route path="challenges/requests/:challengeId" element={<TeamChallengeDetailsPage />} />
        <Route path="fixtures/:fixtureId" element={<TeamFixtureDetailsPage />} />
        <Route path="players" element={<Navigate to="/community/players" replace />} />
        <Route path="players/:userId" element={<PlayerProfilePage />} />

        <Route path="scorecard/*" element={<ScorecardRoutes />} />
        <Route path="matches/*" element={<MatchRoutes />} />

        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/bookings" element={<MyBookingsPage />} />
        <Route path="profile/settings" element={<AccountSettingsPage />} />
        <Route path="profile/blocked" element={<BlockedUsersPage />} />
        <Route path="profile/help" element={<HelpGuidePage />} />
        <Route path="profile/*" element={<Navigate to={paths.profile} replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
