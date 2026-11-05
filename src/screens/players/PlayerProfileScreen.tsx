import { useState } from "react";
import { View, Text, Image, ScrollView, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { usePlayerPublicProfile } from "../../hooks/usePlayers";
import { useFollowState, useToggleFollow } from "../../hooks/usePlayerFollows";
import { useBlockUser, useReportMessage } from "../../hooks/useModeration";
import { showReportBlockActions } from "../../lib/moderationActions";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
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
import PlayerTeamSquadsList from "../../components/PlayerTeamSquadsList";
import PlayerCricketTournaments from "../../components/PlayerCricketTournaments";
import PlayerCricketClubs from "../../components/PlayerCricketClubs";
import PlayerCricketInsights from "../../components/PlayerCricketInsights";
import PlayerCricketCompare from "../../components/PlayerCricketCompare";
import PlayerSportOverview, { usePlayerGenericFigures } from "../../components/PlayerSportOverview";
import PlayerSportStatistics from "../../components/PlayerSportStatistics";
import PlayerSportMatches from "../../components/PlayerSportMatches";
import PlayerSportTournaments from "../../components/PlayerSportTournaments";
import PlayerSportClubs from "../../components/PlayerSportClubs";
import PlayerSportInsights from "../../components/PlayerSportInsights";
import PlayerSportCompare from "../../components/PlayerSportCompare";
import { SkeletonDetailHeader } from "../../components/Skeleton";
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
  const reportMessage = useReportMessage();
  const blockUser = useBlockUser(viewerId);
  const isOwnProfile = viewerId === route.params.userId;

  // Report/Block for guideline 1.2 — there's no message here to attach the
  // report to, so source_id/context_id both reuse the only real id
  // available: the reported user's own profile id.
  const handleOpenProfileMenu = () => {
    if (!viewerId) return;
    showReportBlockActions({
      targetName: player?.fullName ?? "this player",
      onReport: (reason) => {
        reportMessage.mutate(
          {
            reporterId: viewerId,
            reportedUserId: route.params.userId,
            source: "profile",
            sourceId: route.params.userId,
            contextId: route.params.userId,
            messageSnapshot: "",
            reason,
          },
          {
            onSuccess: () => Alert.alert("Reported", "Thanks — we'll review this profile."),
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not submit report.")),
          }
        );
      },
      onBlock: () => {
        blockUser.mutate(route.params.userId, {
          onSuccess: () => navigation.goBack(),
          onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not block user.")),
        });
      },
    });
  };
  const { data: cricketFigures } = usePlayerCricketFigures(player?.fullName, filterSportId);
  const hasCricketData = !!cricketFigures && cricketFigures.length > 0;
  // Which sport's tabs to show: only once a specific sport is explicitly
  // filtered to. "All Sports" (no filter) shows no tabs — same as Basketball/
  // Squash/Volleyball, which have no scorecard module at all.
  const resolvedSportKind: "cricket" | GenericSport | null = filterSportName
    ? classifySportKind(filterSportName)
    : null;
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

  // match_results now covers every completed cricket match a player appears
  // in — standalone "quick scorecard" matches (via the DB trigger that
  // records them the moment they complete) and tournament bracket matches,
  // including ones decided without an underlying cricket_matches scorecard
  // at all — so these can come straight from it, same as every other sport.
  const matchesWon = player?.matchesWonTotal ?? 0;
  const matchesPlayed = player?.matchesPlayedTotal ?? 0;
  // Participation Score: the old activity-based number (games, tournaments,
  // hosting) — shown on its own card.
  const participationScore = computeRating(player);
  // RATING: 70% Games Win percentage + 30% scored games played — the same
  // number the Top Players list ranks by.
  const rating = computeRankingRating(player);
  const tier = getRatingTierInfo(rating);

  return (
    <View className="flex-1 bg-app">
      {/* Hero */}
      <View
        style={{
          backgroundColor: "#103A2A",
          paddingTop: insets.top + 10,
          paddingHorizontal: 14,
          paddingBottom: 16,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >

        <View className="flex-row items-start">
          <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Bouncy>
          <View className="relative mr-4">
            {player?.avatar ? (
              <Image
                source={{ uri: player.avatar }}
                style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: "white" }}
              />
            ) : (
              <GradientFill
                className="items-center justify-center"
                style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: "white" }}
              >
                <Text className="text-2xl font-bold text-jazba-white">
                  {(player?.fullName ?? "?").charAt(0).toUpperCase()}
                </Text>
              </GradientFill>
            )}
            <View
              className="absolute items-center justify-center bg-surface rounded-full"
              style={{ width: 24, height: 24, bottom: -2, right: -2, borderWidth: 2, borderColor: "white", ...cardShadow }}
            >
              <MaterialCommunityIcons name="crown" size={13} color={tier.color} />
            </View>
          </View>
          <View className="flex-1">
            <Text className="font-extrabold text-ink" style={{ fontSize: 19 }} numberOfLines={1}>
              {player?.fullName ?? "Player"}
            </Text>
            {player?.userCode ? (
              <Text className="text-muted text-xs mt-1" numberOfLines={1}>
                ID: {player.userCode}
              </Text>
            ) : null}
            <Text className="text-muted text-xs mt-1">Play Together, Stay Active</Text>
          </View>
          {/* Follow + sport filter stacked on the right instead of their own
              row below the name — the tier badge (shown again on the Rating
              card just below) is dropped here as redundant, so this header
              doesn't need that extra row at all. */}
          <View className="items-end" style={{ gap: 8 }}>
            {!isOwnProfile && (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Pressable
                  onPress={handleOpenProfileMenu}
                  className="items-center justify-center rounded-full bg-surface"
                  style={{ width: 32, height: 32, ...cardShadow }}
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color={colors.ink} />
                </Pressable>
                <Pressable
                  onPress={() => toggleFollow.mutate(!followState?.isFollowing)}
                  disabled={toggleFollow.isPending || !viewerId}
                >
                  {followState?.isFollowing ? (
                    <View
                      className="flex-row items-center rounded-full px-4 py-2"
                      style={{ gap: 6, backgroundColor: "#0A1723", borderWidth: 1, borderColor: colors.border }}
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
                    <View
                      className="flex-row items-center rounded-full px-4 py-2 bg-surface"
                      style={{ gap: 6 }}
                    >
                      {toggleFollow.isPending ? (
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      ) : (
                        <>
                          <Ionicons name="add" size={16} color={colors.primaryDark} />
                          <Text className="text-sm font-bold" style={{ color: colors.primaryDark }}>
                            Follow
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            {/* Sport filter — opens the same sport-select sheet the Top
                Players list's filter icon opens. */}
            <Pressable onPress={() => setSportSheetOpen(true)}>
              <GradientFill className="flex-row items-center rounded-full px-3 py-1" style={{ gap: 5 }}>
                <Text className="text-xs font-bold text-jazba-white" numberOfLines={1}>
                  {filterSportName ?? "All Sports"}
                </Text>
                <Ionicons name="chevron-down" size={13} color="white" />
              </GradientFill>
            </Pressable>
          </View>
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
        <View className="px-5 pt-4">
          <SkeletonDetailHeader />
        </View>
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
                      <Text className="text-xs font-bold text-jazba-white">{label}</Text>
                    </GradientFill>
                  </Pressable>
                ) : (
                  <Pressable
                    key={key}
                    onPress={() => setActiveTab(key)}
                    className="rounded-full px-4 py-2"
                    style={{ backgroundColor: "#1C2D3A" }}
                  >
                    <Text className="text-xs font-bold" style={{ color: "#CBD4DD" }}>
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
                {activeTab === "overview" && <PlayerCricketOverview fullName={player.fullName} sportId={filterSportId} />}
                {activeTab === "statistics" && <PlayerCricketStatistics fullName={player.fullName} sportId={filterSportId} />}
                {activeTab === "matches" && <PlayerCricketMatches fullName={player.fullName} sportId={filterSportId} />}
                {activeTab === "teams" && <PlayerTeamSquadsList userId={route.params.userId} sportId={filterSportId} />}
                {activeTab === "tournaments" && <PlayerCricketTournaments fullName={player.fullName} sportId={filterSportId} />}
                {activeTab === "clubs" && <PlayerCricketClubs userId={route.params.userId} />}
                {activeTab === "insights" && <PlayerCricketInsights fullName={player.fullName} sportId={filterSportId} />}
                {activeTab === "compare" && (
                  <PlayerCricketCompare fullName={player.fullName} displayName={player.fullName} sportId={filterSportId} />
                )}
              </>
            ) : activeTab !== "profile" && genericSport && player.fullName ? (
              <>
                {activeTab === "overview" && <PlayerSportOverview sport={genericSport} fullName={player.fullName} />}
                {activeTab === "statistics" && <PlayerSportStatistics sport={genericSport} fullName={player.fullName} />}
                {activeTab === "matches" && <PlayerSportMatches sport={genericSport} fullName={player.fullName} />}
                {activeTab === "teams" && <PlayerTeamSquadsList userId={route.params.userId} sportId={filterSportId} />}
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

            {player.jerseyNumber != null && (activeTab === "profile" || activeTab === "overview") && (
              <JerseyNumberCard number={player.jerseyNumber} />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}
