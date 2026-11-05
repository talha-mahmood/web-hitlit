import { View, Text, ActivityIndicator } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, cardShadow } from "../constants/theme";
import { aggregateGeneric, SPORT_CONFIGS, type GenericSport } from "../lib/genericSportStats";
import { usePlayerGenericFigures } from "./PlayerSportOverview";

const RESULT_COLOR: Record<string, string> = { Wins: "#16A34A", Losses: "#DC2626", Draws: "#CA8A04" };

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

// There's no shot/zone-level data for any of these sports (point tables only
// record which side won each point) — a Win/Loss(/Draw) breakdown is the
// one chart this data actually supports honestly.
export default function PlayerSportInsights({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  if (!figures || figures.length === 0) return null;

  const t = aggregateGeneric(figures);
  const slices = [
    { label: "Wins", value: t.wins },
    { label: "Losses", value: t.losses },
    ...(cfg.hasDraw ? [{ label: "Draws", value: t.draws }] : []),
  ].filter((s) => s.value > 0);

  const r = 90;
  const cx = r;
  const cy = r;
  let cumulative = 0;
  const arcs = slices.map((s) => {
    const fraction = t.matches > 0 ? s.value / t.matches : 0;
    const startAngle = cumulative * 360;
    cumulative += fraction;
    const endAngle = cumulative * 360;
    return { ...s, startAngle, endAngle };
  });

  return (
    <View className="bg-surface rounded-2xl p-4 mt-4" style={cardShadow}>
      <Text className="text-ink font-bold text-base text-center mb-3">Match Result Distribution</Text>
      {t.matches > 0 ? (
        <View className="items-center">
          <Svg width={r * 2} height={r * 2}>
            {arcs.map((s) => (
              <Path key={s.label} d={arcPath(cx, cy, r, s.startAngle, s.endAngle)} fill={RESULT_COLOR[s.label]} />
            ))}
          </Svg>
          <View className="flex-row flex-wrap justify-center mt-4" style={{ gap: 16 }}>
            {slices.map((s) => (
              <View key={s.label} className="items-center" style={{ width: 70 }}>
                <View className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: RESULT_COLOR[s.label] }}>
                  <Text className="text-jazba-white text-xs font-bold">{s.value}</Text>
                </View>
                <Text className="text-ink text-xs font-semibold mt-1">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text className="text-muted text-sm text-center">No matches yet</Text>
      )}
    </View>
  );
}
