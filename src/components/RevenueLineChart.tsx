import { View, Text, Dimensions } from "react-native";
import Svg, { Polyline, Polygon, Circle } from "react-native-svg";
import { colors } from "../constants/theme";
import { formatCompactNumber } from "../lib/adminDashboard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Matches the analytics screen's page padding (20) + card padding (20) on
// each side, so the chart fills the card exactly without a `width` prop.
const CHART_WIDTH = SCREEN_WIDTH - 20 * 2 - 20 * 2;
const CHART_HEIGHT = 120;
const PADDING_Y = 14;
const LABEL_TOP_MARGIN = 18;

// Extra headroom above the plotted line so the always-visible value labels
// never get clipped by the SVG's top edge.
const TOTAL_HEIGHT = CHART_HEIGHT + LABEL_TOP_MARGIN;

export default function RevenueLineChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  const usableHeight = CHART_HEIGHT - PADDING_Y * 2;
  const stepX = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = values.length > 1 ? i * stepX : CHART_WIDTH / 2;
    const y = LABEL_TOP_MARGIN + PADDING_Y + usableHeight - (v / max) * usableHeight;
    return { x, y, value: v };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const fillPoints = `0,${TOTAL_HEIGHT} ${linePoints} ${CHART_WIDTH},${TOTAL_HEIGHT}`;

  return (
    <View>
      <View style={{ width: CHART_WIDTH, height: TOTAL_HEIGHT }}>
        <Svg width={CHART_WIDTH} height={TOTAL_HEIGHT}>
          <Polygon points={fillPoints} fill={colors.primary} fillOpacity={0.12} />
          <Polyline points={linePoints} fill="none" stroke={colors.primary} strokeWidth={2.5} />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colors.primary} />
          ))}
        </Svg>
        {points.map((p, i) => (
          <Text
            key={i}
            className="text-ink text-[9px] font-semibold"
            numberOfLines={1}
            style={{
              position: "absolute",
              left: p.x - 20,
              top: Math.max(0, p.y - 18),
              width: 40,
              textAlign: "center",
            }}
          >
            {p.value > 0 ? formatCompactNumber(p.value) : ""}
          </Text>
        ))}
      </View>
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
