// Central design tokens for the app. Keep colors/spacing here so screens stay consistent.
// Refined, restrained palette (v2) — one confident accent (deep emerald),
// neutral grays elsewhere, screen backgrounds stay pure white. Deliberately
// avoids a second loud accent color; per-2026 UI research, calm/muted
// palettes with a single accent read as more premium than saturated
// multi-color combos.
export const colors = {
  primary: "#0E7C4A",
  primaryDark: "#0A5C37",
  primaryLight: "#E8F5EE",
  ink: "#12181A",
  muted: "#6B7280",
  border: "#E9ECEA",
  background: "#FFFFFF",
  offwhite: "#F7F8F6",
  danger: "#DC2626",
  warning: "#F59E0B",
};

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
