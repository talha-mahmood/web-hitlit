import { useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useTopPlayers } from "../../hooks/usePlayers";
import type { TopPlayer } from "../../lib/api/players";
import { computeRankingRating, getRatingTierInfo } from "../../lib/playerRating";
import { colors, cardShadow } from "../../constants/theme";
import SelectSportModal from "../../components/SelectSportModal";
import Bouncy from "../../components/Bouncy";
import FieldInput from "../../components/FieldInput";

function PlayerRow({
  player,
  rank,
  onPress,
}: {
  player: TopPlayer;
  rank: number;
  onPress: () => void;
}) {
  const rating = computeRankingRating(player);
  const tier = getRatingTierInfo(rating);
  const initials = (player.fullName ?? "?").charAt(0).toUpperCase();
  const rankLabel = rank < 10 ? `0${rank}` : `${rank}`;

  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.98}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16 }}
      className="mb-3"
    >
      <View className="flex-row items-center border border-border rounded-2xl bg-white px-4 py-3">
        {player.avatar ? (
          <Image source={{ uri: player.avatar }} className="w-12 h-12 rounded-full bg-primary-light mr-3" />
        ) : (
          <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center mr-3">
            <Text className="text-primary font-bold">{initials}</Text>
          </View>
        )}
        <View className="flex-1 mr-2">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary }} />
            <Text className="text-ink font-bold text-sm" numberOfLines={1}>
              {player.fullName ?? "Player"}
            </Text>
          </View>
          <Text className="text-muted text-xs mt-1" numberOfLines={1}>
            {player.gamesPlayedTotal} games · {player.tournamentsPlayedTotal} tournaments
          </Text>
          <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 18, height: 18, backgroundColor: tier.bg }}
            >
              <Ionicons name="flame" size={11} color={tier.color} />
            </View>
            <Text className="text-muted text-xs" numberOfLines={1} style={{ opacity: 0.8 }}>
              Rating {rating} · {tier.label}
            </Text>
          </View>
        </View>
        <Text className="text-muted font-semibold text-xs">
          # {rankLabel}
        </Text>
      </View>
    </Bouncy>
  );
}

// Shared between the standalone PlayersDashboardScreen (pushed from Home)
// and the Community tab's in-place "Top Players" segment — same list, same
// filter, just embedded under whatever header the caller provides.
export default function PlayersDashboardContent({
  onPressPlayer,
}: {
  onPressPlayer: (userId: string, sport?: { id: string; name: string }) => void;
}) {
  const [sportId, setSportId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const { data: sports } = useSports();
  const { data: players, isLoading } = useTopPlayers(sportId ?? undefined);

  const selectedSport = useMemo(() => {
    const match = sportId ? (sports ?? []).find((s) => s.id === sportId) : undefined;
    return match ? { id: match.id, name: match.name } : undefined;
  }, [sportId, sports]);

  const rankedPlayers = useMemo(
    () =>
      [...(players ?? [])].sort(
        (a, b) =>
          computeRankingRating(b) - computeRankingRating(a) ||
          b.matchesPlayedTotal - a.matchesPlayedTotal ||
          b.gamesPlayedTotal - a.gamesPlayedTotal
      ),
    [players]
  );

  // A player keeps their real rank in the full ranking while searching, so
  // "3" next to a name always means third overall (for the selected sport).
  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const withRank = rankedPlayers.map((player, index) => ({ player, rank: index + 1 }));
    if (!query) return withRank;
    return withRank.filter(({ player }) => (player.fullName ?? "").toLowerCase().includes(query));
  }, [rankedPlayers, search]);

  return (
    <>
    <FlatList
      data={visiblePlayers}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.player.userId}
      contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 40 }}
      ListHeaderComponent={
        <View className="mb-1 flex-row items-center" style={{ gap: 10 }}>
          <View className="flex-1">
            <FieldInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search players by name"
              autoCorrect={false}
              returnKeyType="search"
              left={<Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
              right={
                search ? (
                  <Ionicons name="close-circle" size={18} color={colors.muted} onPress={() => setSearch("")} />
                ) : undefined
              }
            />
          </View>
          <Pressable
            onPress={() => setSportSheetOpen(true)}
            className="items-center justify-center bg-white"
            style={{ width: 48, height: 48, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, ...cardShadow }}
          >
            <Ionicons name="options-outline" size={20} color={colors.ink} />
            {sportId && (
              <View
                style={{
                  position: "absolute", top: 6, right: 6,
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
            )}
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={colors.primary} className="mt-10" />
        ) : (
          <View className="items-center mt-16" style={{ gap: 12 }}>
            <Ionicons name="trophy-outline" size={48} color={colors.border} />
            <Text className="text-ink font-semibold text-base">
              {search.trim() ? "No players found" : "No players yet"}
            </Text>
            <Text className="text-muted text-sm text-center px-8">
              {search.trim()
                ? "Try a different name."
                : sportId
                  ? "No one has played this sport yet — be the first!"
                  : "Play a game to show up on the leaderboard."}
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <PlayerRow
          player={item.player}
          rank={item.rank}
          onPress={() => onPressPlayer(item.player.userId, selectedSport)}
        />
      )}
    />
    <SelectSportModal
      visible={sportSheetOpen}
      onClose={() => setSportSheetOpen(false)}
      sports={sports ?? []}
      selectedSportId={sportId ?? undefined}
      onApply={(id) => {
        setSportId(id ?? null);
        setSportSheetOpen(false);
      }}
    />
    </>
  );
}
