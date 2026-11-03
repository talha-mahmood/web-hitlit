import type { ImageSourcePropType } from "react-native";

// Real photos (bundled as local app assets — no network dependency at
// runtime) for the admin dashboard's "Sports & Courts" row and every other
// sport-photo badge in the app. Sports without a photo yet fall back to the
// existing vector-icon badge (see AdminDashboardScreen's SportBadge /
// getSportIcon).
const SPORT_IMAGES: Record<string, ImageSourcePropType> = {
  badminton: require("../../assets/sport-icons/badminton.jpg"),
  football: require("../../assets/sport-icons/football.jpg"),
  futsal: require("../../assets/sport-icons/football.jpg"),
  cricket: require("../../assets/sport-icons/outdoor-cricket.png"),
  "hard ball": require("../../assets/sport-icons/outdoor-cricket.png"),
  "tape ball": require("../../assets/sport-icons/box-cricket.jpg"),
  padel: require("../../assets/sport-icons/padel.jpg"),
  pickleball: require("../../assets/sport-icons/pickleball.jpg"),
  "table tennis": require("../../assets/sport-icons/table-tennis.jpg"),
  tennis: require("../../assets/sport-icons/tennis.jpg"),
};

export function getSportImage(sportName: string): ImageSourcePropType | null {
  return SPORT_IMAGES[sportName.trim().toLowerCase()] ?? null;
}

// padel.jpg is a wide landscape shot (racket head on the left, a long bare
// handle trailing off to the right) — fine for a "contain" badge or a
// blurred full-bleed background, but a square/near-square card thumbnail
// ("cover", or "contain" squeezed into a small disc) crops symmetrically
// from the image's horizontal center and ends up cutting into the racket
// head itself while keeping mostly empty handle. This tighter, more-square
// crop (same photo, just trimmed to the racket+ball) is for exactly those
// small game/tournament card thumbnails (Home's row cards, the Games/
// Tournaments listing cards) — every other padel usage still goes through
// getSportImage/SPORT_IMAGES above.
const SPORT_CARD_THUMBS: Record<string, ImageSourcePropType> = {
  padel: require("../../assets/sport-icons/padel-card.jpg"),
};

export function getSportCardThumb(sportName: string): ImageSourcePropType | null {
  const key = sportName.trim().toLowerCase();
  return SPORT_CARD_THUMBS[key] ?? getSportImage(key);
}
