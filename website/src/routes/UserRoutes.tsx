import { lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import AppShell from "@/layouts/AppShell";
import { ONLINE_BOOKING_ENABLED } from "@/lib/features";
import { AuthCallbackRedirect } from "./returnTo";
import { paths } from "./paths";

// Each page loads on first visit (its own chunk).
const HomePage = lazy(() => import("@/pages/home/HomePage"));
const ProfilePage = lazy(() => import("@/pages/profile/ProfilePage"));
const AccountSettingsPage = lazy(() => import("@/pages/profile/AccountSettingsPage"));
const BlockedUsersPage = lazy(() => import("@/pages/profile/BlockedUsersPage"));
const HelpGuidePage = lazy(() => import("@/pages/profile/HelpGuidePage"));
const MyBookingsPage = lazy(() => import("@/pages/profile/MyBookingsPage"));
const VenuesListPage = lazy(() => import("@/pages/venues/VenuesListPage"));
const VenueDetailPage = lazy(() => import("@/pages/venues/VenueDetailPage"));
const SlotPickerPage = lazy(() => import("@/pages/venues/SlotPickerPage"));
const BookingCheckoutPage = lazy(() => import("@/pages/venues/BookingCheckoutPage"));
const BookingConfirmationPage = lazy(() => import("@/pages/venues/BookingConfirmationPage"));
const NotificationsPage = lazy(() => import("@/pages/notifications/NotificationsPage"));
const CommunityPage = lazy(() => import("@/pages/community/CommunityPage"));
const CommentThreadPage = lazy(() => import("@/pages/community/CommentThreadPage"));
const PlayerProfilePage = lazy(() => import("@/pages/players/PlayerProfilePage"));
const GamesListPage = lazy(() => import("@/pages/games/GamesListPage"));
const GameDetailPage = lazy(() => import("@/pages/games/GameDetailPage"));
const CreateGamePage = lazy(() => import("@/pages/games/CreateGamePage"));
const TournamentMatchesPage = lazy(() => import("@/pages/games/TournamentMatchesPage"));
const EventChatPage = lazy(() => import("@/pages/chat/ChatPages").then((m) => ({ default: m.EventChatPage })));
const GameChatPage = lazy(() => import("@/pages/chat/ChatPages").then((m) => ({ default: m.GameChatPage })));
const SquadChatPage = lazy(() => import("@/pages/chat/ChatPages").then((m) => ({ default: m.SquadChatPage })));
const TeamChatPage = lazy(() => import("@/pages/chat/ChatPages").then((m) => ({ default: m.TeamChatPage })));
const AddTeamPage = lazy(() => import("@/pages/games/AddTeamPage"));
const ExploreEventsPage = lazy(() => import("@/pages/events/ExploreEventsPage"));
const HostEventPage = lazy(() => import("@/pages/events/HostEventPage"));
const EventDetailPage = lazy(() => import("@/pages/events/EventDetailPage"));
const ChallengeTeamsPage = lazy(() => import("@/pages/challenges/ChallengePages").then((m) => ({ default: m.ChallengeTeamsPage })));
const TeamChallengesPage = lazy(() => import("@/pages/challenges/ChallengePages").then((m) => ({ default: m.TeamChallengesPage })));
const TeamChallengeDetailsPage = lazy(() => import("@/pages/challenges/ChallengePages").then((m) => ({ default: m.TeamChallengeDetailsPage })));
const TeamFixtureDetailsPage = lazy(() => import("@/pages/challenges/ChallengePages").then((m) => ({ default: m.TeamFixtureDetailsPage })));
const SquadsListPage = lazy(() => import("@/pages/squads/SquadsListPage"));
const SquadDetailPage = lazy(() => import("@/pages/squads/SquadDetailPage"));
const CreateSquadPage = lazy(() => import("@/pages/squads/CreateSquadPage"));
const MatchRoutes = lazy(() => import("@/pages/scorecard/ScorecardRoutes").then((m) => ({ default: m.MatchRoutes })));
const ScorecardRoutes = lazy(() => import("@/pages/scorecard/ScorecardRoutes").then((m) => ({ default: m.ScorecardRoutes })));

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
