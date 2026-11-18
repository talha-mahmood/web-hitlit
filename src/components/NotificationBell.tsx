import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

export default function NotificationBell({
  onPress,
  size = 24,
  color = colors.ink,
  unreadCount,
}: {
  onPress: () => void;
  size?: number;
  color?: string;
  // When set and > 0, renders a red unread-count badge at the top-right
  // corner of the bell.
  unreadCount?: number;
}) {
  const hasUnread = !!unreadCount && unreadCount > 0;
  const badgeLabel = unreadCount && unreadCount > 9 ? "9+" : String(unreadCount ?? "");

  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ width: size, height: size }}>
      <Ionicons name="notifications" size={size} color={color} />
      {hasUnread ? (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -6,
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
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700", lineHeight: 12 }}>
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
