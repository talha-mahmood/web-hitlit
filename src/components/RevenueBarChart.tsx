import { View, Text } from "react-native";
import { colors } from "../constants/theme";

// Plain-View bar chart (no react-native-svg dependency needed) — good enough
// fidelity for a 7-point weekly revenue overview without a native rebuild.
export default function RevenueBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values);

  return (
    <View className="flex-row items-end justify-between" style={{ height: 120, gap: 6 }}>
      {values.map((v, i) => {
        const heightPct = Math.max(4, Math.round((v / max) * 100));
        return (
          <View key={i} className="flex-1 items-center" style={{ gap: 6 }}>
            <View
              className="w-full rounded-t-md"
              style={{ height: `${heightPct}%`, backgroundColor: v > 0 ? colors.primary : colors.border }}
            />
            <Text className="text-muted text-[10px]">{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
