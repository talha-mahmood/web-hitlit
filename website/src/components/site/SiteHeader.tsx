import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router";
import { colors } from "@app/constants/theme";
import { useProfileStore } from "@app/store/profileStore";
import { useAuthStore } from "@app/store/authStore";
import { useUnreadNotificationCount } from "@app/hooks/useNotifications";
import { signOutGoogle } from "@app/lib/googleAuth";
import { signOutWithPushCleanup } from "@app/lib/pushNotifications";
import { Alert } from "@/lib/alert";
import { Avatar } from "@/components/ui/Avatar";
import { Ionicon } from "@/components/icons/Icon";
import ThemeToggle from "@/components/ThemeToggle";
import { paths } from "@/routes/paths";
import { ACCOUNT_LINKS, CREATE_LINKS, NAV, isEntryActive, type NavLink } from "./nav";

// Same sign-out as Account Settings, behind the confirmation the venue
// dashboard's menu uses (a menu item is easy to hit by accident).
export function confirmSignOut() {
  Alert.alert("Sign Out", "Are you sure you want to sign out?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Sign Out",
      style: "destructive",
      onPress: async () => {
        await signOutGoogle();
        signOutWithPushCleanup();
      },
    },
  ]);
}

export function Brand({ to = "/", size = 36 }: { to?: string; size?: number }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2.5 rounded-xl" aria-label="HitLit home">
      <img src="/logo.png" alt="" style={{ width: size, height: size }} />
      <span className="text-[21px] font-extrabold tracking-tight text-ink">
        Hit<span className="text-primary">Lit</span>
      </span>
    </Link>
  );
}

// A click-to-open menu (also opens on hover with a mouse). Closes on outside
// click, Escape, and navigation.
function Dropdown({
  trigger,
  label,
  active,
  align = "left",
  width = 320,
  hover = true,
  children,
}: {
  trigger: (open: boolean) => ReactNode;
  label: string;
  active?: boolean;
  align?: "left" | "right";
  width?: number;
  hover?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const id = useId();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A click right after hover opened the menu keeps it open (instead of
  // toggling it shut under the pointer).
  const hoverOpenedAt = useRef(0);
  const enter = () => {
    if (!hover) return;
    window.clearTimeout(timer.current);
    setOpen((o) => {
      if (!o) hoverOpenedAt.current = Date.now();
      return true;
    });
  };
  const toggle = () => {
    if (Date.now() - hoverOpenedAt.current < 600) return setOpen(true);
    setOpen((o) => !o);
  };
  const leave = () => {
    if (!hover) return;
    timer.current = window.setTimeout(() => setOpen(false), 140);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="true"
        aria-label={label}
        data-active={active || undefined}
        onClick={toggle}
        className="flex items-center"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          id={id}
          className={`absolute top-full z-50 pt-2 ${align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"}`}
          style={{ width }}
        >
          <div className="animate-pop rounded-2xl border border-border bg-surface p-2 shadow-hero">{children(() => setOpen(false))}</div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ link, active, onClick, compact }: { link: NavLink; active?: boolean; onClick?: () => void; compact?: boolean }) {
  return (
    <Link
      to={link.to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 transition-colors ${compact ? "py-2.5" : "py-2.5"} ${
        active ? "bg-primary-light" : "hover:bg-gray-50"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl transition-colors ${compact ? "h-8 w-8" : "h-10 w-10"} ${
          active ? "bg-primary text-white" : "bg-primary-light group-hover:bg-primary/15"
        }`}
      >
        <Ionicon name={link.icon} size={compact ? 17 : 20} color={active ? "white" : colors.primary} />
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${active ? "text-primary-dark" : "text-ink"}`}>{link.label}</span>
        {link.description && !compact && <span className="block truncate text-xs text-muted">{link.description}</span>}
      </span>
    </Link>
  );
}

const navItemCls = (active: boolean) =>
  `relative flex h-10 items-center gap-1 rounded-xl px-3.5 text-[15px] font-semibold transition-colors ${
    active ? "text-primary-dark" : "text-ink-secondary hover:bg-gray-50 hover:text-ink"
  }`;

function ActiveBar({ show }: { show: boolean }) {
  return show ? <span className="absolute inset-x-3.5 -bottom-[13px] h-[3px] rounded-full bg-primary" /> : null;
}

function BellLink({ unread, active }: { unread?: number; active: boolean }) {
  const has = !!unread && unread > 0;
  return (
    <Link
      to={paths.notifications}
      aria-label={has ? `Notifications, ${unread} unread` : "Notifications"}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${active ? "bg-primary-light" : "hover:bg-gray-50"}`}
    >
      <Ionicon name={active ? "notifications" : "notifications-outline"} size={22} color={active ? colors.primary : colors.ink} />
      {has && (
        <span className="absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-surface bg-danger px-1 text-[10px] font-bold text-white">
          {unread! > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

// Mobile/tablet navigation: a drawer from the right with every destination.
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname, search } = useLocation();
  const profile = useProfileStore((s) => s.profile);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;

  const Section = ({ title, links }: { title: string; links: NavLink[] }) => (
    <div className="mb-5">
      <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{title}</p>
      {links.map((l) => (
        <MenuLink key={l.label} link={l} compact active={l.match(pathname, search)} onClick={onClose} />
      ))}
    </div>
  );
  const main = NAV.filter((e): e is NavLink => !("items" in e));

  return createPortal(
    <div className="fixed inset-0 z-[90] lg:hidden">
      <div className="absolute inset-0 animate-fadeUp bg-black/45" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute inset-y-0 right-0 flex w-[min(340px,88vw)] animate-fadeUp flex-col bg-surface shadow-hero"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Brand size={32} />
          <button type="button" onClick={onClose} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-50">
            <Ionicon name="close" size={24} color={colors.ink} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6 pt-4">
          <Link to={paths.profile} onClick={onClose} className="mx-1 mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
            <Avatar url={profile?.avatar} name={profile?.full_name} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{profile?.full_name || "Your profile"}</span>
              <span className="block truncate text-xs text-muted">View profile</span>
            </span>
          </Link>
          <Section title="Explore" links={main} />
          <Section title="Play" links={NAV.flatMap((e) => ("items" in e && e.label === "Play" ? e.items : []))} />
          <Section title="Community" links={NAV.flatMap((e) => ("items" in e && e.label === "Community" ? e.items : []))} />
          <Section title="Create" links={CREATE_LINKS} />
          <Section title="Account" links={ACCOUNT_LINKS} />
          <div className="mx-1 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5">
            <span className="text-sm font-semibold text-ink">Theme</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={() => (onClose(), confirmSignOut())}
            className="mx-1 mt-3 flex w-[calc(100%-8px)] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-red-50"
          >
            <Ionicon name="log-out-outline" size={20} color={colors.danger} />
            Sign Out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// The signed-in site header: brand, primary navigation (Play and Community
// open dropdowns), a Create menu, notifications and the account menu.
// Below lg the navigation moves into a drawer.
export default function SiteHeader() {
  const { pathname, search } = useLocation();
  const profile = useProfileStore((s) => s.profile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: unread } = useUnreadNotificationCount(userId);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setDrawer(false), [pathname, search]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-shadow ${
        scrolled ? "border-border shadow-[0_6px_20px_rgba(15,23,42,0.08)]" : "border-border/70"
      }`}
    >
      <div className="site-container flex h-16 items-center gap-3">
        <Brand />

        <nav aria-label="Main" className="ml-6 hidden items-center gap-0.5 lg:flex">
          {NAV.map((entry) => {
            const active = isEntryActive(entry, pathname, search);
            if ("items" in entry) {
              return (
                <Dropdown
                  key={entry.label}
                  label={`${entry.label} menu`}
                  active={active}
                  width={330}
                  trigger={(open) => (
                    <span className={navItemCls(active)}>
                      {entry.label}
                      <Ionicon name="chevron-down" size={15} color={active ? colors.primary : colors.muted} style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : undefined }} />
                      <ActiveBar show={active} />
                    </span>
                  )}
                >
                  {(close) => (
                    <div className="flex flex-col gap-0.5">
                      {entry.items.map((l) => (
                        <MenuLink key={l.label} link={l} active={l.match(pathname, search)} onClick={close} />
                      ))}
                    </div>
                  )}
                </Dropdown>
              );
            }
            return (
              <Link key={entry.label} to={entry.to} aria-current={active ? "page" : undefined} className={navItemCls(active)}>
                {entry.label}
                <ActiveBar show={active} />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:block">
            <Dropdown
              label="Create menu"
              align="right"
              width={300}
              trigger={(open) => (
                <span className="flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-cta transition hover:brightness-110">
                  <Ionicon name="add" size={18} color="white" />
                  Create
                  <Ionicon name="chevron-down" size={14} color="white" style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : undefined }} />
                </span>
              )}
            >
              {(close) => (
                <div className="flex flex-col gap-0.5">
                  {CREATE_LINKS.map((l) => (
                    <MenuLink key={l.label} link={l} onClick={close} />
                  ))}
                </div>
              )}
            </Dropdown>
          </div>

          <div className="hidden xl:block">
            <ThemeToggle />
          </div>

          <BellLink unread={unread} active={pathname === paths.notifications} />

          <div className="hidden lg:block">
            <Dropdown
              label="Account menu"
              active={pathname.startsWith("/profile")}
              align="right"
              width={280}
              hover={false}
              trigger={(open) => (
                <span className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition-colors ${open || pathname.startsWith("/profile") ? "border-primary/40 bg-primary-light" : "border-border hover:bg-gray-50"}`}>
                  <Avatar url={profile?.avatar} name={profile?.full_name} size={32} />
                  <span className="hidden max-w-[110px] truncate text-sm font-semibold text-ink xl:block">{firstName || "Account"}</span>
                  <Ionicon name="chevron-down" size={14} color={colors.muted} />
                </span>
              )}
            >
              {(close) => (
                <div>
                  <div className="mb-1 flex items-center gap-3 border-b border-border px-3 pb-3 pt-2">
                    <Avatar url={profile?.avatar} name={profile?.full_name} size={42} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{profile?.full_name || "Your account"}</p>
                      {profile?.email && <p className="truncate text-xs text-muted">{profile.email}</p>}
                    </div>
                  </div>
                  {ACCOUNT_LINKS.map((l) => (
                    <MenuLink key={l.label} link={l} compact active={l.match(pathname, search)} onClick={close} />
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border px-3 pb-1 pt-3 xl:hidden">
                    <span className="text-sm font-semibold text-ink">Theme</span>
                    <ThemeToggle />
                  </div>
                  <button
                    type="button"
                    onClick={() => (close(), confirmSignOut())}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-red-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50">
                      <Ionicon name="log-out-outline" size={17} color={colors.danger} />
                    </span>
                    Sign Out
                  </button>
                </div>
              )}
            </Dropdown>
          </div>

          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-gray-50 lg:hidden"
          >
            <Ionicon name="menu" size={22} color={colors.ink} />
          </button>
        </div>
      </div>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </header>
  );
}
