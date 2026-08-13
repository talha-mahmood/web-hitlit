import { useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useFavoriteVenueIds, useToggleFavoriteVenue } from "../../hooks/useFavoriteVenues";
import SportChip from "../../components/SportChip";
import VenueCard from "../../components/VenueCard";
import FieldInput from "../../components/FieldInput";
import { colors } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type VenuesListRouteProp = RouteProp<VenuesStackParamList, "VenuesList">;
type VenuesListNavigationProp = NativeStackNavigationProp<VenuesStackParamList, "VenuesList">;

export default function VenuesListScreen() {
  const route = useRoute<VenuesListRouteProp>();
  const navigation = useNavigation<VenuesListNavigationProp>();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(
    route.params?.sportId
  );

  const { data: sports } = useSports();
  const {
    data: venues,
    isLoading,
    isRefetching,
    refetch,
  } = useVenues({ search: search || undefined, sportId: selectedSportId });
  const { data: favoriteIds } = useFavoriteVenueIds();
  const toggleFavorite = useToggleFavoriteVenue();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
      <View className="px-5">
        <Text className="text-2xl font-bold text-ink mb-4">Venues</Text>
        <FieldInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search venues or city"
          containerStyle={{ gap: 8, marginBottom: 16 }}
          left={<Ionicons name="search" size={18} color={colors.muted} />}
        />
      </View>

      <View style={{ paddingVertical: 8 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sports ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(Math.min(index, 8) * 40)}>
              <SportChip
                label={item.name}
                selected={selectedSportId === item.id}
                onPress={() =>
                  setSelectedSportId((current) => (current === item.id ? undefined : item.id))
                }
              />
            </Animated.View>
          )}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={venues ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 14 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <Animated.View entering={FadeInDown.duration(400)}>
              <Text className="text-muted text-center mt-10">
                No venues found. Try a different search or sport.
              </Text>
            </Animated.View>
          }
          renderItem={({ item, index }) => (
            <VenueCard
              venue={item}
              index={index}
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
      )}
    </View>
  );
}
