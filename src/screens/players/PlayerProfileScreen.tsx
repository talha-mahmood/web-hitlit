import { View, Text, Image, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { usePlayerPublicProfile } from "../../hooks/usePlayers";
import { computeRating, getRatingTierInfo } from "../../lib/playerRating";
import { getSportIcon } from "../../lib/sportIcons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;
type Route = RouteProp<HomeStackParamList, "PlayerProfile">;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="bg-white rounded-2xl p-4 items-center" style={{ width: "31%", ...cardShadow }}>
      <Text className="text-ink font-extrabold text-xl">{value}</Text>
      <Text className="text-muted text-xs mt-1 text-center">{label}</Text>
    </View>
  );
}

const RATING_WIN_WEIGHT = 0.7;
const RATING_GAMES_PLAYED_WEIGHT = 0.3;

export default function PlayerProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { data: player, isLoading } = usePlayerPublicProfile(route.params.userId, route.params.sportId);

  const matchesWon = player?.matchesWonTotal ?? 0;
  const matchesPlayed = player?.matchesPlayedTotal ?? 0;
  const winShare = matchesPlayed > 0 ? Math.min(100, (matchesWon / matchesPlayed) * 100) : 0;
  const winPercentage = Math.round(winShare);
  // Participation Score: the old activity-based number (games, tournaments,
  // hosting) — still shown on its own card.
  const participationScore = computeRating(player);
  // RATING: 70% Games Win percentage + 30% Games Played. Games Played is
  // scaled onto 0-100 first — 100 games counts as full marks, anything above
  // is capped so volume alone can't outweigh winning.
  const gamesPlayedShare = Math.min(100, player?.gamesPlayedTotal ?? 0);
  const rating = Math.round(winShare * RATING_WIN_WEIGHT + gamesPlayedShare * RATING_GAMES_PLAYED_WEIGHT);
  const tier = getRatingTierInfo(rating);
  const effectiveSkillLevel = player?.skillLevel ?? player?.computedSkillLevel ?? null;

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border bg-white"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Bouncy>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          {player?.fullName ?? "Player Profile"}
        </Text>
      </View>

      {isLoading || !player ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-5">
            {player.avatar ? (
              <Image source={{ uri: player.avatar }} className="w-20 h-20 rounded-full bg-primary-light mb-3" />
            ) : (
              <View className="w-20 h-20 rounded-full bg-primary-light items-center justify-center mb-3">
                <Text className="text-2xl font-bold text-primary">
                  {(player.fullName ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="text-xl font-bold text-ink">{player.fullName ?? "Player"}</Text>
            {player.city && (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <Ionicons name="location-outline" size={13} color={colors.muted} />
                <Text className="text-muted text-sm">{player.city}</Text>
              </View>
            )}
          </View>

          {!!player.bio && (
            <View className="bg-white rounded-2xl p-4 mb-5" style={cardShadow}>
              <Text className="text-muted text-sm leading-relaxed">{player.bio}</Text>
            </View>
          )}

          {/* Rating card — same tiers/formula as your own Profile screen */}
          <View className="bg-white rounded-2xl p-4 mb-5" style={cardShadow}>
            <Text className="text-muted text-xs font-bold mb-2" style={{ letterSpacing: 0.5 }}>
              RATING
            </Text>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 40, height: 40, backgroundColor: tier.bg }}
                >
                  <Ionicons name="flame" size={20} color={tier.color} />
                </View>
                <Text className="text-ink font-extrabold" style={{ fontSize: 30, lineHeight: 34 }}>
                  {rating}
                </Text>
              </View>
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: tier.bg }}>
                <Text className="text-xs font-bold" style={{ color: tier.color }}>
                  {tier.label}
                </Text>
              </View>
            </View>
            {effectiveSkillLevel && (
              <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                <Ionicons name="medal-outline" size={14} color={colors.muted} />
                <Text className="text-muted text-xs">{capitalize(effectiveSkillLevel)} skill level</Text>
              </View>
            )}
          </View>

          {/* Stat grid */}
          <View className="flex-row justify-between mb-3">
            <StatBlock value={player.tournamentsPlayedTotal} label="Tournaments" />
            <StatBlock value={player.gamesHostedTotal} label="Hosted" />
            <StatBlock value={participationScore} label="Participation Score" />
          </View>

          {/* Games Win — scored matches this player's team won out of scored matches it played */}
          <View className="bg-white rounded-2xl p-4 mb-5" style={cardShadow}>
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-ink font-extrabold text-xl">
                  {matchesWon} / {matchesPlayed}
                </Text>
                <Text className="text-muted text-xs mt-1">
                  {route.params.sportName ? `Games Win · ${route.params.sportName}` : "Games Win"}
                </Text>
              </View>
              <Text className="font-extrabold text-lg" style={{ color: colors.primaryDark }}>
                {winPercentage}%
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primaryLight, overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4, width: `${winPercentage}%`, backgroundColor: colors.primary }} />
            </View>
          </View>

          {/* Sport breakdown */}
          {player.sportBreakdown.length > 0 && (
            <>
              <Text className="text-base font-semibold text-ink mb-3">Sports Played</Text>
              <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                {player.sportBreakdown.map((s) => {
                  const { icon, bg, fg } = getSportIcon(s.sportName);
                  return (
                    <View
                      key={s.sportId}
                      className="flex-row items-center rounded-full px-3 py-1.5"
                      style={{ backgroundColor: bg, gap: 6 }}
                    >
                      <MaterialCommunityIcons name={icon} size={14} color={fg} />
                      <Text className="text-xs font-semibold" style={{ color: fg }}>
                        {s.sportName} · {s.count}
                      </Text>
                    </View>
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
