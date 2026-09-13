import { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useFavoriteVenueIds, useToggleFavoriteVenue } from "../../hooks/useFavoriteVenues";
import VenueCard from "../../components/VenueCard";
import SearchField from "../../components/SearchField";
import SportFilterDropdown from "../../components/SportFilterDropdown";
import { colors, primaryButtonShadow } from "../../constants/theme";
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
  const [showFilters, setShowFilters] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");

  // navigation.navigate() re-focuses this screen (already mounted in the
  // stack) instead of remounting it, so a new sportId param wouldn't
  // otherwise reach the useState initializer above — sync it explicitly.
  useEffect(() => {
    setSelectedSportId(route.params?.sportId);
  }, [route.params?.sportId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(locationInput.trim()), 300);
    return () => clearTimeout(t);
  }, [locationInput]);

  const { data: sports } = useSports();
  const {
    data: venues,
    isLoading,
    isRefetching,
    refetch,
  } = useVenues({
    search: search || undefined,
    sportId: selectedSportId,
    location: debouncedLocation || undefined,
  });
  const { data: favoriteIds } = useFavoriteVenueIds();
  const toggleFavorite = useToggleFavoriteVenue();

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
      <View className="px-5">
        <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
          )}
          <Text className="text-2xl font-bold text-ink">Venues</Text>
        </View>
        <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
          <View className="flex-1">
            <SearchField
              value={search}
              onChangeText={setSearch}
              prefix="Search by "
              variants={["venue name"]}
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
      </View>

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
            <Text className="text-muted text-center mt-10">
              No venues found. Try a different search, location, or sport.
            </Text>
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
