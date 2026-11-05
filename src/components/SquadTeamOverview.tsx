import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { useSquadCricketFigures } from "../hooks/useSquadCricketStats";
import { usePlayerGenericFigures, usePlayerGenericMatches } from "./PlayerSportOverview";
import { squadWinLossRecord, squadRecentForm, squadRunsWicketsTrend, squadPlayerFigures, squadTopPerformers } from "../lib/squadCricketStats";
import { aggregateGeneric, genericRecentForm, classifySportKind, type GenericSport } from "../lib/genericSportStats";
import type { SquadDetail } from "../lib/api/squads";
import type { SquadsStackParamList } from "../navigation/SquadsStackNavigator";

type Nav = NativeStackNavigationProp<SquadsStackParamList>;

// Per the "exactly as shown in the attached images" instruction, and the
// same precedent already set by PlayerCricketOverview.tsx (which documents
// pixel-matching a reference rather than this app's own palette as a
// deliberate, one-off exception) — this screen and its sibling SquadTeam*
// components follow the reference images' layout and color treatment
// instead of inventing a new one.

const WON_COLOR = "#0F9F58";
const LOST_COLOR = "#D1D5DB";

function WinLossCard({
  record,
  filter,
  onChangeFilter,
}: {
  record: { matches: number; won: number; lost: number; winPercent: number };
  filter: "all" | "batFirst" | "bowlFirst";
  onChangeFilter: (f: "all" | "batFirst" | "bowlFirst") => void;
}) {
  const lostPercent = 100 - record.winPercent;
  return (
    <View className="rounded-2xl p-4" style={{ backgroundColor: "#142533" }}>
      <View className="flex-row rounded-xl overflow-hidden mb-4" style={{ backgroundColor: "#1C2D3A" }}>
        {([
          ["all", "Both"],
          ["batFirst", "Bat First"],
          ["bowlFirst", "Bowl First"],
        ] as [typeof filter, string][]).map(([key, label]) =>
          filter === key ? (
            <Pressable key={key} onPress={() => onChangeFilter(key)} className="flex-1">
              <GradientFill className="items-center py-2.5">
                <Text className="text-jazba-white font-bold text-xs">{label}</Text>
              </GradientFill>
            </Pressable>
          ) : (
            <Pressable key={key} onPress={() => onChangeFilter(key)} className="flex-1 items-center py-2.5">
              <Text className="font-bold text-xs" style={{ color: "#CBD4DD" }}>{label}</Text>
            </Pressable>
          )
        )}
      </View>

      <View className="flex-row justify-between mb-2">
        <Text className="font-bold text-sm" style={{ color: WON_COLOR }}>
          Won - {record.winPercent.toFixed(1)}%
        </Text>
        <Text className="font-bold text-sm text-muted">Lost - {lostPercent.toFixed(1)}%</Text>
      </View>
      <View className="flex-row rounded-full overflow-hidden" style={{ height: 10 }}>
        <View style={{ width: `${record.winPercent}%`, backgroundColor: WON_COLOR }} />
        <View style={{ width: `${lostPercent}%`, backgroundColor: LOST_COLOR }} />
      </View>
      <View className="flex-row justify-between mt-3">
        <Text className="text-muted text-xs">0</Text>
        <Text className="text-muted text-xs">50</Text>
        <Text className="text-muted text-xs">100</Text>
      </View>

      <View className="flex-row justify-around mt-4">
        <Text className="font-bold text-sm" style={{ color: colors.ink }}>Matches - {record.matches}</Text>
        <Text className="font-bold text-sm" style={{ color: colors.ink }}>Won - {record.won}</Text>
        <Text className="font-bold text-sm" style={{ color: colors.ink }}>Lost - {record.lost}</Text>
      </View>
    </View>
  );
}

function TopPerformerRow({ name, statLabel, subStat }: { name: string; statLabel: string; subStat?: string }) {
  return (
    <View className="items-center" style={{ width: 92 }}>
      <View className="items-center justify-center rounded-full bg-surface" style={{ width: 48, height: 48, ...cardShadow }}>
        <Text className="font-bold" style={{ color: colors.primaryDark }}>{(name || "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: "#FBBF24" }}>
          <Text className="text-jazba-white font-bold" style={{ fontSize: 11 }}>{statLabel}</Text>
        </View>
        {subStat ? (
          <View className="rounded-full px-1.5 py-0.5 items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.3)", minWidth: 22 }}>
            <Text className="text-jazba-white font-bold" style={{ fontSize: 10 }}>{subStat}</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-jazba-white font-semibold text-xs mt-1" numberOfLines={1}>{name}</Text>
    </View>
  );
}

function BarChart({ data, color }: { data: { matchId: string; value: number }[]; color: string }) {
  if (data.length === 0) return <Text className="text-muted text-sm text-center py-6">No recent matches</Text>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="flex-row items-end justify-around" style={{ height: 150 }}>
      {data.map((d, i) => (
        <View key={`${d.matchId}-${i}`} className="items-center" style={{ gap: 6 }}>
          <View style={{ width: 30, height: Math.max(4, (d.value / max) * 110), backgroundColor: color, borderRadius: 6 }} />
          <View className="rounded px-1.5 py-1" style={{ backgroundColor: "#1C2D3A" }}>
            <Text className="font-bold text-xs" style={{ color: colors.ink }}>{d.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mt-6 mb-3">
      <Text className="text-ink font-bold text-lg">{title}</Text>
      {subtitle ? <Text className="text-muted text-xs mt-0.5">{subtitle}</Text> : null}
    </View>
  );
}

function CricketOverview({ squad }: { squad: SquadDetail }) {
  const navigation = useNavigation<Nav>();
  const [filter, setFilter] = useState<"all" | "batFirst" | "bowlFirst">("all");
  const { data: figures, matches, isLoading } = useSquadCricketFigures(squad.name, squad.sport_id);

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  const allFigures = figures ?? [];

  const record = squadWinLossRecord(allFigures, filter, 20);
  const recent5 = allFigures.slice(0, 5);
  const memberNames = squad.squad_members.map((m) => m.profiles?.full_name).filter((n): n is string => !!n);
  const performerFiguresByName = squadPlayerFigures(
    (matches ?? []).filter((m) => recent5.some((f) => f.matchId === m.id)),
    memberNames
  );
  const topPerformers = squadTopPerformers(performerFiguresByName, 3);
  const trend = squadRunsWicketsTrend(allFigures, 5);
  const scheduled = (matches ?? []).find((m) => m.status === "SCHEDULED");

  return (
    <View>
      <SectionTitle title="Win Loss Ratio" subtitle="Recent 20 matches" />
      <WinLossCard record={record} filter={filter} onChangeFilter={setFilter} />

      {topPerformers.length > 0 && (
        <>
          <SectionTitle title="Top Performers" subtitle="Recent 5 matches" />
          <GradientFill className="rounded-2xl p-4" style={{ ...cardShadow }}>
            <View className="flex-row flex-wrap justify-around" style={{ gap: 12 }}>
              {topPerformers.map((p) => (
                <TopPerformerRow
                  key={p.name}
                  name={p.name}
                  statLabel={p.runs > 0 ? p.battingAverage.toFixed(1) : p.bowlingAverage.toFixed(1)}
                  subStat={p.wickets > 0 ? `${p.wickets}w` : undefined}
                />
              ))}
            </View>
          </GradientFill>
        </>
      )}

      {scheduled && (
        <>
          <SectionTitle title="Scheduled Matches" />
          <Pressable
            onPress={() => navigation.navigate("LiveScoring", { matchId: scheduled.id })}
            className="flex-row items-center rounded-2xl p-4"
            style={{ backgroundColor: "#142533", gap: 12 }}
          >
            <Ionicons name="calendar-outline" size={22} color={colors.primaryDark} />
            <View className="flex-1">
              <Text className="text-ink font-bold text-sm">{scheduled.team_a_name}</Text>
              <Text className="text-ink font-bold text-sm">{scheduled.team_b_name}</Text>
              {scheduled.venue ? <Text className="text-muted text-xs mt-1">{scheduled.venue}</Text> : null}
            </View>
          </Pressable>
        </>
      )}

      <SectionTitle title="Runs Scored In Recent Matches" />
      <View className="rounded-2xl p-4" style={{ backgroundColor: "#142533" }}>
        <BarChart data={trend.runsScored} color="#2563EB" />
        <View className="flex-row justify-between mt-2">
          <Text className="text-muted text-xs font-bold">NEW</Text>
          <Text className="text-muted text-xs font-bold">OLD</Text>
        </View>
      </View>

      <SectionTitle title="Wickets Taken In Recent Matches" />
      <View className="rounded-2xl p-4" style={{ backgroundColor: "#142533" }}>
        <BarChart data={trend.wicketsTaken} color="#DC2626" />
        <View className="flex-row justify-between mt-2">
          <Text className="text-muted text-xs font-bold">NEW</Text>
          <Text className="text-muted text-xs font-bold">OLD</Text>
        </View>
      </View>
    </View>
  );
}

function GenericOverview({ squad, sport }: { squad: SquadDetail; sport: GenericSport }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, squad.name);
  const { data: matches } = usePlayerGenericMatches(sport, squad.name);

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  const totals = aggregateGeneric(figures ?? []);
  const form = genericRecentForm(figures ?? [], 5);
  const scheduled = (matches ?? []).find((m) => m.status === "SCHEDULED");

  return (
    <View>
      <SectionTitle title="Record" subtitle="All matches" />
      <View className="rounded-2xl p-4" style={{ backgroundColor: "#142533" }}>
        <View className="flex-row justify-around">
          <Text className="font-bold text-sm" style={{ color: colors.ink }}>Matches - {totals.matches}</Text>
          <Text className="font-bold text-sm" style={{ color: WON_COLOR }}>Won - {totals.wins}</Text>
          <Text className="font-bold text-sm text-muted">Lost - {totals.losses}</Text>
        </View>
        <Text className="text-center text-muted text-xs mt-2">Win % {totals.winPercent.toFixed(1)}%</Text>
      </View>

      <SectionTitle title="Recent Form" />
      <View className="flex-row" style={{ gap: 8 }}>
        {form.length === 0 ? (
          <Text className="text-muted text-sm">No matches yet</Text>
        ) : (
          form.map((f) => (
            <View
              key={f.matchId}
              className="items-center justify-center rounded-full"
              style={{ width: 36, height: 36, backgroundColor: f.letter === "W" ? "#DCFCE7" : f.letter === "L" ? "#351419" : "#352A13" }}
            >
              <Text className="font-bold text-xs" style={{ color: f.letter === "W" ? "#16A34A" : f.letter === "L" ? "#DC2626" : "#CA8A04" }}>
                {f.letter}
              </Text>
            </View>
          ))
        )}
      </View>

      {scheduled && (
        <>
          <SectionTitle title="Scheduled Matches" />
          <View className="rounded-2xl p-4" style={{ backgroundColor: "#142533" }}>
            <Text className="text-ink font-bold text-sm">{scheduled.sideAName}</Text>
            <Text className="text-ink font-bold text-sm">{scheduled.sideBName}</Text>
            {scheduled.venue ? <Text className="text-muted text-xs mt-1">{scheduled.venue}</Text> : null}
          </View>
        </>
      )}
    </View>
  );
}

export default function SquadTeamOverview({ squad }: { squad: SquadDetail }) {
  const sportKind = classifySportKind(squad.sports?.name);
  if (sportKind === "cricket") return <CricketOverview squad={squad} />;
  if (sportKind) return <GenericOverview squad={squad} sport={sportKind} />;
  return (
    <View className="items-center py-10">
      <Ionicons name="stats-chart-outline" size={32} color={colors.muted} />
      <Text className="text-muted text-sm mt-2 text-center">No scorecard data for this sport yet.</Text>
    </View>
  );
}
