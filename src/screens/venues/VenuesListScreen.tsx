import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, Pressable, FlatList, ScrollView, ActivityIndicator, RefreshControl, BackHandler } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import type { VenueListItem } from "../../lib/api/venues";
import { getSportImage } from "../../lib/sportImages";
import Bouncy from "../../components/Bouncy";
import FieldInput from "../../components/FieldInput";
import SelectSportModal from "../../components/SelectSportModal";
import SelectDistanceModal from "../../components/SelectDistanceModal";
import SelectLocationModal from "../../components/SelectLocationModal";
import { colors, cardShadow, primaryButtonShadow, LIST_CARD_MIN_HEIGHT } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type VenuesListRouteProp = RouteProp<VenuesStackParamList, "VenuesList">;
type VenuesListNavigationProp = NativeStackNavigationProp<VenuesStackParamList, "VenuesList">;

// A venue card for this list, laid out as the same five rows as the Squads
// list card (and given the same shared min height / font sizes) so the
// Squads, Games and Venues lists all show the same size of card: a CTA
// pinned top-right, the venue's photo in the soft disc on the right edge,
// then name, location, rating line, sport chips and a price line. This is
// separate from the shared components/VenueCard.tsx, which the Home
// screen's "Venues near you" carousel still uses at a much narrower, fixed
// width — resizing that shared one to this shape would break that carousel.
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
  const minPrice = venue.court.length > 0 ? Math.min(...venue.court.map((c) => c.price_per_hour)) : null;
  // The name/location/rating rows keep clear of the photo disc on the right.
  const rightGutter = { paddingRight: 92 };
  const MAX_SPORT_CHIPS = 2;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      <Bouncy
        onPress={onPress}
        style={{ ...cardShadow, backgroundColor: "white", borderRadius: 24 }}
        scaleTo={0.98}
      >
        <View
          className="border border-border overflow-hidden bg-white"
          style={{ borderRadius: 24, position: "relative", minHeight: LIST_CARD_MIN_HEIGHT }}
        >
          {/* View CTA — pinned to the card's top-right corner, same spot as
              the Squads card's Join button. */}
          <View style={{ position: "absolute", top: 16, right: 16, zIndex: 5 }}>
            <View
              className="flex-row items-center justify-center bg-primary rounded-2xl px-3 py-2"
              style={{ gap: 4, minWidth: 78, ...primaryButtonShadow }}
            >
              <Text className="text-white font-bold text-sm">View</Text>
              <Ionicons name="arrow-forward" size={14} color="white" />
            </View>
          </View>

          {/* Venue photo in the soft green disc, tucked into the right edge */}
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
              backgroundColor: "#E4F7EA",
            }}
          >
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={{ width: 128, height: 128 }} resizeMode="cover" />
            ) : sportFallbackImage ? (
              <View style={{ width: 132, height: 74, marginRight: 26, mixBlendMode: "multiply" }}>
                <Image source={sportFallbackImage} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
              </View>
            ) : (
              <Ionicons name="business" size={50} color={colors.primary} style={{ marginRight: 26, opacity: 0.8 }} />
            )}
          </View>

          <View className="px-4 pt-4 pb-4">
            {/* Row 1: name — clear of the corner CTA via a wider right gutter */}
            <View className="flex-row items-center mb-1.5" style={{ paddingRight: 100 }}>
              <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 20 }} numberOfLines={1}>
                {venue.name}
              </Text>
            </View>

            {/* Row 2: location */}
            <View className="flex-row items-center mb-2.5" style={{ gap: 5, ...rightGutter }}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                {[venue.address, venue.city].filter(Boolean).join(" · ") || "Location not set"}
              </Text>
            </View>

            {/* Row 3: rating + court count (same slot as the squad's member count) */}
            <View className="flex-row items-center mb-3" style={{ gap: 8, minHeight: 30, ...rightGutter }}>
              <Ionicons name="star" size={16} color={colors.warning} />
              <Text className="text-muted font-medium" style={{ fontSize: 14 }} numberOfLines={1}>
                {venue.rating > 0 ? venue.rating.toFixed(1) : "New"} · {venue.court.length} court
                {venue.court.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {/* Row 4: sport chips (capped so this row never wraps to a second line) */}
            <View className="flex-row items-center" style={{ gap: 8 }}>
              {sportNames.slice(0, MAX_SPORT_CHIPS).map((name) => (
                <View key={name} className="bg-primary-light px-3 py-1 rounded-full" style={{ flexShrink: 1 }}>
                  <Text className="text-primary text-xs font-bold" numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
              {sportNames.length > MAX_SPORT_CHIPS && (
                <View className="bg-primary-light px-3 py-1 rounded-full">
                  <Text className="text-primary text-xs font-bold">+{sportNames.length - MAX_SPORT_CHIPS}</Text>
                </View>
              )}
            </View>

            {/* Row 5: price line (same slot as the squad's skill + creator row) */}
            <View className="flex-row items-center mt-3" style={{ minHeight: 30 }}>
              <Ionicons name="ticket-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
              <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                {minPrice != null ? `From Rs ${minPrice.toLocaleString()} / hr` : "Pricing not set"}
              </Text>
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
  const isFocused = useIsFocused();

  // Venues is a bottom-tab root — the phone's hardware/gesture back button
  // should take the user to the Home tab instead of exiting the app.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (navigation.canGoBack()) return false;
        navigation.getParent()?.navigate("Home");
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  const [search, setSearch] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(
    route.params?.sportId
  );
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationTags, setLocationTags] = useState<string[]>([]);
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

  const { data: sports } = useSports();
  const {
    data: venuesData,
    isLoading,
    isRefetching,
    refetch,
  } = useVenues({
    search: search || undefined,
    sportId: selectedSportId,
    locations: locationTags.length > 0 ? locationTags : undefined,
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
    <View className="flex-1 bg-white">
      {isFocused ? <StatusBar style="light" /> : null}
      {/* Fixed dark-green banner — same treatment as the Community tab's header. */}
      <View
        style={{
          backgroundColor: "#14532D",
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Pressable
            onPress={() => {
              // Venues is a bottom-tab root, so there's usually nothing to pop
              // to — fall back to the Home tab in that case.
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.getParent()?.navigate("Home");
            }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-white font-extrabold" style={{ fontSize: 26 }}>
              Venues
            </Text>
            <Text style={{ fontSize: 12.5, marginTop: 1, color: "#BBF7D0" }} numberOfLines={1}>
              Find and book great venues near you
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingTop: 16 }}>
      {/* Search — the sport filter used to sit as an icon button here; it's
          now the "Sports" pill in the filter row below instead. */}
      <View className="px-5 mb-3">
        <FieldInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search venues..."
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ borderRadius: 28, height: 52 }}
          left={<Ionicons name="search-outline" size={20} color={colors.muted} style={{ marginRight: 8 }} />}
        />
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
            {/* "Location" — opens a bottom sheet with a free-text field plus
                city suggestions (multi-select), in place of the old
                always-visible inline field. Leads the row, same as "All" /
                "My Games" leads it on the Games/Squads lists. */}
            <Pressable
              onPress={() => setLocationOpen(true)}
              className="flex-row items-center rounded-full"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 5,
                backgroundColor: locationTags.length > 0 ? colors.primary : "white",
                borderWidth: 1,
                borderColor: locationTags.length > 0 ? colors.primary : colors.border,
              }}
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
            </Pressable>
            {/* "Sports" — opens the same sport-select sheet the filter icon
                next to the search box used to open. */}
            <Pressable
              onPress={() => {
                setDistanceOpen(false);
                setSportSheetOpen(true);
              }}
              className="flex-row items-center rounded-full"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 5,
                backgroundColor: selectedSportId ? colors.primary : "white",
                borderWidth: 1,
                borderColor: selectedSportId ? colors.primary : colors.border,
              }}
            >
              <Ionicons name="options-outline" size={14} color={selectedSportId ? "white" : colors.muted} />
              <Text
                className="font-medium"
                style={{ fontSize: 13.5, color: selectedSportId ? "white" : colors.muted }}
                numberOfLines={1}
              >
                Sports
              </Text>
            </Pressable>
            {/* "Distance" — plain pill like Sports, opening a bottom sheet
                instead of the small inline dropdown it used to expand into. */}
            <Pressable
              onPress={() => {
                if (locationStatus !== "granted") requestLocation();
                setDistanceOpen(true);
              }}
              className="flex-row items-center rounded-full"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 5,
                backgroundColor: distanceKmFilter != null ? colors.primary : "white",
                borderWidth: 1,
                borderColor: distanceKmFilter != null ? colors.primary : colors.border,
              }}
            >
              <Ionicons name="navigate-outline" size={14} color={distanceKmFilter != null ? "white" : colors.muted} />
              <Text
                className="font-medium"
                style={{ fontSize: 13.5, color: distanceKmFilter != null ? "white" : colors.muted }}
                numberOfLines={1}
              >
                {distanceKmFilter != null ? `${distanceKmFilter} km` : "Distance"}
              </Text>
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
