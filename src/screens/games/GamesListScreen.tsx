import { View, Text, Image, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useGames, useJoinGame } from "../../hooks/useGames";
import { useSports } from "../../hooks/useSports";
import FieldInput from "../../components/FieldInput";
import SearchField from "../../components/SearchField";
import SelectSportModal from "../../components/SelectSportModal";
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
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import { computeFixtures, TOURNAMENT_FORMAT_LABEL } from "../../lib/tournamentFixtures";
import { matchesLocationQuery } from "../../lib/locationFilter";
import BookingsDateRangeModal, { type DateSelection } from "../../components/BookingsDateRangeModal";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

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

// Short label for the "Time" pill, e.g. "Sep 21".
function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const fixtures = game.tournament_format
    ? computeFixtures(game.tournament_format, orderedTeamNames)
    : [];
  const FIXTURES_PREVIEW_LIMIT = 2;

  const sportName = game.sports?.name ?? "";
  const sportPhoto = getSportImage(sportName);
  const sportGlyph = getSportIcon(sportName);
  // The title/location/teams rows keep clear of the sport picture on the right.
  const rightGutter = { paddingRight: 92 };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      <Bouncy
        onPress={onPress}
        className="mb-3.5"
        style={{ ...cardShadow, backgroundColor: "white", borderRadius: 24 }}
        scaleTo={0.98}
      >
        <View className="border border-border overflow-hidden bg-white" style={{ borderRadius: 24 }}>
          {/* Sport picture in a soft green disc, tucked into the right edge */}
          <View
            pointerEvents="none"
            className="items-center justify-center overflow-hidden"
            style={{
              position: "absolute",
              right: -30,
              top: 56,
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: "#E4F7EA",
            }}
          >
            {sportPhoto ? (
              <View style={{ width: 132, height: 74, marginRight: 26, mixBlendMode: "multiply" }}>
                <Image source={sportPhoto} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
              </View>
            ) : (
              <MaterialCommunityIcons name={sportGlyph.icon} size={54} color={sportGlyph.fg} style={{ marginRight: 26, opacity: 0.8 }} />
            )}
          </View>

          <View className="px-4 pt-4 pb-4">
            {/* Row 1: time/date badge + Join CTA + menu dots. Nested Bouncy so a
                tap on Join doesn't also trigger the card's own onPress. */}
            <View className="flex-row items-center justify-between mb-3">
              <View
                className="flex-row items-center"
                style={{ backgroundColor: badgeColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, gap: 6 }}
              >
                <Ionicons
                  name={isTournament && game.end_date && game.end_date !== game.game_date ? "calendar-outline" : "time-outline"}
                  size={15}
                  color="white"
                />
                <Text style={{ color: "white", fontSize: 12.5, fontWeight: "700" }}>{badgeLabel}</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                {!isMyGame && !isFull && (
                  <Bouncy onPress={isTeamBased ? onPress : onJoinPress} scaleTo={0.94}>
                    {hasJoined ? (
                      <View
                        className="flex-row items-center justify-center bg-green-50 rounded-2xl px-3 py-2"
                        style={{ gap: 4, minWidth: 78 }}
                      >
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text className="text-primary font-semibold text-sm">Joined</Text>
                      </View>
                    ) : hasRequested ? (
                      <View
                        className="items-center justify-center bg-orange-50 rounded-2xl px-3 py-2"
                        style={{ minWidth: 78 }}
                      >
                        <Text className="text-orange-600 font-semibold text-sm">Requested</Text>
                      </View>
                    ) : (
                      <View
                        className="items-center justify-center bg-primary rounded-2xl px-3 py-2"
                        style={{ minWidth: 78, ...primaryButtonShadow }}
                      >
                        <Text className="text-white font-bold text-sm">Join</Text>
                      </View>
                    )}
                  </Bouncy>
                )}
                <Ionicons name="ellipsis-vertical" size={20} color={colors.muted} />
              </View>
            </View>

            {/* Row 2: Icon (if the host set a custom one) + Title */}
            <View className="flex-row items-center mb-1.5" style={{ gap: 8, ...rightGutter }}>
              {game.icon_url && (
                <Image
                  source={{ uri: game.icon_url }}
                  style={{ width: SPORT_ICON_BADGE_SIZE, height: SPORT_ICON_BADGE_SIZE, borderRadius: 8 }}
                  resizeMode="cover"
                />
              )}
              <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 20 }} numberOfLines={2}>
                {game.title}
              </Text>
            </View>

            {/* Row 3: Location */}
            {(game.venues || game.custom_venue_name) && (
              <View className="flex-row items-center mb-2.5" style={{ gap: 5, ...rightGutter }}>
                <Ionicons name="location-outline" size={15} color={colors.muted} />
                <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                  {game.venues ? game.venues.name : game.custom_venue_name}
                  {game.venues?.city ? ` · ${game.venues.city}` : ""}
                </Text>
              </View>
            )}

            {/* Row 4: avatar stack + going/teams count */}
            <View className="flex-row items-center mb-2.5" style={{ gap: 8, ...rightGutter }}>
              <AvatarStack
                people={joined.map((p) => ({
                  avatar: p.profiles?.avatar ?? null,
                  name: p.profiles?.full_name ?? null,
                }))}
                size={30}
              />
              <Text className="text-muted font-medium" style={{ fontSize: 14 }}>
                {isTeamBased
                  ? `${approvedTeams.length} team${approvedTeams.length !== 1 ? "s" : ""}`
                  : `${joined.length} Going`}
              </Text>
            </View>

            {/* Row 5: Entry fee — "Per Team" for tournaments, "Per Person" for
                regular games. */}
            <View className="flex-row items-center mb-3" style={{ gap: 8, ...rightGutter }}>
              <Ionicons name="ticket-outline" size={18} color={colors.ink} />
              <Text className="text-ink" style={{ fontSize: 14.5 }} numberOfLines={1}>
                <Text className="font-bold">{isTournament ? "Entry Fee Per Team" : "Entry Fee Per Person"}: </Text>
                <Text className="font-bold" style={{ color: colors.primary }}>
                  {game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()}` : "Free"}
                </Text>
              </Text>
            </View>

            {/* Row 6: Sport + tournament + my-game + spots badges */}
            <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
              <View className="bg-primary-light px-3 py-1 rounded-full">
                <Text className="text-primary text-xs font-bold">{game.sports?.name ?? "Sport"}</Text>
              </View>
              {isTournament && (
                <View className="bg-purple-50 px-3 py-1 rounded-full">
                  <Text className="text-purple-700 text-xs font-semibold">🏆 Tournament</Text>
                </View>
              )}
              {isMyGame && (
                <View className="bg-blue-50 px-3 py-1 rounded-full">
                  <Text className="text-blue-600 text-xs font-semibold">
                    {isTournament ? "My Tournament" : "My Game"}
                  </Text>
                </View>
              )}
              {isFull ? (
                <View className="bg-red-50 px-3 py-1 rounded-full">
                  <Text className="text-red-600 text-xs font-semibold">Full</Text>
                </View>
              ) : (
                <View className="bg-green-50 px-3 py-1 rounded-full">
                  <Text className="text-primary text-xs font-semibold">
                    {isTeamBased
                      ? `${teamsLeft} team${teamsLeft !== 1 ? "s" : ""} left`
                      : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                  </Text>
                </View>
              )}
            </View>

            {/* Row 6b: fixtures preview (tournament only, once teams exist) */}
            {fixtures.length > 0 && (
              <View className="rounded-2xl px-4 py-3 mt-3" style={{ backgroundColor: "#EEF0FF", gap: 3 }}>
                <Text className="text-indigo-700 text-sm font-bold mb-0.5">
                  {TOURNAMENT_FORMAT_LABEL[game.tournament_format!]} Fixtures
                </Text>
                {fixtures.slice(0, FIXTURES_PREVIEW_LIMIT).map((f, i) => (
                  <Text key={i} className="text-ink text-sm" numberOfLines={1}>
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

            {/* Row 7: skill pill + creator */}
            <View className="flex-row items-center mt-3">
              {skillColor && skillLabel && (
                <View
                  className="flex-row items-center"
                  style={{
                    backgroundColor: skillColor,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    gap: 6,
                  }}
                >
                  <Ionicons name="stats-chart" size={13} color="white" />
                  <Text style={{ color: "white", fontSize: 12.5, fontWeight: "700" }}>{skillLabel}</Text>
                </View>
              )}
              {skillColor && skillLabel ? (
                <View style={{ width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 12 }} />
              ) : null}
              <Ionicons name="person-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
              <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
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
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  // "All" / "My Games" pills, the "Time" range pill, and the distance
  // dropdown beside them.
  const [listFilter, setListFilter] = useState<"all" | "mine">("all");
  const [timeRange, setTimeRange] = useState<DateSelection | null>(null);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [distanceOpen, setDistanceOpen] = useState(false);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();
  const myOnly = listFilter === "mine";
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
    gameType,
  });
  // The search box matches a game's name/ID, its sport, and its venue/location.
  const searched = debouncedSearch
    ? (gamesData ?? []).filter((g) =>
        [g.title, g.game_code, g.sports?.name, g.venues?.name, g.venues?.city, g.venues?.address, g.custom_venue_name].some(
          (v) => !!v && v.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
      )
    : gamesData;
  const locationFiltered = debouncedLocation
    ? (searched ?? []).filter((g) =>
        matchesLocationQuery(
          [g.venues?.name, g.venues?.city, g.venues?.address, g.custom_venue_name],
          debouncedLocation
        )
      )
    : searched;
  const scoped = myOnly ? (locationFiltered ?? []).filter((g) => g.creator_id === userId) : locationFiltered;
  // "Time": only games whose date falls inside the picked range (a
  // multi-day tournament counts if any of its days overlap the range).
  const upcomingOnly = timeRange
    ? (scoped ?? []).filter((g) => (g.end_date ?? g.game_date) >= timeRange.start && g.game_date <= timeRange.end)
    : scoped;
  // "Latest" = most recently posted first; "Soonest" = earliest start first (server order).
  const latestFirst = [...(upcomingOnly ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  // A game with no venue coordinates (custom/text-only venue) has no known
  // distance, so it's left out once a distance filter is on — same "unknown
  // distance is treated as not near you" rule the Home screen's distance
  // sort already uses (see withDistance there).
  const games =
    distanceKmFilter != null && myCoords
      ? latestFirst.filter((g) => {
          const lat = g.venues?.latitude;
          const lng = g.venues?.longitude;
          if (lat == null || lng == null) return false;
          return distanceKm(myCoords.latitude, myCoords.longitude, lat, lng) <= distanceKmFilter;
        })
      : latestFirst;

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
          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request.")),
      }
    );
  };

  return (
    <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
          )}
          <View className="flex-1">
            <Text className="text-ink font-extrabold" style={{ fontSize: 26 }}>
              {gameType === "TOURNAMENT" ? "Tournaments" : "Games"}
            </Text>
            <Text className="text-muted" style={{ fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
              {isTournamentList ? "Find and join exciting tournaments near you" : "Find and join exciting games near you"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate("CreateGame", gameType ? { gameType } : undefined)}
          className="flex-row items-center bg-primary rounded-full px-5 py-3"
          style={{ gap: 6, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-bold" style={{ fontSize: 15 }}>
            Create
          </Text>
        </Pressable>
      </View>

      {/* Search */}
      <View className="px-5 mb-3 flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-1">
          <FieldInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={isTournamentList ? "Search tournaments, sport, location..." : "Search games, sport, location..."}
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ borderRadius: 28, height: 52 }}
            left={<Ionicons name="search-outline" size={20} color={colors.muted} style={{ marginRight: 8 }} />}
          />
        </View>
        <Pressable
          onPress={() => setSportSheetOpen(true)}
          className="items-center justify-center bg-white"
          style={{ width: 52, height: 52, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, ...cardShadow }}
        >
          <Ionicons name="options-outline" size={22} color={colors.ink} />
          {(!!selectedSportId || !!debouncedLocation) && (
            <View
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: colors.primary,
              }}
            />
          )}
        </Pressable>
      </View>

      {/* All / My Games / Time / Distance — one row, evenly spaced */}
      <View className="px-5 mb-3 flex-row items-center" style={{ gap: 8, zIndex: 20 }}>
          {(
            [
              { key: "all", label: "All" },
              { key: "mine", label: isTournamentList ? "My Tournaments" : "My Games" },
            ] as const
          ).map((p) => {
            const active = listFilter === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setListFilter(p.key)}
                className="rounded-full"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: active ? colors.primary : "white",
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text className="font-semibold" style={{ fontSize: 13.5, color: active ? "white" : colors.muted }}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
          {/* "Time" — opens the same date-range calendar as the admin panel's
              Bookings tab (BookingsDateRangeModal); results are limited to
              games whose date falls inside the picked range. */}
          <Pressable
            onPress={() => setTimeModalOpen(true)}
            className="flex-row items-center rounded-full"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              gap: 5,
              backgroundColor: timeRange ? colors.primary : "white",
              borderWidth: 1,
              borderColor: timeRange ? colors.primary : colors.border,
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={timeRange ? "white" : colors.muted} />
            <Text
              className="font-semibold"
              style={{ fontSize: 13.5, color: timeRange ? "white" : colors.muted, maxWidth: 84 }}
              numberOfLines={1}
            >
              {timeRange
                ? timeRange.start === timeRange.end
                  ? formatShortDate(timeRange.start)
                  : `${formatShortDate(timeRange.start)} - ${formatShortDate(timeRange.end)}`
                : "Time"}
            </Text>
            {timeRange ? (
              // Separate tap target from the pill itself — clears the range
              // without reopening the calendar.
              <Pressable onPress={() => setTimeRange(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="white" />
              </Pressable>
            ) : null}
          </Pressable>
        <View>
          <Pressable
            onPress={() => {
              // Ask for location the first time this is opened, same as the
              // Home screen's "near you" sections — a denied/pending permission
              // just means the km options won't be able to filter anything yet.
              if (locationStatus !== "granted") requestLocation();
              setDistanceOpen((v) => !v);
            }}
            className="flex-row items-center rounded-full"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 6,
              borderWidth: 1,
              backgroundColor: distanceKmFilter != null ? colors.primary : "white",
              borderColor: distanceKmFilter != null ? colors.primary : colors.border,
            }}
          >
            <Ionicons name="navigate-outline" size={14} color={distanceKmFilter != null ? "white" : colors.muted} />
            <Text
              className="font-semibold"
              style={{ fontSize: 13.5, color: distanceKmFilter != null ? "white" : colors.muted }}
            >
              {distanceKmFilter != null ? `${distanceKmFilter} km` : "Distance"}
            </Text>
            <Ionicons
              name={distanceOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={distanceKmFilter != null ? "white" : colors.muted}
            />
          </Pressable>
          {distanceOpen && (
            <View
              className="bg-white"
              style={{
                position: "absolute",
                right: 0,
                top: 46,
                minWidth: 150,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 4,
                zIndex: 30,
                ...cardShadow,
              }}
            >
              {locationStatus === "denied" && (
                <Text className="text-muted" style={{ fontSize: 11.5, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2 }}>
                  Enable location to filter by distance.
                </Text>
              )}
              {DISTANCE_OPTIONS_KM.map((km) => {
                const selected = distanceKmFilter === km;
                return (
                  <Pressable
                    key={km}
                    onPress={() => {
                      // Tapping the already-selected range clears the filter,
                      // same toggle-off behavior as the sport tiles.
                      setDistanceKmFilter(selected ? null : km);
                      setDistanceOpen(false);
                    }}
                    className="flex-row items-center justify-between"
                    style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
                  >
                    <Text
                      className={selected ? "font-bold" : "font-medium"}
                      style={{ fontSize: 14, color: selected ? colors.primaryDark : colors.ink }}
                    >
                      {km} km
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Location filter — always visible. The filter icon opens the sport-select
          sheet below it instead of toggling this. */}
      <View className="px-5 mb-3">
        <SearchField
          value={locationInput}
          onChangeText={setLocationInput}
          prefix="Filter by "
          variants={["location"]}
          autoCapitalize="none"
          autoCorrect={false}
          icon="location-outline"
          right={<Ionicons name="chevron-forward" size={18} color={colors.muted} />}
        />
      </View>
      <SelectSportModal
        visible={sportSheetOpen}
        onClose={() => setSportSheetOpen(false)}
        sports={sports ?? []}
        selectedSportId={selectedSportId}
        onApply={(id) => {
          setSelectedSportId(id);
          setSportSheetOpen(false);
        }}
      />
      <BookingsDateRangeModal
        visible={timeModalOpen}
        initialSelection={timeRange}
        onClose={() => setTimeModalOpen(false)}
        onSave={(selection) => {
          setTimeRange(selection);
          setTimeModalOpen(false);
        }}
      />

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
            debouncedSearch || debouncedLocation || listFilter !== "all" || timeRange ? (
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
