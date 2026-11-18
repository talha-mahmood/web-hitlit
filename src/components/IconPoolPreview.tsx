import type { ComponentProps } from "react";
import { View, Text } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const MAX_VISIBLE = 20;

// A small cluster of icons, one per unit of `count` — pops in/out (staggered)
// as the user changes the selected number, so "8 teams" visibly reads as
// eight little shields rather than just a digit.
export default function IconPoolPreview({
  count,
  icon,
}: {
  count: number;
  icon: IconName;
}) {
  if (!count || count < 1) return null;
  const visible = Math.min(count, MAX_VISIBLE);
  const overflow = count - visible;

  return (
    <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
      {Array.from({ length: visible }, (_, i) => (
        <Animated.View
          key={i}
          entering={ZoomIn.delay(i * 25).springify().damping(14)}
          exiting={ZoomOut.duration(120)}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name={icon} size={14} color={colors.primary} />
        </Animated.View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            minWidth: 26,
            height: 26,
            borderRadius: 13,
            paddingHorizontal: 6,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}
