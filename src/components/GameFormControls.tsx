import { View, Text } from "react-native";
import Animated from "react-native-reanimated";
import { Pressable } from "react-native";
import { colors } from "../constants/theme";
import { useSelectPulse } from "../lib/useSelectPulse";

export function SectionLabel({
  title,
  required,
  variant,
}: {
  title: string;
  required?: boolean;
  // "onGreen" is used on screens with a colored (not white) background —
  // default stays exactly as before everywhere else.
  variant?: "onGreen";
}) {
  return (
    <View className="flex-row items-center mb-2 mt-5">
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

  return (
    <Animated.View style={pulseStyle}>
      <Pressable
        onPress={() => onChange(option.value)}
        className="px-4 py-2.5 rounded-2xl"
        style={{
          borderWidth: 1.5,
          borderColor: onGreen
            ? selected
              ? "white"
              : "rgba(255,255,255,0.45)"
            : selected
              ? colors.primary
              : colors.border,
          backgroundColor: onGreen
            ? selected
              ? "white"
              : "rgba(255,255,255,0.14)"
            : selected
              ? colors.primary
              : "white",
          ...(selected
            ? {
                shadowColor: onGreen ? "#000" : colors.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: onGreen ? 0.18 : 0.2,
                shadowRadius: 6,
                elevation: 2,
              }
            : null),
        }}
      >
        <Text
          className={`text-sm font-medium ${
            onGreen ? (selected ? "text-primary" : "text-white") : selected ? "text-white" : "text-ink"
          }`}
        >
          {option.label}
        </Text>
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
