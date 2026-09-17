import { View, Text, Image, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useGames, useJoinGame } from "../../hooks/useGames";
import { useSports } from "../../hooks/useSports";
import SearchField from "../../components/SearchField";
import SportFilterDropdown from "../../components/SportFilterDropdown";
import { SPORT_ICON_BADGE_SIZE } from "../../components/SportsBySportSection";
import JoinRequestModal from "../../components/JoinRequestModal";
import Bouncy from "../../components/Bouncy";
import AvatarStack from "../../components/AvatarStack";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { GameListItem } from "../../lib/api/games";
import type { Database } from "../../types/database.types";
import { useAuthStore } from "../../store/authStore";
import { GAME_SKILL_COLORS, timeBadgeColor, dayLabel } from "../../lib/badgeColors";
import { computeFixtures, TOURNAMENT_FORMAT_LABEL } from "../../lib/tournamentFixtures";
import { matchesLocationQuery } from "../../lib/locationFilter";

type Nav = NativeStackNavigationProp<GamesStackParamList, "GamesList">;
type GamesListRoute = RouteProp<GamesStackParamList, "GamesList">;

// Matches the header's Create button's rendered footprint (px-3 py-2 +
// "Create" text + its icon) so the card's Join CTA reads as the same size
// even though its own label has no icon and varies ("Join"/"Joined"/"Requested").
const JOIN_BUTTON_MIN_WIDTH = 96;

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
  onJoinPress,
  currentUserId,
  index,
}: {
  game: GameListItem;
  onPress: () => void;
  // Regular games only — opens the join-request modal right from the card.
  // Tournaments have no single "join" action (you pick a team on the detail
  // screen), so their card CTA just navigates via `onPress` instead.
  onJoinPress: () => void;
  currentUserId?: string;
  index: number;
}) {
  const isTournament = game.game_type === "TOURNAMENT";
  // True for real tournaments and for regular games created with the newer
  // team-based join flow (2 teams by default) — false only for old-style
  // regular games that still use the flat game_players join list.
  const isTeamBased = game.number_of_teams != null;
  const joined = game.game_players.filter((p) => p.status === "JOINED");
  const hasJoined = !isTeamBased && game.game_players.some((p) => p.user_id === currentUserId && p.status === "JOINED");
  const hasRequested = !isTeamBased && game.game_players.some((p) => p.user_id === currentUserId && p.status === "PENDING");
  // Only teams the host has actually approved count toward the roster — a
  // team that's still forming or awaiting approval hasn't secured a slot
  // yet, so it shouldn't move the "X/Y teams" count.
  const approvedTeams = game.tournament_teams.filter((t) => t.status === "APPROVED");
  const requiredTeams = game.number_of_teams ?? 0;
  const spotsLeft = game.max_players - joined.length;
  const teamsLeft = requiredTeams - approvedTeams.length;
  const isFull = game.status === "FULL" || (isTeamBased ? teamsLeft <= 0 : spotsLeft <= 0);
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

  // Fixtures are derived from the host's ordered team-name list — same logic
  // as the full list on TournamentTeamsSection, just capped for card space.
  const orderedTeamNames = [...game.tournament_teams]
    .filter((t) => t.status !== "REJECTED")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t) => t.name);
  // Per-team "N players left" readout — same JOINED-member count each
  // TeamCard on the detail screen uses, just capped for card space.
  const teamPlayerCounts = isTeamBased
    ? [...game.tournament_teams]
        .filter((t) => t.status !== "REJECTED")
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((t) => {
          const joinedCount = t.tournament_team_members.filter((m) => m.status === "JOINED").length;
          const left = Math.max((game.players_per_team ?? 0) - joinedCount, 0);
          return { name: t.name, left };
        })
    : [];
  const TEAM_COUNTS_PREVIEW_LIMIT = 4;
  const fixtures = game.tournament_format
    ? computeFixtures(game.tournament_format, orderedTeamNames)
    : [];
  const FIXTURES_PREVIEW_LIMIT = 2;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      {/* Shadow lives on this outer, non-clipping wrapper — a shadow doesn't
          render on a view with overflow:hidden (needed below to clip the top
          accent bar to the rounded corners), so it has to sit one level up. */}
      <Bouncy
        onPress={onPress}
        className="mb-3"
        style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16 }}
        scaleTo={0.98}
      >
        <View className="border border-border rounded-2xl overflow-hidden bg-white mb-3">
          {/* Top accent bar keyed to sport */}
          <View className="bg-primary h-1" />
          <View className="px-5 pt-4 pb-5">
            {/* Row 1: time/date badge + Join CTA (top-right, sized/shaped like
                the header's Create button) — hidden for the host, and once
                full (the "Full" badge in Row 5 already says so). Nested
                Bouncy so a tap here doesn't also trigger the card's own
                onPress. */}
            <View className="flex-row items-center justify-between mb-2.5">
              <View style={{ backgroundColor: badgeColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{badgeLabel}</Text>
              </View>
              {!isMyGame && !isFull && (
                <Bouncy onPress={isTeamBased ? onPress : onJoinPress} scaleTo={0.94}>
                  {hasJoined ? (
                    <View
                      className="flex-row items-center justify-center bg-green-50 rounded-xl px-3 py-2"
                      style={{ gap: 4, minWidth: JOIN_BUTTON_MIN_WIDTH }}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text className="text-primary font-semibold text-sm">Joined</Text>
                    </View>
                  ) : hasRequested ? (
                    <View
                      className="items-center justify-center bg-orange-50 rounded-xl px-3 py-2"
                      style={{ minWidth: JOIN_BUTTON_MIN_WIDTH }}
                    >
                      <Text className="text-orange-600 font-semibold text-sm">Requested</Text>
                    </View>
                  ) : (
                    <View
                      className="items-center justify-center bg-primary rounded-xl px-3 py-2"
                      style={{ minWidth: JOIN_BUTTON_MIN_WIDTH, ...primaryButtonShadow }}
                    >
                      <Text className="text-white font-semibold text-sm">Join</Text>
                    </View>
                  )}
                </Bouncy>
              )}
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
                {isTeamBased
                  ? `${approvedTeams.length} team${approvedTeams.length !== 1 ? "s" : ""}`
                  : `${joined.length} Going`}
              </Text>
            </View>

            {/* Row 3: Icon (if the host set a custom one) + Title */}
            <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
              {game.icon_url && (
                <Image
                  source={{ uri: game.icon_url }}
                  style={{ width: SPORT_ICON_BADGE_SIZE, height: SPORT_ICON_BADGE_SIZE, borderRadius: 8 }}
                  resizeMode="cover"
                />
              )}
              <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>
                {game.title}
              </Text>
            </View>

            {/* Row 4: Location */}
            {(game.venues || game.custom_venue_name) && (
              <View className="flex-row items-center mb-2" style={{ gap: 4 }}>
                <Ionicons name="location-outline" size={13} color={colors.muted} />
                <Text className="text-muted text-sm" numberOfLines={1}>
                  {game.venues ? game.venues.name : game.custom_venue_name}
                  {game.venues?.city ? ` · ${game.venues.city}` : ""}
                </Text>
              </View>
            )}

            {/* Row 4b: Entry fee — "Per Team Entry" for tournaments, "Per
                Person Entry" for regular games. */}
            <Text className="text-ink font-bold text-sm mb-2">
              {isTournament ? "Entry Fee Per Team" : "Entry Fee Per Person"} :{" "}
              {game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()}` : "Free"}
            </Text>

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
                    {isTeamBased
                      ? `${teamsLeft} team${teamsLeft !== 1 ? "s" : ""} left`
                      : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                  </Text>
                </View>
              )}
            </View>

            {/* Row 5b: fixtures preview (tournament only, once teams exist) */}
            {fixtures.length > 0 && (
              <View className="bg-indigo-50/60 rounded-xl px-3 py-2 mt-2" style={{ gap: 2 }}>
                <Text className="text-indigo-700 text-xs font-semibold mb-0.5">
                  {TOURNAMENT_FORMAT_LABEL[game.tournament_format!]} Fixtures
                </Text>
                {fixtures.slice(0, FIXTURES_PREVIEW_LIMIT).map((f, i) => (
                  <Text key={i} className="text-ink text-xs" numberOfLines={1}>
                    {f.teamA} vs {f.teamB ?? "Bye"}
                  </Text>
                ))}
                {fixtures.length > FIXTURES_PREVIEW_LIMIT && (
                  <Text className="text-muted text-xs mt-0.5">
                    +{fixtures.length - FIXTURES_PREVIEW_LIMIT} more
                  </Text>
                )}
              </View>
            )}

            {/* Row 5c: per-team "N players left" — regular team-based games
                only, not tournaments (tournament cards don't show this). */}
            {teamPlayerCounts.length > 0 && !isTournament && (
              <View className="flex-row items-center flex-wrap mt-2" style={{ gap: 6 }}>
                {teamPlayerCounts.slice(0, TEAM_COUNTS_PREVIEW_LIMIT).map((t) => (
                  <View
                    key={t.name}
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: t.left > 0 ? colors.primaryLight : "#F3F4F6" }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: t.left > 0 ? colors.primary : colors.muted }}
                      numberOfLines={1}
                    >
                      {t.name}: {t.left > 0 ? `${t.left} left` : "Full"}
                    </Text>
                  </View>
                ))}
                {teamPlayerCounts.length > TEAM_COUNTS_PREVIEW_LIMIT && (
                  <Text className="text-muted text-xs">
                    +{teamPlayerCounts.length - TEAM_COUNTS_PREVIEW_LIMIT} more
                  </Text>
                )}
              </View>
            )}

            {/* Row 6: skill pill + creator */}
            <View className="flex-row items-center mt-2.5">
              {skillColor && skillLabel && (
                <View
                  style={{
                    backgroundColor: skillColor,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    marginRight: 6,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{skillLabel}</Text>
                </View>
              )}
              <Ionicons name="person-circle-outline" size={14} color={colors.muted} style={{ marginRight: 6 }} />
              <Text className="text-muted text-sm flex-1" numberOfLines={1}>
                {game.profiles?.full_name ?? "Unknown"}
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
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [myOnly, setMyOnly] = useState(false);
  const gameType = route.params?.gameType;
  const isTournamentList = gameType === "TOURNAMENT";

  // navigation.navigate() re-focuses this screen (already mounted in the
  // stack) instead of remounting it, so a new sportId param wouldn't
  // otherwise reach the useState initializer above — sync it explicitly.
  useEffect(() => {
    setSelectedSportId(route.params?.sportId);
  }, [route.params?.sportId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(locationInput.trim()), 300);
    return () => clearTimeout(t);
  }, [locationInput]);

  const { data: sports } = useSports();
  const { data: gamesData, isLoading, isRefetching, refetch } = useGames({
    sportId: selectedSportId,
    search: debouncedSearch || undefined,
    gameType,
  });
  const locationFiltered = debouncedLocation
    ? (gamesData ?? []).filter((g) =>
        matchesLocationQuery(
          [g.venues?.name, g.venues?.city, g.venues?.address, g.custom_venue_name],
          debouncedLocation
        )
      )
    : gamesData;
  const games = myOnly ? (locationFiltered ?? []).filter((g) => g.creator_id === userId) : locationFiltered;

  // Join-request modal is a single shared instance (not one per card) —
  // this tracks which regular game (if any) it's currently open for.
  const [joinTargetGame, setJoinTargetGame] = useState<GameListItem | null>(null);
  const joinGame = useJoinGame();
  const handleSubmitJoinRequest = (
    skillLevel: Database["public"]["Enums"]["skill_level_type"],
    location: string
  ) => {
    if (!userId || !joinTargetGame) return;
    joinGame.mutate(
      { gameId: joinTargetGame.id, userId, skillLevel, location },
      {
        onSuccess: () => setJoinTargetGame(null),
        onError: (err) =>
          Alert.alert("Error", err instanceof Error ? err.message : "Could not send request."),
      }
    );
  };

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
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
      <View className="px-5 mb-3 flex-row items-center" style={{ gap: 8 }}>
        <View className="flex-1">
          <SearchField
            value={searchInput}
            onChangeText={setSearchInput}
            prefix="Search by "
            variants={isTournamentList ? ["tournament name", "tournament ID"] : ["game name", "game ID"]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          className="w-11 h-11 rounded-2xl bg-primary items-center justify-center"
          style={primaryButtonShadow}
        >
          <Ionicons name="filter" size={18} color="white" />
          {(!!selectedSportId || !!debouncedLocation) && (
            <View
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "white",
              }}
            />
          )}
        </Pressable>
      </View>

      {/* All / My Games (or My Tournaments) toggle */}
      <View className="px-5 mb-3 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={() => setMyOnly(false)}
          className={`px-4 py-2 rounded-full ${myOnly ? "bg-white border border-border" : "bg-primary"}`}
        >
          <Text className={`text-sm font-semibold ${myOnly ? "text-muted" : "text-white"}`}>All</Text>
        </Pressable>
        <Pressable
          onPress={() => setMyOnly(true)}
          className={`px-4 py-2 rounded-full ${myOnly ? "bg-primary" : "bg-white border border-border"}`}
        >
          <Text className={`text-sm font-semibold ${myOnly ? "text-white" : "text-muted"}`}>
            {isTournamentList ? "My Tournaments" : "My Games"}
          </Text>
        </Pressable>
      </View>

      {/* Location + sport filters — hidden behind the filter icon until tapped */}
      {showFilters && (
        <View className="px-5 mb-3">
          <SearchField
            value={locationInput}
            onChangeText={setLocationInput}
            prefix="Filter by "
            variants={["location", "city", "area"]}
            autoCapitalize="none"
            autoCorrect={false}
            icon="location-outline"
          />
        </View>
      )}
      {showFilters && (
        <SportFilterDropdown
          sports={sports ?? []}
          selectedSportId={selectedSportId}
          onSelect={(id) => {
            setSelectedSportId(id);
            setShowFilters(false);
          }}
        />
      )}

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
            debouncedSearch || debouncedLocation || myOnly ? (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">
                  No {isTournamentList ? "tournaments" : "games"} found
                </Text>
                <Text className="text-muted text-sm text-center px-8">
                  {debouncedSearch && debouncedLocation
                    ? `No ${isTournamentList ? "tournaments" : "games"} match "${debouncedSearch}" near "${debouncedLocation}".`
                    : debouncedLocation
                      ? `No ${isTournamentList ? "tournaments" : "games"} found near "${debouncedLocation}".`
                      : debouncedSearch
                        ? `No ${isTournamentList ? "tournaments" : "games"} match "${debouncedSearch}". Try a different name or ${isTournamentList ? "tournament" : "game"} ID.`
                        : `You haven't created any ${isTournamentList ? "tournaments" : "games"} yet.`}
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
              onPress={() => navigation.navigate("GameDetail", { gameId: item.id })}
              onJoinPress={() => setJoinTargetGame(item)}
            />
          )}
        />
      )}

      <JoinRequestModal
        visible={!!joinTargetGame}
        onClose={() => setJoinTargetGame(null)}
        onSubmit={handleSubmitJoinRequest}
        submitting={joinGame.isPending}
        title="Request to Join"
        subtitle={
          joinTargetGame && joinTargetGame.entry_fee > 0
            ? `Entry fee: Rs ${joinTargetGame.entry_fee.toLocaleString()} (pay at the venue). The host must approve your request before you're added.`
            : "The host must approve your request before you're added."
        }
      />
    </View>
  );
}
