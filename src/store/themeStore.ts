import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

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
const resolveSystemTheme = (): ResolvedTheme => Appearance.getColorScheme() === "light" ? "light" : "dark";

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: "light",
  systemTheme: resolveSystemTheme(),
  hydrated: false,
  setPreference: (preference) => {
    set({ preference });
    void AsyncStorage.setItem(STORAGE_KEY, preference);
  },
  setSystemTheme: (systemTheme) => set({ systemTheme }),
  setHydrated: (hydrated) => set({ hydrated }),
}));

export const getResolvedTheme = (state = useThemeStore.getState()): ResolvedTheme =>
  state.preference === "system" ? state.systemTheme : state.preference;

export async function hydrateThemePreference() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      useThemeStore.getState().setPreference(saved);
    }
  } finally {
    useThemeStore.getState().setHydrated(true);
  }
}
