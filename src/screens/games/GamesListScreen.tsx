import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useGames, useFavoriteGameIds, useToggleFavoriteGame } from "../../hooks/useGames";
import { useSports } from "../../hooks/useSports";
import SportChip from "../../components/SportChip";
import SearchField from "../../components/SearchField";
import Bouncy from "../../components/Bouncy";
import AvatarStack from "../../components/AvatarStack";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { GameListItem } from "../../lib/api/games";
import { useAuthStore } from "../../store/authStore";
import { GAME_SKILL_COLORS, timeBadgeColor, dayLabel } from "../../lib/badgeColors";

type Nav = NativeStackNavigationProp<GamesStackParamList, "GamesList">;
type GamesListRoute = RouteProp<GamesStackParamList, "GamesList">;

function formatTimeRange(startTime: string, endTime: string): string {
  const fmt = (t: string) =>
    new Date(`2000-01-01T${t}`).toLocaleTimeString("en-PK", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${fmt(startTime)} - ${fmt(endTime)}`;
}

// A multi-day tournament shows a date range instead of a single day + time.
function formatDateRange(gameDate: string, endDate: string): string {
  const [sy, sm, sd] = gameDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-PK", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined });
  const sameYear = sy === ey;
  return `${fmt(start, !sameYear)} - ${fmt(end, true)}`;
}

function GameCard({
  game,
  onPress,
  currentUserId,
  index,
  isFavorite,
  onToggleFavorite,
}: {
  game: GameListItem;
  onPress: () => void;
  currentUserId?: string;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const isTournament = game.game_type === "TOURNAMENT";
  const joined = game.game_players.filter((p) => p.status === "JOINED");
  // Only teams the host has actually approved count toward the tournament's
  // roster — a team that's still forming or awaiting approval hasn't secured
  // a slot yet, so it shouldn't move the "X/Y teams" count.
  const approvedTeams = game.tournament_teams.filter((t) => t.status === "APPROVED");
  const requiredTeams = game.number_of_teams ?? 0;
  const spotsLeft = game.max_players - joined.length;
  const teamsLeft = requiredTeams - approvedTeams.length;
  const isFull = game.status === "FULL" || (isTournament ? teamsLeft <= 0 : spotsLeft <= 0);
  const isMyGame = game.creator_id === currentUserId;
  const skill = game.skill_level;
  const skillColor = skill ? GAME_SKILL_COLORS[skill] : null;
  const skillLabel =
    skill === "BEGINNER" ? "Beginner" :
    skill === "INTERMEDIATE" ? "Intermediate" :
    skill === "ADVANCED" ? "Advanced" :
    skill === "PRO" ? "Pro" : null;

  const badgeLabel =
    isTournament && game.end_date && game.end_date !== game.game_date
      ? formatDateRange(game.game_date, game.end_date)
      : `${dayLabel(game.game_date)} · ${formatTimeRange(game.start_time, game.end_time)}`;
  const badgeColor = isTournament ? "#7C3AED" : timeBadgeColor(game.start_time);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      {/* Shadow lives on this outer, non-clipping wrapper — a shadow doesn't
          render on a view with overflow:hidden (needed below to clip the top
          accent bar to the rounded corners), so it has to sit one level up. */}
      <Bouncy onPress={onPress} className="mb-3" style={cardShadow} scaleTo={0.98}>
        <View className="border border-border rounded-2xl overflow-hidden bg-white">
          {/* Top accent bar keyed to sport */}
          <View className="bg-primary h-1" />
          <View className="px-4 pt-3 pb-4">
            {/* Row 1: time/date badge + favorite */}
            <View className="flex-row items-center justify-between mb-2.5">
              <View style={{ backgroundColor: badgeColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{badgeLabel}</Text>
              </View>
              <Bouncy onPress={onToggleFavorite} scaleTo={0.75} hitSlop={8}>
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={20}
                  color={isFavorite ? colors.danger : colors.muted}
                />
              </Bouncy>
            </View>

            {/* Row 2: avatar stack + going/teams count */}
            <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
              <AvatarStack
                people={joined.map((p) => ({
                  avatar: p.profiles?.avatar ?? null,
                  name: p.profiles?.full_name ?? null,
                }))}
                size={24}
              />
              <Text className="text-muted text-sm font-medium">
                {isTournament
                  ? `${approvedTeams.length} team${approvedTeams.length !== 1 ? "s" : ""}`
                  : `${joined.length} Going`}
              </Text>
            </View>

            {/* Row 3: Title */}
            <Text className="text-ink font-bold text-base mb-1" numberOfLines={1}>
              {game.title}
            </Text>

            {/* Row 4: Location */}
            {game.venues && (
              <View className="flex-row items-center mb-2" style={{ gap: 4 }}>
                <Ionicons name="location-outline" size={13} color={colors.muted} />
                <Text className="text-muted text-sm" numberOfLines={1}>
                  {game.venues.name}
                  {game.venues.city ? ` · ${game.venues.city}` : ""}
                </Text>
              </View>
            )}

            {/* Row 5: Sport + tournament + my-game + spots badges */}
            <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
              <View className="bg-primary-light px-2 py-0.5 rounded-full">
                <Text className="text-primary text-xs font-semibold">
                  {game.sports?.name ?? "Sport"}
                </Text>
              </View>
              {isTournament && (
                <View className="bg-purple-50 px-2 py-0.5 rounded-full">
                  <Text className="text-purple-700 text-xs font-medium">🏆 Tournament</Text>
                </View>
              )}
              {isMyGame && (
                <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                  <Text className="text-blue-600 text-xs font-medium">
                    {isTournament ? "My Tournament" : "My Game"}
                  </Text>
                </View>
              )}
              {isFull ? (
                <View className="bg-red-50 px-2 py-0.5 rounded-full">
                  <Text className="text-red-600 text-xs font-medium">Full</Text>
                </View>
              ) : (
                <View className="bg-green-50 px-2 py-0.5 rounded-full">
                  <Text className="text-primary text-xs font-medium">
                    {isTournament
                      ? `${teamsLeft} team${teamsLeft !== 1 ? "s" : ""} left`
                      : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                  </Text>
                </View>
              )}
            </View>

            {/* Row 6: skill pill + creator + entry fee */}
            <View className="flex-row items-center justify-between mt-2.5">
              <View className="flex-row items-center flex-1 mr-2" style={{ gap: 6 }}>
                {skillColor && skillLabel && (
                  <View style={{ backgroundColor: skillColor, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{skillLabel}</Text>
                  </View>
                )}
                <Ionicons name="person-circle-outline" size={14} color={colors.muted} />
                <Text className="text-muted text-sm flex-1" numberOfLines={1}>
                  {game.profiles?.full_name ?? "Unknown"}
                </Text>
              </View>
              <Text className="text-ink font-semibold text-sm">
                {game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()}` : "Free"}
              </Text>
            </View>
          </View>
        </View>
      </Bouncy>
    </Animated.View>
  );
}

export default function GamesListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<GamesListRoute>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(
    route.params?.sportId
  );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const gameType = route.params?.gameType;
  const isTournamentList = gameType === "TOURNAMENT";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: sports } = useSports();
  const { data: games, isLoading, isRefetching, refetch } = useGames({
    sportId: selectedSportId,
    search: debouncedSearch || undefined,
    gameType,
  });
  const { data: favoriteIds } = useFavoriteGameIds(userId);
  const toggleFavorite = useToggleFavoriteGame();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
          )}
          <Text className="text-2xl font-bold text-ink">
            {gameType === "TOURNAMENT" ? "Tournaments" : "Games"}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("CreateGame", gameType ? { gameType } : undefined)}
          className="flex-row items-center bg-primary rounded-xl px-3 py-2"
          style={{ gap: 4, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white font-semibold text-sm">Create</Text>
        </Pressable>
      </View>

      {/* Search by name or ID */}
      <View className="px-5 mb-3">
        <SearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholders={
            isTournamentList
              ? ["Search by tournament name", "Search by tournament ID"]
              : ["Search by game name", "Search by game ID"]
          }
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Sport filter chips */}
      <View style={{ paddingVertical: 6 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sports ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => (
            <SportChip
              label={item.name}
              selected={selectedSportId === item.id}
              onPress={() =>
                setSelectedSportId((cur) => (cur === item.id ? undefined : item.id))
              }
            />
          )}
        />
      </View>

      {/* Games list */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={games ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 0 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            debouncedSearch ? (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">
                  No {isTournamentList ? "tournaments" : "games"} found
                </Text>
                <Text className="text-muted text-sm text-center px-8">
                  No {isTournamentList ? "tournaments" : "games"} match "{debouncedSearch}". Try a different
                  name or {isTournamentList ? "tournament" : "game"} ID.
                </Text>
              </View>
            ) : (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="tennisball-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">
                  No {isTournamentList ? "tournaments" : "games"} yet
                </Text>
                <Text className="text-muted text-sm text-center px-8">
                  Be the first to create a {isTournamentList ? "tournament" : "game"} and invite players to join!
                </Text>
                <Pressable
                  onPress={() => navigation.navigate("CreateGame", gameType ? { gameType } : undefined)}
                  className="bg-primary rounded-xl px-6 py-3 mt-2"
                >
                  <Text className="text-white font-semibold">
                    Create a {isTournamentList ? "Tournament" : "Game"}
                  </Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <GameCard
              game={item}
              currentUserId={userId}
              index={index}
              isFavorite={favoriteIds?.has(item.id) ?? false}
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  gameId: item.id,
                  isFavorite: !(favoriteIds?.has(item.id) ?? false),
                })
              }
              onPress={() => navigation.navigate("GameDetail", { gameId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}
