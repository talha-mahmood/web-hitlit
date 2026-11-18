import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useMyFootballMatches, useDeleteFootballMatch } from "../../hooks/useFootball";
import { findFootballMatchByCode, friendlyFootballError, goalRowToEvent, type FootballMatchDetail } from "../../lib/api/football";
import ViewScoringPanel from "../../components/ViewScoringPanel";
import { SkeletonCardRows } from "../../components/Skeleton";
import { computeScoreSummary, type Phase } from "../../lib/footballScoring";
import Bouncy from "../../components/Bouncy";
import TeamCrest from "../../components/TeamCrest";
import GradientFill from "../../components/GradientFill";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "FootballHome">;
type TabKey = "all" | "live" | "completed" | "view";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Matches" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "view", label: "View Scoring" },
];

const PHASE_SHORT_LABEL: Partial<Record<Phase, string>> = {
  FIRST_HALF: "1st Half",
  HALF_TIME: "Half-Time",
  SECOND_HALF: "2nd Half",
  FULL_TIME: "Full-Time",
  EXTRA_TIME_FIRST: "Extra Time",
  EXTRA_TIME_BREAK: "Extra Time",
  EXTRA_TIME_SECOND: "Extra Time",
  EXTRA_TIME_FULL_TIME: "Extra Time",
  PENALTIES: "Penalties",
};

export function computeCurrentScore(match: FootballMatchDetail) {
  const goals = [...match.football_goals].sort((a, b) => a.seq - b.seq).map(goalRowToEvent);
  const summary = computeScoreSummary(goals, match.phase as Phase, !!match.extra_time_first_kickoff_at);
  return summary.current;
}

function MatchCard({
  match,
  onPress,
  onDelete,
}: {
  match: FootballMatchDetail;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isLive = match.status === "IN_PROGRESS";
  const score = useMemo(() => computeCurrentScore(match), [match]);
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
        {/* Corner accent triangles, team-colored — same as the live scoring screen */}
        <View
          style={{
            position: "absolute", top: 0, left: 0, width: 0, height: 0,
            borderTopWidth: 26, borderRightWidth: 26,
            borderTopColor: colors.primary, borderRightColor: "transparent",
          }}
        />
        <View
          style={{
            position: "absolute", top: 0, right: 0, width: 0, height: 0,
            borderTopWidth: 26, borderLeftWidth: 26,
            borderTopColor: "#1D4ED8", borderLeftColor: "transparent",
          }}
        />

        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <View className={`flex-row items-center px-2.5 py-1 rounded-full ${isLive ? "bg-red-500" : "bg-green-50"}`} style={{ gap: 5 }}>
            {isLive ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" }} /> : null}
            <Text className={`text-xs font-bold ${isLive ? "text-jazba-white" : "text-green-700"}`}>
              {isLive ? "LIVE" : "COMPLETED"}
            </Text>
          </View>
          {isLive && (
            <Text className="text-muted text-sm">{PHASE_SHORT_LABEL[match.phase as Phase] ?? ""}</Text>
          )}
        </View>

        <View className="flex-row items-center justify-between px-6 pb-2">
          <View className="items-center" style={{ width: 76 }}>
            <TeamCrest color={colors.primary} size={42} />
            <Text className="text-ink font-bold text-sm mt-1 text-center" numberOfLines={1}>
              {match.team_a_name}
            </Text>
          </View>

          <View className="items-center flex-1">
            <Text className="text-ink font-extrabold" style={{ fontSize: 25 }}>
              {score.a} - {score.b}
            </Text>
          </View>

          <View className="items-center" style={{ width: 76 }}>
            <TeamCrest color="#1D4ED8" size={42} />
            <Text className="text-ink font-bold text-sm mt-1 text-center" numberOfLines={1}>
              {match.team_b_name}
            </Text>
          </View>
        </View>

        {!isLive && match.result_summary ? (
          <Text className="text-primary text-xs font-semibold text-center pb-1" numberOfLines={1}>
            {match.result_summary}
          </Text>
        ) : null}

        <View className="h-px bg-border" />

        <View className="flex-row items-center px-4 py-2.5" style={{ gap: 8 }}>
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

export default function FootballHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: matches, isLoading, refetch, isRefetching } = useMyFootballMatches(userId);
  const deleteMatch = useDeleteFootballMatch();
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const handleDelete = (match: FootballMatchDetail) => {
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
              onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not delete match.")),
            }),
        },
      ]
    );
  };

  const handleLookupScoringCode = async (code: string) => {
    const result = await findFootballMatchByCode(code);
    if (result) navigation.navigate("FootballLiveScoring", { matchId: result.id });
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
          <Text className="text-2xl font-bold text-ink">Football</Text>
          <Text className="text-muted text-sm mt-0.5">Track and manage matches</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("FootballNewMatch")}
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
                  name="soccer"
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
                onPress={() => navigation.navigate("FootballNewMatch")}
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
              onPress={() => navigation.navigate("FootballLiveScoring", { matchId: item.id })}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}
    </View>
  );
}
