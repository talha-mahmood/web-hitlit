import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useMyTableTennisMatches, useDeleteTableTennisMatch } from "../../hooks/useTableTennis";
import { findTableTennisMatchByCode, friendlyTableTennisError, rallyRowToEvent, type TableTennisMatchDetail } from "../../lib/api/tableTennis";
import ViewScoringPanel from "../../components/ViewScoringPanel";
import { replayTableTennisMatch, type TableTennisMatchConfig, type Team } from "../../lib/tableTennisScoring";
import Bouncy from "../../components/Bouncy";
import TeamCrest from "../../components/TeamCrest";
import GradientFill from "../../components/GradientFill";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "TableTennisHome">;
type TabKey = "all" | "live" | "completed" | "view";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Matches" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "view", label: "View Scoring" },
];

export function computeMatchState(match: TableTennisMatchDetail) {
  const config: TableTennisMatchConfig = {
    playMode: match.play_mode as TableTennisMatchConfig["playMode"],
    firstServingTeam: match.first_serving_team as Team,
    firstServerIndex: match.first_server_index as 0 | 1,
    pointsToWin: match.points_to_win,
    gamesToWin: match.games_to_win,
  };
  const rallies = [...match.table_tennis_rallies].sort((a, b) => a.seq - b.seq).map(rallyRowToEvent);
  return replayTableTennisMatch(rallies, config);
}

function MatchCard({
  match,
  onPress,
  onDelete,
}: {
  match: TableTennisMatchDetail;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isLive = match.status === "IN_PROGRESS";
  const state = useMemo(() => computeMatchState(match), [match]);
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
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 20 }}
    >
      <View className="rounded-[20px] bg-white overflow-hidden" style={{ position: "relative" }}>
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
            {isLive ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "white" }} /> : null}
            <Text className={`text-xs font-bold ${isLive ? "text-white" : "text-green-700"}`}>
              {isLive ? "LIVE" : "COMPLETED"}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Text className="text-muted text-sm">{match.play_mode === "DOUBLES" ? "Doubles" : "Singles"}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </View>
        </View>

        <View className="flex-row items-center justify-between px-6 pb-3">
          <View className="items-center" style={{ width: 76 }}>
            <TeamCrest color={colors.primary} size={52} icon="table-tennis" />
            <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>
              {match.team_a_name}
            </Text>
          </View>

          <View className="items-center flex-1">
            <Text className="text-ink font-extrabold" style={{ fontSize: 30 }}>
              {state.gamesWonA} - {state.gamesWonB}
            </Text>
            <Text className="text-muted text-xs mt-0.5">
              {state.games.map((g) => `${g.scoreA}-${g.scoreB}`).join("  ")}
            </Text>
          </View>

          <View className="items-center" style={{ width: 76 }}>
            <TeamCrest color="#1D4ED8" size={52} icon="table-tennis" />
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

export default function TableTennisHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: matches, isLoading, refetch, isRefetching } = useMyTableTennisMatches(userId);
  const deleteMatch = useDeleteTableTennisMatch();
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const handleDelete = (match: TableTennisMatchDetail) => {
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
              onError: (err) => Alert.alert("Error", friendlyTableTennisError(err, "Could not delete match.")),
            }),
        },
      ]
    );
  };

  const handleLookupScoringCode = async (code: string) => {
    const result = await findTableTennisMatchByCode(code);
    if (result) navigation.navigate("TableTennisLiveScoring", { matchId: result.id });
    return result?.id ?? null;
  };

  const allMatches = matches ?? [];
  const filteredMatches = allMatches.filter((m) => {
    if (activeTab === "live") return m.status === "IN_PROGRESS";
    if (activeTab === "completed") return m.status === "COMPLETED";
    return true;
  });

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-3.5 mb-4" style={{ gap: 8 }}>
        <Pressable onPress={() => navigation.navigate("ScorecardHome")} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">Table Tennis</Text>
          <Text className="text-muted text-sm mt-0.5">Track and manage matches</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("TableTennisNewMatch")} style={primaryButtonShadow}>
          <GradientFill className="flex-row items-center rounded-full px-4 py-2.5" style={{ gap: 6 }}>
            <Ionicons name="add" size={18} color="white" />
            <Text className="text-white font-bold text-sm">New Match</Text>
          </GradientFill>
        </Pressable>
      </View>

      <View className="px-3.5 mb-4">
        <View className="flex-row items-center bg-white rounded-2xl p-1.5" style={cardShadow}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className="flex-1 flex-row items-center justify-center rounded-xl py-2"
                style={{ gap: 5, backgroundColor: selected ? colors.primaryLight : "transparent" }}
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
                    <Text className="text-white font-bold" style={{ fontSize: 10 }}>
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
        <ActivityIndicator color={colors.primary} className="mt-8" />
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
                  name="table-tennis"
                  size={110}
                  color={colors.primaryDark}
                  style={{ opacity: 0.85, transform: [{ rotate: "-12deg" }] }}
                />
              </View>
              <Text className="text-ink font-bold text-lg mt-2">No more matches yet</Text>
              <Text className="text-muted text-sm text-center px-10">
                Create a new match to start keeping score{"\n"}and track your games here.
              </Text>
              <Pressable onPress={() => navigation.navigate("TableTennisNewMatch")} style={primaryButtonShadow}>
                <GradientFill className="flex-row items-center rounded-full px-6 py-3.5 mt-3" style={{ gap: 8 }}>
                  <Ionicons name="add" size={18} color="white" />
                  <Text className="text-white font-bold text-sm">New Match</Text>
                </GradientFill>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              onPress={() => navigation.navigate("TableTennisLiveScoring", { matchId: item.id })}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}
    </View>
  );
}
