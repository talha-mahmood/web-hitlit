import { View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import Svg, { Path } from "react-native-svg";
import { cardShadow } from "../constants/theme";

type MCIName = ComponentProps<typeof MaterialCommunityIcons>["name"];

// Generic shield-shaped team crest (sport icon + star) — the app doesn't
// have real club/team badge art for these matches, so this is a drawn
// stand-in colored per team instead of an actual logo. `icon` is the same
// per-sport MaterialCommunityIcons glyph getSportIcon() already uses
// elsewhere in the app (defaults to football's ball for the football
// screens, which predate the other sports adopting this crest).
export default function TeamCrest({
  color,
  size = 60,
  icon = "soccer",
}: {
  color: string;
  size?: number;
  icon?: MCIName;
}) {
  return (
    <View
      className="items-center justify-center rounded-full bg-surface"
      style={{ width: size, height: size, ...cardShadow }}
    >
      <Svg width={size * 0.66} height={size * 0.74} viewBox="0 0 40 46">
        <Path d="M20 0 L40 6 V22 C40 34 32 42 20 46 C8 42 0 34 0 22 V6 Z" fill={color} />
      </Svg>
      <Ionicons name="star" size={size * 0.17} color="#FACC15" style={{ position: "absolute", top: size * 0.2 }} />
      <MaterialCommunityIcons name={icon} size={size * 0.32} color="white" style={{ position: "absolute", bottom: size * 0.16 }} />
    </View>
  );
}
