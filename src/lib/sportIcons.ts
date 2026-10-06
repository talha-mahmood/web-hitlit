import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type SportIconInfo = {
  icon: IconName;
  bg: string;
  fg: string;
};

// Keyed by lowercase sport name (from public.sports.name). Colors are chosen
// to stay visually distinct even where two sports share an icon glyph (e.g.
// the racquet-court sports Padel/Squash).
const SPORT_ICON_MAP: Record<string, SportIconInfo> = {
  badminton: { icon: "badminton", bg: "#F0FDF4", fg: "#16A34A" },
  football: { icon: "soccer", bg: "#EFF6FF", fg: "#2563EB" },
  futsal: { icon: "soccer", bg: "#F0F9FF", fg: "#0284C7" },
  cricket: { icon: "cricket", bg: "#FFFBEB", fg: "#D97706" },
  "hard ball": { icon: "cricket", bg: "#FFFBEB", fg: "#D97706" },
  "tape ball": { icon: "cricket", bg: "#ECFDF5", fg: "#0D9488" },
  pickleball: { icon: "table-tennis", bg: "#ECFEFF", fg: "#0891B2" },
  basketball: { icon: "basketball", bg: "#FFF7ED", fg: "#EA580C" },
  tennis: { icon: "tennis", bg: "#FEFCE8", fg: "#CA8A04" },
  padel: { icon: "racquetball", bg: "#FDF2F8", fg: "#DB2777" },
  squash: { icon: "racquetball", bg: "#F5F3FF", fg: "#7C3AED" },
  "table tennis": { icon: "table-tennis", bg: "#F0FDFA", fg: "#0D9488" },
  volleyball: { icon: "volleyball", bg: "#FFF1F2", fg: "#E11D48" },
};

const DEFAULT_ICON: SportIconInfo = { icon: "trophy-outline", bg: "#F3F4F6", fg: "#6B7280" };

export function getSportIcon(sportName: string): SportIconInfo {
  return SPORT_ICON_MAP[sportName.trim().toLowerCase()] ?? DEFAULT_ICON;
}
