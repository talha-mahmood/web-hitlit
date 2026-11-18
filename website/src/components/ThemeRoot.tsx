import { Fragment, useEffect, useLayoutEffect, type ReactNode } from "react";
import { setActiveThemePalette, themePalettes } from "@app/constants/theme";
import { getResolvedTheme, useThemeStore } from "@app/store/themeStore";

// The web half of the app's RootNavigator theming: picks the light/dark
// palette for the shared `colors` getters (before any child renders), flips
// the CSS variables in src/theme.css via <html data-theme>, and follows the
// OS theme when the preference is "system".
export default function ThemeRoot({ children }: { children: ReactNode }) {
  const preference = useThemeStore((s) => s.preference);
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme);
  const resolved = getResolvedTheme({ ...useThemeStore.getState(), preference, systemTheme });

  setActiveThemePalette(resolved);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themePalettes[resolved].app);
  }, [resolved]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onChange = () => setSystemTheme(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setSystemTheme]);

  // Inline colors (icons, charts) read the palette at render time, so a
  // theme switch remounts the tree to repaint everything in the new palette.
  return <Fragment key={resolved}>{children}</Fragment>;
}
