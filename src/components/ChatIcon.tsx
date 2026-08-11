import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

// A speech-bubble glyph with three small dots layered on top so it reads as
// an actual "chat" icon (the classic messaging-app look) rather than a bare
// bubble outline. Ionicons is single-color per glyph, so the dots can't be
// baked into the icon itself if they need to stay white against a colored
// bubble — they're rendered as separate overlaid Views instead.
export default function ChatIcon({
  size = 22,
  bubbleColor = colors.primary,
  dotColor = "#FFFFFF",
}: {
  size?: number;
  bubbleColor?: string;
  dotColor?: string;
}) {
  const dotSize = Math.max(2, Math.round(size * 0.12));
  const gap = Math.round(size * 0.1);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="chatbubble" size={size} color={bubbleColor} />
      <View
        style={{
          position: "absolute",
          top: size * 0.37,
          flexDirection: "row",
          alignItems: "center",
          gap,
        }}
      >
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: dotColor }}
          />
        ))}
      </View>
    </View>
  );
}
