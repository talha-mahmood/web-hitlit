import { View, Text, Dimensions } from "react-native";
import Svg, { Polyline, Polygon, Circle } from "react-native-svg";
import { colors } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Matches the analytics screen's page padding (20) + card padding (20) on
// each side, so the chart fills the card exactly without a `width` prop.
const CHART_WIDTH = SCREEN_WIDTH - 20 * 2 - 20 * 2;
const CHART_HEIGHT = 120;
const PADDING_Y = 14;

export default function RevenueLineChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  const usableHeight = CHART_HEIGHT - PADDING_Y * 2;
  const stepX = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = values.length > 1 ? i * stepX : CHART_WIDTH / 2;
    const y = PADDING_Y + usableHeight - (v / max) * usableHeight;
    return { x, y };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const fillPoints = `0,${CHART_HEIGHT} ${linePoints} ${CHART_WIDTH},${CHART_HEIGHT}`;

  return (
    <View>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Polygon points={fillPoints} fill={colors.primary} fillOpacity={0.12} />
        <Polyline points={linePoints} fill="none" stroke={colors.primary} strokeWidth={2.5} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colors.primary} />
        ))}
      </Svg>
      <View className="flex-row justify-between mt-1">
        {labels.map((label, i) => (
          <Text key={i} className="text-muted text-[10px]" style={{ width: 30, textAlign: "center" }}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
