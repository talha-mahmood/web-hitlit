import Svg, { Path, Circle } from "react-native-svg";

export type PieSegment = { label: string; value: number; color: string };

function polar(cx: number, cy: number, r: number, angle: number) {
  // 0 rad = 12 o'clock, clockwise.
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

// A solid pie (no hole). Each slice is an SVG arc sized by its share of the
// segments' own total, so the slices always add up to exactly one full circle.
export default function PieChart({
  segments,
  size = 120,
  gapColor = "white",
}: {
  segments: PieSegment[];
  size?: number;
  gapColor?: string;
}) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  const r = size / 2;

  if (total <= 0) return <Svg width={size} height={size} />;

  let start = 0;
  return (
    <Svg width={size} height={size}>
      {visible.length === 1 ? (
        <Circle cx={r} cy={r} r={r} fill={visible[0].color} />
      ) : (
        visible.map((seg) => {
          const sweep = (seg.value / total) * 2 * Math.PI;
          const from = polar(r, r, r, start);
          const to = polar(r, r, r, start + sweep);
          const largeArc = sweep > Math.PI ? 1 : 0;
          const d = `M ${r} ${r} L ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
          start += sweep;
          return <Path key={seg.label} d={d} fill={seg.color} stroke={gapColor} strokeWidth={1.5} strokeLinejoin="round" />;
        })
      )}
    </Svg>
  );
}
