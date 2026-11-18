import { create } from "zustand";

// Web version of the app's themeStore: same API and the same storage key,
// but persisted in localStorage (read synchronously, so the first paint is
// already in the right theme) and "system" follows prefers-color-scheme.
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeState = {
  preference: ThemePreference;
  systemTheme: ResolvedTheme;
  hydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
  setSystemTheme: (theme: ResolvedTheme) => void;
  setHydrated: (hydrated: boolean) => void;
};

const STORAGE_KEY = "jazba.theme.preference";

const resolveSystemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";

function readSaved(): ThemePreference | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : null;
  } catch {
    return null;
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  // The app's default is dark.
  preference: readSaved() ?? "dark",
  systemTheme: resolveSystemTheme(),
  hydrated: true,
  setPreference: (preference) => {
    set({ preference });
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Private mode / blocked storage: the choice just won't persist.
    }
  },
  setSystemTheme: (systemTheme) => set({ systemTheme }),
  setHydrated: (hydrated) => set({ hydrated }),
}));

export const getResolvedTheme = (state = useThemeStore.getState()): ResolvedTheme =>
  state.preference === "system" ? state.systemTheme : state.preference;

export async function hydrateThemePreference() {
  const saved = readSaved();
  if (saved) useThemeStore.getState().setPreference(saved);
  useThemeStore.getState().setHydrated(true);
}
