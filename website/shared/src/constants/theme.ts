// Central design tokens for the app. Keep colors/spacing here so screens stay consistent.
// NativeWind variables let the shared utility classes respond to a runtime
// theme change without creating parallel screen implementations.
export const themePalettes = {
  dark: {
    app: "#050B12", surface: "#0A1723", surfaceRaised: "#0D1C29", border: "#1C2D3A",
    ink: "#F5F7FA", muted: "#9AA8B7", primary: "#18C66A", primaryDark: "#0F9F58", primaryDeep: "#0B6C3C", primaryLight: "#103A2A",
    surfaceOverlay: "#142533", surfaceSelection: "#111827", inkSecondary: "#CBD4DD", dangerLight: "#351419", warningLight: "#352A13",
    infoLight: "#102638", purpleLight: "#271C3B", imageCanvas: "#F5F7FA",
  },
  light: {
    app: "#F5F7FA", surface: "#FFFFFF", surfaceRaised: "#EEF2F6", border: "#E0E6ED",
    ink: "#152238", muted: "#64748B", primary: "#129B53", primaryDark: "#087A3D", primaryDeep: "#066333", primaryLight: "#E3F5EA",
    surfaceOverlay: "#E8EDF3", surfaceSelection: "#EEF2F6", inkSecondary: "#334155", dangerLight: "#FEF2F2", warningLight: "#FFFBEB",
    infoLight: "#EFF6FF", purpleLight: "#FAF5FF", imageCanvas: "#FFFFFF",
  },
} as const;

type Palette = { [K in keyof (typeof themePalettes)["dark"]]: string };
let activePalette: Palette = themePalettes.dark;

export function setActiveThemePalette(theme: keyof typeof themePalettes) {
  activePalette = themePalettes[theme];
}

const isLightTheme = () => activePalette === themePalettes.light;

export const colors = {
  get primary() { return activePalette.primary; },
  get primaryDark() { return activePalette.primaryDark; },
  get primaryDeep() { return activePalette.primaryDeep; },
  get primaryLight() { return activePalette.primaryLight; },
  get ink() { return activePalette.ink; },
  get muted() { return activePalette.muted; },
  get border() { return activePalette.border; },
  get background() { return activePalette.app; },
  get surface() { return activePalette.surface; },
  get surfaceRaised() { return activePalette.surfaceRaised; },
  get surfaceOverlay() { return activePalette.surfaceOverlay; },
  get surfaceSelection() { return activePalette.surfaceSelection; },
  get inkSecondary() { return activePalette.inkSecondary; },
  get dangerLight() { return activePalette.dangerLight; },
  get warningLight() { return activePalette.warningLight; },
  get infoLight() { return activePalette.infoLight; },
  get purpleLight() { return activePalette.purpleLight; },
  get imageCanvas() { return activePalette.imageCanvas; },
  danger: "#EF4444",
  warning: "#F59E0B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Soft "lifted" shadow for list/detail cards — background stays white, this
// just gives flat bordered boxes some depth. Spread into a card's style prop
// alongside its existing className.
export const cardShadow = {
  shadowColor: "#000000",
  get shadowOffset() { return { width: 0, height: isLightTheme() ? 2 : 4 }; },
  get shadowOpacity() { return isLightTheme() ? 0.08 : 0.22; },
  get shadowRadius() { return isLightTheme() ? 6 : 10; },
  get elevation() { return isLightTheme() ? 2 : 4; },
};

// The Squads and Games/Tournaments list cards share this one minimum height
// (each is laid out as the same five rows: name, location, a people/rating
// line, a badge line, and a skill/price line) so the two lists read as the
// same size of card. (Venues' own list card scales its photo banner with
// screen width instead of using this — see VenuesListScreen.)
export const LIST_CARD_MIN_HEIGHT = 146;

// Heavier variant for large, singular, centered hero cards (auth screens,
// modals) — same recipe as the login screen's card.
export const heroShadow = {
  shadowColor: "#000000",
  get shadowOffset() { return { width: 0, height: isLightTheme() ? 6 : 10 }; },
  get shadowOpacity() { return isLightTheme() ? 0.10 : 0.18; },
  get shadowRadius() { return isLightTheme() ? 14 : 20; },
  get elevation() { return isLightTheme() ? 4 : 8; },
};

// Tinted shadow for primary (green) CTA buttons — gives them a bit of lift
// instead of sitting flush with the page.
export const primaryButtonShadow = {
  get shadowColor() { return colors.primary; },
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 3,
};
