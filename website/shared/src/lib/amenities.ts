import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type AmenityOption = { label: string; icon: IconName };

// The court.amenities column stores these labels verbatim (no separate
// key/id) — simplest option for a small, fixed list that's unlikely to need
// renaming, and matches how venue_facilities.name is already free text.
export const AMENITY_OPTIONS: AmenityOption[] = [
  { label: "Drinking Water", icon: "cup-water" },
  { label: "Parking", icon: "parking" },
  { label: "Rental Equipment", icon: "dumbbell" },
  { label: "Restrooms", icon: "toilet" },
  { label: "Shower", icon: "shower" },
  { label: "Warmup Area", icon: "run" },
  { label: "Flood Lights", icon: "spotlight-beam" },
  { label: "Cafe", icon: "coffee" },
];

const DEFAULT_ICON: IconName = "checkbox-blank-circle-outline";

export function getAmenityIcon(label: string): IconName {
  return AMENITY_OPTIONS.find((a) => a.label === label)?.icon ?? DEFAULT_ICON;
}
