import { View, Text, Pressable, FlatList, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { useProfileStore } from "../../store/profileStore";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useFavoriteVenueIds, useToggleFavoriteVenue } from "../../hooks/useFavoriteVenues";
import SportsBySportSection from "../../components/SportsBySportSection";
import VenueCard from "../../components/VenueCard";
import PromoCarousel, { type PromoSlide } from "../../components/PromoCarousel";
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
      className="bg-white border border-border rounded-2xl p-4 justify-between"
      style={{ width: "48%", height: 120 }}
    >
      <View>
        <Text className="text-ink font-extrabold text-base">{title}</Text>
        <Text className="text-muted text-xs mt-1">{subtitle}</Text>
      </View>
      <Text style={{ fontSize: 32, textAlign: "right" }}>{emoji}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const profile = useProfileStore((s) => s.profile);
  const insets = useSafeAreaInsets();

  const { data: sports } = useSports();
  const { data: venues, isLoading } = useVenues({});
  const { data: favoriteIds } = useFavoriteVenueIds();
  const toggleFavorite = useToggleFavoriteVenue();

  const topVenues = (venues ?? []).slice(0, 6);

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
      onPress: () => navigation.navigate("Games", { screen: "GamesList" }),
    },
  ];

  return (
    <FlatList
      className="flex-1 bg-white"
      ListHeaderComponent={
        <View className="px-5" style={{ paddingTop: insets.top + 16 }}>
          <Pressable
            onPress={() => navigation.navigate("Profile", { screen: "ProfileHome" })}
            className="flex-row items-center mb-5"
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
              <Text className="text-2xl font-bold text-ink">
                Hey {profile?.full_name?.split(" ")[0] ?? "there"}!
              </Text>
              <Text className="text-muted mt-1">What are you playing today?</Text>
            </View>
          </Pressable>

          <PromoCarousel slides={promoSlides} />

          <SportsBySportSection
            sports={sports ?? []}
            onSelectSport={(sportId) =>
              navigation.navigate("Venues", { screen: "VenuesList", params: { sportId } })
            }
          />

          <View className="flex-row flex-wrap justify-between mb-6" style={{ rowGap: 12 }}>
            <HomeActionCard
              title="Games"
              subtitle="Join games. Meet players"
              emoji="🏸"
              onPress={() => navigation.navigate("Games", { screen: "GamesList" })}
            />
            <HomeActionCard
              title="Tournaments"
              subtitle="Compete. Win big."
              emoji="🏆"
              onPress={() => navigation.navigate("GamesList", { gameType: "TOURNAMENT" })}
            />
            <HomeActionCard
              title="Venues"
              subtitle="Book turfs. Save big"
              emoji="⚽"
              onPress={() => navigation.navigate("Venues", { screen: "VenuesList" })}
            />
            <HomeActionCard
              title="Squads"
              subtitle="Find your play tribe"
              emoji="🤝"
              onPress={() => navigation.navigate("Squads", { screen: "SquadsList" })}
            />
          </View>

          <Text className="text-lg font-semibold text-ink mb-3">Popular venues</Text>
        </View>
      }
      data={topVenues}
      keyExtractor={(item) => item.id}
      numColumns={1}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={colors.primary} className="mt-4" />
        ) : (
          <Text className="text-muted">No venues available yet.</Text>
        )
      }
      renderItem={({ item }) => (
        <VenueCard
          venue={item}
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
    />
  );
}
