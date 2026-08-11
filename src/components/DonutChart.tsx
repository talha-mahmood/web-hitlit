import { View, Text } from "react-native";
import { colors } from "../constants/theme";

export type DonutSegment = { label: string; value: number; color: string };

// Approximates a donut chart with plain Views (no react-native-svg, so no new
// native dependency / build requirement) — a ring of small radial "tick"
// blocks, each colored by which cumulative segment its angle falls into.
// This is the same technique used for gauge/activity-ring UIs in plain RN.
const TICK_COUNT = 60;

export default function DonutChart({
  segments,
  size = 168,
  thickness = 20,
  centerLabel,
  centerSubLabel,
  trackColor = "#EEF1F0",
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  trackColor?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2;
  const tickDistance = radius - thickness / 2;
  const arcLength = (2 * Math.PI * tickDistance) / TICK_COUNT;
  const tickWidth = Math.max(2, Math.round(arcLength * 0.55));

  let cumulative = 0;
  const boundaries = segments.map((seg) => {
    const start = cumulative;
    cumulative += total > 0 ? seg.value / total : 0;
    return { color: seg.color, start, end: cumulative };
  });

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const frac = i / TICK_COUNT;
    const angle = frac * 360;
    const match = total > 0 ? boundaries.find((b) => frac >= b.start && frac < b.end) : null;
    return { key: i, angle, color: match?.color ?? trackColor };
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {ticks.map((t) => (
        <View
          key={t.key}
          style={{
            position: "absolute",
            top: radius - thickness / 2,
            left: radius - tickWidth / 2,
            width: tickWidth,
            height: thickness,
            borderRadius: tickWidth / 2,
            backgroundColor: t.color,
            transform: [{ rotate: `${t.angle}deg` }, { translateY: -tickDistance }],
          }}
        />
      ))}
      <View style={{ alignItems: "center" }} pointerEvents="none">
        {centerLabel ? (
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.ink }}>{centerLabel}</Text>
        ) : null}
        {centerSubLabel ? (
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{centerSubLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}
