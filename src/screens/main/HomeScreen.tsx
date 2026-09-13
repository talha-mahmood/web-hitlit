import { useMemo, useState, type ComponentProps, type ReactElement } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image, FlatList } from "react-native";
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
import { useFavoriteVenueIds, useToggleFavoriteVenue } from "../../hooks/useFavoriteVenues";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import { isVenueBoosted, type VenueListItem } from "../../lib/api/venues";
import type { GameListItem } from "../../lib/api/games";
import type { SquadListItem } from "../../lib/api/squads";
import SportsBySportSection from "../../components/SportsBySportSection";
import {
  NearbyGameCard,
  NearbySquadCard,
  NearbyVenueCard,
  NearbyEmptyRow,
  NEARBY_CARD_GAP,
} from "../../components/NearbyCards";
import PromoCarousel, { type PromoSlide } from "../../components/PromoCarousel";
import NotificationBell from "../../components/NotificationBell";
import WavingHandIcon from "../../components/WavingHandIcon";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";

type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeFeed">,
  BottomTabNavigationProp<MainTabParamList>
>;

function HomeActionCard({
  title,
  subtitle,
  emoji,
  onPress,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-4 justify-between"
      style={{
        width: "48%",
        height: 120,
        borderWidth: 1,
        borderColor: "rgba(17, 24, 39, 0.06)",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 6,
      }}
    >
      <View>
        <Text className="text-ink font-extrabold text-base">{title}</Text>
        <Text className="text-muted text-xs mt-1">{subtitle}</Text>
      </View>
      <Text style={{ fontSize: 32, textAlign: "right" }}>{emoji}</Text>
    </Pressable>
  );
}

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
  data,
  isLoading,
  emptyIcon,
  emptyLabel,
  keyExtractor,
  renderItem,
  onSeeAll,
}: {
  title: string;
  data: { item: T; km: number | null }[];
  isLoading: boolean;
  emptyIcon: ComponentProps<typeof NearbyEmptyRow>["icon"];
  emptyLabel: string;
  keyExtractor: (item: T) => string;
  renderItem: (entry: { item: T; km: number | null }) => ReactElement;
  onSeeAll: () => void;
}) {
  return (
    <View className="mb-7">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-ink">{title}</Text>
        <Pressable onPress={onSeeAll} className="flex-row items-center" hitSlop={8} style={{ gap: 2 }}>
          <Text className="text-primary text-sm font-semibold">See all</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : data.length === 0 ? (
        <NearbyEmptyRow icon={emptyIcon} label={emptyLabel} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(entry) => keyExtractor(entry.item)}
          horizontal
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ width: NEARBY_CARD_GAP }} />}
          renderItem={({ item }) => renderItem(item)}
        />
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
  const { data: favoriteIds } = useFavoriteVenueIds();
  const toggleFavorite = useToggleFavoriteVenue();
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
      onPress: () => navigation.navigate("Squads", { screen: "SquadsList" }),
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
    <ScrollView className="flex-1 bg-gray-100" contentContainerStyle={{ paddingBottom: 24 }}>
      <View className="px-5" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center mb-5" style={{ gap: 12 }}>
          <Pressable
            onPress={() => navigation.navigate("Profile", { screen: "ProfileHome" })}
            className="flex-row items-center flex-1"
            style={{ gap: 12 }}
          >
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} className="w-12 h-12 rounded-full bg-primary-light" />
            ) : (
              <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center">
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
          <NotificationBell
            unreadCount={unreadCount}
            onPress={() => navigation.navigate("Notifications")}
          />
        </View>

        <PromoCarousel slides={promoSlides} />

        <Text className="text-lg font-semibold text-ink mb-3">Filter by Sport</Text>
        <SportsBySportSection
          sports={sports ?? []}
          selectedSportId={selectedSportId}
          onSelectSport={(sportId) =>
            setSelectedSportId((prev) => (prev === sportId ? null : sportId))
          }
        />

        <NearbySection
          title="Venues near you"
          data={nearbyVenues}
          isLoading={venuesLoading}
          emptyIcon="location-outline"
          emptyLabel="No venues near you yet"
          keyExtractor={(v: VenueListItem) => v.id}
          renderItem={({ item, km }) => (
            <NearbyVenueCard
              venue={item}
              distanceKm={km}
              isFavorite={favoriteIds?.has(item.id) ?? false}
              onPress={() => navigation.navigate("VenueDetail", { venueId: item.id })}
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  venueId: item.id,
                  isFavorite: !(favoriteIds?.has(item.id) ?? false),
                })
              }
            />
          )}
          onSeeAll={() => navigation.navigate("Venues", { screen: "VenuesList" })}
        />

        <NearbySection
          title="Squads near you"
          data={nearbySquads}
          isLoading={squadsLoading}
          emptyIcon="people-outline"
          emptyLabel="No squads near you yet"
          keyExtractor={(s: SquadListItem) => s.id}
          renderItem={({ item, km }) => (
            <NearbySquadCard
              squad={item}
              distanceKm={km}
              onPress={() => navigation.navigate("Squads", { screen: "SquadDetail", params: { squadId: item.id } })}
            />
          )}
          onSeeAll={() => navigation.navigate("Squads", { screen: "SquadsList" })}
        />

        <NearbySection
          title="Games near you"
          data={nearbyRegularGames}
          isLoading={gamesLoading}
          emptyIcon="tennisball-outline"
          emptyLabel="No games near you yet"
          keyExtractor={(g: GameListItem) => g.id}
          renderItem={({ item, km }) => (
            <NearbyGameCard
              game={item}
              distanceKm={km}
              onPress={() => navigation.navigate("GameDetail", { gameId: item.id })}
            />
          )}
          onSeeAll={() => navigation.navigate("GamesList", undefined)}
        />

        <NearbySection
          title="Tournaments near you"
          data={nearbyTournaments}
          isLoading={gamesLoading}
          emptyIcon="trophy-outline"
          emptyLabel="No tournaments near you yet"
          keyExtractor={(g: GameListItem) => g.id}
          renderItem={({ item, km }) => (
            <NearbyGameCard
              game={item}
              distanceKm={km}
              onPress={() => navigation.navigate("GameDetail", { gameId: item.id })}
            />
          )}
          onSeeAll={() => navigation.navigate("GamesList", { gameType: "TOURNAMENT" })}
        />

        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
          <HomeActionCard
            title="Tournaments"
            subtitle="Compete. Win big."
            emoji="🏆"
            onPress={() => navigation.navigate("GamesList", { gameType: "TOURNAMENT" })}
          />
          <HomeActionCard
            title="Players Dashboard"
            subtitle="See who's top rated"
            emoji="📊"
            onPress={() => navigation.navigate("PlayersDashboard")}
          />
        </View>
      </View>
    </ScrollView>
  );
}
