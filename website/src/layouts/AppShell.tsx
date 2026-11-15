import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { colors } from "@app/constants/theme";
import { useProfileStore } from "@app/store/profileStore";
import { useAuthStore } from "@app/store/authStore";
import { useUnreadNotificationCount } from "@app/hooks/useNotifications";
import { useNetworkStore } from "@app/store/networkStore";
import { TabIcon, TABS } from "@/components/TabIcons";
import { Avatar } from "@/components/ui/Avatar";
import { Ionicon } from "@/components/icons/Icon";
import { useActiveTab } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import { PageSuspense } from "@/components/PageSuspense";
import { MAIN_CONTENT_ID, SkipLink, useFocusMainOnNavigate } from "@/components/SkipLink";

// The signed-in user area. Phones/tablets get the app's own bottom tab bar
// (green indicator bar above the active icon, same five tabs). Desktop gets
// the same five destinations as a left sidebar, with the notifications bell
// and the signed-in profile pinned to it, and content in a centered column.
export default function AppShell() {
  const active = useActiveTab();
  const { pathname } = useLocation();
  const profile = useProfileStore((s) => s.profile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: unread } = useUnreadNotificationCount(userId);
  const isOnline = useNetworkStore((s) => s.isOnline);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  useFocusMainOnNavigate();

  return (
    <div className="min-h-dvh bg-app lg:flex">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-3 px-2">
          <img src="/logo.png" alt="" className="h-10 w-10" />
          <span className="text-xl font-extrabold tracking-tight text-ink">
            Hit<span className="text-primary">Lit</span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex flex-col gap-1">
          {TABS.map((t) => {
            const isActive = active === t.key;
            return (
              <Link
                key={t.key}
                to={t.path}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                  isActive ? "bg-primary-light font-semibold text-primary-dark" : "font-medium text-muted hover:bg-gray-50 hover:text-ink"
                }`}
              >
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />}
                <TabIcon tab={t.key} size={22} color={isActive ? colors.primary : colors.muted} />
                {t.label}
              </Link>
            );
          })}
          <Link
            to={paths.notifications}
            state={{ tab: "home" }}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
              pathname === paths.notifications ? "bg-primary-light text-primary-dark" : "text-muted hover:bg-gray-50 hover:text-ink"
            }`}
          >
            <span className="relative">
              <Ionicon name="notifications" size={22} color={pathname === paths.notifications ? colors.primary : colors.muted} />
              {!!unread && unread > 0 && (
                <span className="absolute -right-1.5 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-danger px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            Notifications
          </Link>
        </nav>

        <Link
          to={paths.profile}
          className="mt-auto flex items-center gap-3 rounded-2xl border border-border p-3 shadow-card transition-colors hover:bg-gray-50"
        >
          <Avatar url={profile?.avatar} name={profile?.full_name} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{profile?.full_name || "Profile"}</p>
            <p className="truncate text-xs text-muted">View profile</p>
          </div>
        </Link>
      </aside>

      <div className="min-w-0 flex-1">
        {!isOnline && (
          <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-xs font-semibold text-white">
            <Ionicon name="cloud-offline-outline" size={14} color="white" />
            You're offline — changes will sync when you're back online.
          </div>
        )}
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="pb-[calc(76px+env(safe-area-inset-bottom))] outline-none lg:pb-10">
          <PageSuspense>
            <Outlet />
          </PageSuspense>
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(76px+env(safe-area-inset-bottom))] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.28)] lg:hidden"
      >
        {TABS.map((t) => {
          const isActive = active === t.key;
          const color = isActive ? colors.primary : colors.muted;
          return (
            <Link
              key={t.key}
              to={t.path}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-1 flex-col items-center"
            >
              {/* Active tab: soft green pill behind the icon (the app's new tab bar). */}
              <span className={`mb-0.5 flex h-11 w-[46px] items-center justify-center rounded-[15px] ${isActive ? "bg-[rgba(24,198,106,0.16)]" : ""}`}>
                <TabIcon tab={t.key} size={24} color={color} />
              </span>
              <span className="mb-0.5 mt-px text-[10px] font-semibold tracking-[-0.25px]" style={{ color }}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
