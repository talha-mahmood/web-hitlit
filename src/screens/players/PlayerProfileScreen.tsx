import { useState } from "react";
import { View, Text, Image, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { usePlayerPublicProfile } from "../../hooks/usePlayers";
import { useFollowState, useToggleFollow } from "../../hooks/usePlayerFollows";
import { useAuthStore } from "../../store/authStore";
import { useSports } from "../../hooks/useSports";
import { computeRating, computeRankingRating, getRatingTierInfo } from "../../lib/playerRating";
import { getSportIcon } from "../../lib/sportIcons";
import { colors, cardShadow } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import Bouncy from "../../components/Bouncy";
import SelectSportModal from "../../components/SelectSportModal";
import PlayerStatCards from "../../components/PlayerStatCards";
import JerseyNumberCard from "../../components/JerseyNumberCard";
import PlayerCricketOverview, { usePlayerCricketFigures } from "../../components/PlayerCricketOverview";
import PlayerCricketStatistics from "../../components/PlayerCricketStatistics";
import PlayerCricketMatches from "../../components/PlayerCricketMatches";
import PlayerCricketTeams from "../../components/PlayerCricketTeams";
import PlayerCricketTournaments from "../../components/PlayerCricketTournaments";
import PlayerCricketClubs from "../../components/PlayerCricketClubs";
import PlayerCricketInsights from "../../components/PlayerCricketInsights";
import PlayerCricketCompare from "../../components/PlayerCricketCompare";
import PlayerSportOverview, { usePlayerGenericFigures } from "../../components/PlayerSportOverview";
import PlayerSportStatistics from "../../components/PlayerSportStatistics";
import PlayerSportMatches from "../../components/PlayerSportMatches";
import PlayerSportTeams from "../../components/PlayerSportTeams";
import PlayerSportTournaments from "../../components/PlayerSportTournaments";
import PlayerSportClubs from "../../components/PlayerSportClubs";
import PlayerSportInsights from "../../components/PlayerSportInsights";
import PlayerSportCompare from "../../components/PlayerSportCompare";
import { classifySportKind, type GenericSport } from "../../lib/genericSportStats";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";

export type ProfileTab = "profile" | "overview" | "statistics" | "matches" | "teams" | "tournaments" | "clubs" | "insights" | "compare";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;
type Route = RouteProp<HomeStackParamList, "PlayerProfile">;

export default function PlayerProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const viewerId = useAuthStore((s) => s.session?.user.id);
  // If the list this was opened from had no sport filter on, tapping a
  // "Sports Played" card below applies that one sport's filter right here
  // instead — tapping the same one again clears it back to unfiltered.
  const [filterSportId, setFilterSportId] = useState(route.params.sportId);
  const [filterSportName, setFilterSportName] = useState(route.params.sportName);
  const { data: player, isLoading, refetch, isRefetching } = usePlayerPublicProfile(route.params.userId, filterSportId);
  // The "Filter By Sports" list is the sport selector, so it always lists every
  // sport (the filtered profile above only returns the selected one).
  const { data: allSportsProfile } = usePlayerPublicProfile(route.params.userId);
  const { data: followState } = useFollowState(viewerId, route.params.userId);
  const toggleFollow = useToggleFollow(route.params.userId, viewerId);
  const isOwnProfile = viewerId === route.params.userId;
  const { data: cricketFigures } = usePlayerCricketFigures(player?.fullName);
  const hasCricketData = !!cricketFigures && cricketFigures.length > 0;
  // Which sport's tabs to show: whatever's explicitly filtered, else cricket
  // if this player has any (preserving the original behavior), else their
  // most-played sport if it's one of the other scorecard sports. Basketball/
  // Squash/Volleyball have no scorecard module at all, so they resolve to
  // null — same as a player with no scorecard data of any kind.
  const resolvedSportKind: "cricket" | GenericSport | null = filterSportName
    ? classifySportKind(filterSportName)
    : hasCricketData
      ? "cricket"
      : classifySportKind(player?.sportBreakdown?.[0]?.sportName);
  const genericSport: GenericSport | null = resolvedSportKind && resolvedSportKind !== "cricket" ? resolvedSportKind : null;
  const { data: genericFigures } = usePlayerGenericFigures(genericSport, player?.fullName);
  const hasGenericData = !!genericFigures && genericFigures.length > 0;
  const hasActiveSportData = resolvedSportKind === "cricket" ? hasCricketData : resolvedSportKind ? hasGenericData : false;
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const { data: allSports } = useSports();

  const handleSelectSportCard = (sportId: string, sportName: string) => {
    if (filterSportId === sportId) {
      setFilterSportId(undefined);
      setFilterSportName(undefined);
    } else {
      setFilterSportId(sportId);
      setFilterSportName(sportName);
    }
  };

  const matchesWon = player?.matchesWonTotal ?? 0;
  const matchesPlayed = player?.matchesPlayedTotal ?? 0;
  // Participation Score: the old activity-based number (games, tournaments,
  // hosting) — shown on its own card.
  const participationScore = computeRating(player);
  // RATING: 70% Games Win percentage + 30% scored games played — the same
  // number the Top Players list ranks by.
  const rating = computeRankingRating(player);
  const tier = getRatingTierInfo(rating);
  const heroSportIcon = player?.sportBreakdown?.[0]
    ? getSportIcon(player.sportBreakdown[0].sportName).icon
    : "trophy-outline";

  return (
    <View className="flex-1 bg-white">
      {/* Hero */}
      <View
        style={{
          backgroundColor: "#E3F6EA",
          paddingTop: insets.top + 12,
          paddingHorizontal: 14,
          paddingBottom: 26,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >
        <MaterialCommunityIcons
          name={heroSportIcon}
          size={150}
          color={colors.primaryDark}
          style={{ position: "absolute", right: -26, top: 28, opacity: 0.1, transform: [{ rotate: "-8deg" }] }}
        />

        <View className="flex-row items-center mb-5">
          <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Bouncy>
          <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
            {player?.fullName ?? "Player Profile"}
          </Text>
        </View>

        <View className="flex-row items-center">
          <View className="relative mr-4">
            {player?.avatar ? (
              <Image
                source={{ uri: player.avatar }}
                style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: "white" }}
              />
            ) : (
              <GradientFill
                className="items-center justify-center"
                style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: "white" }}
              >
                <Text className="text-3xl font-bold text-white">
                  {(player?.fullName ?? "?").charAt(0).toUpperCase()}
                </Text>
              </GradientFill>
            )}
            <View
              className="absolute items-center justify-center bg-white rounded-full"
              style={{ width: 30, height: 30, bottom: -2, right: -2, borderWidth: 2, borderColor: "white", ...cardShadow }}
            >
              <MaterialCommunityIcons name="crown" size={16} color={tier.color} />
            </View>
          </View>
          <View className="flex-1">
            <Text className="font-extrabold text-ink" style={{ fontSize: 22 }} numberOfLines={1}>
              {player?.fullName ?? "Player"}
            </Text>
            {player?.userCode ? (
              <Text className="text-muted text-xs mt-1" numberOfLines={1}>
                ID: {player.userCode}
              </Text>
            ) : null}
            <Text className="text-muted text-xs mt-1">Play Together, Stay Active</Text>
            <View className="flex-row items-center flex-wrap mt-2" style={{ gap: 8 }}>
              <View
                className="flex-row items-center self-start rounded-full px-3 py-1"
                style={{ backgroundColor: tier.bg, gap: 5 }}
              >
                <MaterialCommunityIcons name="crown" size={14} color={tier.color} />
                <Text className="text-xs font-bold" style={{ color: tier.color }}>
                  {tier.label}
                </Text>
              </View>

              {/* Sport filter — opens the same sport-select sheet the Top
                  Players list's filter icon opens, shown as a dropdown pill
                  right here (filling the space under the name) instead of a
                  bare icon floating under the Follow button. */}
              <Pressable onPress={() => setSportSheetOpen(true)} className="self-start">
                <GradientFill className="flex-row items-center rounded-full px-3 py-1" style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-white" numberOfLines={1}>
                    {filterSportName ?? "All Sports"}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color="white" />
                </GradientFill>
              </Pressable>
            </View>
          </View>
          {!isOwnProfile && (
            <Pressable
              onPress={() => toggleFollow.mutate(!followState?.isFollowing)}
              disabled={toggleFollow.isPending || !viewerId}
            >
              {followState?.isFollowing ? (
                <View
                  className="flex-row items-center rounded-full px-4 py-2"
                  style={{ gap: 6, backgroundColor: "white", borderWidth: 1, borderColor: colors.border }}
                >
                  {toggleFollow.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color={colors.primaryDark} />
                      <Text className="text-sm font-bold" style={{ color: colors.primaryDark }}>
                        Following
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                <GradientFill className="flex-row items-center rounded-full px-4 py-2" style={{ gap: 6 }}>
                  {toggleFollow.isPending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="add" size={16} color="white" />
                      <Text className="text-sm font-bold" style={{ color: "white" }}>
                        Follow
                      </Text>
                    </>
                  )}
                </GradientFill>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <SelectSportModal
        visible={sportSheetOpen}
        onClose={() => setSportSheetOpen(false)}
        sports={allSports ?? []}
        selectedSportId={filterSportId}
        onApply={(id) => {
          const match = id ? (allSports ?? []).find((s) => s.id === id) : undefined;
          setFilterSportId(id);
          setFilterSportName(match?.name);
          setSportSheetOpen(false);
        }}
      />

      {isLoading || !player ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <>
          {hasActiveSportData ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-grow-0"
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}
            >
              {([
                ["profile", "Player Profile"],
                ["overview", "Player Overview"],
                ["statistics", "Statistics"],
                ["matches", "Matches"],
                ["teams", "Teams"],
                ["tournaments", "Tournaments"],
                ["clubs", "Clubs"],
                ["insights", "Insights"],
                ["compare", "Compare"],
              ] as [ProfileTab, string][]).map(([key, label]) =>
                activeTab === key ? (
                  <Pressable key={key} onPress={() => setActiveTab(key)}>
                    <GradientFill className="rounded-full px-4 py-2">
                      <Text className="text-xs font-bold text-white">{label}</Text>
                    </GradientFill>
                  </Pressable>
                ) : (
                  <Pressable
                    key={key}
                    onPress={() => setActiveTab(key)}
                    className="rounded-full px-4 py-2"
                    style={{ backgroundColor: "#E5E7EB" }}
                  >
                    <Text className="text-xs font-bold" style={{ color: "#374151" }}>
                      {label}
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>
          ) : null}

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingTop: hasActiveSportData ? 0 : 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          >
            {activeTab !== "profile" && resolvedSportKind === "cricket" && player.fullName ? (
              <>
                {activeTab === "overview" && <PlayerCricketOverview fullName={player.fullName} />}
                {activeTab === "statistics" && <PlayerCricketStatistics fullName={player.fullName} />}
                {activeTab === "matches" && <PlayerCricketMatches fullName={player.fullName} />}
                {activeTab === "teams" && <PlayerCricketTeams fullName={player.fullName} />}
                {activeTab === "tournaments" && <PlayerCricketTournaments fullName={player.fullName} />}
                {activeTab === "clubs" && <PlayerCricketClubs userId={route.params.userId} />}
                {activeTab === "insights" && <PlayerCricketInsights fullName={player.fullName} />}
                {activeTab === "compare" && (
                  <PlayerCricketCompare fullName={player.fullName} displayName={player.fullName} />
                )}
              </>
            ) : activeTab !== "profile" && genericSport && player.fullName ? (
              <>
                {activeTab === "overview" && <PlayerSportOverview sport={genericSport} fullName={player.fullName} />}
                {activeTab === "statistics" && <PlayerSportStatistics sport={genericSport} fullName={player.fullName} />}
                {activeTab === "matches" && <PlayerSportMatches sport={genericSport} fullName={player.fullName} />}
                {activeTab === "teams" && <PlayerSportTeams sport={genericSport} fullName={player.fullName} />}
                {activeTab === "tournaments" && <PlayerSportTournaments sport={genericSport} fullName={player.fullName} />}
                {activeTab === "clubs" && <PlayerSportClubs sport={genericSport} userId={route.params.userId} />}
                {activeTab === "insights" && <PlayerSportInsights sport={genericSport} fullName={player.fullName} />}
                {activeTab === "compare" && (
                  <PlayerSportCompare sport={genericSport} fullName={player.fullName} displayName={player.fullName} />
                )}
              </>
            ) : (
              // "Player Profile" tab, and the only thing shown for players
              // with no scorecard data for the resolved sport (the tab bar
              // above is hidden for them, so activeTab never moves off its
              // "profile" default).
              <PlayerStatCards
                data={{
                  rating,
                  gamesPlayed: player.gamesPlayedTotal,
                  tournamentsPlayed: player.tournamentsPlayedTotal,
                  gamesHosted: player.gamesHostedTotal,
                  activeSquads: player.activeSquads,
                  hoursPlayed: player.hoursPlayedTotal,
                  participationScore,
                  followerCount: followState?.followerCount ?? 0,
                  regularGamesPlayed: player.regularGamesPlayed,
                  matchesWon,
                  matchesPlayed,
                  sportSegments: player.sportBreakdown.map((sp) => ({
                    label: sp.sportName,
                    value: sp.count,
                    color: getSportIcon(sp.sportName).fg,
                  })),
                  totals: { runs: player.totalRuns, wickets: player.totalWickets, goals: player.totalGoals },
                }}
                filterSportId={filterSportId}
                filterSportName={filterSportName}
                sportsPlayed={allSportsProfile?.sportBreakdown ?? []}
                onSelectSport={handleSelectSportCard}
                hideSportsFilter
              />
            )}

            {player.jerseyNumber != null && <JerseyNumberCard number={player.jerseyNumber} />}
          </ScrollView>
        </>
      )}
    </View>
  );
}
