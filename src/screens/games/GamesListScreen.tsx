import { View, Text, Image, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useIsFocused, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useGames, useJoinGame } from "../../hooks/useGames";
import { hasGameEnded, isGameLive } from "../../lib/api/games";
import { useRequestToJoinTeam } from "../../hooks/useTournamentTeams";
import { useSports } from "../../hooks/useSports";
import FieldInput from "../../components/FieldInput";
import SelectSportModal from "../../components/SelectSportModal";
import SelectDistanceModal from "../../components/SelectDistanceModal";
import SelectLocationModal from "../../components/SelectLocationModal";
import { SPORT_ICON_BADGE_SIZE } from "../../components/SportsBySportSection";
import JoinRequestModal from "../../components/JoinRequestModal";
import SelectJoinTeamModal, { type JoinableTeam } from "../../components/SelectJoinTeamModal";
import Bouncy from "../../components/Bouncy";
import AvatarStack from "../../components/AvatarStack";
import { colors, cardShadow, primaryButtonShadow, LIST_CARD_MIN_HEIGHT } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { GameListItem } from "../../lib/api/games";
import type { Database } from "../../types/database.types";
import { useAuthStore } from "../../store/authStore";
import { GAME_SKILL_COLORS, timeBadgeColor } from "../../lib/badgeColors";
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import { matchesLocationQuery } from "../../lib/locationFilter";
import BookingsDateRangeModal, { type DateSelection } from "../../components/BookingsDateRangeModal";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GradientFill from "../../components/GradientFill";
import { SkeletonCardRows } from "../../components/Skeleton";

type Nav = NativeStackNavigationProp<GamesStackParamList, "GamesList">;
type GamesListRoute = RouteProp<GamesStackParamList, "GamesList">;

// Matches the header's Create button's rendered footprint (px-3 py-2 +
// "Create" text + its icon) so the card's Join CTA reads as the same size
// even though its own label has no icon and varies ("Join"/"Joined"/"Requested").
const JOIN_BUTTON_MIN_WIDTH = 96;

// Shared fill for the filter-row pills below (All/My Games, Tournaments,
// Location, Sports, Time, Distance) — an active pill renders the brand
// gradient, an inactive one stays flat white, same look as before just with
// a real gradient instead of a flat green.
function FilterPillFill({
  active,
  className,
  style,
  children,
}: {
  active: boolean;
  className?: string;
  style?: object;
  children: ReactNode;
}) {
  if (active) {
    return (
      <GradientFill className={className} style={style}>
        {children}
      </GradientFill>
    );
  }
  return (
    <View className={className} style={{ backgroundColor: "white", ...style }}>
      {children}
    </View>
  );
}

function formatTimeRange(startTime: string, endTime: string): string {
  const fmt = (t: string) =>
    new Date(`2000-01-01T${t}`).toLocaleTimeString("en-PK", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${fmt(startTime)} - ${fmt(endTime)}`;
}

// Same "Today"/"Tomorrow"/date idea as badgeColors' dayLabel, but without
// the weekday — the card is tight on space, so just the date is enough
// here (the detail screen still shows the full day name).
function cardDayLabel(dateStr: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
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
  onTeamJoinPress,
  currentUserId,
  index,
}: {
  game: GameListItem;
  onPress: () => void;
  // Regular games only — opens the join-request modal right from the card.
  onJoinPress: () => void;
  // Team-based games/tournaments — opens the "pick a team" sheet instead.
  onTeamJoinPress: () => void;
  currentUserId?: string;
  index: number;
}) {
  const isTournament = game.game_type === "TOURNAMENT";
  // True for real tournaments and for regular games created with the newer
  // team-based join flow (2 teams by default) — false only for old-style
  // regular games that still use the flat game_players join list.
  const isTeamBased = game.number_of_teams != null;
  const joined = game.game_players.filter((p) => p.status === "JOINED");
  const hasJoinedTeam =
    isTeamBased &&
    !!currentUserId &&
    game.tournament_teams.some(
      (t) => t.status !== "REJECTED" && t.tournament_team_members.some((m) => m.user_id === currentUserId && m.status === "JOINED")
    );
  const hasJoined = isTeamBased ? hasJoinedTeam : game.game_players.some((p) => p.user_id === currentUserId && p.status === "JOINED");
  const hasRequested = !isTeamBased && game.game_players.some((p) => p.user_id === currentUserId && p.status === "PENDING");
  // Only teams the host has actually approved count toward the roster — a
  // team that's still forming or awaiting approval hasn't secured a slot
  // yet, so it shouldn't move the "X/Y teams" count.
  const approvedTeams = game.tournament_teams.filter((t) => t.status === "APPROVED");
  const requiredTeams = game.number_of_teams ?? 0;
  const spotsLeft = game.max_players - joined.length;
  const teamsLeft = requiredTeams - approvedTeams.length;
  const isFull = game.status === "FULL" || (isTeamBased ? teamsLeft <= 0 : spotsLeft <= 0);
  const isCompleted = game.status === "COMPLETED";
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
      : `${cardDayLabel(game.game_date)} · ${formatTimeRange(game.start_time, game.end_time)}`;
  const badgeColor = isTournament ? "#7C3AED" : timeBadgeColor(game.start_time);

  const sportName = game.sports?.name ?? "";
  const sportPhoto = getSportImage(sportName);
  const sportGlyph = getSportIcon(sportName);
  // The title/location/people rows keep clear of the sport picture on the right.
  const rightGutter = { paddingRight: 92 };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      <Bouncy
        onPress={onPress}
        // Spacing between cards comes from the FlatList's own
        // contentContainerStyle gap below, not a className margin here —
        // Bouncy's explicit style prop (needed for the press animation)
        // takes priority over a className-derived margin, so a margin set
        // here never actually showed up.
        style={{ ...cardShadow, backgroundColor: "white", borderRadius: 24 }}
        scaleTo={0.98}
      >
        {/* Laid out as the same five rows (and the same min height / font
            sizes) as the Squads list card: CTA pinned top-right, sport
            picture in the disc on the right edge, then title, location,
            people line, badge line, skill + price line. */}
        <View
          className="border border-border overflow-hidden bg-white"
          style={{ borderRadius: 24, position: "relative", minHeight: LIST_CARD_MIN_HEIGHT }}
        >
          {/* Join/Joined/Requested/Full/hosting CTA — pinned to the top-right
              corner. Nested Bouncy so a tap here doesn't also trigger the
              card's own onPress. */}
          <View style={{ position: "absolute", top: 16, right: 16, zIndex: 5 }}>
            {isMyGame ? (
              <View className="bg-blue-50 rounded-2xl px-3 py-2">
                <Text className="text-blue-600 font-bold text-sm">{isTournament ? "My Tournament" : "My Game"}</Text>
              </View>
            ) : isCompleted ? (
              <View className="bg-gray-100 rounded-2xl px-3 py-2">
                <Text className="text-muted font-bold text-sm">Completed</Text>
              </View>
            ) : isFull && !hasJoined ? (
              <View className="bg-red-50 rounded-2xl px-3 py-2">
                <Text className="text-red-600 font-bold text-sm">Full</Text>
              </View>
            ) : (
              <Bouncy
                onPress={isTeamBased ? (hasJoined ? onPress : onTeamJoinPress) : onJoinPress}
                scaleTo={0.94}
              >
                {hasJoined ? (
                  <View
                    className="flex-row items-center justify-center bg-green-50 rounded-2xl px-3 py-2"
                    style={{ gap: 4, minWidth: 78 }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text className="text-primary font-semibold text-sm">Joined</Text>
                  </View>
                ) : hasRequested ? (
                  <View className="items-center justify-center bg-orange-50 rounded-2xl px-3 py-2" style={{ minWidth: 78 }}>
                    <Text className="text-orange-600 font-semibold text-sm">Requested</Text>
                  </View>
                ) : (
                  <GradientFill
                    className="items-center justify-center rounded-2xl px-3 py-2"
                    style={{ minWidth: 78, ...primaryButtonShadow }}
                  >
                    <Text className="text-white font-bold text-sm">Join</Text>
                  </GradientFill>
                )}
              </Bouncy>
            )}
          </View>

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
              backgroundColor: "#DCEFE4",
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
            {/* Row 1: Icon (if the host set a custom one) + Title — kept clear
                of the corner CTA via a wider right gutter, one line. */}
            <View className="flex-row items-center mb-1.5" style={{ gap: 8, paddingRight: 100 }}>
              {game.icon_url && (
                <Image
                  source={{ uri: game.icon_url }}
                  style={{ width: SPORT_ICON_BADGE_SIZE, height: SPORT_ICON_BADGE_SIZE, borderRadius: 8 }}
                  resizeMode="cover"
                />
              )}
              <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 20 }} numberOfLines={1}>
                {game.title}
              </Text>
            </View>

            {/* Row 2: Location */}
            <View className="flex-row items-center mb-2.5" style={{ gap: 5, ...rightGutter }}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                {game.venues
                  ? `${game.venues.name}${game.venues.city ? ` · ${game.venues.city}` : ""}`
                  : game.custom_venue_name ?? "Location not set"}
              </Text>
            </View>

            {/* Row 3: avatar stack + going/teams count and how many are left
                + the sport pill, pinned to the right of that text. */}
            <View className="flex-row items-center mb-3" style={{ gap: 8, ...rightGutter }}>
              <AvatarStack
                people={joined.map((p) => ({
                  avatar: p.profiles?.avatar ?? null,
                  name: p.profiles?.full_name ?? p.manual_name ?? null,
                }))}
                size={30}
              />
              <Text className="text-muted font-medium" style={{ fontSize: 14, flexShrink: 1 }} numberOfLines={1}>
                {isTeamBased
                  ? `${approvedTeams.length} team${approvedTeams.length !== 1 ? "s" : ""} · ${Math.max(teamsLeft, 0)} left`
                  : `${joined.length} Going · ${Math.max(spotsLeft, 0)} left`}
              </Text>
              <View className="bg-primary-light px-3 py-1 rounded-full" style={{ flexShrink: 0 }}>
                <Text className="text-primary text-xs font-bold" numberOfLines={1}>
                  {game.sports?.name ?? "Sport"}
                </Text>
              </View>
            </View>

            {/* Row 4: when — alone on its own row now that the sport pill
                moved up to Row 3. */}
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <View
                className="flex-row items-center px-3 py-1 rounded-full"
                style={{ backgroundColor: badgeColor, gap: 5, flexShrink: 1 }}
              >
                <Ionicons
                  name={isTournament && game.end_date && game.end_date !== game.game_date ? "calendar-outline" : "time-outline"}
                  size={13}
                  color="white"
                />
                <Text className="text-white text-xs font-bold" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {badgeLabel}
                </Text>
              </View>
            </View>

            {/* Row 5: skill pill + entry fee */}
            <View className="flex-row items-center mt-3" style={{ minHeight: 30 }}>
              {skillColor && skillLabel && (
                <View
                  className="flex-row items-center"
                  style={{ backgroundColor: skillColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, gap: 6 }}
                >
                  <Ionicons name="stats-chart" size={13} color="white" />
                  <Text style={{ color: "white", fontSize: 12.5, fontWeight: "700" }}>{skillLabel}</Text>
                </View>
              )}
              {skillColor && skillLabel ? (
                <View style={{ width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 12 }} />
              ) : null}
              <Ionicons name="ticket-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
              <Text className="flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                <Text className="font-bold" style={{ color: colors.primary }}>
                  {game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()}` : "Free"}
                </Text>
                <Text className="text-muted">{isTournament ? " per team" : " per person"}</Text>
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
  const isFocused = useIsFocused();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(
    route.params?.sportId
  );
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationTags, setLocationTags] = useState<string[]>([]);
  // "All" / "Upcoming" / "Live" / "Completed" / "My Games" pills, the "Time"
  // range pill, and the distance dropdown beside them.
  const [listFilter, setListFilter] = useState<"all" | "upcoming" | "live" | "completed" | "mine">("all");
  const [timeRange, setTimeRange] = useState<DateSelection | null>(null);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [distanceOpen, setDistanceOpen] = useState(false);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();
  const myOnly = listFilter === "mine";
  const upcomingOnlyFilter = listFilter === "upcoming";
  const liveOnlyFilter = listFilter === "live";
  const completedOnlyFilter = listFilter === "completed";
  const gameType = route.params?.gameType;
  // Off = only regular games, on = only tournaments — an entry point that
  // opens this screen already scoped to tournaments (e.g. "Explore
  // Tournaments") just starts the toggle on; the user can still flip it.
  const [showTournaments, setShowTournaments] = useState(gameType === "TOURNAMENT");
  const isTournamentList = showTournaments;

  // navigation.navigate() re-focuses this screen (already mounted in the
  // stack) instead of remounting it, so a new sportId param wouldn't
  // otherwise reach the useState initializer above — sync it explicitly.
  useEffect(() => {
    setSelectedSportId(route.params?.sportId);
  }, [route.params?.sportId]);

  useEffect(() => {
    setShowTournaments(gameType === "TOURNAMENT");
  }, [gameType]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: sports } = useSports();
  const { data: gamesData, isLoading, isRefetching, refetch } = useGames({
    sportId: selectedSportId,
    gameType: showTournaments ? "TOURNAMENT" : "REGULAR",
  });
  // The search box matches a game's name/ID, its sport, and its venue/location.
  const searched = debouncedSearch
    ? (gamesData ?? []).filter((g) =>
        [g.title, g.game_code, g.sports?.name, g.venues?.name, g.venues?.city, g.venues?.address, g.custom_venue_name].some(
          (v) => !!v && v.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
      )
    : gamesData;
  const locationFiltered = locationTags.length > 0
    ? (searched ?? []).filter((g) =>
        matchesLocationQuery(
          [g.venues?.name, g.venues?.city, g.venues?.address, g.custom_venue_name],
          locationTags
        )
      )
    : searched;
  const scoped = myOnly
    ? (locationFiltered ?? []).filter(
        (g) =>
          g.creator_id === userId ||
          g.game_players.some((p) => p.user_id === userId && p.status === "JOINED") ||
          g.tournament_teams.some((t) =>
            t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED")
          )
      )
    : upcomingOnlyFilter
    ? (locationFiltered ?? []).filter(
        (g) => !hasGameEnded(g.game_date, g.end_date, g.end_time) && !isGameLive(g.game_date, g.start_time, g.end_date, g.end_time)
      )
    : liveOnlyFilter
    ? (locationFiltered ?? []).filter((g) => isGameLive(g.game_date, g.start_time, g.end_date, g.end_time))
    : completedOnlyFilter
    ? (locationFiltered ?? []).filter((g) => g.status === "COMPLETED")
    : locationFiltered;
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
  // Same shared-instance pattern for team-based games/tournaments — picking
  // a team here joins it directly (see requestToJoinTeam's rejoin-safe
  // upsert), no host approval step needed.
  const [teamJoinTargetGame, setTeamJoinTargetGame] = useState<GameListItem | null>(null);
  const qc = useQueryClient();
  const requestToJoinTeam = useRequestToJoinTeam(teamJoinTargetGame?.id ?? "");
  const joinableTeams: JoinableTeam[] = teamJoinTargetGame
    ? teamJoinTargetGame.tournament_teams
        .filter((t) => t.status !== "REJECTED")
        .filter((t) => {
          const joinedCount = t.tournament_team_members.filter((m) => m.status === "JOINED").length;
          const requiredSize = teamJoinTargetGame.players_per_team ?? 0;
          return requiredSize <= 0 || joinedCount < requiredSize;
        })
        .map((t) => ({
          id: t.id,
          name: t.name,
          joinedCount: t.tournament_team_members.filter((m) => m.status === "JOINED").length,
          requiredSize: teamJoinTargetGame.players_per_team ?? 0,
        }))
    : [];
  const handleSelectJoinTeam = (teamId: string) => {
    if (!userId || !teamJoinTargetGame) return;
    requestToJoinTeam.mutate(
      { teamId, userId },
      {
        onSuccess: () => {
          setTeamJoinTargetGame(null);
          qc.invalidateQueries({ queryKey: ["games"] });
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not join this team.")),
      }
    );
  };
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
    <View className="flex-1 bg-white">
      {isFocused ? <StatusBar style="light" /> : null}
      {/* Fixed dark-green banner — same treatment as the Community tab's header. */}
      <GradientFill
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 14,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
            {navigation.canGoBack() && (
              <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color="white" />
              </Pressable>
            )}
            <View className="flex-1">
              <Text className="text-white font-extrabold" style={{ fontSize: 26 }}>
                {gameType === "TOURNAMENT" ? "Tournaments" : "Games"}
              </Text>
              <Text style={{ fontSize: 12.5, marginTop: 1, color: "white" }} numberOfLines={1}>
                {isTournamentList ? "Find and join tournaments nearby" : "Find and join games nearby"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate("CreateGame", gameType ? { gameType } : undefined)}
            className="flex-row items-center bg-white rounded-full px-5 py-3"
            style={{ gap: 6, ...cardShadow }}
          >
            <Ionicons name="add" size={20} color={colors.primaryDark} />
            <Text className="font-bold" style={{ fontSize: 15, color: colors.primaryDark }}>
              Create
            </Text>
          </Pressable>
        </View>
      </GradientFill>

      <View style={{ paddingTop: 16 }}>
      {/* Search — the sport filter used to sit as an icon button here; it's
          now the "Sports" pill in the filter row below instead. */}
      <View className="px-3.5 mb-3">
        <FieldInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={isTournamentList ? "Search tournaments..." : "Search games, tournaments..."}
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ borderRadius: 28, height: 52 }}
          left={<Ionicons name="search-outline" size={20} color={colors.muted} style={{ marginRight: 8 }} />}
        />
      </View>

      {/* All / My Games / Time / Distance — one row, evenly spaced. Wrapped in
          a relatively-positioned box so the Distance dropdown below can float
          over "Filter by location" instead of pushing it down. */}
      <View style={{ position: "relative", zIndex: 20 }}>
      <View
  style={{
    marginBottom: 12,
  }}
>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    }}
  >
          {(
            [
              { key: "all", label: "All" },
              { key: "upcoming", label: "Upcoming" },
              { key: "live", label: "Live" },
              { key: "completed", label: "Completed" },
              { key: "mine", label: isTournamentList ? "My Tournaments" : "My Games" },
            ] as const
          ).map((p) => {
            const active = listFilter === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => {
                  setDistanceOpen(false);
                  setListFilter(p.key);
                }}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <FilterPillFill active={active} className="rounded-full" style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text className="font-medium" style={{ fontSize: 13.5, color: active ? "white" : colors.muted }}>
                    {p.label}
                  </Text>
                </FilterPillFill>
              </Pressable>
            );
          })}
          {/* "Tournaments" — off shows only regular games, on shows only
              tournaments (never both mixed together). Hidden entirely when
              this screen was opened specifically for tournaments (e.g. via
              Home's "Tournaments near you" → See all) — that listing should
              only ever show tournament cards, with no way to switch it off. */}
          {gameType !== "TOURNAMENT" && (
            <Pressable
              onPress={() => setShowTournaments((v) => !v)}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: showTournaments ? colors.primary : colors.border,
              }}
            >
              <FilterPillFill
                active={showTournaments}
                className="flex-row items-center rounded-full"
                style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 5 }}
              >
                <Ionicons name="trophy-outline" size={14} color={showTournaments ? "white" : colors.muted} />
                <Text className="font-medium" style={{ fontSize: 13.5, color: showTournaments ? "white" : colors.muted }}>
                  Tournaments
                </Text>
              </FilterPillFill>
            </Pressable>
          )}
          {/* "Location" — opens a bottom sheet with a free-text field plus
              city suggestions (multi-select), in place of the old
              always-visible inline field. Right after All/My Games. */}
          <Pressable
            onPress={() => setLocationOpen(true)}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: locationTags.length > 0 ? colors.primary : colors.border,
            }}
          >
            <FilterPillFill
              active={locationTags.length > 0}
              className="flex-row items-center rounded-full"
              style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 5 }}
            >
              <Ionicons name="location-outline" size={14} color={locationTags.length > 0 ? "white" : colors.muted} />
              <Text
                className="font-medium"
                style={{ fontSize: 13.5, color: locationTags.length > 0 ? "white" : colors.muted }}
                numberOfLines={1}
              >
                {locationTags.length > 0
                  ? locationTags.length === 1
                    ? locationTags[0]
                    : `${locationTags.length} locations`
                  : "Location"}
              </Text>
            </FilterPillFill>
          </Pressable>
          {/* "Sports" — opens the same sport-select sheet the filter icon
              next to the search box used to open. */}
          <Pressable
            onPress={() => {
              setDistanceOpen(false);
              setSportSheetOpen(true);
            }}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selectedSportId ? colors.primary : colors.border,
            }}
          >
            <FilterPillFill
              active={!!selectedSportId}
              className="flex-row items-center rounded-full"
              style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 5 }}
            >
              <Ionicons name="options-outline" size={14} color={selectedSportId ? "white" : colors.muted} />
              <Text
                className="font-medium"
                style={{ fontSize: 13.5, color: selectedSportId ? "white" : colors.muted }}
                numberOfLines={1}
              >
                Sports
              </Text>
            </FilterPillFill>
          </Pressable>
          {/* "Time" — opens the same date-range calendar as the admin panel's
              Bookings tab (BookingsDateRangeModal); results are limited to
              games whose date falls inside the picked range. */}
          <Pressable
            onPress={() => {
              setDistanceOpen(false);
              setTimeModalOpen(true);
            }}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: timeRange ? colors.primary : colors.border,
            }}
          >
            <FilterPillFill
              active={!!timeRange}
              className="flex-row items-center rounded-full"
              style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 5 }}
            >
              <Ionicons name="calendar-outline" size={12} color={timeRange ? "white" : colors.muted} />
              <Text
                className="font-medium"
                style={{ fontSize: 13.5, color: timeRange ? "white" : colors.muted }}
                numberOfLines={1}
              >
                {timeRange
                  ? timeRange.start === timeRange.end
                    ? formatShortDate(timeRange.start)
                    : `${formatShortDate(timeRange.start)} - ${formatShortDate(timeRange.end)}`
                  : "Date"}
              </Text>
              {timeRange ? (
                // Separate tap target from the pill itself — clears the range
                // without reopening the calendar.
                <Pressable onPress={() => setTimeRange(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="white" />
                </Pressable>
              ) : null}
            </FilterPillFill>
          </Pressable>
          {/* "Distance" — plain pill like Sports, opening a bottom sheet
              instead of the small inline dropdown it used to expand into. */}
          <Pressable
            onPress={() => {
              // Ask for location the first time this is opened, same as the
              // Home screen's "near you" sections — a denied/pending permission
              // just means the km options won't be able to filter anything yet.
              if (locationStatus !== "granted") requestLocation();
              setDistanceOpen(true);
            }}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: distanceKmFilter != null ? colors.primary : colors.border,
            }}
          >
            <FilterPillFill
              active={distanceKmFilter != null}
              className="flex-row items-center rounded-full"
              style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 5 }}
            >
              <Ionicons name="navigate-outline" size={14} color={distanceKmFilter != null ? "white" : colors.muted} />
              <Text
                className="font-medium"
                style={{ fontSize: 13.5, color: distanceKmFilter != null ? "white" : colors.muted }}
                numberOfLines={1}
              >
                {distanceKmFilter != null ? `${distanceKmFilter} km` : "Distance"}
              </Text>
            </FilterPillFill>
          </Pressable>
        </ScrollView>
</View>
      </View>
      </View>

      <SelectDistanceModal
        visible={distanceOpen}
        onClose={() => setDistanceOpen(false)}
        options={DISTANCE_OPTIONS_KM}
        selectedKm={distanceKmFilter}
        locationDenied={locationStatus === "denied"}
        onApply={(km) => {
          setDistanceKmFilter(km);
          setDistanceOpen(false);
        }}
      />

      <SelectLocationModal
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        value={locationTags}
        onApply={(locs) => {
          setLocationTags(locs);
          setLocationOpen(false);
        }}
      />
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
        <View className="px-3.5 pt-1">
          <SkeletonCardRows />
        </View>
      ) : (
        <FlatList
          data={games ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20, paddingTop: 4, gap: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            debouncedSearch || locationTags.length > 0 || listFilter !== "all" || timeRange ? (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">
                  No {isTournamentList ? "tournaments" : "games"} found
                </Text>
                <Text className="text-muted text-sm text-center px-8">
                  {debouncedSearch && locationTags.length > 0
                    ? `No ${isTournamentList ? "tournaments" : "games"} match "${debouncedSearch}" near "${locationTags.join(", ")}".`
                    : locationTags.length > 0
                      ? `No ${isTournamentList ? "tournaments" : "games"} found near "${locationTags.join(", ")}".`
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
                  className="mt-2"
                >
                  <GradientFill className="rounded-xl px-6 py-3">
                    <Text className="text-white font-semibold">
                      Create a {isTournamentList ? "Tournament" : "Game"}
                    </Text>
                  </GradientFill>
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
              onTeamJoinPress={() => setTeamJoinTargetGame(item)}
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

      <SelectJoinTeamModal
        visible={!!teamJoinTargetGame}
        onClose={() => setTeamJoinTargetGame(null)}
        teams={joinableTeams}
        submitting={requestToJoinTeam.isPending}
        onSelect={handleSelectJoinTeam}
      />
    </View>
  );
}
