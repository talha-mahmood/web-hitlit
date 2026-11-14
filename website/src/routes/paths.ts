// Every URL in the site, in one place. The app's stack routes map onto
// shareable URLs: its per-tab duplicated screens (GameDetail living in the
// Home, Community, Profile and Games stacks…) are one URL each here, and the
// tab that stays highlighted is carried in navigation state instead (see
// useActiveTab).
export type MatchSport = "cricket" | "football" | "padel" | "tennis" | "badminton" | "pickleball" | "table_tennis";

export type TabKey = "home" | "community" | "scorecard" | "venues" | "profile";

export const paths = {
  home: "/",
  notifications: "/notifications",
  community: "/community",
  communityPlayers: "/community/players",
  communityChat: "/community/chat",
  commentThread: (rootId: string, highlightId?: string) =>
    `/comment/${rootId}${highlightId ? `?highlight=${encodeURIComponent(highlightId)}` : ""}`,
  games: (opts?: { sportId?: string; gameType?: string }) => {
    const q = new URLSearchParams();
    if (opts?.sportId) q.set("sport", opts.sportId);
    if (opts?.gameType) q.set("type", opts.gameType);
    const s = q.toString();
    return `/games${s ? `?${s}` : ""}`;
  },
  game: (gameId: string) => `/games/${gameId}`,
  createGame: (opts?: { gameType?: string }) => `/games/new${opts?.gameType ? `?type=${opts.gameType}` : ""}`,
  squads: "/squads",
  squad: (squadId: string) => `/squads/${squadId}`,
  createSquad: "/squads/new",
  // CreateSquad's route params (preset/locked type and sport).
  createSquadWith: (opts: { presetType?: string; lockType?: boolean; presetSportId?: string; lockSport?: boolean }) => {
    const q = new URLSearchParams();
    if (opts.presetType) q.set("type", opts.presetType);
    if (opts.lockType) q.set("lockType", "1");
    if (opts.presetSportId) q.set("sport", opts.presetSportId);
    if (opts.lockSport) q.set("lockSport", "1");
    const s = q.toString();
    return `/squads/new${s ? `?${s}` : ""}`;
  },
  // Tournament "Add Team" (AddTeamParams travel in history state).
  addTeam: (gameId: string) => `/games/${gameId}/add-team`,
  squadChat: (squadId: string) => `/squads/${squadId}/chat`,
  // Events (and Training Camps — squads of that type).
  events: () => "/events",
  hostEvent: "/events/new",
  event: (eventId: string) => `/events/${eventId}`,
  eventChat: (eventId: string) => `/events/${eventId}/chat`,
  trainingCamps: "/training-camps",
  // Team challenges (squads of type "team").
  challengeTeams: (opts?: { sportId?: string; opponentId?: string }) => {
    const q = new URLSearchParams();
    if (opts?.sportId) q.set("sport", opts.sportId);
    if (opts?.opponentId) q.set("opponent", opts.opponentId);
    const s = q.toString();
    return `/challenges${s ? `?${s}` : ""}`;
  },
  teamChallenges: (focusChallengeId?: string) => `/challenges/mine${focusChallengeId ? `?focus=${focusChallengeId}` : ""}`,
  teamChallenge: (challengeId: string) => `/challenges/requests/${challengeId}`,
  teamFixture: (fixtureId: string) => `/fixtures/${fixtureId}`,
  players: "/players",
  player: (userId: string, sport?: { id: string; name: string }) =>
    `/players/${userId}${sport ? `?sport=${sport.id}&sportName=${encodeURIComponent(sport.name)}` : ""}`,
  scorecard: "/scorecard",
  // A scored match of any sport (live or completed) — Phase 4 pages.
  match: (sport: MatchSport, matchId: string) => `/matches/${sport}/${matchId}`,
  // New scored match for a sport (prefill from a fixture travels in state).
  newMatch: (sport: MatchSport) => `/scorecard/${sport}/new`,
  manualScore: "/scorecard/manual",
  tournamentMatches: (gameId: string) => `/games/${gameId}/matches`,
  gameChat: (gameId: string) => `/games/${gameId}/chat`,
  teamChat: (teamId: string) => `/teams/${teamId}/chat`,
  venues: (opts?: { sportId?: string }) => `/venues${opts?.sportId ? `?sport=${opts.sportId}` : ""}`,
  venue: (venueId: string, opts?: { forGameId?: string }) =>
    `/venues/${venueId}${opts?.forGameId ? `?forGame=${opts.forGameId}` : ""}`,
  // In-app court booking (dormant in the app — see ONLINE_BOOKING_ENABLED).
  slotPicker: (venueId: string, courtId: string, opts?: { forGameId?: string }) =>
    `/venues/${venueId}/courts/${courtId}/book${opts?.forGameId ? `?forGame=${opts.forGameId}` : ""}`,
  checkout: (venueId: string, courtId: string) => `/venues/${venueId}/courts/${courtId}/checkout`,
  bookingConfirmation: "/bookings/confirmed",
  profile: "/profile",
  myBookings: "/profile/bookings",
  accountSettings: "/profile/settings",
  blockedUsers: "/profile/blocked",
  authCallback: "/auth/callback",
  admin: "/admin",
  superadmin: "/superadmin",
};

// Which bottom tab a URL belongs to when it was opened directly (deep link,
// refresh) rather than from inside a tab.
export function tabForPath(pathname: string): TabKey {
  if (
    pathname.startsWith("/community") ||
    pathname.startsWith("/comment") ||
    pathname.startsWith("/squads") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/training-camps")
  ) {
    return "community";
  }
  if (pathname.startsWith("/scorecard") || pathname.startsWith("/matches")) return "scorecard";
  if (pathname.startsWith("/venues") || pathname.startsWith("/bookings")) return "venues";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/games") || pathname.startsWith("/players") || pathname.startsWith("/teams")) return "community";
  return "home";
}
