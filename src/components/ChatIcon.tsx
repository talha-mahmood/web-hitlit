import { View, Text } from "react-native";
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
  unreadCount,
}: {
  size?: number;
  bubbleColor?: string;
  dotColor?: string;
  // When set and > 0, renders a red unread-count badge at the top-right
  // corner — the standard "N new messages" pill seen in messaging apps.
  unreadCount?: number;
}) {
  const dotSize = Math.max(2, Math.round(size * 0.12));
  const gap = Math.round(size * 0.1);
  const hasUnread = !!unreadCount && unreadCount > 0;
  const badgeLabel = unreadCount && unreadCount > 9 ? "9+" : String(unreadCount ?? "");

  return (
    <View style={{ width: size, height: size }}>
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
      {hasUnread ? (
        <View
          style={{
            position: "absolute",
            top: -6,
            right: -10,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            paddingHorizontal: badgeLabel.length > 1 ? 4 : 0,
            backgroundColor: colors.danger,
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700", lineHeight: 12 }}>{badgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}
