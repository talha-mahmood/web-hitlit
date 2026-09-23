import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { cardShadow } from "../constants/theme";

// Generic shield-shaped team crest (ball + star) — the app doesn't have real
// club badge art for these matches, so this is a drawn stand-in colored per
// team instead of a specific club's actual logo. Shared between the
// football live-scoring screen and the football match-listing card.
export default function TeamCrest({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <View
      className="items-center justify-center rounded-full bg-white"
      style={{ width: size, height: size, ...cardShadow }}
    >
      <Svg width={size * 0.66} height={size * 0.74} viewBox="0 0 40 46">
        <Path d="M20 0 L40 6 V22 C40 34 32 42 20 46 C8 42 0 34 0 22 V6 Z" fill={color} />
      </Svg>
      <Ionicons name="star" size={size * 0.17} color="#FACC15" style={{ position: "absolute", top: size * 0.2 }} />
      <Ionicons name="football" size={size * 0.32} color="white" style={{ position: "absolute", bottom: size * 0.16 }} />
    </View>
  );
}
