import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useLocation, useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useAdminVenueDetail } from "@app/hooks/useVenuesAdmin";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { signOutGoogle } from "@app/lib/googleAuth";
import { signOutWithPushCleanup } from "@app/lib/pushNotifications";
import { Alert } from "@/lib/alert";
import { Ionicon } from "../icons/Icon";
import { useAdminPaths } from "./AdminParts";
import { PageSuspense } from "../PageSuspense";
import { MAIN_CONTENT_ID, SkipLink, useFocusMainOnNavigate } from "../SkipLink";

const signOut = async () => {
  await signOutGoogle();
  signOutWithPushCleanup();
};

const HELP_MAILTO = "mailto:mahmoodhamza1261@gmail.com?subject=HitLit%20Support";

type MenuItem = { key: string; icon: string; label: string; to?: string; onPress?: () => void };

// The venue dashboard's menu (AdminMenuOverlay's items): Dashboard, Edit
// Venue Details, Bookings, Sports & Courts, Venue Photos, AI Analytics,
// Reviews, Notifications, Boost Venue, Manage Admins (primary owner only),
// Sign Out (confirmed).
export function useVenueMenuItems(venueId: string): MenuItem[] {
  const p = useAdminPaths();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venue } = useAdminVenueDetail(venueId);
  const isPrimaryOwner = !!venue && venue.venue_owner_id === userId;
  return [
    { key: "dashboard", icon: "grid-outline", label: "Dashboard", to: p.venue(venueId) },
    { key: "editDetails", icon: "create-outline", label: "Edit Venue Details", to: p.editVenue(venueId) },
    { key: "bookings", icon: "calendar-outline", label: "Bookings", to: p.bookings(venueId) },
    { key: "courts", icon: "grid-outline", label: "Sports & Courts", to: p.courts(venueId) },
    { key: "venuePhotos", icon: "images-outline", label: "Venue Photos", to: p.venuePhotos(venueId) },
    { key: "analytics", icon: "stats-chart-outline", label: "AI Analytics", to: p.analytics(venueId) },
    { key: "reviews", icon: "star-outline", label: "Reviews", to: p.reviews(venueId) },
    { key: "notifications", icon: "notifications-outline", label: "Notifications", to: p.notifications },
    { key: "boost", icon: "rocket-outline", label: "Boost Venue", to: p.boost(venueId) },
    ...(isPrimaryOwner ? [{ key: "manageAdmins", icon: "people-outline", label: "Manage Admins", to: p.admins(venueId) }] : []),
    {
      key: "signout",
      icon: "log-out-outline",
      label: "Sign Out",
      onPress: () =>
        Alert.alert("Sign Out", "Are you sure you want to sign out?", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out", style: "destructive", onPress: signOut },
        ]),
    },
  ];
}

function activeKeyFor(pathname: string, venueId: string, items: MenuItem[]) {
  // Longest matching path wins (Dashboard is a prefix of every venue page).
  const match = items.filter((i) => i.to && (pathname === i.to || pathname.startsWith(i.to + "/"))).sort((a, b) => b.to!.length - a.to!.length)[0];
  return match?.key ?? (venueId ? "dashboard" : "");
}

function MenuList({ items, activeKey, onNavigate }: { items: MenuItem[]; activeKey: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Venue admin" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.key === activeKey;
        const cls = `flex items-center gap-3.5 rounded-xl px-4 py-3 text-base transition ${active ? "bg-primary font-semibold text-white" : "text-gray-300 hover:bg-white/10 hover:text-white"}`;
        const content = (
          <>
            <Ionicon name={item.icon} size={20} color={active ? "white" : "#9CA3AF"} />
            {item.label}
          </>
        );
        return item.to ? (
          <Link key={item.key} to={item.to} onClick={onNavigate} className={cls} aria-current={active ? "page" : undefined}>
            {content}
          </Link>
        ) : (
          <button key={item.key} type="button" onClick={() => (onNavigate?.(), item.onPress?.())} className={`${cls} text-left`}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}

function MenuChrome({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#062A19]">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-lg font-bold text-white">
          <Ionicon name="tennisball" size={22} color="#4ADE80" />
          HitLit
        </span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-full p-1 hover:bg-white/10">
            <Ionicon name="close" size={26} color="white" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2">{children}</div>
      <a href={HELP_MAILTO} className="flex items-center gap-2.5 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 text-sm text-gray-300 hover:text-white">
        <Ionicon name="help-circle-outline" size={20} color="#9CA3AF" />
        Need Help? Visit Help Center
      </a>
    </div>
  );
}

// Full-screen menu on phones (the dashboard's hamburger / avatar).
export function VenueMenuOverlay({ venueId, open, onClose }: { venueId: string; open: boolean; onClose: () => void }) {
  const items = useVenueMenuItems(venueId);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[95] animate-fadeUp">
      <MenuChrome onClose={onClose}>
        <MenuList items={items} activeKey={activeKeyFor(pathname, venueId, items)} onNavigate={onClose} />
      </MenuChrome>
    </div>,
    document.body
  );
}

// /…/venues/:venueId/* — desktop gets the venue menu as a permanent sidebar.
export function VenueAdminLayout() {
  const { venueId = "" } = useParams();
  const items = useVenueMenuItems(venueId);
  const { pathname } = useLocation();
  const { data: venue } = useAdminVenueDetail(venueId);
  useFocusMainOnNavigate();
  return (
    <div className="min-h-dvh bg-app lg:flex">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 lg:block">
        <MenuChrome>
          {venue && <p className="mb-3 truncate px-4 text-xs font-semibold uppercase tracking-wider text-white/50">{venue.name}</p>}
          <MenuList items={items} activeKey={activeKeyFor(pathname, venueId, items)} />
        </MenuChrome>
      </aside>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <PageSuspense>
          <Outlet />
        </PageSuspense>
      </main>
    </div>
  );
}

// ───── Superadmin ─────
const SECTIONS = [
  { key: "venues", label: "Venues", icon: "business-outline" },
  { key: "games", label: "Games", icon: "trophy-outline" },
  { key: "groups", label: "Squads", icon: "people-outline" },
  { key: "events", label: "Events", icon: "calendar-outline" },
  { key: "moderation", label: "Reports", icon: "flag-outline" },
  { key: "users", label: "Users", icon: "person-outline" },
] as const;
export type SuperSection = (typeof SECTIONS)[number]["key"];

function useSectionPath() {
  const p = useAdminPaths();
  return (key: SuperSection) => ({ venues: p.home, games: p.games, groups: p.groups, events: p.events, moderation: p.reports, users: p.users })[key];
}

function SectionList({ active, onNavigate }: { active: SuperSection | null; onNavigate?: () => void }) {
  const pathFor = useSectionPath();
  return (
    <>
      <p className="mb-3 px-3 text-xs font-bold tracking-[0.5px] text-muted">SUPERADMIN</p>
      <nav aria-label="Superadmin" className="flex flex-col gap-1">
        {SECTIONS.map((s) => {
          const isActive = s.key === active;
          return (
            <Link
              key={s.key}
              to={pathFor(s.key)}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${isActive ? "bg-primary-light text-primary" : "text-ink hover:bg-app"}`}
            >
              <Ionicon name={s.icon} size={18} color={isActive ? colors.primary : colors.muted} />
              {s.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function SignOutRow() {
  return (
    <div className="border-t border-border pt-3">
      <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-danger hover:bg-red-50">
        <Ionicon name="log-out-outline" size={18} color={colors.danger} />
        Sign Out
      </button>
    </div>
  );
}

// Port of SuperAdminSectionSwitcher: the hamburger that opens the section
// drawer (phones/tablets only — desktop has the permanent sidebar).
export function SuperAdminSectionSwitcher({ active }: { active: SuperSection }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open sections menu" className="flex h-7 w-7 items-center justify-center lg:hidden">
        <Ionicon name="menu" size={24} color={colors.ink} />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[95] lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div role="dialog" aria-modal="true" aria-label="Superadmin sections" className="relative flex h-full w-[250px] animate-fadeUp flex-col bg-surface px-2.5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+20px)] shadow-card">
              <SectionList active={active} onNavigate={() => setOpen(false)} />
              <div className="flex-1" />
              <SignOutRow />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// /superadmin section pages: permanent section sidebar on desktop.
export function SuperAdminLayout() {
  const { pathname } = useLocation();
  const p = useAdminPaths();
  const profile = useProfileStore((s) => s.profile);
  const active: SuperSection | null = pathname.startsWith(p.games)
    ? "games"
    : pathname.startsWith(p.groups)
      ? "groups"
      : pathname.startsWith(p.events)
        ? "events"
        : pathname.startsWith(p.reports)
          ? "moderation"
          : pathname.startsWith(p.users)
            ? "users"
            : pathname === p.home || pathname.startsWith(p.createVenue)
              ? "venues"
              : null;
  useFocusMainOnNavigate();
  return (
    <div className="min-h-dvh bg-app lg:flex">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh w-[250px] shrink-0 flex-col border-r border-border bg-surface px-2.5 pb-6 pt-6 lg:flex">
        <Link to={p.home} className="mb-6 flex items-center gap-3 px-3">
          <img src="/logo.png" alt="" className="h-9 w-9" />
          <span className="text-lg font-extrabold text-ink">
            Hit<span className="text-primary">Lit</span>
          </span>
        </Link>
        <SectionList active={active} />
        <div className="flex-1" />
        {profile && <p className="mb-2 truncate px-3 text-xs text-muted">Signed in as {profile.full_name ?? profile.email}</p>}
        <SignOutRow />
      </aside>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <PageSuspense>
          <Outlet />
        </PageSuspense>
      </main>
    </div>
  );
}
