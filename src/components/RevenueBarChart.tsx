import { View, Text, Pressable } from "react-native";
import { colors } from "../constants/theme";

// Plain-View bar chart (no react-native-svg dependency needed). Each bar is
// tappable — the caller decides how to surface the exact value (e.g. an
// Alert with a longer date/period label) via onBarPress.
export default function RevenueBarChart({
  labels,
  values,
  onBarPress,
}: {
  labels: string[];
  values: number[];
  onBarPress?: (index: number) => void;
}) {
  const max = Math.max(1, ...values);

  return (
    <View className="flex-row items-end justify-between" style={{ height: 120, gap: 6 }}>
      {values.map((v, i) => {
        const heightPct = Math.max(4, Math.round((v / max) * 100));
        return (
          <Pressable
            key={i}
            onPress={() => onBarPress?.(i)}
            className="flex-1 items-center"
            style={{ gap: 6, height: "100%", justifyContent: "flex-end" }}
            hitSlop={{ top: 8 }}
          >
            <View
              className="w-full rounded-t-md"
              style={{ height: `${heightPct}%`, backgroundColor: v > 0 ? colors.primary : colors.border }}
            />
            <Text className="text-muted text-[10px]">{labels[i]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
