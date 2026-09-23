import { useMemo, useState, type ComponentProps, type ReactElement } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image, FlatList, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { useProfileStore } from "../../store/profileStore";
import { useSports } from "../../hooks/useSports";
import { useGames } from "../../hooks/useGames";
import { useSquads } from "../../hooks/useSquads";
import { useVenues } from "../../hooks/useVenues";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm, formatDistanceKm } from "../../lib/distance";
import { isVenueBoosted, type VenueListItem } from "../../lib/api/venues";
import type { GameListItem } from "../../lib/api/games";
import type { SquadListItem } from "../../lib/api/squads";
import VenueCard from "../../components/VenueCard";
import { HomeSportTile, HomeSquadCard, HomeGameRowCard } from "../../components/HomeWideCards";
import { NearbyEmptyRow } from "../../components/NearbyCards";
import PromoCarousel, { type PromoSlide } from "../../components/PromoCarousel";
import NotificationBell from "../../components/NotificationBell";
import WavingHandIcon from "../../components/WavingHandIcon";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VENUE_CARD_WIDTH = Math.round((SCREEN_WIDTH - 20 * 2 - 10) * 0.48);
const SPORT_TILE_WIDTH = 74;

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
          <Text className="text-primary text-sm font-semibold">See all</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
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
  const insets = useSafeAreaInsets();

  const [selectedSportId, setSelectedSportId] = useState<string | null>(null);

  const { data: sports } = useSports();
  const { data: venues, isLoading: venuesLoading } = useVenues({
    sportId: selectedSportId ?? undefined,
  });
  const { data: unreadCount } = useUnreadNotificationCount(userId);

  const { coords } = useDeviceLocation();
  const { data: games, isLoading: gamesLoading } = useGames({
    sportId: selectedSportId ?? undefined,
  });
  const { data: squads, isLoading: squadsLoading } = useSquads({
    sportId: selectedSportId ?? undefined,
  });

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

  const promoSlides: PromoSlide[] = [
    {
      key: "tournaments",
      title: "Compete & Win Big",
      subtitle: "Join tournaments across your city and prove your game.",
      cta: "View Tournaments",
      icon: "trophy",
      bgColor: "#111827",
      accentColor: "#F59E0B",
      onPress: () => navigation.navigate("GamesList", { gameType: "TOURNAMENT" }),
    },
    {
      key: "venues",
      title: "Book Premium Turfs",
      subtitle: "Top-rated venues, instant booking, zero hassle.",
      cta: "Explore Venues",
      icon: "flash",
      bgColor: "#0B3B24",
      accentColor: "#4ADE80",
      onPress: () => navigation.navigate("Venues", { screen: "VenuesList" }),
    },
    {
      key: "squads",
      title: "Build Your Squad",
      subtitle: "Find your regular crew and never play solo again.",
      cta: "Find Squads",
      icon: "people",
      bgColor: "#1E3A5F",
      accentColor: "#7DD3FC",
      onPress: () => navigation.navigate("SquadsList", undefined),
    },
    {
      key: "games",
      title: "Jump Into a Game",
      subtitle: "Browse open games nearby and play today.",
      cta: "Browse Games",
      icon: "flame",
      bgColor: "#7C2D12",
      accentColor: "#FDBA74",
      onPress: () => navigation.navigate("GamesList", undefined),
    },
  ];

  return (
    <ScrollView className="flex-1 bg-green-50" contentContainerStyle={{ paddingBottom: 24 }}>
      <View className="px-5" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center mb-5" style={{ gap: 12 }}>
          <Pressable
            onPress={() => navigation.navigate("Profile", { screen: "ProfileHome" })}
            className="flex-row items-center flex-1"
            style={{ gap: 12 }}
          >
            {profile?.avatar ? (
              <Image
                source={{ uri: profile.avatar }}
                className="w-12 h-12 rounded-full bg-primary-light border-2 border-primary"
              />
            ) : (
              <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center border-2 border-primary">
                <Text className="text-lg font-bold text-primary">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-2xl font-bold text-ink">
                  Hey {profile?.full_name?.split(" ")[0] ?? "there"}!
                </Text>
                <WavingHandIcon size={22} />
              </View>
              <Text className="text-muted mt-1">What are you playing today?</Text>
            </View>
          </Pressable>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <NotificationBell
              unreadCount={unreadCount}
              onPress={() => navigation.navigate("Notifications")}
            />
          </View>
        </View>

        <PromoCarousel slides={promoSlides} />

        <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
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
                distanceLabel={km !== null ? formatDistanceKm(km) : undefined}
                maxSportChips={2}
                onPress={() => navigation.navigate("VenueDetail", { venueId: item.id })}
              />
            </View>
          )}
          onSeeAll={() => navigation.navigate("Venues", { screen: "VenuesList" })}
        />

        <NearbySection
          title="Squads near you"
          titleIcon="people"
          data={nearbySquads}
          isLoading={squadsLoading}
          emptyIcon="people-outline"
          emptyLabel="No squads near you yet"
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
      </View>
    </ScrollView>
  );
}
