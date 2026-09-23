import type { ComponentProps } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as themeColors } from "../constants/theme";

// The secondary/"undo" action button shape — a white pill with a colored
// border, a leading icon circle, a divider, the label, and a trailing
// chevron. Same visual family as GradientActionButton but for a
// non-destructive-looking, lower-emphasis action.
export default function OutlineActionButton({
  onPress,
  disabled,
  icon,
  label,
  tint = themeColors.primary,
  tintLight = themeColors.primaryLight,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  tint?: string;
  tintLight?: string;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center rounded-2xl py-3.5 px-4 bg-white"
      style={[{ borderWidth: 1.5, borderColor: tint }, style]}
    >
      <View className="items-center justify-center rounded-full" style={{ width: 30, height: 30, backgroundColor: tintLight }}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <View style={{ width: 1, height: 22, backgroundColor: themeColors.border, marginHorizontal: 12 }} />
      <Text className="font-bold text-base flex-1" style={{ color: tint }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={tint} />
    </Pressable>
  );
}
