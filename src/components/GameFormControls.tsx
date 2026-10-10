import { View, Text } from "react-native";
import Animated from "react-native-reanimated";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useSelectPulse } from "../lib/useSelectPulse";
import GradientFill from "./GradientFill";

export function SectionLabel({
  title,
  required,
  variant,
  icon,
  compact,
}: {
  title: string;
  required?: boolean;
  // "onGreen" is used on screens with a colored (not white) background —
  // default stays exactly as before everywhere else.
  variant?: "onGreen";
  icon?: keyof typeof Ionicons.glyphMap;
  // Tighter top margin for screens with many stacked sections (e.g. Create
  // Tournament) — opt-in so every other existing screen's spacing is
  // untouched.
  compact?: boolean;
}) {
  return (
    <View className={`flex-row items-center mb-2 ${compact ? "mt-3" : "mt-5"}`}>
      {icon && (
        <Ionicons
          name={icon}
          size={15}
          color={variant === "onGreen" ? "white" : colors.primary}
          style={{ marginRight: 6 }}
        />
      )}
      <Text className={`font-semibold text-sm ${variant === "onGreen" ? "text-white" : "text-ink"}`}>
        {title}
      </Text>
      {required && (
        <Text className={variant === "onGreen" ? "text-red-200 ml-1" : "text-red-500 ml-1"}>*</Text>
      )}
    </View>
  );
}

function Pill<T extends string>({
  option,
  selected,
  onChange,
  variant,
}: {
  option: { label: string; value: T };
  selected: boolean;
  onChange: (v: T) => void;
  variant?: "onGreen";
}) {
  const pulseStyle = useSelectPulse(selected);
  const onGreen = variant === "onGreen";

  const pillStyle = {
    borderWidth: 1.5,
    borderRadius: 16,
    borderColor: onGreen
      ? selected
        ? "white"
        : "rgba(255,255,255,0.45)"
      : selected
        ? colors.primary
        : colors.border,
    ...(selected
      ? {
          shadowColor: onGreen ? "#000" : colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: onGreen ? 0.18 : 0.2,
          shadowRadius: 6,
          elevation: 2,
        }
      : null),
  };

  const label = (
    <Text
      className={`text-sm font-medium ${
        onGreen ? (selected ? "text-primary" : "text-white") : selected ? "text-white" : "text-ink"
      }`}
    >
      {option.label}
    </Text>
  );

  // The brand gradient only ever stands in for the solid `colors.primary`
  // fill (the default, white-background screens) — the "onGreen" variant's
  // white/translucent-white treatment (for screens already on a colored
  // background) is untouched.
  return (
    <Animated.View style={pulseStyle}>
      <Pressable onPress={() => onChange(option.value)} style={pillStyle}>
        {!onGreen && selected ? (
          <GradientFill className="px-4 py-2.5 rounded-2xl">{label}</GradientFill>
        ) : (
          <View
            className="px-4 py-2.5 rounded-2xl"
            style={{ backgroundColor: onGreen ? (selected ? "white" : "rgba(255,255,255,0.14)") : "white" }}
          >
            {label}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function PillRow<T extends string>({
  options,
  value,
  onChange,
  variant,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
  // "onGreen" is used on screens with a colored (not white) background —
  // default stays exactly as before everywhere else.
  variant?: "onGreen";
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map((o) => (
        <Pill key={o.value} option={o} selected={value === o.value} onChange={onChange} variant={variant} />
      ))}
    </View>
  );
}
