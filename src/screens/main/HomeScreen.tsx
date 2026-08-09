import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
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
import SportChip from "../../components/SportChip";
import VenueCard from "../../components/VenueCard";
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

  return (
    <FlatList
      className="flex-1 bg-white"
      ListHeaderComponent={
        <View className="px-5" style={{ paddingTop: insets.top + 16 }}>
          <Text className="text-2xl font-bold text-ink">
            Hey {profile?.full_name?.split(" ")[0] ?? "there"}!
          </Text>
          <Text className="text-muted mt-1 mb-5">What are you playing today?</Text>

          <View style={{ paddingVertical: 8, marginBottom: 16 }}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={sports ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SportChip
                  label={item.name}
                  onPress={() =>
                    navigation.navigate("Venues", {
                      screen: "VenuesList",
                      params: { sportId: item.id },
                    })
                  }
                />
              )}
            />
          </View>

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
              onPress={() =>
                navigation.navigate("Games", {
                  screen: "GamesList",
                  params: { gameType: "TOURNAMENT" },
                })
              }
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
