import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import {
  fetchPlayerCricketMatches,
  computePlayerFigures,
  aggregateBatting,
  aggregateBowling,
  aggregateFielding,
  recentForm,
  yearlyOverview,
  bestAgainstTeam,
} from "../lib/playerCricketStats";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
import GradientFill from "./GradientFill";
import { SkeletonCardRows } from "./Skeleton";

// Every match (any status) this player appears in — shared cache key so the
// Overview/Statistics/Matches tabs all reuse the same single fetch.
// `sportId` narrows to one cricket sub-sport (Hard Ball/Tape Ball/Outdoor
// Cricket) when the profile is filtered to a specific one; omitted, every
// cricket match regardless of sub-sport is included.
export function usePlayerCricketMatches(fullName: string | null | undefined, sportId?: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["playerCricketMatches", fullName, sportId ?? null],
    queryFn: () => fetchPlayerCricketMatches(fullName as string, sportId),
    enabled: !!fullName,
    staleTime: 60_000,
  });

  // A player's matches are found by name appearing in team_a_players/
  // team_b_players (plain text[] columns) — Postgres realtime's filter
  // grammar doesn't reliably support "array contains" filters, so this
  // subscribes broadly (any cricket_matches/cricket_innings/cricket_balls
  // change) and invalidates every cached sportId variant for this player,
  // the same broad-then-invalidate shape useProfileStats's own channel
  // already uses. Only active while a player's profile screen has this tab
  // mounted.
  useEffect(() => {
    if (!fullName) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["playerCricketMatches", fullName] });
    const channel = supabase
      .channel(uniqueChannelName(`playerCricketMatches:${fullName}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_matches" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_innings" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_balls" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fullName, qc]);

  return query;
}

export function usePlayerCricketFigures(fullName: string | null | undefined, sportId?: string | null) {
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName, sportId);
  const figures = useMemo(
    () => (matches && fullName ? computePlayerFigures(matches, fullName) : undefined),
    [matches, fullName]
  );
  return { data: figures, isLoading };
}

// Colors here deliberately match the reference screenshots pixel-for-pixel
// (per explicit instruction) rather than this app's green palette — this is
// the one screen on the app where that's intentional.
const PANEL = {
  bat: { header: "#8C5E82", body: "#EFE0F2", text: "#4A2F47" },
  bowl: { header: "#3E6B5C", body: "#DEF2E3", text: "#2C4A3D" },
  field: { header: "#BD6B45", body: "#FBE4D1", text: "#7A4426" },
};

function StatPanel({
  title,
  color,
  rows,
}: {
  title: string;
  color: { header: string; body: string; text: string };
  rows: { label: string; value: string }[];
}) {
  return (
    <View className="flex-1 rounded-2xl overflow-hidden" style={cardShadow}>
      <View className="py-2 items-center" style={{ backgroundColor: color.header }}>
        <Text className="text-jazba-white font-bold text-xs">{title}</Text>
      </View>
      <View style={{ backgroundColor: color.body }}>
        {rows.map((r, i) => (
          <View key={r.label} className="items-center py-3" style={i > 0 ? { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" } : undefined}>
            <Text className="font-extrabold" style={{ color: color.text, fontSize: 20 }}>
              {r.value}
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: color.text, opacity: 0.8 }}>
              {r.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TogglePill({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row self-start rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
      {options.map((o) =>
        value === o ? (
          <Pressable key={o} onPress={() => onChange(o)}>
            <GradientFill className="px-4 py-1.5">
              <Text className="text-xs font-bold text-jazba-white">{o}</Text>
            </GradientFill>
          </Pressable>
        ) : (
          <Pressable key={o} onPress={() => onChange(o)} className="px-4 py-1.5">
            <Text className="text-xs font-bold" style={{ color: colors.inkSecondary }}>
              {o}
            </Text>
          </Pressable>
        )
      )}
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

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <View className="flex-row py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View className="flex-1" />
      {cols.map((c) => (
        <Text key={c} className="text-muted text-xs font-bold text-center" style={{ width: 64 }}>
          {c}
        </Text>
      ))}
    </View>
  );
}

export default function PlayerCricketOverview({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const { data: figures, isLoading } = usePlayerCricketFigures(fullName, sportId);
  const [yearlyTab, setYearlyTab] = useState<"Batting" | "Bowling">("Batting");
  const [opponentTab, setOpponentTab] = useState<"Batting" | "Bowling">("Batting");
  const [formPage, setFormPage] = useState(0);

  if (isLoading) {
    return <View className="mt-4"><SkeletonCardRows count={3} /></View>;
  }
  if (!figures || figures.length === 0) return null;

  const bat = aggregateBatting(figures);
  const bowl = aggregateBowling(figures);
  const field = aggregateFielding(figures);
  const yearly = yearlyOverview(figures);
  const opponents = bestAgainstTeam(figures);

  const PAGE_SIZE = 5;
  const formWindow = figures.slice(formPage * PAGE_SIZE, formPage * PAGE_SIZE + PAGE_SIZE);
  const formEntries = recentForm(formWindow, PAGE_SIZE);
  const hasOlder = (formPage + 1) * PAGE_SIZE < figures.length;
  const hasNewer = formPage > 0;

  return (
    <View>
      <View className="flex-row" style={{ gap: 10 }}>
        <StatPanel
          title="Batting"
          color={PANEL.bat}
          rows={[
            { label: "Runs", value: String(bat.runs) },
            { label: "Average", value: bat.average.toFixed(1) },
            { label: "High Score", value: `${bat.highScore}${bat.highScoreNotOut ? "*" : ""}` },
          ]}
        />
        <StatPanel
          title="Bowling"
          color={PANEL.bowl}
          rows={[
            { label: "Wickets", value: String(bowl.wickets) },
            { label: "Average", value: bowl.wickets > 0 ? bowl.average.toFixed(1) : "0.0" },
            { label: "Best Bowling", value: bowl.innings > 0 ? `${bowl.bestWickets}-${bowl.bestRuns}` : "-" },
          ]}
        />
        <StatPanel
          title="Fielding"
          color={PANEL.field}
          rows={[
            { label: "Catches", value: String(field.catches) },
            { label: "Stumpings", value: String(field.stumpings) },
            { label: "Runouts", value: String(field.runouts) },
          ]}
        />
      </View>

      <Text className="text-ink font-bold text-base mt-6 mb-3">Recent Form</Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <GradientFill className="items-center justify-center rounded-full" style={{ width: 44, height: 44 }}>
          <Text className="text-jazba-white font-bold text-xs">Bat</Text>
        </GradientFill>
        {formEntries.map((f) => (
          <View key={`${f.matchId}-bat`} className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: colors.border }}>
            <Text className="font-bold text-xs" style={{ color: colors.ink }}>
              {f.bat}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
        <GradientFill className="items-center justify-center rounded-full" style={{ width: 44, height: 44 }}>
          <Text className="text-jazba-white font-bold text-xs">Bowl</Text>
        </GradientFill>
        {formEntries.map((f) => (
          <View key={`${f.matchId}-bowl`} className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: colors.border }}>
            <Text className="font-bold text-xs" style={{ color: colors.ink }}>
              {f.bowl}
            </Text>
          </View>
        ))}
      </View>
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

      <SectionCard title="Yearly Overview">
        <TogglePill options={["Batting", "Bowling"]} value={yearlyTab} onChange={(v) => setYearlyTab(v as "Batting" | "Bowling")} />
        <View className="mt-3">
          <TableHeader cols={yearlyTab === "Batting" ? ["Runs", "Avg", "HS"] : ["Wkts", "Econ", "Best"]} />
          {[yearly.thisYear, yearly.lastYear].map((row) => (
            <View key={row.label} className="flex-row items-center py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text className="flex-1 text-ink text-sm font-semibold">{row.label}</Text>
              {yearlyTab === "Batting" ? (
                <>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.runs}</Text>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.average.toFixed(1)}</Text>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.highScore}</Text>
                </>
              ) : (
                <>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.wickets}</Text>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.economy.toFixed(1)}</Text>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.bestBowling}</Text>
                </>
              )}
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Best Against Team">
        <TogglePill options={["Batting", "Bowling"]} value={opponentTab} onChange={(v) => setOpponentTab(v as "Batting" | "Bowling")} />
        <View className="mt-3">
          <TableHeader cols={opponentTab === "Batting" ? ["Runs", "Inn", "SR"] : ["Wkts", "Econ"]} />
          {(opponentTab === "Batting" ? opponents.batting : opponents.bowling).map((row) => (
            <View key={row.teamName} className="flex-row items-center py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text className="flex-1 text-ink text-sm font-semibold" numberOfLines={1}>{row.teamName.toUpperCase()}</Text>
              {opponentTab === "Batting" ? (
                <>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.runs}</Text>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.innings}</Text>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.strikeRate.toFixed(1)}</Text>
                </>
              ) : (
                <>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.wickets}</Text>
                  <Text className="text-ink text-sm text-center" style={{ width: 64 }}>{row.economy.toFixed(1)}</Text>
                </>
              )}
            </View>
          ))}
          {(opponentTab === "Batting" ? opponents.batting : opponents.bowling).length === 0 ? (
            <Text className="text-muted text-sm py-3 text-center">No matches yet</Text>
          ) : null}
        </View>
      </SectionCard>
    </View>
  );
}
