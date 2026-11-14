import { colors } from "@app/constants/theme";

export type ChartSegment = { label: string; value: number; color: string };

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

// Port of PieChart: solid pie, each slice its share of the total, thin gaps.
export function PieChart({ segments, size = 120, gapColor = "white" }: { segments: ChartSegment[]; size?: number; gapColor?: string }) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  const r = size / 2;
  if (total <= 0) return <svg width={size} height={size} aria-hidden />;
  let start = 0;
  return (
    <svg width={size} height={size} role="img" aria-label={visible.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}>
      {visible.length === 1 ? (
        <circle cx={r} cy={r} r={r} fill={visible[0].color} />
      ) : (
        visible.map((seg) => {
          const sweep = (seg.value / total) * 2 * Math.PI;
          const from = polar(r, r, r, start);
          const to = polar(r, r, r, start + sweep);
          const d = `M ${r} ${r} L ${from.x} ${from.y} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${to.x} ${to.y} Z`;
          start += sweep;
          return <path key={seg.label} d={d} fill={seg.color} stroke={gapColor} strokeWidth={1.5} strokeLinejoin="round" />;
        })
      )}
    </svg>
  );
}

// Port of DonutChart: a ring of 60 radial ticks colored by segment, with an
// optional center label (same look as the app's View-based approximation).
const TICK_COUNT = 60;

export function DonutChart({
  segments,
  size = 168,
  thickness = 20,
  centerLabel,
  centerSubLabel,
  trackColor = "#EEF1F0",
}: {
  segments: ChartSegment[];
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
  const bounds = segments.map((seg) => {
    const start = cumulative;
    cumulative += total > 0 ? seg.value / total : 0;
    return { color: seg.color, start, end: cumulative };
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0" aria-hidden>
        {Array.from({ length: TICK_COUNT }, (_, i) => {
          const frac = i / TICK_COUNT;
          const color = (total > 0 ? bounds.find((b) => frac >= b.start && frac < b.end)?.color : undefined) ?? trackColor;
          return (
            <rect
              key={i}
              x={radius - tickWidth / 2}
              y={radius - tickDistance - thickness / 2}
              width={tickWidth}
              height={thickness}
              rx={tickWidth / 2}
              fill={color}
              transform={`rotate(${frac * 360} ${radius} ${radius})`}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none relative flex flex-col items-center">
        {centerLabel ? <span className="text-[26px] font-extrabold" style={{ color: colors.ink }}>{centerLabel}</span> : null}
        {centerSubLabel ? <span className="mt-0.5 text-xs text-muted">{centerSubLabel}</span> : null}
      </div>
    </div>
  );
}
