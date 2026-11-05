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
  badminton: { icon: "badminton", bg: "#103A2A", fg: "#18C66A" },
  football: { icon: "soccer", bg: "#102638", fg: "#38BDF8" },
  futsal: { icon: "soccer", bg: "#102638", fg: "#38BDF8" },
  cricket: { icon: "cricket", bg: "#352A13", fg: "#FBBF24" },
  "hard ball": { icon: "cricket", bg: "#352A13", fg: "#FBBF24" },
  "tape ball": { icon: "cricket", bg: "#103A2A", fg: "#18C66A" },
  pickleball: { icon: "table-tennis", bg: "#102638", fg: "#38BDF8" },
  basketball: { icon: "basketball", bg: "#382516", fg: "#FB923C" },
  tennis: { icon: "tennis", bg: "#352A13", fg: "#FBBF24" },
  padel: { icon: "racquetball", bg: "#271C3B", fg: "#C084FC" },
  squash: { icon: "racquetball", bg: "#271C3B", fg: "#C084FC" },
  "table tennis": { icon: "table-tennis", bg: "#102638", fg: "#38BDF8" },
  volleyball: { icon: "volleyball", bg: "#351419", fg: "#FB7185" },
};

const DEFAULT_ICON: SportIconInfo = { icon: "trophy-outline", bg: "#142533", fg: "#9AA8B7" };

export function getSportIcon(sportName: string): SportIconInfo {
  return SPORT_ICON_MAP[sportName.trim().toLowerCase()] ?? DEFAULT_ICON;
}
