import type { ComponentProps } from "react";
import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// The primary scoring-action button shape used across every live-scoring
// screen (Football/Padel/etc.): a gradient pill with a leading icon circle,
// a divider, the label (+ optional sublabel), an optional faint watermark
// icon, and a trailing chevron. Pulled out once the same JSX started
// getting copy-pasted per sport screen.
export default function GradientActionButton({
  onPress,
  disabled,
  colors,
  icon,
  label,
  sublabel,
  watermarkIcon,
  showChevron = true,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  colors: [string, string];
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  sublabel?: string;
  watermarkIcon?: ComponentProps<typeof Ionicons>["name"];
  showChevron?: boolean;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, position: "relative" }}
      >
        <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.25)" }}>
          <Ionicons name={icon} size={17} color="white" />
        </View>
        <View style={{ width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.35)", marginHorizontal: 14 }} />
        <View style={{ flex: 1 }}>
          <Text className="text-jazba-white font-bold text-base" numberOfLines={1}>{label}</Text>
          {sublabel && (
            <Text className="text-jazba-white text-xs mt-0.5" style={{ opacity: 0.85 }} numberOfLines={1}>
              {sublabel}
            </Text>
          )}
        </View>
        {watermarkIcon && (
          <Ionicons
            name={watermarkIcon}
            size={40}
            color="white"
            style={{ position: "absolute", right: showChevron ? 38 : 16, opacity: 0.2 }}
          />
        )}
        {showChevron && <Ionicons name="chevron-forward" size={20} color="white" />}
      </LinearGradient>
    </Pressable>
  );
}
