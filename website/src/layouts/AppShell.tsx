import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useNetworkStore } from "@app/store/networkStore";
import { Ionicon } from "@/components/icons/Icon";
import { PageSuspense } from "@/components/PageSuspense";
import { MAIN_CONTENT_ID, SkipLink, useFocusMainOnNavigate } from "@/components/SkipLink";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

// Full-height working screens (chats, live scoring) end at the viewport, so
// they skip the footer.
const IMMERSIVE = [/\/chat$/, /^\/matches\/[^/]+\/[^/]+$/];

// The signed-in site: sticky header with the main navigation, the page, and
// the footer. Same destinations as the app's five tabs.
export default function AppShell() {
  const { pathname } = useLocation();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const immersive = IMMERSIVE.some((r) => r.test(pathname));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  useFocusMainOnNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <SkipLink />
      <SiteHeader />
      {!isOnline && (
        <div role="status" className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-xs font-semibold text-white">
          <Ionicon name="cloud-offline-outline" size={14} color="white" />
          You're offline — changes will sync when you're back online.
        </div>
      )}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={`min-w-0 flex-1 outline-none ${immersive ? "" : "pb-6"}`}>
        <PageSuspense>
          <Outlet />
        </PageSuspense>
      </main>
      {!immersive && <SiteFooter />}
    </div>
  );
}
