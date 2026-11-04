import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { useSquadCricketMatches } from "../hooks/useSquadCricketStats";
import {
  computeSquadFigures,
  squadTeamOverviewStats,
  squadChasedDefended,
  squadPartnerships,
  squadRosterAggregates,
  squadMvpPoints,
  type RosterAggregateRow,
} from "../lib/squadCricketStats";
import type { SquadDetail } from "../lib/api/squads";

type StatTab = "TEAM" | "BAT" | "BOWL" | "FIELD" | "MVP";
const STAT_TABS: StatTab[] = ["TEAM", "BAT", "BOWL", "FIELD", "MVP"];

function PillBar<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) =>
        value === o ? (
          <Pressable key={o} onPress={() => onChange(o)}>
            <GradientFill className="rounded-full px-4 py-2">
              <Text className="text-white font-bold text-xs">{o}</Text>
            </GradientFill>
          </Pressable>
        ) : (
          <Pressable key={o} onPress={() => onChange(o)} className="rounded-full px-4 py-2" style={{ backgroundColor: "#E5E7EB" }}>
            <Text className="font-bold text-xs" style={{ color: "#374151" }}>{o}</Text>
          </Pressable>
        )
      )}
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center py-3 rounded-xl" style={{ backgroundColor: "#F3F4F6" }}>
      <Text className="font-bold text-base" style={{ color: colors.ink }}>{value}</Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
    </View>
  );
}

function RankedTable({
  rows,
  columns,
  nameLabel = "Player",
}: {
  rows: { rank: number; name: string; values: string[] }[];
  columns: string[];
  nameLabel?: string;
}) {
  if (rows.length === 0) return <Text className="text-muted text-sm text-center py-6">No data to show.</Text>;
  return (
    <View className="mt-3">
      <View className="flex-row py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 24 }} />
        <Text className="text-muted text-xs font-bold flex-1">{nameLabel}</Text>
        {columns.map((c) => (
          <Text key={c} className="text-muted text-xs font-bold text-center" style={{ width: 60 }}>{c}</Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={`${r.rank}-${r.name}`} className="flex-row items-center py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View className="items-center justify-center rounded-full" style={{ width: 20, height: 20, backgroundColor: "#E5E7EB" }}>
            <Text className="text-xs font-bold" style={{ color: colors.ink }}>{r.rank}</Text>
          </View>
          <Text className="text-ink text-sm font-semibold flex-1 ml-2" numberOfLines={1}>{r.name}</Text>
          {r.values.map((v, i) => (
            <Text key={i} className="text-ink text-sm text-center" style={{ width: 60 }}>{v}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

type TeamSub = "Overview" | "Chased" | "Defended" | "Partnerships";

function PartnershipCard({ row }: { row: ReturnType<typeof squadPartnerships>[number] }) {
  const total = row.totalRuns || 1;
  const widthA = Math.min(100, (row.runsA / total) * 100);
  const widthB = Math.min(100, (row.runsB / total) * 100);
  return (
    <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: "#F3F4F6" }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-ink text-sm">
            <Text className="font-bold">{row.runsA}</Text> ({row.ballsA}) <Text className="font-semibold">{row.batterA}</Text>
          </Text>
          <View className="mt-1.5 rounded-full" style={{ height: 6, backgroundColor: "#D1D5DB", width: `${widthA}%` }} />
          <View className="mt-1 rounded-full" style={{ height: 6, backgroundColor: "#F9A8D4", width: `${widthB}%` }} />
          <Text className="text-ink text-sm mt-1.5">
            <Text className="font-bold">{row.runsB}</Text> ({row.ballsB}) <Text className="font-semibold">{row.batterB}</Text>
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-extrabold text-xl" style={{ color: colors.primaryDark }}>{row.totalRuns}</Text>
          <Text className="text-muted text-xs">{row.totalBalls} Balls</Text>
        </View>
      </View>
    </View>
  );
}

function TeamSection({ matches, teamName }: { matches: NonNullable<ReturnType<typeof useSquadCricketMatches>["data"]>; teamName: string }) {
  const [sub, setSub] = useState<TeamSub>("Overview");
  const figures = useMemo(() => computeSquadFigures(matches, teamName), [matches, teamName]);
  const overview = useMemo(() => squadTeamOverviewStats(figures), [figures]);
  const chasedDefended = useMemo(() => squadChasedDefended(figures), [figures]);
  const partnerships = useMemo(() => squadPartnerships(matches, teamName), [matches, teamName]);

  return (
    <View className="mt-4">
      <PillBar value={sub} options={["Overview", "Chased", "Defended", "Partnerships"] as TeamSub[]} onChange={setSub} />
      {sub === "Overview" && (
        <View className="mt-4" style={{ gap: 10 }}>
          <View className="flex-row" style={{ gap: 10 }}>
            <StatBox label="Matches" value={overview.matches} />
            <StatBox label="Won" value={overview.won} />
            <StatBox label="Win %" value={`${overview.winPercent.toFixed(1)}%`} />
          </View>
          <View className="flex-row" style={{ gap: 10 }}>
            <StatBox label="Lost" value={overview.lost} />
            <StatBox label="Tie" value={overview.tied} />
            <StatBox label="NR" value={overview.noResult} />
          </View>

          <Text className="text-ink font-bold text-base text-center mt-4">Team Score</Text>
          <View className="flex-row rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border }}>
            <View className="flex-1" />
            <Text className="flex-1 text-center font-bold text-xs py-2" style={{ color: colors.muted }}>High</Text>
            <Text className="flex-1 text-center font-bold text-xs py-2" style={{ color: colors.muted }}>Low</Text>
          </View>
          <View className="flex-row">
            <Text className="flex-1 text-sm py-2" style={{ color: colors.ink }}>Scored</Text>
            <Text className="flex-1 text-center font-bold text-sm py-2">{overview.highScore}</Text>
            <Text className="flex-1 text-center font-bold text-sm py-2">{overview.lowScore}</Text>
          </View>
          <View className="flex-row">
            <Text className="flex-1 text-sm py-2" style={{ color: colors.ink }}>Conceded</Text>
            <Text className="flex-1 text-center font-bold text-sm py-2">{overview.highConceded}</Text>
            <Text className="flex-1 text-center font-bold text-sm py-2">{overview.lowConceded}</Text>
          </View>

          <Text className="text-ink font-bold text-base text-center mt-4">Toss</Text>
          <View className="flex-row" style={{ gap: 10 }}>
            <StatBox label="Toss Won" value={overview.tossWonCount} />
            <StatBox label="Bat First" value={overview.battedFirstCount} />
            <StatBox label="Bowl First" value={overview.bowledFirstCount} />
          </View>

          <Text className="text-ink font-bold text-base text-center mt-4">Result Insights</Text>
          <View className="flex-row" style={{ gap: 10 }}>
            <StatBox label="Bat First Win %" value={`${overview.batFirstWinPercent.toFixed(1)}%`} />
            <StatBox label="Bowl First Win %" value={`${overview.bowlFirstWinPercent.toFixed(1)}%`} />
          </View>
        </View>
      )}
      {sub === "Chased" && (
        <RankedTable
          nameLabel="Opponent Team"
          columns={["Format", "Target"]}
          rows={chasedDefended.chased.map((r, i) => ({ rank: i + 1, name: r.opponentTeamName.toUpperCase(), values: [r.format, String(r.value)] }))}
        />
      )}
      {sub === "Defended" && (
        <RankedTable
          nameLabel="Opponent Team"
          columns={["Format", "Score"]}
          rows={chasedDefended.defended.map((r, i) => ({ rank: i + 1, name: r.opponentTeamName.toUpperCase(), values: [r.format, String(r.value)] }))}
        />
      )}
      {sub === "Partnerships" && (
        <View className="mt-3">
          {partnerships.length === 0 ? (
            <Text className="text-muted text-sm text-center py-6">No data to show.</Text>
          ) : (
            partnerships.map((row, i) => <PartnershipCard key={`${row.matchId}-${i}`} row={row} />)
          )}
        </View>
      )}
    </View>
  );
}

type BatMetric = "Most Runs" | "Most 30s" | "Most 50s" | "Most 100s" | "Highest Score" | "Batting Average" | "Strike Rate" | "Most Sixes" | "Most Fours" | "Balls Faced" | "Duck Outs";
const BAT_METRICS: BatMetric[] = ["Most Runs", "Most 30s", "Most 50s", "Most 100s", "Highest Score", "Batting Average", "Strike Rate", "Most Sixes", "Most Fours", "Balls Faced", "Duck Outs"];

function batRows(roster: RosterAggregateRow[], metric: BatMetric) {
  const withInnings = roster.filter((r) => r.batting.innings > 0);
  const cfg: Record<BatMetric, { primary: (r: RosterAggregateRow) => number; primaryLabel: (r: RosterAggregateRow) => string; cols: string[]; values: (r: RosterAggregateRow) => string[] }> = {
    "Most Runs": { primary: (r) => r.batting.runs, primaryLabel: (r) => String(r.batting.runs), cols: ["Run", "Inn", "Avg"], values: (r) => [String(r.batting.runs), String(r.batting.innings), r.batting.average.toFixed(1)] },
    "Most 30s": { primary: (r) => r.batting.thirties, primaryLabel: (r) => String(r.batting.thirties), cols: ["30s", "Inn", "Run"], values: (r) => [String(r.batting.thirties), String(r.batting.innings), String(r.batting.runs)] },
    "Most 50s": { primary: (r) => r.batting.fifties, primaryLabel: (r) => String(r.batting.fifties), cols: ["50s", "Inn", "Run"], values: (r) => [String(r.batting.fifties), String(r.batting.innings), String(r.batting.runs)] },
    "Most 100s": { primary: (r) => r.batting.hundreds, primaryLabel: (r) => String(r.batting.hundreds), cols: ["100", "Inn", "Run"], values: (r) => [String(r.batting.hundreds), String(r.batting.innings), String(r.batting.runs)] },
    "Highest Score": { primary: (r) => r.batting.highScore, primaryLabel: (r) => `${r.batting.highScore}${r.batting.highScoreNotOut ? "*" : ""}`, cols: ["Run", "Bal", "SR"], values: (r) => [`${r.batting.highScore}${r.batting.highScoreNotOut ? "*" : ""}`, String(r.batting.balls), r.batting.strikeRate.toFixed(1)] },
    "Batting Average": { primary: (r) => r.batting.average, primaryLabel: (r) => r.batting.average.toFixed(1), cols: ["Avg", "Inn", "Run"], values: (r) => [r.batting.average.toFixed(1), String(r.batting.innings), String(r.batting.runs)] },
    "Strike Rate": { primary: (r) => r.batting.strikeRate, primaryLabel: (r) => r.batting.strikeRate.toFixed(1), cols: ["SR", "Inn", "Run"], values: (r) => [r.batting.strikeRate.toFixed(1), String(r.batting.innings), String(r.batting.runs)] },
    "Most Sixes": { primary: (r) => r.batting.sixes, primaryLabel: (r) => String(r.batting.sixes), cols: ["6s", "Inn", "Run"], values: (r) => [String(r.batting.sixes), String(r.batting.innings), String(r.batting.runs)] },
    "Most Fours": { primary: (r) => r.batting.fours, primaryLabel: (r) => String(r.batting.fours), cols: ["4s", "Inn", "Run"], values: (r) => [String(r.batting.fours), String(r.batting.innings), String(r.batting.runs)] },
    "Balls Faced": { primary: (r) => r.batting.balls, primaryLabel: (r) => String(r.batting.balls), cols: ["Bal", "Inn", "Run"], values: (r) => [String(r.batting.balls), String(r.batting.innings), String(r.batting.runs)] },
    "Duck Outs": { primary: (r) => r.batting.ducks, primaryLabel: (r) => String(r.batting.ducks), cols: ["Duk", "Inn", "Avg"], values: (r) => [String(r.batting.ducks), String(r.batting.innings), r.batting.average.toFixed(1)] },
  };
  const { primary, cols, values } = cfg[metric];
  const sorted = [...withInnings].filter((r) => primary(r) > 0).sort((a, b) => primary(b) - primary(a));
  return { cols, rows: sorted.map((r, i) => ({ rank: i + 1, name: r.name, values: values(r) })) };
}

type BowlMetric = "Most Wickets" | "3 Wkt Hauls" | "5 Wkt Hauls" | "Best Bowling";
const BOWL_METRICS: BowlMetric[] = ["Most Wickets", "3 Wkt Hauls", "5 Wkt Hauls", "Best Bowling"];

function bowlRows(roster: RosterAggregateRow[], metric: BowlMetric) {
  const withInnings = roster.filter((r) => r.bowling.innings > 0);
  const cfg: Record<BowlMetric, { primary: (r: RosterAggregateRow) => number; cols: string[]; values: (r: RosterAggregateRow) => string[] }> = {
    "Most Wickets": { primary: (r) => r.bowling.wickets, cols: ["Wkt", "Inn", "Avg"], values: (r) => [String(r.bowling.wickets), String(r.bowling.innings), r.bowling.wickets > 0 ? r.bowling.average.toFixed(1) : "0.0"] },
    "3 Wkt Hauls": { primary: (r) => r.bowling.threeWickets, cols: ["3w", "Inn", "Wkt"], values: (r) => [String(r.bowling.threeWickets), String(r.bowling.innings), String(r.bowling.wickets)] },
    "5 Wkt Hauls": { primary: (r) => r.bowling.fiveWickets, cols: ["5w", "Inn", "Wkt"], values: (r) => [String(r.bowling.fiveWickets), String(r.bowling.innings), String(r.bowling.wickets)] },
    "Best Bowling": { primary: (r) => r.bowling.wickets, cols: ["Best", "Inn", "Wkt"], values: (r) => [`${r.bowling.bestWickets}-${r.bowling.bestRuns}`, String(r.bowling.innings), String(r.bowling.wickets)] },
  };
  const { primary, cols, values } = cfg[metric];
  const sorted = [...withInnings].filter((r) => primary(r) > 0).sort((a, b) => primary(b) - primary(a));
  return { cols, rows: sorted.map((r, i) => ({ rank: i + 1, name: r.name, values: values(r) })) };
}

type FieldMetric = "Catches" | "Stumpings" | "Runouts";
const FIELD_METRICS: FieldMetric[] = ["Catches", "Stumpings", "Runouts"];

function fieldRows(roster: RosterAggregateRow[], metric: FieldMetric) {
  const cfg: Record<FieldMetric, { primary: (r: RosterAggregateRow) => number; cols: string[]; values: (r: RosterAggregateRow) => string[] }> = {
    Catches: { primary: (r) => r.fielding.catches, cols: ["Cat", "Stu", "Rou"], values: (r) => [String(r.fielding.catches), String(r.fielding.stumpings), String(r.fielding.runouts)] },
    Stumpings: { primary: (r) => r.fielding.stumpings, cols: ["Stu", "Cat", "Rou"], values: (r) => [String(r.fielding.stumpings), String(r.fielding.catches), String(r.fielding.runouts)] },
    Runouts: { primary: (r) => r.fielding.runouts, cols: ["Rou", "Stu", "Cat"], values: (r) => [String(r.fielding.runouts), String(r.fielding.stumpings), String(r.fielding.catches)] },
  };
  const { primary, cols, values } = cfg[metric];
  const sorted = [...roster].filter((r) => primary(r) > 0).sort((a, b) => primary(b) - primary(a));
  return { cols, rows: sorted.map((r, i) => ({ rank: i + 1, name: r.name, values: values(r) })) };
}

function MvpSection({ roster }: { roster: RosterAggregateRow[] }) {
  const insets = useSafeAreaInsets();
  const [rulesOpen, setRulesOpen] = useState(false);
  const rows = useMemo(() => squadMvpPoints(roster), [roster]);

  return (
    <View className="mt-4">
      <Pressable onPress={() => setRulesOpen(true)} className="flex-row items-center self-start rounded-full px-3 py-2" style={{ gap: 6, borderWidth: 1, borderColor: colors.border }}>
        <Text className="text-ink font-semibold text-xs">MVP Rules</Text>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
      </Pressable>

      {rows.length === 0 ? (
        <Text className="text-muted text-sm text-center py-6">No data to show.</Text>
      ) : (
        <View className="mt-3">
          {rows.map((r, i) => (
            <View key={r.name} className="flex-row items-center py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View className="items-center justify-center rounded-full" style={{ width: 22, height: 22, backgroundColor: "#E5E7EB" }}>
                <Text className="text-xs font-bold">{i + 1}</Text>
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-ink font-semibold text-sm">{r.name}</Text>
                <Text className="text-muted text-xs mt-0.5">
                  Bat {r.batPoints.toFixed(1)}
                  {r.bowlPoints > 0 ? `  Bowl ${r.bowlPoints.toFixed(1)}` : ""}
                  {r.fieldPoints > 0 ? `  Field ${r.fieldPoints.toFixed(1)}` : ""}
                </Text>
              </View>
              <Text className="font-extrabold text-base" style={{ color: colors.primaryDark }}>{r.totalPoints.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      )}

      <Modal visible={rulesOpen} animationType="slide" transparent onRequestClose={() => setRulesOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-ink">MVP Rules</Text>
              <Pressable onPress={() => setRulesOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm leading-relaxed">
              Batting: 1 point per run, +1 per four, +2 per six, +4 for a 30, +8 for a 50, +16 for a 100.{"\n\n"}
              Bowling: 20 points per wicket, +8 per maiden over, +8 for a 3-wicket haul, +16 for a 5-wicket haul.{"\n\n"}
              Fielding: 8 points per catch, 12 per stumping, 6 per run-out.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function SquadTeamStatistics({ squad }: { squad: SquadDetail }) {
  const [tab, setTab] = useState<StatTab>("TEAM");
  const [batMetric, setBatMetric] = useState<BatMetric>("Most Runs");
  const [bowlMetric, setBowlMetric] = useState<BowlMetric>("Most Wickets");
  const [fieldMetric, setFieldMetric] = useState<FieldMetric>("Catches");
  const { data: matches, isLoading } = useSquadCricketMatches(squad.name, squad.sport_id);

  const memberNames = squad.squad_members.filter((m) => m.status === "ACTIVE").map((m) => m.profiles?.full_name).filter((n): n is string => !!n);
  const roster = useMemo(() => (matches ? squadRosterAggregates(matches, memberNames) : []), [matches, memberNames]);

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  if (!matches) return null;

  const bat = batRows(roster, batMetric);
  const bowl = bowlRows(roster, bowlMetric);
  const field = fieldRows(roster, fieldMetric);

  return (
    <View>
      <View className="flex-row rounded-xl overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
        {STAT_TABS.map((t) =>
          tab === t ? (
            <Pressable key={t} onPress={() => setTab(t)} className="flex-1">
              <GradientFill className="items-center py-2">
                <Text className="text-xs font-bold text-white">{t}</Text>
              </GradientFill>
            </Pressable>
          ) : (
            <Pressable key={t} onPress={() => setTab(t)} className="flex-1 items-center py-2">
              <Text className="text-xs font-bold" style={{ color: "#6B7280" }}>{t}</Text>
            </Pressable>
          )
        )}
      </View>

      {tab === "TEAM" && <TeamSection matches={matches} teamName={squad.name} />}

      {tab === "BAT" && (
        <View className="mt-4">
          <PillBar value={batMetric} options={BAT_METRICS} onChange={setBatMetric} />
          <RankedTable columns={bat.cols} rows={bat.rows} />
        </View>
      )}

      {tab === "BOWL" && (
        <View className="mt-4">
          <PillBar value={bowlMetric} options={BOWL_METRICS} onChange={setBowlMetric} />
          <RankedTable columns={bowl.cols} rows={bowl.rows} />
        </View>
      )}

      {tab === "FIELD" && (
        <View className="mt-4">
          <PillBar value={fieldMetric} options={FIELD_METRICS} onChange={setFieldMetric} />
          <RankedTable columns={field.cols} rows={field.rows} />
        </View>
      )}

      {tab === "MVP" && <MvpSection roster={roster} />}
    </View>
  );
}
