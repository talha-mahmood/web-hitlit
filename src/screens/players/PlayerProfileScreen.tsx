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
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;
type Route = RouteProp<HomeStackParamList, "PlayerProfile">;

function StatBlock({
  icon,
  bg,
  fg,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
  value: string | number;
  label: string;
}) {
  return (
    <View className="bg-white rounded-2xl p-3.5 items-center" style={{ width: "31%", ...cardShadow }}>
      <View
        className="items-center justify-center rounded-full mb-2"
        style={{ width: 38, height: 38, backgroundColor: bg }}
      >
        <Ionicons name={icon} size={19} color={fg} />
      </View>
      <Text className="text-ink font-extrabold text-xl">{value}</Text>
      <Text className="text-muted text-xs mt-1 text-center" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

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
  const winPercentage = matchesPlayed > 0 ? Math.min(100, Math.round((matchesWon / matchesPlayed) * 100)) : 0;
  // Participation Score: the old activity-based number (games, tournaments,
  // hosting) — still shown on its own card.
  const participationScore = computeRating(player);
  // RATING: 70% Games Win percentage + 30% scored games played — the same
  // number the Top Players list ranks by.
  const rating = computeRankingRating(player);
  const tier = getRatingTierInfo(rating);
  const heroSportIcon = player?.sportBreakdown?.[0]
    ? getSportIcon(player.sportBreakdown[0].sportName).icon
    : "trophy-outline";

  let winTag: string | null = null;
  let winCaption = "Play more scored games to build this up.";
  if (matchesPlayed > 0) {
    if (winPercentage === 100) {
      winTag = "Perfect!";
      winCaption = "Great performance! Keep it up!";
    } else if (winPercentage >= 70) {
      winTag = "Great!";
      winCaption = "Strong performance — keep it going!";
    } else if (winPercentage >= 40) {
      winCaption = "Solid effort — keep grinding!";
    } else {
      winCaption = "Room to improve — keep playing!";
    }
  }

  return (
    <View className="flex-1 bg-green-50">
      {/* Hero */}
      <View
        style={{
          backgroundColor: "#E3F6EA",
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
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
        <Text
          numberOfLines={3}
          style={{
            position: "absolute",
            right: 18,
            top: insets.top + 58,
            width: 110,
            fontSize: 11,
            fontStyle: "italic",
            fontWeight: "700",
            color: colors.primaryDark,
            opacity: 0.5,
            textAlign: "right",
            transform: [{ rotate: "-4deg" }],
          }}
        >
          Good Players Build Brighter Communities
        </Text>

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
        {(followState?.followerCount ?? 0) > 0 && (
          <Text className="text-muted text-xs mt-3">
            {followState!.followerCount} follower{followState!.followerCount === 1 ? "" : "s"}
          </Text>
        )}
      </View>

      {isLoading || !player ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Rating card */}
          <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: "white", ...cardShadow }}>
            <Text className="text-muted text-xs font-bold mb-2" style={{ letterSpacing: 0.5 }}>
              RATING
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 48, height: 48, backgroundColor: tier.bg }}
                >
                  <Ionicons name="flame" size={24} color={tier.color} />
                </View>
                <Text className="text-ink font-extrabold" style={{ fontSize: 34, lineHeight: 38 }}>
                  {rating}
                </Text>
              </View>
              <View
                className="flex-row items-center rounded-full px-3 py-1.5"
                style={{ backgroundColor: tier.bg, gap: 5 }}
              >
                <MaterialCommunityIcons name="crown" size={14} color={tier.color} />
                <Text className="text-xs font-bold" style={{ color: tier.color }}>
                  {tier.label}
                </Text>
              </View>
            </View>
            <Text className="text-muted text-xs mt-2">Keep playing, keep rising!</Text>
          </View>

          {/* Stat grid */}
          <View className="flex-row justify-between mb-4">
            <StatBlock icon="trophy" bg="#DCFCE7" fg={colors.primaryDark} value={player.tournamentsPlayedTotal} label="Tournaments" />
            <StatBlock icon="calendar" bg="#F3F4F6" fg="#6B7280" value={player.gamesHostedTotal} label="Hosted" />
            <StatBlock icon="people" bg="#DCFCE7" fg={colors.primaryDark} value={participationScore} label="Participation Score" />
          </View>

          {/* Games Win */}
          <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center flex-1 mr-2" style={{ gap: 10 }}>
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}
                >
                  <Ionicons name="locate" size={20} color={colors.primaryDark} />
                </View>
                <View>
                  <Text className="text-ink font-extrabold text-xl">
                    {matchesWon} / {matchesPlayed}
                  </Text>
                  <Text className="text-muted text-xs mt-0.5">
                    {filterSportName ? `Games Win · ${filterSportName}` : "Games Win"}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="font-extrabold text-lg" style={{ color: colors.primaryDark }}>
                  {winPercentage}%
                </Text>
                {winTag && (
                  <View className="rounded-full px-2 py-0.5 mt-1" style={{ backgroundColor: colors.primaryLight }}>
                    <Text className="text-[10px] font-bold" style={{ color: colors.primaryDark }}>
                      {winTag}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primaryLight, overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4, width: `${winPercentage}%`, backgroundColor: colors.primary }} />
            </View>
            <Text className="text-muted text-xs mt-2">{winCaption}</Text>
          </View>

          {/* Sport-specific totals — only meaningful once filtered to that
              one sport (see get_player_public_stats' name-matching caveat on
              why these can't be shown unfiltered/combined). */}
          {filterSportName?.toLowerCase() === "cricket" && (
            <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center" style={{ ...cardShadow, gap: 12 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 44, height: 44, backgroundColor: colors.primaryLight }}
              >
                <MaterialCommunityIcons name="cricket" size={22} color={colors.primaryDark} />
              </View>
              <View>
                <Text className="text-ink font-extrabold text-xl">{player.totalRuns}</Text>
                <Text className="text-muted text-xs mt-0.5">Total Runs Scored</Text>
              </View>
            </View>
          )}
          {filterSportName?.toLowerCase() === "football" && (
            <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center" style={{ ...cardShadow, gap: 12 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 44, height: 44, backgroundColor: colors.primaryLight }}
              >
                <MaterialCommunityIcons name="soccer" size={22} color={colors.primaryDark} />
              </View>
              <View>
                <Text className="text-ink font-extrabold text-xl">{player.totalGoals}</Text>
                <Text className="text-muted text-xs mt-0.5">Total Goals</Text>
              </View>
            </View>
          )}

          {/* Sport breakdown */}
          {player.sportBreakdown.length > 0 && (
            <>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-bold text-ink">Sports Played</Text>
                <View
                  className="flex-row items-center rounded-full px-2.5 py-1"
                  style={{ backgroundColor: colors.primaryLight, gap: 4 }}
                >
                  <Ionicons name="bar-chart" size={12} color={colors.primaryDark} />
                  <Text className="text-xs font-bold" style={{ color: colors.primaryDark }}>
                    {player.sportBreakdown.length} {player.sportBreakdown.length === 1 ? "Sport" : "Sports"}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {player.sportBreakdown.map((s) => {
                  const { icon, bg, fg } = getSportIcon(s.sportName);
                  const selected = filterSportId === s.sportId;
                  return (
                    <Pressable
                      key={s.sportId}
                      onPress={() => handleSelectSportCard(s.sportId, s.sportName)}
                      className="flex-row items-center bg-white rounded-2xl p-3"
                      style={{
                        ...cardShadow,
                        borderWidth: selected ? 1.5 : 0,
                        borderColor: selected ? colors.primary : "transparent",
                      }}
                    >
                      <View
                        className="items-center justify-center rounded-xl mr-3"
                        style={{ width: 46, height: 46, backgroundColor: bg }}
                      >
                        <MaterialCommunityIcons name={icon} size={22} color={fg} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-ink font-bold text-sm" numberOfLines={1}>
                          {s.sportName}
                        </Text>
                        <Text className="text-muted text-xs mt-0.5">
                          {s.count} {s.count === 1 ? "game" : "games"}
                        </Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
