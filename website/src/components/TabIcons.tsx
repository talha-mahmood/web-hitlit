import { Ionicon, MCIcon } from "./icons/Icon";
import type { TabKey } from "@/routes/paths";

// The Scorecard tab glyph (assets/Scorecard-svg-icon.svg): rounded square with three lines.
export function ScorecardTabIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width={18} height={18} x={3} y={3} rx={2} />
      <path d="M7 8h8" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </svg>
  );
}

// Same per-tab glyphs as MainTabNavigator: solid Ionicons for Home/Venues,
// MDI account-group for Community, the custom SVG for Scorecard and
// person-circle for Profile.
export function TabIcon({ tab, color, size }: { tab: TabKey; color: string; size: number }) {
  switch (tab) {
    case "home":
      return <Ionicon name="home" size={size} color={color} />;
    case "venues":
      return <Ionicon name="location" size={size} color={color} />;
    case "community":
      return <MCIcon name="account-group" size={size} color={color} />;
    case "scorecard":
      return <ScorecardTabIcon size={size} color={color} />;
    case "profile":
      return <Ionicon name="person-circle" size={size} color={color} />;
  }
}

export const TABS: { key: TabKey; label: string; path: string }[] = [
  { key: "home", label: "Home", path: "/" },
  { key: "community", label: "Community", path: "/community" },
  { key: "scorecard", label: "Scorecard", path: "/scorecard" },
  { key: "venues", label: "Venues", path: "/venues" },
  { key: "profile", label: "Profile", path: "/profile" },
];
