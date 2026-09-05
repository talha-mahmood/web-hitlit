import { View, Text } from "react-native";
import { colors } from "../constants/theme";
import { formatCompactNumber } from "../lib/adminDashboard";

const MAX_BAR_HEIGHT = 90;

// Plain-View bar chart (no react-native-svg dependency needed). Each bar's
// value is always shown as a small label directly above it — no tap needed.
export default function RevenueBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values);

  return (
    <View className="flex-row items-end justify-between" style={{ height: 150, gap: 6 }}>
      {values.map((v, i) => {
        const barHeight = Math.max(4, Math.round((v / max) * MAX_BAR_HEIGHT));
        return (
          <View key={i} className="flex-1 items-center" style={{ height: "100%", justifyContent: "flex-end" }}>
            <Text className="text-ink text-[9px] font-semibold mb-1" numberOfLines={1}>
              {v > 0 ? formatCompactNumber(v) : ""}
            </Text>
            <View
              className="w-full rounded-t-md"
              style={{ height: barHeight, backgroundColor: v > 0 ? colors.primary : colors.border }}
            />
            <Text className="text-muted text-[10px] mt-1.5">{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
