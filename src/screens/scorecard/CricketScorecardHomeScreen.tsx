import { useState } from "react";
import { View, Text, Pressable, FlatList, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useMyCricketMatches, useDeleteCricketMatch } from "../../hooks/useCricket";
import { friendlyCricketError, ballRowToEvent, findCricketMatchByCode, type CricketMatchDetail } from "../../lib/api/cricket";
import { replayInnings, formatOvers } from "../../lib/cricketScoring";
import Bouncy from "../../components/Bouncy";
import TeamCrest from "../../components/TeamCrest";
import GradientFill from "../../components/GradientFill";
import ViewScoringPanel from "../../components/ViewScoringPanel";
import { SkeletonCardRows } from "../../components/Skeleton";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "CricketHome">;
type TabKey = "all" | "live" | "completed" | "view";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Matches" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "view", label: "View Scoring" },
];

// The host picks the real format (T10/T20/One Day/Club Cricket) at match
// creation — this just maps the stored value to its short list-badge label.
function formatTag(format: string): string {
  if (format === "ODI") return "OD";
  return format;
}

// Score of whichever innings is currently (or was last) batting — derived
// from the same pure ball-by-ball engine the live scorer uses, replayed off
// the real recorded balls, so this is never approximated or faked.
function computeInningsScore(match: CricketMatchDetail) {
  if (match.cricket_innings.length === 0) return null;
  const innings = [...match.cricket_innings].sort((a, b) => a.innings_number - b.innings_number).at(-1)!;
  const balls = [...innings.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
  const battingTeam = innings.batting_team as "A" | "B";
  const totalPlayers = (battingTeam === "A" ? match.team_a_players.length : match.team_b_players.length) || 11;
  const state = replayInnings(
    balls,
    battingTeam,
    match.overs_limit,
    totalPlayers,
    balls[0]?.strikerName ?? "",
    balls[0]?.nonStrikerName ?? "",
    0,
    match.last_man_stand
  );
  return { runs: state.runs, wickets: state.wickets, oversLabel: formatOvers(state.legalBalls) };
}

function MatchCard({
  match,
  onPress,
  onDelete,
}: {
  match: CricketMatchDetail;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isLive = match.status === "IN_PROGRESS";
  const score = computeInningsScore(match);
  const dateLabel = new Date(match.created_at).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Bouncy
      onPress={onPress}
      onLongPress={onDelete}
      scaleTo={0.98}
      style={{ ...cardShadow, backgroundColor: colors.surface, borderRadius: 20 }}
    >
      <View className="rounded-[20px] bg-surface overflow-hidden" style={{ position: "relative" }}>
        {/* Corner accent triangles, team-colored — same as the football screens */}
        <View
          style={{
            position: "absolute", top: 0, left: 0, width: 0, height: 0,
            borderTopWidth: 34, borderRightWidth: 34,
            borderTopColor: colors.primary, borderRightColor: "transparent",
          }}
        />
        <View
          style={{
            position: "absolute", top: 0, right: 0, width: 0, height: 0,
            borderTopWidth: 34, borderLeftWidth: 34,
            borderTopColor: "#1D4ED8", borderLeftColor: "transparent",
          }}
        />

        <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
          <View className={`flex-row items-center px-2.5 py-1 rounded-full ${isLive ? "bg-red-500" : "bg-green-50"}`} style={{ gap: 5 }}>
            {isLive ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink }} /> : null}
            <Text className={`text-xs font-bold ${isLive ? "text-jazba-white" : "text-green-700"}`}>
              {isLive ? "LIVE" : "COMPLETED"}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Text className="text-muted text-sm">{match.overs_limit} overs</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </View>
        </View>

        <View className="flex-row items-center justify-between px-6 pb-3">
          <View className="items-center" style={{ width: 76 }}>
            <TeamCrest color={colors.primary} size={52} icon="cricket" />
            <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>
              {match.team_a_name}
            </Text>
          </View>

          <View className="items-center flex-1">
            <Text className="text-ink font-extrabold" style={{ fontSize: 30 }}>
              {score ? `${score.runs} - ${score.wickets}` : "0 - 0"}
            </Text>
            <Text className="text-muted text-xs mt-0.5">{score ? `${score.oversLabel} overs` : "0.0 overs"}</Text>
            <View className="rounded-full px-2.5 py-0.5 mt-1.5" style={{ backgroundColor: colors.primaryLight }}>
              <Text className="text-xs font-bold" style={{ color: colors.primaryDark }}>
                {formatTag(match.format)}
              </Text>
            </View>
          </View>

          <View className="items-center" style={{ width: 76 }}>
            <TeamCrest color="#1D4ED8" size={52} icon="cricket" />
            <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>
              {match.team_b_name}
            </Text>
          </View>
        </View>

        {!isLive && match.result_summary ? (
          <Text className="text-primary text-xs font-semibold text-center pb-2" numberOfLines={1}>
            {match.result_summary}
          </Text>
        ) : null}

        <View className="h-px bg-border" />

        <View className="flex-row items-center px-4 py-3" style={{ gap: 8 }}>
          <Ionicons name="calendar-outline" size={15} color={colors.muted} />
          <Text className="text-muted text-sm">{dateLabel}</Text>
          {match.venue ? (
            <>
              <View style={{ width: 1, height: 14, backgroundColor: colors.border }} />
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text className="text-muted text-sm flex-1" numberOfLines={1}>
                {match.venue}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Bouncy>
  );
}

export default function CricketScorecardHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: matches, isLoading, refetch, isRefetching } = useMyCricketMatches(userId);
  const deleteMatch = useDeleteCricketMatch();
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const handleDelete = (match: CricketMatchDetail) => {
    Alert.alert(
      "Delete Match",
      `Delete the scorecard for ${match.team_a_name} vs ${match.team_b_name}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteMatch.mutate(match.id, {
              onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not delete match.")),
            }),
        },
      ]
    );
  };

  const handleLookupScoringCode = async (code: string) => {
    const result = await findCricketMatchByCode(code);
    // LiveScoring now covers both live and finished matches (read-only for
    // anyone who isn't the match's scorer) — no more separate screen to
    // send a code-lookup viewer to.
    if (result) navigation.navigate("LiveScoring", { matchId: result.id });
    return result?.id ?? null;
  };

  const allMatches = matches ?? [];
  const filteredMatches = allMatches.filter((m) => {
    if (activeTab === "live") return m.status === "IN_PROGRESS";
    if (activeTab === "completed") return m.status === "COMPLETED";
    return true;
  });

  return (
    <View className="flex-1 bg-app" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-3.5 mb-4" style={{ gap: 8 }}>
        <Pressable onPress={() => navigation.navigate("ScorecardHome")} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">Cricket</Text>
          <Text className="text-muted text-sm mt-0.5">Track and manage matches</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("NewMatch")}
          style={primaryButtonShadow}
        >
          <GradientFill className="flex-row items-center rounded-full px-4 py-2.5" style={{ gap: 6 }}>
            <Ionicons name="add" size={18} color="white" />
            <Text className="text-jazba-white font-bold text-sm">New Match</Text>
          </GradientFill>
        </Pressable>
      </View>

      <View className="px-3.5 mb-4">
        <View className="flex-row items-center bg-surface rounded-2xl p-1.5" style={cardShadow}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className="flex-1 flex-row items-center justify-center rounded-xl py-2"
                style={{ gap: 5, borderBottomWidth: 3, borderBottomColor: selected ? colors.primary : "transparent" }}
              >
                {tab.key === "live" ? (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" }} />
                ) : null}
                <Text
                  className={`text-xs ${selected ? "font-bold" : "font-medium"}`}
                  style={{ color: selected ? colors.primaryDark : colors.muted }}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                {tab.key === "all" && allMatches.length > 0 ? (
                  <GradientFill
                    className="items-center justify-center rounded-full"
                    style={{ minWidth: 16, height: 16, paddingHorizontal: 3 }}
                  >
                    <Text className="text-jazba-white font-bold" style={{ fontSize: 10 }}>
                      {allMatches.length}
                    </Text>
                  </GradientFill>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {activeTab === "view" ? (
        <ViewScoringPanel onLookup={handleLookupScoringCode} />
      ) : isLoading ? (
        <View className="px-5">
          <SkeletonCardRows />
        </View>
      ) : (
        <FlatList
          data={filteredMatches}
          // Keyed by status too so a card that flips LIVE -> COMPLETED while this
          // screen is covered by Live Scoring remounts fresh, and clipped-subview
          // recycling is off — otherwise Android can leave that card drawn blank.
          keyExtractor={(item) => `${item.id}:${item.status}`}
          removeClippedSubviews={false}
          contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 14 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListFooterComponent={
            <View className="items-center" style={{ gap: 4, marginTop: filteredMatches.length > 0 ? 24 : 64 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 200, height: 200, backgroundColor: colors.primaryLight, opacity: 0.5 }}
              >
                <Ionicons
                  name="sparkles"
                  size={16}
                  color={colors.primaryDark}
                  style={{ position: "absolute", top: 34, left: 46, opacity: 0.7 }}
                />
                <Ionicons
                  name="sparkles"
                  size={12}
                  color={colors.primaryDark}
                  style={{ position: "absolute", bottom: 46, right: 40, opacity: 0.6 }}
                />
                <MaterialCommunityIcons
                  name="cricket"
                  size={110}
                  color={colors.primaryDark}
                  style={{ opacity: 0.85, transform: [{ rotate: "-12deg" }] }}
                />
              </View>
              <Text className="text-ink font-bold text-lg mt-2">No more matches yet</Text>
              <Text className="text-muted text-sm text-center px-10">
                Create a new match to start keeping score{"\n"}and track your games here.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("NewMatch")}
                style={primaryButtonShadow}
              >
                <GradientFill className="flex-row items-center rounded-full px-6 py-3.5 mt-3" style={{ gap: 8 }}>
                  <Ionicons name="add" size={18} color="white" />
                  <Text className="text-jazba-white font-bold text-sm">New Match</Text>
                </GradientFill>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              // LiveScoring is the one permanent destination now, live or
              // completed — it shows read-only once the match is over
              // instead of needing a separate screen.
              onPress={() => navigation.navigate("LiveScoring", { matchId: item.id })}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}
    </View>
  );
}
