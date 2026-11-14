import { useCallback } from "react";
import { useLocation, useNavigate, type NavigateOptions } from "react-router";
import { tabForPath, type TabKey } from "./paths";

type NavState = { tab?: TabKey } | null;

// The tab that should stay highlighted: the one the user navigated from
// (carried along in history state, like the app keeping a drill-down inside
// its own tab's stack), else whatever the URL itself belongs to.
export function useActiveTab(): TabKey {
  const location = useLocation();
  return (location.state as NavState)?.tab ?? tabForPath(location.pathname);
}

// navigate() that keeps the current tab highlighted across drill-downs.
export function useAppNavigate() {
  const navigate = useNavigate();
  const tab = useActiveTab();
  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") return navigate(to);
      const state = { ...((options?.state as object) ?? {}), tab: (options?.state as NavState)?.tab ?? tab };
      return navigate(to, { ...options, state });
    },
    [navigate, tab]
  );
}

// "Back" that never leaves the site: history back when there's somewhere to
// go back to inside the app, otherwise the given fallback.
export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
