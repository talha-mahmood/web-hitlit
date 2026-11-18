import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

export const MAIN_CONTENT_ID = "main-content";

// First focusable element on every signed-in page: keyboard users can jump
// past the sidebar / tab bar straight to the page.
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(MAIN_CONTENT_ID)?.focus();
      }}
      className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-card transition-transform focus:translate-y-0"
    >
      Skip to content
    </a>
  );
}

// After an in-app navigation, move focus to the new page's content so screen
// readers start reading there (the browser does this on full page loads).
// Left alone when the new page already focused something itself (autoFocus).
export function useFocusMainOnNavigate() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const active = document.activeElement;
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    const keepFocus = active && active !== document.body && main.contains(active);
    if (!keepFocus) main.focus({ preventScroll: true });
  }, [pathname]);
}
