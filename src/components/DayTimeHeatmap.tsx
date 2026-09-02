import { View, Text, Pressable, Alert } from "react-native";
import { colors } from "../constants/theme";
import type { DayTimeHeatmap } from "../lib/adminDashboard";

const CELL_SIZE = 30;
const LABEL_WIDTH = 60;

function cellColor(value: number, max: number): string {
  if (value <= 0) return "#F3F4F6";
  const intensity = Math.max(0.18, value / max);
  const alpha = Math.round(intensity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${colors.primary}${alpha}`;
}

// Plain-View heatmap (no chart library needed) — revenue by day-of-week ×
// time-of-day, darker cell = more revenue. Tap a cell to see the exact figure.
export default function DayTimeHeatmapChart({ data }: { data: DayTimeHeatmap }) {
  return (
    <View>
      <View className="flex-row" style={{ marginLeft: LABEL_WIDTH }}>
        {data.dayLabels.map((d) => (
          <View key={d} style={{ width: CELL_SIZE, alignItems: "center" }}>
            <Text className="text-muted text-[10px] font-semibold">{d}</Text>
          </View>
        ))}
      </View>
      {data.bandLabels.map((band, bandIndex) => (
        <View key={band} className="flex-row items-center" style={{ marginTop: 3 }}>
          <View style={{ width: LABEL_WIDTH }}>
            <Text className="text-muted text-[10px]">{band}</Text>
          </View>
          {data.dayLabels.map((day, dayIndex) => {
            const value = data.grid[dayIndex][bandIndex];
            return (
              <Pressable
                key={day}
                onPress={() => Alert.alert(`${band} · ${day}`, `Rs ${value.toLocaleString()} in revenue`)}
                style={{
                  width: CELL_SIZE - 4,
                  height: CELL_SIZE - 4,
                  marginRight: 4,
                  borderRadius: 6,
                  backgroundColor: cellColor(value, data.max),
                }}
              />
            );
          })}
        </View>
      ))}
      <View className="flex-row items-center mt-3" style={{ gap: 6 }}>
        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#F3F4F6" }} />
        <Text className="text-muted text-[10px]">Low</Text>
        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.primary, marginLeft: 8 }} />
        <Text className="text-muted text-[10px]">High revenue · tap a cell for details</Text>
      </View>
    </View>
  );
}
