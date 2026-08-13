import { View, Text, Pressable, FlatList, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { useProfileStore } from "../../store/profileStore";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useFavoriteVenueIds, useToggleFavoriteVenue } from "../../hooks/useFavoriteVenues";
import SportsBySportSection from "../../components/SportsBySportSection";
import VenueCard from "../../components/VenueCard";
import PromoCarousel, { type PromoSlide } from "../../components/PromoCarousel";
import { colors, fonts } from "../../constants/theme";

type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeFeed">,
  BottomTabNavigationProp<MainTabParamList>
>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function QuickActionCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-4 justify-between"
      style={{
        width: "48%",
        height: 124,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
      }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 38, height: 38, backgroundColor: colors.primaryLight }}
      >
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View>
        <Text style={{ fontFamily: fonts.bold }} className="text-ink text-base">
          {title}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="text-muted text-xs mt-0.5">
          {subtitle}
        </Text>
      </View>
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

  // Restrained, muted dark palette (jewel-tone family, not saturated
  // neons) — same functional destinations as before, just recolored.
  const promoSlides: PromoSlide[] = [
    {
      key: "tournaments",
      title: "Compete & Win Big",
      subtitle: "Join tournaments across your city and prove your game.",
      cta: "View Tournaments",
      icon: "trophy",
      bgColor: "#12241C",
      accentColor: "#D4B26A",
      onPress: () => navigation.navigate("GamesList", { gameType: "TOURNAMENT" }),
    },
    {
      key: "venues",
      title: "Book Premium Turfs",
      subtitle: "Top-rated venues, instant booking, zero hassle.",
      cta: "Explore Venues",
      icon: "flash",
      bgColor: colors.primaryDark,
      accentColor: "#8FD9B5",
      onPress: () => navigation.navigate("Venues", { screen: "VenuesList" }),
    },
    {
      key: "squads",
      title: "Build Your Squad",
      subtitle: "Find your regular crew and never play solo again.",
      cta: "Find Squads",
      icon: "people",
      bgColor: "#16202B",
      accentColor: "#9DBEDB",
      onPress: () => navigation.navigate("Squads", { screen: "SquadsList" }),
    },
    {
      key: "games",
      title: "Jump Into a Game",
      subtitle: "Browse open games nearby and play today.",
      cta: "Browse Games",
      icon: "flame",
      bgColor: "#241A14",
      accentColor: "#E0A579",
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
            className="flex-row items-center mb-6"
            style={{ gap: 12 }}
          >
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} className="w-12 h-12 rounded-full bg-primary-light" />
            ) : (
              <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center">
                <Text style={{ fontFamily: fonts.bold }} className="text-lg text-primary">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text style={{ fontFamily: fonts.regular }} className="text-muted text-xs">
                {getGreeting()}
              </Text>
              <Text style={{ fontFamily: fonts.extrabold }} className="text-ink text-2xl">
                {profile?.full_name?.split(" ")[0] ?? "there"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <PromoCarousel slides={promoSlides} />

          <SportsBySportSection
            sports={sports ?? []}
            onSelectSport={(sportId) =>
              navigation.navigate("Venues", { screen: "VenuesList", params: { sportId } })
            }
          />

          <Text style={{ fontFamily: fonts.extrabold }} className="text-ink text-lg mb-3">
            Quick actions
          </Text>
          <View className="flex-row flex-wrap justify-between mb-6" style={{ rowGap: 12 }}>
            <QuickActionCard
              title="Games"
              subtitle="Join games. Meet players"
              icon="tennisball-outline"
              onPress={() => navigation.navigate("Games", { screen: "GamesList" })}
            />
            <QuickActionCard
              title="Tournaments"
              subtitle="Compete. Win big."
              icon="trophy-outline"
              onPress={() => navigation.navigate("GamesList", { gameType: "TOURNAMENT" })}
            />
            <QuickActionCard
              title="Venues"
              subtitle="Book turfs. Save big"
              icon="location-outline"
              onPress={() => navigation.navigate("Venues", { screen: "VenuesList" })}
            />
            <QuickActionCard
              title="Squads"
              subtitle="Find your play tribe"
              icon="people-outline"
              onPress={() => navigation.navigate("Squads", { screen: "SquadsList" })}
            />
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <Text style={{ fontFamily: fonts.extrabold }} className="text-ink text-lg">
              Popular venues
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Venues", { screen: "VenuesList" })}
              className="flex-row items-center"
              style={{ gap: 2 }}
            >
              <Text style={{ fontFamily: fonts.semibold }} className="text-primary text-sm">
                See all
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
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
