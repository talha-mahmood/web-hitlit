import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import { SkeletonCardRows } from "./Skeleton";
import {
  fetchGenericMatches,
  fetchPlayerGenericFigures,
  aggregateGeneric,
  genericRecentForm,
  genericYearlyOverview,
  genericBestAgainstOpponent,
  SPORT_CONFIGS,
  type GenericSport,
} from "../lib/genericSportStats";

export function usePlayerGenericMatches(sport: GenericSport | null, fullName: string | null | undefined) {
  return useQuery({
    queryKey: ["playerGenericMatches", sport, fullName],
    queryFn: () => fetchGenericMatches(sport as GenericSport, fullName as string),
    enabled: !!sport && !!fullName,
    staleTime: 60_000,
  });
}

export function usePlayerGenericFigures(sport: GenericSport | null, fullName: string | null | undefined) {
  return useQuery({
    queryKey: ["playerGenericFigures", sport, fullName],
    queryFn: () => fetchPlayerGenericFigures(sport as GenericSport, fullName as string),
    enabled: !!sport && !!fullName,
    staleTime: 60_000,
  });
}

const RESULT_COLOR: Record<"W" | "L" | "D", string> = { W: "#16A34A", L: "#DC2626", D: "#CA8A04" };

function ResultBadge({ letter }: { letter: "W" | "L" | "D" }) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: 36, height: 36, backgroundColor: RESULT_COLOR[letter] }}
    >
      <Text className="text-jazba-white font-bold text-sm">{letter}</Text>
    </View>
  );
}

function StatPanel({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl py-4" style={{ ...cardShadow, backgroundColor: colors.surface }}>
      <Text className="font-extrabold" style={{ fontSize: 22, color }}>
        {value}
      </Text>
      <Text className="text-muted text-xs mt-1">{label}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-surface rounded-2xl p-4 mt-5" style={cardShadow}>
      <Text className="text-ink font-bold text-base mb-3">{title}</Text>
      {children}
    </View>
  );
}

export default function PlayerSportOverview({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, fullName);
  const [formPage, setFormPage] = useState(0);
  const cfg = SPORT_CONFIGS[sport];

  if (isLoading) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;
  if (!figures || figures.length === 0) return null;

  const totals = aggregateGeneric(figures);
  const yearly = genericYearlyOverview(figures);
  const opponents = genericBestAgainstOpponent(figures);

  const PAGE_SIZE = 5;
  const formWindow = figures.slice(formPage * PAGE_SIZE, formPage * PAGE_SIZE + PAGE_SIZE);
  const formEntries = genericRecentForm(formWindow, PAGE_SIZE);
  const hasOlder = (formPage + 1) * PAGE_SIZE < figures.length;
  const hasNewer = formPage > 0;

  return (
    <View>
      <View className="flex-row" style={{ gap: 10 }}>
        <StatPanel value={String(totals.matches)} label="Matches" color={colors.ink} />
        <StatPanel value={String(totals.wins)} label="Wins" color="#16A34A" />
        <StatPanel value={String(totals.losses)} label="Losses" color="#DC2626" />
        {cfg.hasDraw ? <StatPanel value={String(totals.draws)} label="Draws" color="#CA8A04" /> : null}
      </View>

      <View className="flex-row mt-3" style={{ gap: 10 }}>
        <StatPanel value={`${totals.winPercent.toFixed(0)}%`} label="Win Rate" color={colors.primary} />
        {cfg.headline === "goals" ? <StatPanel value={String(totals.goals)} label="Goals" color="#2563EB" /> : null}
      </View>

      <Text className="text-ink font-bold text-base mt-6 mb-3">Recent Form</Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {formEntries.length > 0 ? (
          formEntries.map((f) => <ResultBadge key={f.matchId} letter={f.letter} />)
        ) : (
          <Text className="text-muted text-sm">No results yet</Text>
        )}
      </View>
      {figures.length > PAGE_SIZE ? (
        <View className="flex-row items-center justify-center mt-3" style={{ gap: 10 }}>
          <Pressable onPress={() => hasNewer && setFormPage((p) => p - 1)} disabled={!hasNewer} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={hasNewer ? colors.ink : colors.border} />
          </Pressable>
          <Text className="text-muted text-xs font-bold">NEW</Text>
          <Pressable onPress={() => hasOlder && setFormPage((p) => p + 1)} disabled={!hasOlder} hitSlop={8}>
            <Ionicons name="chevron-forward" size={16} color={hasOlder ? colors.ink : colors.border} />
          </Pressable>
          <Text className="text-muted text-xs font-bold">OLD</Text>
        </View>
      ) : null}

      <SectionCard title="Yearly Overview">
        <View className="flex-row py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View className="flex-1" />
          <Text className="text-muted text-xs font-bold text-center" style={{ width: 56 }}>M</Text>
          <Text className="text-muted text-xs font-bold text-center" style={{ width: 56 }}>W</Text>
          <Text className="text-muted text-xs font-bold text-center" style={{ width: 56 }}>L</Text>
          {cfg.headline === "goals" ? (
            <Text className="text-muted text-xs font-bold text-center" style={{ width: 56 }}>Gls</Text>
          ) : null}
        </View>
        {[yearly.thisYear, yearly.lastYear].map((row) => (
          <View key={row.label} className="flex-row items-center py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text className="flex-1 text-ink text-sm font-semibold">{row.label}</Text>
            <Text className="text-ink text-sm text-center" style={{ width: 56 }}>{row.matches}</Text>
            <Text className="text-ink text-sm text-center" style={{ width: 56 }}>{row.wins}</Text>
            <Text className="text-ink text-sm text-center" style={{ width: 56 }}>{row.losses}</Text>
            {cfg.headline === "goals" ? (
              <Text className="text-ink text-sm text-center" style={{ width: 56 }}>{row.goals}</Text>
            ) : null}
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Best Against Opponent">
        {opponents.length === 0 ? (
          <Text className="text-muted text-sm text-center py-3">No matches yet</Text>
        ) : (
          <>
            <View className="flex-row py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View className="flex-1" />
              <Text className="text-muted text-xs font-bold text-center" style={{ width: 56 }}>M</Text>
              <Text className="text-muted text-xs font-bold text-center" style={{ width: 56 }}>W</Text>
              <Text className="text-muted text-xs font-bold text-center" style={{ width: 56 }}>L</Text>
            </View>
            {opponents.map((row) => (
              <View key={row.opponentName} className="flex-row items-center py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text className="flex-1 text-ink text-sm font-semibold" numberOfLines={1}>{row.opponentName.toUpperCase()}</Text>
                <Text className="text-ink text-sm text-center" style={{ width: 56 }}>{row.matches}</Text>
                <Text className="text-ink text-sm text-center" style={{ width: 56 }}>{row.wins}</Text>
                <Text className="text-ink text-sm text-center" style={{ width: 56 }}>{row.losses}</Text>
              </View>
            ))}
          </>
        )}
      </SectionCard>
    </View>
  );
}
