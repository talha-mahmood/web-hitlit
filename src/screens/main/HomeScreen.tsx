import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactElement } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, FlatList, Dimensions, RefreshControl, Alert } from "react-native";
import Image from "../../components/images/OptimizedImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { useProfileStore } from "../../store/profileStore";
import { useSports } from "../../hooks/useSports";
import { useGames } from "../../hooks/useGames";
import { useSquads } from "../../hooks/useSquads";
import { useEvents } from "../../hooks/useEvents";
import { useVenues } from "../../hooks/useVenues";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm, formatDistanceKm } from "../../lib/distance";
import { isVenueBoosted, type VenueListItem } from "../../lib/api/venues";
import type { GameListItem } from "../../lib/api/games";
import type { SquadListItem } from "../../lib/api/squads";
import type { EventListItem } from "../../lib/api/events";
import VenueCard from "../../components/VenueCard";
import { HomeSportTile, HomeSquadCard, HomeEventCard, HomeGameRowCard } from "../../components/HomeWideCards";
import { NearbyEmptyRow } from "../../components/NearbyCards";
import PromoCarousel, { type PromoSlide } from "../../components/PromoCarousel";
import NotificationBell from "../../components/NotificationBell";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import { SkeletonBlock, SkeletonCardRows } from "../../components/Skeleton";
import { useThemeStore } from "../../store/themeStore";
import { prefetchImages } from "../../services/images/imagePrefetch";
import { useMyOwnedSquads } from "../../hooks/useSquadTeamFill";
import { challengeFormatsForSport } from "../../lib/teamChallengeFormats";
import TeamManagerRequiredModal from "../../components/challenges/TeamManagerRequiredModal";
import TeamChallengeComposerModal from "../../components/challenges/TeamChallengeComposerModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VENUE_CARD_WIDTH = Math.round((SCREEN_WIDTH - 20 * 2 - 10) * 0.48);
const SPORT_TILE_WIDTH = 52;

type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeFeed">,
  BottomTabNavigationProp<MainTabParamList>
>;

// A distance (km) is attached to each item from the device's current
// coordinates, then the list is sorted nearest-first — items whose own
// location is unknown (no coords on the venue/game-venue/squad-owner's
// profile) sort to the end instead of being hidden.
function withDistance<T>(
  items: T[],
  coords: { latitude: number; longitude: number } | null,
  getLatLng: (item: T) => { lat: number | null; lng: number | null }
): { item: T; km: number | null }[] {
  const withKm = items.map((item) => {
    const { lat, lng } = getLatLng(item);
    const km = coords && lat != null && lng != null ? distanceKm(coords.latitude, coords.longitude, lat, lng) : null;
    return { item, km };
  });
  return withKm.sort((a, b) => {
    if (a.km === null && b.km === null) return 0;
    if (a.km === null) return 1;
    if (b.km === null) return -1;
    return a.km - b.km;
  });
}

function NearbySection<T>({
  title,
  titleIcon,
  data,
  isLoading,
  emptyIcon,
  emptyLabel,
  keyExtractor,
  renderItem,
  onSeeAll,
  seeAllLabel = "See all",
  // Venues/Squads stay a horizontal scroll (unchanged interaction — just a
  // restyled card). Games/Tournaments render as a short vertical preview
  // instead, matching the wide row-card layout — capped at previewCount
  // with the rest still reachable via "See all", same as before.
  horizontal = true,
  previewCount = 3,
}: {
  title: string;
  titleIcon: keyof typeof Ionicons.glyphMap;
  data: { item: T; km: number | null }[];
  isLoading: boolean;
  emptyIcon: ComponentProps<typeof NearbyEmptyRow>["icon"];
  emptyLabel: string;
  keyExtractor: (item: T) => string;
  renderItem: (entry: { item: T; km: number | null }) => ReactElement;
  onSeeAll: () => void;
  seeAllLabel?: string;
  horizontal?: boolean;
  previewCount?: number;
}) {
  return (
    <View className="mb-7">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Ionicons name={titleIcon} size={17} color={colors.primary} />
          <Text className="text-lg font-semibold text-ink">{title}</Text>
        </View>
        <Pressable onPress={onSeeAll} className="flex-row items-center" hitSlop={8} style={{ gap: 2 }}>
          <Text className="text-primary text-sm font-semibold">{seeAllLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
      {isLoading ? (
        horizontal ? (
          <View className="flex-row" style={{ gap: 10 }}>
            <SkeletonBlock width={160} height={120} borderRadius={16} />
            <SkeletonBlock width={160} height={120} borderRadius={16} />
          </View>
        ) : (
          <SkeletonCardRows count={2} />
        )
      ) : data.length === 0 ? (
        <NearbyEmptyRow icon={emptyIcon} label={emptyLabel} />
      ) : horizontal ? (
        <FlatList
          data={data}
          keyExtractor={(entry) => keyExtractor(entry.item)}
          horizontal
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          renderItem={({ item }) => renderItem(item)}
        />
      ) : (
        <View>
          {data.slice(0, previewCount).map((entry) => (
            <View key={keyExtractor(entry.item)}>{renderItem(entry)}</View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const profile = useProfileStore((s) => s.profile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const isLightTheme = themePreference === "light" || (themePreference === "system" && colors.background === "#F5F7FA");

  const [selectedSportId, setSelectedSportId] = useState<string | null>(null);
  const [challengeOpponent, setChallengeOpponent] = useState<SquadListItem | null>(null);
  const [managerRequiredVisible, setManagerRequiredVisible] = useState(false);
  const [challengeComposerVisible, setChallengeComposerVisible] = useState(false);
  const [resumeChallengeAfterTeamCreate, setResumeChallengeAfterTeamCreate] = useState(false);
  const leftHomeForTeamCreation = useRef(false);

  const { data: sports } = useSports();
  const { data: venues, isLoading: venuesLoading, refetch: refetchVenues, isRefetching: venuesRefetching } = useVenues({
    sportId: selectedSportId ?? undefined,
  });
  const { data: unreadCount } = useUnreadNotificationCount(userId);

  const { coords } = useDeviceLocation();
  const { data: games, isLoading: gamesLoading, refetch: refetchGames, isRefetching: gamesRefetching } = useGames({
    sportId: selectedSportId ?? undefined,
  });
  const { data: squads, isLoading: squadsLoading, refetch: refetchSquads, isRefetching: squadsRefetching } = useSquads({
    sportId: selectedSportId ?? undefined,
  });
  const { data: ownedSquads = [], refetch: refetchOwnedSquads } = useMyOwnedSquads(userId);
  const managedTeams = useMemo(
    () => ownedSquads.filter((squad) => squad.group_type === "team" && challengeFormatsForSport(squad.sports?.name).length > 0),
    [ownedSquads]
  );
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents, isRefetching: eventsRefetching } = useEvents();
  // Pull-to-refresh refetches everything this screen shows at once rather
  // than picking one "main" query — there isn't a single source of truth
  // here, just four independent lists.
  const isRefreshing = venuesRefetching || gamesRefetching || squadsRefetching || eventsRefetching;
  const handleRefresh = () => {
    refetchVenues();
    refetchGames();
    refetchSquads();
    refetchEvents();
  };

  const nearbyRegularGames = useMemo(
    () =>
      withDistance(
        (games ?? []).filter((g) => g.game_type !== "TOURNAMENT"),
        coords,
        (g: GameListItem) => ({ lat: g.venues?.latitude ?? null, lng: g.venues?.longitude ?? null })
      ),
    [games, coords]
  );
  const nearbyTournaments = useMemo(
    () =>
      withDistance(
        (games ?? []).filter((g) => g.game_type === "TOURNAMENT"),
        coords,
        (g: GameListItem) => ({ lat: g.venues?.latitude ?? null, lng: g.venues?.longitude ?? null })
      ),
    [games, coords]
  );
  const nearbySquads = useMemo(
    () =>
      withDistance(squads ?? [], coords, (s: SquadListItem) => ({
        lat: s.profiles?.latitude ?? null,
        lng: s.profiles?.longitude ?? null,
      })),
    [squads, coords]
  );
  const nearbyChallengeTeams = useMemo(
    () => nearbySquads.filter(({ item }) =>
      item.group_type === "team" &&
      challengeFormatsForSport(item.sports?.name).length > 0 &&
      item.squad_owner_id !== userId &&
      !item.squad_members.some((member) => member.status === "ACTIVE" && member.user_id === userId)
    ),
    [nearbySquads, userId]
  );
  const nearbyGroups = useMemo(
    () => nearbySquads.filter(({ item }) => item.group_type !== "team" || challengeFormatsForSport(item.sports?.name).length === 0),
    [nearbySquads]
  );
  const nearbyEvents = useMemo(
    () =>
      withDistance(events ?? [], coords, (e: EventListItem) => ({
        lat: e.profiles?.latitude ?? null,
        lng: e.profiles?.longitude ?? null,
      })),
    [events, coords]
  );
  const nearbyVenues = useMemo(() => {
    const sorted = withDistance(venues ?? [], coords, (v: VenueListItem) => ({
      lat: v.latitude,
      lng: v.longitude,
    }));
    // A boosted venue ("Boost Your Venue") is meant to come out on top for
    // its area regardless of exact distance, so it's pulled ahead of the
    // distance ordering rather than folded into it.
    return [...sorted].sort((a, b) => Number(isVenueBoosted(b.item)) - Number(isVenueBoosted(a.item)));
  }, [venues, coords]);

  useEffect(() => {
    if (!resumeChallengeAfterTeamCreate) return;
    if (!isFocused) {
      leftHomeForTeamCreation.current = true;
      return;
    }
    if (!leftHomeForTeamCreation.current || !challengeOpponent) return;
    leftHomeForTeamCreation.current = false;
    void refetchOwnedSquads().then(({ data }) => {
      setResumeChallengeAfterTeamCreate(false);
      if (data?.some((team) => team.group_type === "team" && team.sport_id === challengeOpponent.sport_id)) {
        setChallengeComposerVisible(true);
      }
    });
  }, [isFocused, resumeChallengeAfterTeamCreate, challengeOpponent, refetchOwnedSquads]);

  const beginChallenge = (opponent: SquadListItem) => {
    setChallengeOpponent(opponent);
    if (managedTeams.some((team) => team.sport_id === opponent.sport_id)) {
      setChallengeComposerVisible(true);
    } else {
      setManagerRequiredVisible(true);
    }
  };

  useEffect(() => {
    const likelyVisibleImages = [
      ...nearbyVenues.slice(0, 2).map(({ item }) => ({ url: item.venue_images?.[0]?.image_url, fit: "cover" as const })),
      ...nearbyRegularGames.slice(0, 2).map(({ item }) => ({ url: item.icon_url, fit: "cover" as const })),
      ...nearbySquads.slice(0, 2).map(({ item }) => ({ url: item.icon_url, fit: "cover" as const })),
      ...nearbyEvents.slice(0, 2).map(({ item }) => ({ url: item.icon_url, fit: "cover" as const })),
    ];
    void prefetchImages(likelyVisibleImages).catch(() => undefined);
  }, [nearbyVenues, nearbyRegularGames, nearbySquads, nearbyEvents]);

  const promoSlides: PromoSlide[] = [
    {
      key: "venues",
      title: "Book Premium Turfs",
      subtitle: "Top-rated venues, instant booking, zero hassle.",
      cta: "Explore Venues",
      icon: "flash",
      bgColor: "#0B3B24",
      accentColor: "#4ADE80",
      image: require("../../../assets/Slider-images/second_slider_image.png"),
    },
    {
      key: "squads",
      title: "Build Your Group",
      subtitle: "Find your regular crew and never play solo again.",
      cta: "Find Groups",
      icon: "people",
      bgColor: "#1E3A5F",
      accentColor: "#7DD3FC",
      image: require("../../../assets/Slider-images/third_slider_image.png"),
    },
  ];

  return (
    <View className="flex-1 bg-app">
      {/* Compact Jazba-style top bar. Existing profile and notification actions stay in place. */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          backgroundColor: colors.background,
        }}
      >
        <View className="flex-row items-center justify-between" style={{ minHeight: 46 }}>
          <Pressable
            onPress={() => setThemePreference(isLightTheme ? "dark" : "light")}
            accessibilityRole="switch"
            accessibilityLabel="Toggle light and dark theme"
            accessibilityState={{ checked: isLightTheme }}
            hitSlop={8}
            style={{
              width: 68,
              height: 36,
              borderRadius: 18,
              backgroundColor: isLightTheme ? "#E6E7E8" : "#34383D",
              borderWidth: 1,
              borderColor: isLightTheme ? "#D4D7DA" : "#555B61",
              justifyContent: "center",
              paddingHorizontal: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isLightTheme ? 0.14 : 0.24,
              shadowRadius: 3,
              elevation: 3,
            }}
          >
            <Ionicons
              name={isLightTheme ? "sunny" : "moon"}
              size={16}
              color="#F5B93B"
              style={{ position: "absolute", left: isLightTheme ? 10 : 41 }}
            />
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignSelf: isLightTheme ? "flex-end" : "flex-start",
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: isLightTheme ? "#F4F4F4" : "#D5D7D9",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.16,
                shadowRadius: 2,
                elevation: 2,
              }}
            />
          </Pressable>
          <View className="absolute left-0 right-0 items-center" pointerEvents="none">
            <Text className="text-ink font-extrabold" style={{ fontSize: 22, letterSpacing: -0.4 }}>HitLit</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <NotificationBell
              size={25}
              color={colors.ink}
              unreadCount={unreadCount}
              onPress={() => navigation.navigate("Notifications")}
            />
            <Pressable
              onPress={() => navigation.navigate("Profile", { screen: "ProfileHome" })}
              hitSlop={8}
              className="items-center justify-center"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceRaised, overflow: "hidden" }}
            >
              {profile?.avatar ? (
                <Image source={{ uri: profile.avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
              ) : (
                <Ionicons name="person" size={18} color={colors.ink} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
      <View className="px-3.5" style={{ paddingTop: 20 }}>
        <PromoCarousel slides={promoSlides} />

        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <Ionicons name="filter" size={16} color={colors.primary} />
          <Text className="text-lg font-semibold text-ink">Filter by Sport</Text>
        </View>
        <FlatList
          data={sports ?? []}
          keyExtractor={(s) => s.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
          className="mb-6"
          renderItem={({ item }) => (
            <HomeSportTile
              name={item.name}
              width={SPORT_TILE_WIDTH}
              selected={selectedSportId === item.id}
              onPress={() => setSelectedSportId((prev) => (prev === item.id ? null : item.id))}
            />
          )}
        />

        <NearbySection
          title="Venues near you"
          titleIcon="location"
          data={nearbyVenues}
          isLoading={venuesLoading}
          emptyIcon="location-outline"
          emptyLabel="No venues near you yet"
          keyExtractor={(v: VenueListItem) => v.id}
          renderItem={({ item, km }) => (
            <View style={{ width: VENUE_CARD_WIDTH }}>
              <VenueCard
                venue={item}
                showFavorite={false}
                minimal
                distanceLabel={km !== null ? formatDistanceKm(km) : undefined}
                onPress={() => navigation.navigate("VenueDetail", { venueId: item.id })}
              />
            </View>
          )}
          onSeeAll={() => navigation.navigate("Venues", { screen: "VenuesList" })}
        />

        <NearbySection
          title="Play Near You"
          titleIcon="football"
          data={nearbyChallengeTeams}
          isLoading={squadsLoading}
          emptyIcon="football-outline"
          emptyLabel="No teams for these sports near you yet"
          keyExtractor={(s: SquadListItem) => s.id}
          renderItem={({ item, km }) => (
            <View style={{ width: VENUE_CARD_WIDTH }}>
              <HomeSquadCard
                squad={item}
                currentUserId={userId}
                myGender={profile?.gender}
                distanceLabel={km !== null ? formatDistanceKm(km) : undefined}
                onChallenge={managedTeams.some((team) => team.id === item.id) ? undefined : () => beginChallenge(item)}
                onPress={() => navigation.navigate("SquadDetail", { squadId: item.id })}
              />
            </View>
          )}
          onSeeAll={() => navigation.navigate("ChallengeTeams", { sportId: selectedSportId ?? undefined })}
          seeAllLabel="See all"
        />

        <NearbySection
          title="Groups near you"
          titleIcon="people"
          data={nearbyGroups}
          isLoading={squadsLoading}
          emptyIcon="people-outline"
          emptyLabel="No groups near you yet"
          keyExtractor={(s: SquadListItem) => s.id}
          renderItem={({ item }) => (
            <View style={{ width: VENUE_CARD_WIDTH }}>
              <HomeSquadCard
                squad={item}
                currentUserId={userId}
                myGender={profile?.gender}
                onPress={() => navigation.navigate("SquadDetail", { squadId: item.id })}
              />
            </View>
          )}
          onSeeAll={() => navigation.navigate("SquadsList", undefined)}
        />

        <NearbySection
          title="Games near you"
          titleIcon="calendar"
          horizontal={false}
          data={nearbyRegularGames}
          isLoading={gamesLoading}
          emptyIcon="tennisball-outline"
          emptyLabel="No games near you yet"
          keyExtractor={(g: GameListItem) => g.id}
          renderItem={({ item, km }) => (
            <HomeGameRowCard
              game={item}
              distanceKm={km}
              onPress={() => navigation.navigate("GameDetail", { gameId: item.id })}
            />
          )}
          onSeeAll={() => navigation.navigate("GamesList", undefined)}
        />

        <NearbySection
          title="Tournaments near you"
          titleIcon="trophy"
          horizontal={false}
          data={nearbyTournaments}
          isLoading={gamesLoading}
          emptyIcon="trophy-outline"
          emptyLabel="No tournaments near you yet"
          keyExtractor={(g: GameListItem) => g.id}
          renderItem={({ item, km }) => (
            <HomeGameRowCard
              game={item}
              distanceKm={km}
              onPress={() => navigation.navigate("GameDetail", { gameId: item.id })}
            />
          )}
          onSeeAll={() => navigation.navigate("GamesList", { gameType: "TOURNAMENT" })}
        />

        <NearbySection
          title="Events near you"
          titleIcon="calendar-outline"
          data={nearbyEvents}
          isLoading={eventsLoading}
          emptyIcon="calendar-outline"
          emptyLabel="No events near you yet"
          keyExtractor={(e: EventListItem) => e.id}
          renderItem={({ item }) => (
            <View style={{ width: VENUE_CARD_WIDTH }}>
              <HomeEventCard
                event={item}
                currentUserId={userId}
                myGender={profile?.gender}
                onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
              />
            </View>
          )}
          onSeeAll={() => navigation.navigate("ExploreEvents", undefined)}
        />
      </View>
      </ScrollView>
      <TeamManagerRequiredModal
        visible={managerRequiredVisible}
        onClose={() => { setManagerRequiredVisible(false); setChallengeOpponent(null); }}
        onCreateTeam={() => {
          setManagerRequiredVisible(false);
          leftHomeForTeamCreation.current = false;
          setResumeChallengeAfterTeamCreate(true);
          navigation.navigate("CreateSquad", {
            presetType: "team",
            lockType: true,
            presetSportId: challengeOpponent?.sport_id ?? undefined,
            lockSport: Boolean(challengeOpponent?.sport_id),
          });
        }}
      />
      <TeamChallengeComposerModal
        visible={challengeComposerVisible}
        senderTeams={managedTeams}
        opponent={challengeOpponent}
        onClose={() => { setChallengeComposerVisible(false); setChallengeOpponent(null); }}
        onSent={() => {
          setChallengeComposerVisible(false);
          setChallengeOpponent(null);
          Alert.alert("Challenge sent", "The other team’s managers have been notified.");
        }}
      />
    </View>
  );
}
