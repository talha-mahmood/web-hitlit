import { useState } from "react";
import { View, Text, Image, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { usePlayerPublicProfile } from "../../hooks/usePlayers";
import { useFollowState, useToggleFollow } from "../../hooks/usePlayerFollows";
import { useAuthStore } from "../../store/authStore";
import { computeRating, computeRankingRating, getRatingTierInfo } from "../../lib/playerRating";
import { getSportIcon } from "../../lib/sportIcons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import PlayerStatCards from "../../components/PlayerStatCards";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";

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
  const { data: player, isLoading } = usePlayerPublicProfile(route.params.userId, filterSportId);
  // The "Filter By Sports" list is the sport selector, so it always lists every
  // sport (the filtered profile above only returns the selected one).
  const { data: allSportsProfile } = usePlayerPublicProfile(route.params.userId);
  const { data: followState } = useFollowState(viewerId, route.params.userId);
  const toggleFollow = useToggleFollow(route.params.userId, viewerId);
  const isOwnProfile = viewerId === route.params.userId;

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
              <View
                className="items-center justify-center bg-primary"
                style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: "white" }}
              >
                <Text className="text-3xl font-bold text-white">
                  {(player?.fullName ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
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
            <Text className="text-muted text-xs mt-1">Play Together, Stay Active</Text>
            <View
              className="flex-row items-center self-start rounded-full px-3 py-1 mt-2"
              style={{ backgroundColor: tier.bg, gap: 5 }}
            >
              <MaterialCommunityIcons name="crown" size={14} color={tier.color} />
              <Text className="text-xs font-bold" style={{ color: tier.color }}>
                {tier.label}
              </Text>
            </View>
          </View>
          {!isOwnProfile && (
            <Pressable
              onPress={() => toggleFollow.mutate(!followState?.isFollowing)}
              disabled={toggleFollow.isPending || !viewerId}
              className="flex-row items-center rounded-full px-4 py-2"
              style={{
                gap: 6,
                backgroundColor: followState?.isFollowing ? "white" : colors.primary,
                borderWidth: followState?.isFollowing ? 1 : 0,
                borderColor: colors.border,
              }}
            >
              {toggleFollow.isPending ? (
                <ActivityIndicator size="small" color={followState?.isFollowing ? colors.primary : "white"} />
              ) : (
                <>
                  <Ionicons
                    name={followState?.isFollowing ? "checkmark" : "add"}
                    size={16}
                    color={followState?.isFollowing ? colors.primaryDark : "white"}
                  />
                  <Text
                    className="text-sm font-bold"
                    style={{ color: followState?.isFollowing ? colors.primaryDark : "white" }}
                  >
                    {followState?.isFollowing ? "Following" : "Follow"}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {isLoading || !player ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* The same cards as the Profile screen, filled with this player's numbers. */}
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
          />
        </ScrollView>
      )}
    </View>
  );
}
