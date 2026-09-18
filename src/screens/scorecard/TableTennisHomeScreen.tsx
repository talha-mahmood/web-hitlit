import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useMyTableTennisMatches, useDeleteTableTennisMatch } from "../../hooks/useTableTennis";
import { friendlyTableTennisError, rallyRowToEvent, type TableTennisMatchDetail } from "../../lib/api/tableTennis";
import { replayTableTennisMatch, type TableTennisMatchConfig, type Team } from "../../lib/tableTennisScoring";
import Bouncy from "../../components/Bouncy";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "TableTennisHome">;
type TabKey = "all" | "live" | "completed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Matches" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
];

function computeMatchState(match: TableTennisMatchDetail) {
  const config: TableTennisMatchConfig = {
    playMode: match.play_mode as TableTennisMatchConfig["playMode"],
    format: match.format as TableTennisMatchConfig["format"],
    firstServingTeam: match.first_serving_team as Team,
    firstServerIndex: match.first_server_index as 0 | 1,
  };
  const rallies = [...match.table_tennis_rallies].sort((a, b) => a.seq - b.seq).map(rallyRowToEvent);
  return replayTableTennisMatch(rallies, config);
}

function TeamAvatar({ initial }: { initial: string }) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: 56, height: 56, backgroundColor: colors.primaryLight }}
    >
      <Text className="font-extrabold text-xl" style={{ color: colors.primaryDark }}>
        {initial}
      </Text>
    </View>
  );
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
      <View
        className="rounded-[20px] bg-white overflow-hidden"
        style={isLive ? { borderLeftWidth: 3, borderLeftColor: "#EF4444" } : undefined}
      >
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
          <View className="items-center" style={{ width: 72 }}>
            <TeamAvatar initial={match.team_a_name.charAt(0).toUpperCase() || "A"} />
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

          <View className="items-center" style={{ width: 72 }}>
            <TeamAvatar initial={match.team_b_name.charAt(0).toUpperCase() || "B"} />
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
  const { data: matches, isLoading } = useMyTableTennisMatches(userId);
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

  const allMatches = matches ?? [];
  const filteredMatches = allMatches.filter((m) => {
    if (activeTab === "live") return m.status === "IN_PROGRESS";
    if (activeTab === "completed") return m.status === "COMPLETED";
    return true;
  });

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-5 mb-4" style={{ gap: 8 }}>
        <Pressable onPress={() => navigation.navigate("ScorecardHome")} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">Table Tennis</Text>
          <Text className="text-muted text-sm mt-0.5">Track and manage all your matches</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("TableTennisNewMatch")}
          className="flex-row items-center bg-primary rounded-full px-4 py-2.5"
          style={{ gap: 6, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white font-bold text-sm">New Match</Text>
        </Pressable>
      </View>

      <View className="px-5 mb-4">
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
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ minWidth: 16, height: 16, paddingHorizontal: 3, backgroundColor: colors.primaryDark }}
                  >
                    <Text className="text-white font-bold" style={{ fontSize: 10 }}>
                      {allMatches.length}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={filteredMatches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 14 }}
          ListFooterComponent={
            <View className="items-center" style={{ gap: 4, marginTop: filteredMatches.length > 0 ? 24 : 64 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 200, height: 200, backgroundColor: "#FFEDD5", opacity: 0.5 }}
              >
                <MaterialCommunityIcons name="table-tennis" size={90} color="#C2410C" style={{ opacity: 0.85, transform: [{ rotate: "-12deg" }] }} />
              </View>
              <Text className="text-ink font-bold text-lg mt-2">No matches yet</Text>
              <Text className="text-muted text-sm text-center px-10">
                Create a new match to start keeping score{"\n"}and track your games here.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("TableTennisNewMatch")}
                className="flex-row items-center bg-primary rounded-full px-6 py-3.5 mt-3"
                style={{ gap: 8, ...primaryButtonShadow }}
              >
                <Ionicons name="add" size={18} color="white" />
                <Text className="text-white font-bold text-sm">New Match</Text>
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
