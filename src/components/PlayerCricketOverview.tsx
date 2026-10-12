import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
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

// Every match (any status) this player appears in — shared cache key so the
// Overview/Statistics/Matches tabs all reuse the same single fetch.
export function usePlayerCricketMatches(fullName: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["playerCricketMatches", fullName],
    queryFn: () => fetchPlayerCricketMatches(fullName as string),
    enabled: !!fullName,
    staleTime: 60_000,
  });

  // A player's matches are found by name appearing in team_a_players/
  // team_b_players (plain text[] columns) — Postgres realtime's filter
  // grammar doesn't reliably support "array contains" filters, so this
  // subscribes broadly (any cricket_matches/cricket_innings/cricket_balls
  // change) and invalidates, the same broad-then-invalidate shape
  // useProfileStats's own channel already uses. Only active while a
  // player's profile screen has this tab mounted.
  useEffect(() => {
    if (!fullName) return;
    const channel = supabase
      .channel(uniqueChannelName(`playerCricketMatches:${fullName}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_matches" }, () =>
        qc.invalidateQueries({ queryKey: ["playerCricketMatches", fullName] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_innings" }, () =>
        qc.invalidateQueries({ queryKey: ["playerCricketMatches", fullName] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_balls" }, () =>
        qc.invalidateQueries({ queryKey: ["playerCricketMatches", fullName] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fullName, qc]);

  return query;
}

export function usePlayerCricketFigures(fullName: string | null | undefined) {
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName);
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
  bat: { header: "#9B7A80", body: "#F7DEDE", text: "#5C3A3E" },
  bowl: { header: "#5F7D63", body: "#DCEFD7", text: "#355238" },
  field: { header: "#5E7489", body: "#D7E6F2", text: "#2E4A5E" },
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
        <Text className="text-white font-bold text-xs">{title}</Text>
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
    <View className="flex-row self-start rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} className="px-4 py-1.5" style={{ backgroundColor: value === o ? "#1F2937" : "transparent" }}>
          <Text className="text-xs font-bold" style={{ color: value === o ? "white" : "#374151" }}>
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 mt-5" style={cardShadow}>
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

export default function PlayerCricketOverview({ fullName }: { fullName: string }) {
  const { data: figures, isLoading } = usePlayerCricketFigures(fullName);
  const [yearlyTab, setYearlyTab] = useState<"Batting" | "Bowling">("Batting");
  const [opponentTab, setOpponentTab] = useState<"Batting" | "Bowling">("Batting");
  const [formPage, setFormPage] = useState(0);

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} className="mt-10" />;
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
        <View className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: "#111827" }}>
          <Text className="text-white font-bold text-xs">Bat</Text>
        </View>
        {formEntries.map((f) => (
          <View key={`${f.matchId}-bat`} className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: "#E5E7EB" }}>
            <Text className="font-bold text-xs" style={{ color: colors.ink }}>
              {f.bat}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
        <View className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: "#111827" }}>
          <Text className="text-white font-bold text-xs">Bowl</Text>
        </View>
        {formEntries.map((f) => (
          <View key={`${f.matchId}-bowl`} className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: "#E5E7EB" }}>
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
