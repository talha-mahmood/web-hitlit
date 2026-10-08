import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import Svg, { Rect, Path, G } from "react-native-svg";
import { colors, cardShadow } from "../constants/theme";
import { battingPositionStats, bowlingConcededDistribution } from "../lib/playerCricketStats";
import { usePlayerCricketFigures, usePlayerCricketMatches } from "./PlayerCricketOverview";

type BatMetric = "Inn" | "Run" | "Avg" | "SR";
const BAT_METRICS: BatMetric[] = ["Inn", "Run", "Avg", "SR"];
const BAR_COLOR_TOP = "#14B8A6";
const BAR_COLOR_BOTTOM = "#0F172A";

function MetricToggle<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="flex-row justify-center" style={{ gap: 10 }}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChange(o)}
          className="items-center justify-center rounded-full"
          style={{ width: 40, height: 40, backgroundColor: value === o ? "#14B8A6" : "#E5E7EB" }}
        >
          <Text className="text-[10px] font-bold" style={{ color: value === o ? "white" : "#6B7280" }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function BatPositionChart({ rows, metric }: { rows: { position: number; innings: number; runs: number; average: number; strikeRate: number }[]; metric: BatMetric }) {
  const values = rows.map((r) => (metric === "Inn" ? r.innings : metric === "Run" ? r.runs : metric === "Avg" ? r.average : r.strikeRate));
  const max = Math.max(1, ...values);
  const chartHeight = 160;
  const barWidth = 28;
  const gap = 18;
  const width = Math.max(rows.length * (barWidth + gap), 280);

  return (
    <View className="mt-4">
      <Svg width={width} height={chartHeight + 24}>
        {rows.map((r, i) => {
          const v = values[i];
          const barHeight = Math.max(2, (v / max) * chartHeight);
          const x = i * (barWidth + gap) + gap / 2;
          return (
            <G key={r.position}>
              <Rect x={x} y={chartHeight - barHeight} width={barWidth} height={barHeight} rx={4} fill={BAR_COLOR_TOP} />
            </G>
          );
        })}
      </Svg>
      <View className="flex-row" style={{ width }}>
        {rows.map((r, i) => (
          <View key={r.position} style={{ width: barWidth + gap, alignItems: "center" }}>
            <Text className="text-ink text-xs font-bold">{Math.round(values[i] * 10) / 10}</Text>
            <View className="rounded-full px-2 py-0.5 mt-1" style={{ backgroundColor: "#E5E7EB" }}>
              <Text className="text-[10px] font-bold text-ink">{r.position}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const PIE_COLORS: Record<string, string> = {
  "1": "#06B6D4",
  "2": "#8B5CF6",
  "3": "#F59E0B",
  "4": "#F59E0B",
  "6": "#7C3AED",
  Ex: "#3B82F6",
};

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

function ConcededPieChart({ byValue, totalRuns }: { byValue: { value: string; runs: number; balls: number }[]; totalRuns: number }) {
  const r = 90;
  const cx = r;
  const cy = r;
  let cumulative = 0;
  const slices = byValue
    .filter((b) => b.runs > 0)
    .map((b) => {
      const fraction = totalRuns > 0 ? b.runs / totalRuns : 0;
      const startAngle = cumulative * 360;
      cumulative += fraction;
      const endAngle = cumulative * 360;
      return { ...b, fraction, startAngle, endAngle };
    });

  return (
    <View className="items-center mt-4">
      <Svg width={r * 2} height={r * 2}>
        {slices.map((s) => (
          <Path key={s.value} d={arcPath(cx, cy, r, s.startAngle, s.endAngle)} fill={PIE_COLORS[s.value] ?? "#9CA3AF"} />
        ))}
      </Svg>
      <View className="flex-row flex-wrap justify-center mt-4" style={{ gap: 16 }}>
        {byValue.map((b) => (
          <View key={b.value} className="items-center" style={{ width: 48 }}>
            <View className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: PIE_COLORS[b.value] ?? "#9CA3AF" }}>
              <Text className="text-white text-xs font-bold">{b.value}</Text>
            </View>
            <Text className="text-ink text-xs font-bold mt-1">{b.runs}</Text>
          </View>
        ))}
      </View>
      <Text className="text-ink font-bold text-sm mt-4">Total Bowl Runs : {totalRuns}</Text>
    </View>
  );
}

export default function PlayerCricketInsights({ fullName }: { fullName: string }) {
  const { data: figures, isLoading: figuresLoading } = usePlayerCricketFigures(fullName);
  const { data: matches, isLoading: matchesLoading } = usePlayerCricketMatches(fullName);
  const [section, setSection] = useState<"Batting" | "Bowling">("Batting");
  const [batMetric, setBatMetric] = useState<BatMetric>("Run");

  if (figuresLoading || matchesLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  if (!figures || figures.length === 0 || !matches) return null;

  const positionRows = battingPositionStats(figures);
  const distribution = bowlingConcededDistribution(matches, fullName);

  return (
    <View>
      <View className="flex-row self-start rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
        {(["Batting", "Bowling"] as const).map((s) => (
          <Pressable key={s} onPress={() => setSection(s)} className="px-4 py-1.5" style={{ backgroundColor: section === s ? "#1F2937" : "transparent" }}>
            <Text className="text-xs font-bold" style={{ color: section === s ? "white" : "#374151" }}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {section === "Batting" ? (
        <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
          <Text className="text-ink font-bold text-base text-center mb-3">Bat Position Stats</Text>
          <MetricToggle options={BAT_METRICS} value={batMetric} onChange={setBatMetric} />
          {positionRows.length > 0 ? (
            <BatPositionChart rows={positionRows} metric={batMetric} />
          ) : (
            <Text className="text-muted text-sm text-center mt-6">No batting innings yet</Text>
          )}
        </View>
      ) : (
        <View className="bg-white rounded-2xl p-4 mt-4" style={cardShadow}>
          <Text className="text-ink font-bold text-base text-center mb-1">Conceded Runs Distribution</Text>
          {distribution.totalRuns > 0 ? (
            <ConcededPieChart byValue={distribution.byValue} totalRuns={distribution.totalRuns} />
          ) : (
            <Text className="text-muted text-sm text-center mt-6">No bowling figures yet</Text>
          )}
        </View>
      )}
    </View>
  );
}
