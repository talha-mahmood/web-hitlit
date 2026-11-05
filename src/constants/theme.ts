// Central design tokens for the app. Keep colors/spacing here so screens stay consistent.
export const colors = {
  primary: "#18C66A",
  primaryDark: "#0F9F58",
  primaryLight: "#103A2A",
  ink: "#F5F7FA",
  muted: "#9AA8B7",
  border: "#1C2D3A",
  background: "#050B12",
  surface: "#0A1723",
  surfaceRaised: "#0D1C29",
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
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.22,
  shadowRadius: 10,
  elevation: 4,
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
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.18,
  shadowRadius: 20,
  elevation: 8,
};

// Tinted shadow for primary (green) CTA buttons — gives them a bit of lift
// instead of sitting flush with the page.
export const primaryButtonShadow = {
  shadowColor: colors.primary,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 3,
};
