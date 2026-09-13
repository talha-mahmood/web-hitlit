import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useTopPlayers } from "../../hooks/usePlayers";
import type { TopPlayer } from "../../lib/api/players";
import { computeRating, getRatingTierInfo } from "../../lib/playerRating";
import { colors, cardShadow } from "../../constants/theme";
import { SectionLabel } from "../../components/GameFormControls";
import SportsBySportSection from "../../components/SportsBySportSection";
import Bouncy from "../../components/Bouncy";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayersDashboard">;

function PlayerRow({
  player,
  rank,
  onPress,
}: {
  player: TopPlayer;
  rank: number;
  onPress: () => void;
}) {
  const rating = computeRating(player);
  const tier = getRatingTierInfo(rating);
  const initials = (player.fullName ?? "?").charAt(0).toUpperCase();

  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.98}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16 }}
      className="mb-3"
    >
      <View className="flex-row items-center border border-border rounded-2xl bg-white px-4 py-3">
        <Text className="text-muted font-bold text-sm mr-3" style={{ width: 20 }}>
          {rank}
        </Text>
        {player.avatar ? (
          <Image source={{ uri: player.avatar }} className="w-12 h-12 rounded-full bg-primary-light mr-3" />
        ) : (
          <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center mr-3">
            <Text className="text-primary font-bold">{initials}</Text>
          </View>
        )}
        <View className="flex-1 mr-2">
          <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
            {player.fullName ?? "Player"}
          </Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            {player.gamesPlayedTotal} games · {player.tournamentsPlayedTotal} tournaments
          </Text>
        </View>
        <View className="items-end">
          <View className="rounded-full px-2.5 py-1 mb-1" style={{ backgroundColor: tier.bg }}>
            <Text className="text-xs font-bold" style={{ color: tier.color }}>
              {tier.label}
            </Text>
          </View>
          <Text className="text-ink font-extrabold text-base">{rating}</Text>
        </View>
      </View>
    </Bouncy>
  );
}

export default function PlayersDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [sportId, setSportId] = useState<string | null>(null);
  const { data: sports } = useSports();
  const { data: players, isLoading } = useTopPlayers(sportId ?? undefined);

  const rankedPlayers = useMemo(
    () => [...(players ?? [])].sort((a, b) => computeRating(b) - computeRating(a)),
    [players]
  );

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border bg-white"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Bouncy>
        <Text className="text-base font-bold text-ink flex-1">Players Dashboard</Text>
      </View>

      <FlatList
        data={rankedPlayers}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="mb-1">
            <SectionLabel title="Filter by Sport" />
            <SportsBySportSection
              sports={sports ?? []}
              selectedSportId={sportId}
              onSelectSport={(id) => setSportId((prev) => (prev === id ? null : id))}
            />
            <Text className="text-muted text-xs mt-1 mb-1">
              Ranked by an activity-based rating — games, tournaments, and hosting all count.
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-10" />
          ) : (
            <View className="items-center mt-16" style={{ gap: 12 }}>
              <Ionicons name="trophy-outline" size={48} color={colors.border} />
              <Text className="text-ink font-semibold text-base">No players yet</Text>
              <Text className="text-muted text-sm text-center px-8">
                {sportId
                  ? "No one has played this sport yet — be the first!"
                  : "Play a game to show up on the leaderboard."}
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <PlayerRow
            player={item}
            rank={index + 1}
            onPress={() => navigation.navigate("PlayerProfile", { userId: item.userId })}
          />
        )}
      />
    </View>
  );
}
