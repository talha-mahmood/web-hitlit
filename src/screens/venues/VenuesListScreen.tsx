import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, FlatList, ScrollView, Modal, ActivityIndicator, RefreshControl } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import type { VenueListItem } from "../../lib/api/venues";
import { getSportImage } from "../../lib/sportImages";
import Bouncy from "../../components/Bouncy";
import FieldInput from "../../components/FieldInput";
import SearchField from "../../components/SearchField";
import SelectSportModal from "../../components/SelectSportModal";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type VenuesListRouteProp = RouteProp<VenuesStackParamList, "VenuesList">;
type VenuesListNavigationProp = NativeStackNavigationProp<VenuesStackParamList, "VenuesList">;

// A venue card for this list, restyled to match the Games/Squads list
// cards' shell and typography (rounded-24 card, cardShadow, same font
// sizes, the same light-green pill style for chips, a bottom-right CTA).
// This is separate from the shared components/VenueCard.tsx, which the
// Home screen's "Venues near you" carousel still uses at a much narrower,
// fixed width — resizing that shared one to this shape would break that
// carousel's layout.
function VenueListCard({
  venue,
  onPress,
  index,
}: {
  venue: VenueListItem;
  onPress: () => void;
  index: number;
}) {
  const coverImage = [...venue.venue_images].sort((a, b) => a.display_order - b.display_order).at(0)?.image_url;
  const sportNames = Array.from(new Set(venue.court.map((c) => c.sports?.name).filter(Boolean))) as string[];
  const sportFallbackImage = getSportImage(sportNames[0] ?? "");

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      <Bouncy
        onPress={onPress}
        style={{ ...cardShadow, backgroundColor: "white", borderRadius: 24 }}
        scaleTo={0.98}
      >
        <View className="border border-border overflow-hidden bg-white" style={{ borderRadius: 24 }}>
          <View style={{ position: "relative" }}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={{ width: "100%", height: 150 }} resizeMode="cover" />
            ) : sportFallbackImage ? (
              <Image source={sportFallbackImage} style={{ width: "100%", height: 150 }} resizeMode="cover" />
            ) : (
              <View style={{ width: "100%", height: 150, backgroundColor: colors.primaryLight }} />
            )}
            <View
              className="absolute flex-row items-center bg-black/60 rounded-full"
              style={{ left: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 5, gap: 4 }}
            >
              <Ionicons name="star" size={13} color={colors.warning} />
              <Text className="text-white font-bold" style={{ fontSize: 12.5 }}>
                {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
              </Text>
            </View>
          </View>

          <View className="px-4 pt-4 pb-4">
            {/* Row: name */}
            <Text className="text-ink font-extrabold mb-1.5" style={{ fontSize: 20 }} numberOfLines={1}>
              {venue.name}
            </Text>

            {/* Row: location */}
            {(venue.city || venue.address) && (
              <View className="flex-row items-center mb-2.5" style={{ gap: 5 }}>
                <Ionicons name="location-outline" size={15} color={colors.muted} />
                <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                  {[venue.address, venue.city].filter(Boolean).join(" · ")}
                </Text>
              </View>
            )}

            {/* Row: sport chips + View CTA */}
            <View className="flex-row items-end justify-between">
              <View className="flex-row items-center flex-wrap flex-1" style={{ gap: 8, marginRight: 8 }}>
                {sportNames.map((name) => (
                  <View key={name} className="bg-primary-light px-3 py-1 rounded-full">
                    <Text className="text-primary text-xs font-bold">{name}</Text>
                  </View>
                ))}
              </View>
              <View
                className="flex-row items-center justify-center bg-primary rounded-2xl px-3 py-2"
                style={{ gap: 4, ...primaryButtonShadow }}
              >
                <Text className="text-white font-bold text-sm">View</Text>
                <Ionicons name="arrow-forward" size={14} color="white" />
              </View>
            </View>
          </View>
        </View>
      </Bouncy>
    </Animated.View>
  );
}

export default function VenuesListScreen() {
  const route = useRoute<VenuesListRouteProp>();
  const navigation = useNavigation<VenuesListNavigationProp>();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(
    route.params?.sportId
  );
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  // Distance dropdown — same row as the Games list, minus its Date pill
  // (venues aren't scheduled) and minus a Favorites pill.
  const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [distanceOpen, setDistanceOpen] = useState(false);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();

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
    data: venuesData,
    isLoading,
    isRefetching,
    refetch,
  } = useVenues({
    search: search || undefined,
    sportId: selectedSportId,
    location: debouncedLocation || undefined,
  });
  const venues =
    distanceKmFilter != null && myCoords
      ? (venuesData ?? []).filter((v) => {
          const lat = v.latitude;
          const lng = v.longitude;
          if (lat == null || lng == null) return false;
          return distanceKm(myCoords.latitude, myCoords.longitude, lat, lng) <= distanceKmFilter;
        })
      : venuesData;

  return (
    <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View className="flex-row items-center px-5 mb-4" style={{ gap: 10 }}>
        <Pressable
          onPress={() => {
            // Venues is a bottom-tab root, so there's usually nothing to pop
            // to — fall back to the Home tab in that case.
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.getParent()?.navigate("Home");
          }}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-ink font-extrabold" style={{ fontSize: 26 }}>
            Venues
          </Text>
          <Text className="text-muted" style={{ fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
            Find and book great venues near you
          </Text>
        </View>
      </View>

      {/* Search */}
      <View className="px-5 mb-3 flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-1">
          <FieldInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search venues, sport, location..."
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ borderRadius: 28, height: 52 }}
            left={<Ionicons name="search-outline" size={20} color={colors.muted} style={{ marginRight: 8 }} />}
          />
        </View>
        <Pressable
          onPress={() => {
            setDistanceOpen(false);
            setSportSheetOpen(true);
          }}
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

      {/* Distance — its own row. Wrapped in a relatively-positioned box so
          the dropdown below can float over "Filter by location" instead of
          pushing it down. */}
      <View style={{ position: "relative", zIndex: 20 }}>
        <View style={{ marginBottom: 12 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View>
              {/* The card itself no longer opens the dropdown — only the
                  chevron icon at the end does. */}
              <View
                className="flex-row items-center rounded-full"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  gap: 5,
                  borderWidth: 1,
                  backgroundColor: distanceKmFilter != null ? colors.primary : "white",
                  borderColor: distanceKmFilter != null ? colors.primary : colors.border,
                }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: distanceKmFilter != null ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  }}
                >
                  <Ionicons name="navigate" size={8} color={distanceKmFilter != null ? "white" : colors.muted} />
                </View>
                <Text
                  className="font-medium"
                  style={{ fontSize: 13.5, color: distanceKmFilter != null ? "white" : colors.muted }}
                >
                  {distanceKmFilter != null ? `${distanceKmFilter} km` : "Distance"}
                </Text>
                <Pressable
                  onPress={() => {
                    if (locationStatus !== "granted") requestLocation();
                    setDistanceOpen((v) => !v);
                  }}
                  hitSlop={8}
                >
                  <Ionicons
                    name={distanceOpen ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={distanceKmFilter != null ? "white" : colors.muted}
                  />
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Distance options — a transparent full-screen Modal rather than an
            inline overlay, so a tap anywhere outside the card (including the
            rest of the venues list) closes it; a tap on the card itself is
            swallowed by its own Pressable instead of reaching the backdrop. */}
        <Modal visible={distanceOpen} transparent animationType="none" onRequestClose={() => setDistanceOpen(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setDistanceOpen(false)}>
            <View style={{ position: "absolute", top: insets.top + 168, right: 20 }}>
              {/* Little speech-bubble tail pointing up at the button. */}
              <View
                style={{
                  width: 0,
                  height: 0,
                  marginLeft: 24,
                  borderLeftWidth: 9,
                  borderRightWidth: 9,
                  borderBottomWidth: 9,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderBottomColor: "white",
                }}
              />
              <Pressable onPress={() => {}}>
                <View
                  className="bg-white"
                  style={{
                    minWidth: 250,
                    marginTop: -1,
                    borderRadius: 20,
                    paddingVertical: 6,
                    ...cardShadow,
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                  }}
                >
                  {locationStatus === "denied" && (
                    <Text className="text-muted" style={{ fontSize: 11.5, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 }}>
                      Enable location to filter by distance.
                    </Text>
                  )}
                  {DISTANCE_OPTIONS_KM.map((km, i) => {
                    const selected = distanceKmFilter === km;
                    return (
                      <View key={km}>
                        <Pressable
                          onPress={() => {
                            setDistanceKmFilter(selected ? null : km);
                            setDistanceOpen(false);
                          }}
                          className="flex-row items-center justify-between"
                          style={{
                            marginHorizontal: 6,
                            marginVertical: 3,
                            paddingLeft: 12,
                            paddingRight: 20,
                            paddingVertical: 12,
                            gap: 10,
                            borderRadius: 14,
                            backgroundColor: selected ? colors.primaryLight : "transparent",
                          }}
                        >
                          <View className="flex-row items-center" style={{ gap: 12 }}>
                            <Ionicons name="location" size={20} color={selected ? colors.primary : "#4B5563"} />
                            <Text
                              className={selected ? "font-bold" : "font-semibold"}
                              style={{ fontSize: 17, color: selected ? colors.primary : colors.ink }}
                            >
                              {km} km
                            </Text>
                          </View>
                          {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                        </Pressable>
                        {i < DISTANCE_OPTIONS_KM.length - 1 ? (
                          <View style={{ height: 1, backgroundColor: "#EEF0F1", marginHorizontal: 14 }} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>

      {/* Location filter — always visible. */}
      <View className="px-5 mb-2">
        <SearchField
          value={locationInput}
          onChangeText={setLocationInput}
          prefix="Filter by "
          variants={["location"]}
          autoCapitalize="none"
          autoCorrect={false}
          icon="location-outline"
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

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={venues ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4, gap: 16 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <Text className="text-muted text-center mt-10">
              {distanceKmFilter != null
                ? `No venues found within ${distanceKmFilter} km.`
                : "No venues found. Try a different search, location, or sport."}
            </Text>
          }
          renderItem={({ item, index }) => (
            <VenueListCard
              venue={item}
              index={index}
              onPress={() => navigation.navigate("VenueDetail", { venueId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}
