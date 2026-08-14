// Central design tokens for the app. Keep colors/spacing here so screens stay consistent.
export const colors = {
  primary: "#16A34A",
  primaryDark: "#15803D",
  primaryLight: "#DCFCE7",
  ink: "#1A1A1A",
  muted: "#6B7280",
  border: "#E5E7EB",
  background: "#F3F4F6", // page canvas (bg-gray-100) — cards/surfaces stay white on top of it
  danger: "#DC2626",
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
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

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
