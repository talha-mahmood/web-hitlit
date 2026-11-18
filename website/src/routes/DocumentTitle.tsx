import { useEffect } from "react";
import { useLocation } from "react-router";
import { useAuthStore } from "@app/store/authStore";

const SITE = "HitLit";
const SIGNED_OUT_TITLE = "HitLit — Book. Play. Enjoy.";

// First matching pattern wins: specific paths before their parents.
const TITLES: [RegExp, string][] = [
  [/^\/privacy$/, "Privacy Policy"],
  [/^\/$/, "Home"],
  [/^\/notifications$/, "Notifications"],
  [/^\/community\/players$/, "Find Players"],
  [/^\/community\/chat$/, "Community Chat"],
  [/^\/community$/, "Community"],
  [/^\/comment\//, "Comment"],
  [/^\/venues\/[^/]+\/courts\/[^/]+\/book$/, "Book a Court"],
  [/^\/venues\/[^/]+\/courts\/[^/]+\/checkout$/, "Checkout"],
  [/^\/bookings\/confirmed$/, "Booking Confirmed"],
  [/^\/venues\/[^/]+$/, "Venue"],
  [/^\/venues$/, "Venues"],
  [/^\/games\/new$/, "Create Game"],
  [/^\/games\/[^/]+\/matches$/, "Tournament Dashboard"],
  [/^\/games\/[^/]+\/chat$/, "Game Chat"],
  [/^\/games\/[^/]+\/add-team$/, "Add Team"],
  [/^\/games\/[^/]+$/, "Game"],
  [/^\/games$/, "Games & Tournaments"],
  [/^\/teams\/[^/]+\/chat$/, "Team Chat"],
  [/^\/squads\/new$/, "Create Squad"],
  [/^\/squads\/[^/]+\/chat$/, "Squad Chat"],
  [/^\/squads\/[^/]+$/, "Squad"],
  [/^\/squads$/, "Squads"],
  [/^\/training-camps$/, "Training Camps"],
  [/^\/events\/new$/, "Host an Event"],
  [/^\/events\/[^/]+\/chat$/, "Event Chat"],
  [/^\/events\/[^/]+$/, "Event"],
  [/^\/events$/, "Explore Events"],
  [/^\/challenges\/mine$/, "Team Challenges"],
  [/^\/challenges\/requests\//, "Challenge Details"],
  [/^\/challenges$/, "Challenge a Team"],
  [/^\/fixtures\//, "Fixture"],
  [/^\/players\//, "Player Profile"],
  [/^\/scorecard\/manual$/, "Manual Score"],
  [/^\/scorecard\/[^/]+\/new$/, "New Match"],
  [/^\/scorecard\/[^/]+$/, "Matches"],
  [/^\/scorecard$/, "Scorecard"],
  [/^\/matches\//, "Live Match"],
  [/^\/profile\/bookings$/, "My Bookings"],
  [/^\/profile\/settings$/, "Account Settings"],
  [/^\/profile\/blocked$/, "Blocked Users"],
  [/^\/profile\/help$/, "Help & User Guide"],
  [/^\/profile$/, "Profile"],
  // Venue admin (owner: /admin/…, superadmin: /superadmin/…).
  [/^\/(super)?admin\/venues\/new$/, "Create Venue"],
  [/^\/(super)?admin\/venues\/[^/]+\/edit$/, "Edit Venue Details"],
  [/^\/(super)?admin\/venues\/[^/]+\/photos$/, "Venue Photos"],
  [/^\/(super)?admin\/venues\/[^/]+\/courts\/new$/, "Add Court"],
  [/^\/(super)?admin\/venues\/[^/]+\/courts\/[^/]+\/photos$/, "Court Photos"],
  [/^\/(super)?admin\/venues\/[^/]+\/courts\/[^/]+\/slots$/, "Manage Slots"],
  [/^\/(super)?admin\/venues\/[^/]+\/courts\/[^/]+$/, "Edit Court"],
  [/^\/(super)?admin\/venues\/[^/]+\/courts$/, "Sports & Courts"],
  [/^\/(super)?admin\/venues\/[^/]+\/bookings$/, "Bookings"],
  [/^\/(super)?admin\/venues\/[^/]+\/reviews$/, "Reviews"],
  [/^\/(super)?admin\/venues\/[^/]+\/analytics$/, "AI Analytics"],
  [/^\/(super)?admin\/venues\/[^/]+\/boost$/, "Boost Venue"],
  [/^\/(super)?admin\/venues\/[^/]+\/admins$/, "Manage Admins"],
  [/^\/(super)?admin\/venues\/[^/]+/, "Venue Dashboard"],
  [/^\/(super)?admin\/notifications$/, "Notifications"],
  [/^\/admin$/, "My Venues"],
  [/^\/superadmin\/games$/, "All Games"],
  [/^\/superadmin\/groups$/, "All Squads"],
  [/^\/superadmin\/events$/, "All Events"],
  [/^\/superadmin\/reports$/, "Reports"],
  [/^\/superadmin\/users$/, "All Users"],
  [/^\/superadmin$/, "All Venues"],
];

export function titleForPath(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return TITLES.find(([re]) => re.test(path))?.[1] ?? null;
}

// Keeps the browser tab / history entry named after the current page.
export default function DocumentTitle() {
  const { pathname } = useLocation();
  const signedIn = useAuthStore((s) => !!s.session);
  useEffect(() => {
    const page = titleForPath(pathname);
    if (pathname === "/privacy") document.title = `Privacy Policy · ${SITE}`;
    else if (!signedIn) document.title = SIGNED_OUT_TITLE;
    else document.title = page ? `${page} · ${SITE}` : SITE;
  }, [pathname, signedIn]);
  return null;
}
