import { resolveNotificationTarget } from "@app/lib/notificationTarget";
import { paths } from "@/routes/paths";

// The website URL for a notification's payload — the same decision the app's
// resolveNotificationTarget makes for its screens (inbox rows and push taps
// share it). Venue notifications open the venue for players; admins get the
// venue's bookings via the admin area instead.
export function notificationPath(payload: unknown, options: { isAdmin?: boolean } = {}): string | undefined {
  const target = resolveNotificationTarget(payload, options);
  if (!target) return undefined;
  switch (target.screen) {
    case "CommentThread":
      return paths.commentThread(target.params.rootId, target.params.highlightId);
    case "GameChat":
      return paths.gameChat(target.params.gameId);
    case "TeamChat":
      return paths.teamChat(target.params.teamId);
    case "SquadChat":
      return paths.squadChat(target.params.squadId);
    case "EventChat":
      return paths.eventChat(target.params.eventId);
    case "GameDetail":
      return paths.game(target.params.gameId);
    case "TournamentMatches":
      return paths.tournamentMatches(target.params.gameId);
    case "SquadDetail":
      return paths.squad(target.params.squadId);
    case "EventDetail":
      return paths.event(target.params.eventId);
    case "VenueDetail":
      return paths.venue(target.params.venueId);
    case "TeamChallengeDetails":
      return paths.teamChallenge(target.params.challengeId);
    case "TeamFixtureDetails":
      return paths.teamFixture(target.params.fixtureId);
    case "VenueBookings":
      return undefined;
  }
}
