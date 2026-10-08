import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { colors } from "../constants/theme";
import {
  statisticsByFormat,
  matchWiseRows,
  FORMAT_LABEL,
  type CricketFormat,
  type MatchFigures,
} from "../lib/playerCricketStats";
import { usePlayerCricketFigures } from "./PlayerCricketOverview";

type SubTab = "BAT" | "BOWL" | "FIELD" | "MATCH-WISE";
const SUB_TABS: SubTab[] = ["BAT", "BOWL", "FIELD", "MATCH-WISE"];
const FORMATS: CricketFormat[] = ["T10", "T20", "Club", "ODI"];
const COL_WIDTH = 64;

function SubTabBar({ value, onChange }: { value: SubTab; onChange: (v: SubTab) => void }) {
  return (
    <View className="flex-row rounded-xl overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
      {SUB_TABS.map((t) => (
        <Pressable key={t} onPress={() => onChange(t)} className="flex-1 items-center py-2" style={{ backgroundColor: value === t ? "#1F2937" : "transparent" }}>
          <Text className="text-xs font-bold" style={{ color: value === t ? "white" : "#6B7280" }}>
            {t}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatsTable({ rows }: { rows: { label: string; values: (string | number)[] }[] }) {
  return (
    <View className="mt-4">
      <View className="flex-row pb-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View className="flex-1" />
        {FORMATS.map((fmt) => (
          <Text key={fmt} className="text-xs font-bold text-center" style={{ width: COL_WIDTH, color: "#0D9488" }}>
            {FORMAT_LABEL[fmt]}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.label} className="flex-row items-center py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text className="flex-1 text-ink font-semibold text-sm">{row.label}</Text>
          {row.values.map((v, i) => (
            <Text key={i} className="text-ink text-sm text-center" style={{ width: COL_WIDTH }}>
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function MatchWiseCard({ row }: { row: { matchId: string; date: string; format: CricketFormat; opponentTeamName: string; batting: MatchFigures["batting"]; bowling: MatchFigures["bowling"] } }) {
  const dateLabel = new Date(row.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
  return (
    <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: "#F3F4F6" }}>
      <Text className="text-ink font-bold text-sm mb-3">
        {row.format} - {dateLabel} vs {row.opponentTeamName.toUpperCase()}
      </Text>
      {row.batting ? (
        <>
          <View className="flex-row justify-between">
            {["Bat Order", "Runs", "Balls", "Fours", "Sixes", "SR"].map((h) => (
              <Text key={h} className="text-muted text-xs flex-1 text-center">{h}</Text>
            ))}
          </View>
          <View className="flex-row justify-between mt-1.5">
            {[
              row.batting.position,
              row.batting.runs,
              row.batting.balls,
              row.batting.fours,
              row.batting.sixes,
              row.batting.balls > 0 ? ((row.batting.runs / row.batting.balls) * 100).toFixed(1) : "0.0",
            ].map((v, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{v}</Text>
            ))}
          </View>
        </>
      ) : null}
      {row.bowling ? (
        <>
          <View className="flex-row justify-between mt-3">
            {["Overs", "Runs", "Maidens", "Wickets", "Eco."].map((h) => (
              <Text key={h} className="text-muted text-xs flex-1 text-center">{h}</Text>
            ))}
          </View>
          <View className="flex-row justify-between mt-1.5">
            {[
              `${Math.floor(row.bowling.legalBalls / 6)}.${row.bowling.legalBalls % 6}`,
              row.bowling.runsConceded,
              row.bowling.maidens,
              row.bowling.wickets,
              row.bowling.legalBalls > 0 ? ((row.bowling.runsConceded / row.bowling.legalBalls) * 6).toFixed(1) : "0.0",
            ].map((v, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{v}</Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function PlayerCricketStatistics({ fullName }: { fullName: string }) {
  const { data: figures, isLoading } = usePlayerCricketFigures(fullName);
  const [subTab, setSubTab] = useState<SubTab>("BAT");

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  if (!figures || figures.length === 0) return null;

  const stats = statisticsByFormat(figures);

  return (
    <View>
      <SubTabBar value={subTab} onChange={setSubTab} />

      {subTab === "BAT" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <StatsTable
              rows={[
                { label: "Matches", values: FORMATS.map((f) => stats.matches[f]) },
                { label: "Innings", values: FORMATS.map((f) => stats.batting[f].innings) },
                { label: "Runs", values: FORMATS.map((f) => stats.batting[f].runs) },
                { label: "Balls", values: FORMATS.map((f) => stats.batting[f].balls) },
                { label: "Highest", values: FORMATS.map((f) => `${stats.batting[f].highScore}${stats.batting[f].highScoreNotOut ? "*" : ""}`) },
                { label: "Average", values: FORMATS.map((f) => stats.batting[f].average.toFixed(1)) },
                { label: "SR", values: FORMATS.map((f) => stats.batting[f].strikeRate.toFixed(1)) },
                { label: "Not Out", values: FORMATS.map((f) => stats.batting[f].notOuts) },
                { label: "Ducks", values: FORMATS.map((f) => stats.batting[f].ducks) },
                { label: "100s", values: FORMATS.map((f) => stats.batting[f].hundreds) },
                { label: "50s", values: FORMATS.map((f) => stats.batting[f].fifties) },
                { label: "30s", values: FORMATS.map((f) => stats.batting[f].thirties) },
                { label: "6s", values: FORMATS.map((f) => stats.batting[f].sixes) },
                { label: "4s", values: FORMATS.map((f) => stats.batting[f].fours) },
              ]}
            />
          </View>
        </ScrollView>
      ) : null}

      {subTab === "BOWL" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <StatsTable
              rows={[
                { label: "Matches", values: FORMATS.map((f) => stats.matches[f]) },
                { label: "Innings", values: FORMATS.map((f) => stats.bowling[f].innings) },
                { label: "Balls", values: FORMATS.map((f) => stats.bowling[f].balls) },
                { label: "Runs", values: FORMATS.map((f) => stats.bowling[f].runs) },
                { label: "Dots", values: FORMATS.map((f) => stats.bowling[f].dots) },
                { label: "Maidens", values: FORMATS.map((f) => stats.bowling[f].maidens) },
                { label: "Wickets", values: FORMATS.map((f) => stats.bowling[f].wickets) },
                { label: "Average", values: FORMATS.map((f) => (stats.bowling[f].wickets > 0 ? stats.bowling[f].average.toFixed(1) : "0.0")) },
                { label: "Economy", values: FORMATS.map((f) => stats.bowling[f].economy.toFixed(1)) },
                { label: "SR", values: FORMATS.map((f) => (stats.bowling[f].wickets > 0 ? stats.bowling[f].strikeRate.toFixed(1) : "0.0")) },
                { label: "3w", values: FORMATS.map((f) => stats.bowling[f].threeWickets) },
                { label: "5w", values: FORMATS.map((f) => stats.bowling[f].fiveWickets) },
              ]}
            />
          </View>
        </ScrollView>
      ) : null}

      {subTab === "FIELD" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <StatsTable
              rows={[
                { label: "Catches", values: FORMATS.map((f) => stats.fielding[f].catches) },
                { label: "Stumpings", values: FORMATS.map((f) => stats.fielding[f].stumpings) },
                { label: "Runouts", values: FORMATS.map((f) => stats.fielding[f].runouts) },
              ]}
            />
          </View>
        </ScrollView>
      ) : null}

      {subTab === "MATCH-WISE" ? (
        <View className="mt-4">
          {matchWiseRows(figures).map((row) => (
            <MatchWiseCard key={row.matchId} row={row} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
