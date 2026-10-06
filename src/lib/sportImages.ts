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
