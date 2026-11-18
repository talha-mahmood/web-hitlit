import { paths } from "@/routes/paths";
import { ONLINE_BOOKING_ENABLED } from "@/lib/features";

// The website's information architecture. The app's five bottom tabs (Home,
// Community, Scorecard, Venues, Profile) and the screens reached from inside
// them are grouped into a top navigation with two dropdowns; every
// destination is an existing route.
export type NavLink = {
  label: string;
  to: string;
  icon: string;
  description?: string;
  match: (pathname: string, search: string) => boolean;
};
export type NavEntry = NavLink | { label: string; items: NavLink[] };

const starts = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p === x || p.startsWith(x + "/"));
const isTournamentList = (p: string, s: string) => p === "/games" && new URLSearchParams(s).get("type") === "TOURNAMENT";

export const PLAY_LINKS: NavLink[] = [
  { label: "Games", to: paths.games(), icon: "tennisball-outline", description: "Join pickup games near you", match: (p, s) => starts("/games")(p) && !isTournamentList(p, s) },
  { label: "Tournaments", to: paths.games({ gameType: "TOURNAMENT" }), icon: "trophy-outline", description: "Compete in brackets and leagues", match: isTournamentList },
  { label: "Challenge a Team", to: paths.challengeTeams(), icon: "flash-outline", description: "Send a match request to a team", match: starts("/challenges", "/fixtures") },
  { label: "Events", to: paths.events(), icon: "calendar-outline", description: "Discover upcoming events", match: starts("/events") },
  { label: "Training Camps", to: paths.trainingCamps, icon: "school-outline", description: "Coaching and camps near you", match: starts("/training-camps") },
];

export const COMMUNITY_LINKS: NavLink[] = [
  { label: "Community Hub", to: paths.community, icon: "apps-outline", description: "Everything social in one place", match: (p) => p === "/community" },
  { label: "Find Players", to: paths.communityPlayers, icon: "person-outline", description: "Top players and people near you", match: starts("/community/players", "/players") },
  { label: "Community Chat", to: paths.communityChat, icon: "chatbubbles-outline", description: "Talk sport with the community", match: starts("/community/chat", "/comment") },
  { label: "Squads", to: paths.squads, icon: "people-outline", description: "Teams and groups to join", match: starts("/squads", "/teams") },
];

export const NAV: NavEntry[] = [
  { label: "Home", to: paths.home, icon: "home-outline", match: (p) => p === "/" },
  { label: "Play", items: PLAY_LINKS },
  { label: "Venues", to: paths.venues(), icon: "location-outline", match: starts("/venues", "/bookings") },
  { label: "Community", items: COMMUNITY_LINKS },
  { label: "Scorecard", to: paths.scorecard, icon: "stats-chart-outline", match: starts("/scorecard", "/matches") },
];

export const CREATE_LINKS: NavLink[] = [
  { label: "Create a Game", to: paths.createGame(), icon: "add-circle-outline", description: "Organise a game or tournament", match: () => false },
  { label: "Host an Event", to: paths.hostEvent, icon: "calendar-number-outline", description: "Bring people together", match: () => false },
  { label: "Create a Squad", to: paths.createSquad, icon: "people-circle-outline", description: "Start a team or group", match: () => false },
  { label: "Score a Match", to: paths.scorecard, icon: "stats-chart-outline", description: "Live scoring for any sport", match: () => false },
];

export const ACCOUNT_LINKS: NavLink[] = [
  { label: "My Profile", to: paths.profile, icon: "person-circle-outline", match: (p) => p === "/profile" },
  ...(ONLINE_BOOKING_ENABLED ? [{ label: "My Bookings", to: paths.myBookings, icon: "receipt-outline", match: starts("/profile/bookings") }] : []),
  { label: "Account Settings", to: paths.accountSettings, icon: "settings-outline", match: starts("/profile/settings", "/profile/blocked") },
  { label: "Help & Guide", to: paths.helpGuide, icon: "help-circle-outline", match: starts("/profile/help") },
];

export const isEntryActive = (e: NavEntry, p: string, s: string) => ("items" in e ? e.items.some((i) => i.match(p, s)) : e.match(p, s));
