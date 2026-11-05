import { View, Text, ActivityIndicator } from "react-native";
import { colors, cardShadow } from "../constants/theme";
import { aggregateGeneric, SPORT_CONFIGS, type GenericSport } from "../lib/genericSportStats";
import { usePlayerGenericFigures } from "./PlayerSportOverview";

// Unlike cricket, none of these sports have a "format" concept (no T10/T20/
// Club/ODI equivalent exists in their schema) — so this is a flat totals
// table rather than forcing a fake set of format columns.
export default function PlayerSportStatistics({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  if (!figures || figures.length === 0) return null;

  const t = aggregateGeneric(figures);
  const rows: { label: string; value: string | number }[] = [
    { label: "Matches", value: t.matches },
    { label: "Wins", value: t.wins },
    { label: "Losses", value: t.losses },
    ...(cfg.hasDraw ? [{ label: "Draws", value: t.draws }] : []),
    { label: "Win %", value: `${t.winPercent.toFixed(1)}%` },
    ...(cfg.headline === "goals" ? [{ label: "Goals", value: t.goals }, { label: "Goals per Match", value: (t.goals / t.matches).toFixed(2) }] : []),
  ];

  return (
    <View className="bg-surface rounded-2xl p-4 mt-4" style={cardShadow}>
      {rows.map((row, i) => (
        <View
          key={row.label}
          className="flex-row items-center justify-between py-3"
          style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
        >
          <Text className="text-ink font-semibold" style={{ fontSize: 14.5 }}>{row.label}</Text>
          <Text className="text-ink font-extrabold" style={{ fontSize: 16 }}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}
