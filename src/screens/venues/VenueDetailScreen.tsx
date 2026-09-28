import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useVenueDetail } from "../../hooks/useVenueDetail";
import { useFavoriteVenueIds, useToggleFavoriteVenue } from "../../hooks/useFavoriteVenues";
import { getAmenityIcon } from "../../lib/amenities";
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import { getVenuePhoto } from "../../lib/venuePhotos";
import { colors, cardShadow } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type VenueDetailParams = { VenueDetail: { venueId: string; forGameId?: string } };
type VenueDetailNav = NativeStackNavigationProp<VenuesStackParamList, "VenueDetail">;

export default function VenueDetailScreen() {
  const { params } = useRoute<RouteProp<VenueDetailParams, "VenueDetail">>();
  const navigation = useNavigation<VenueDetailNav>();
  const { width } = useWindowDimensions();
  const [activeImage, setActiveImage] = useState(0);

  const { data: venue, isLoading } = useVenueDetail(params.venueId);
  const { data: favoriteIds } = useFavoriteVenueIds();
  const toggleFavorite = useToggleFavoriteVenue();
  const isFavorite = favoriteIds?.has(params.venueId) ?? false;

  const onScrollImages = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveImage(index);
  };

  if (isLoading || !venue) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const images = [...venue.venue_images].sort((a, b) => a.display_order - b.display_order);
  // No uploaded photos yet — prefer the curated demo photo for this specific
  // venue, else fall back to a real photo of the venue's own sport (same
  // bundled photos the admin dashboard uses) instead of a flat color block.
  const sportFallbackImage = getVenuePhoto(venue.id) ?? getSportImage(venue.court[0]?.sports?.name ?? "");

  // Amenities live per-court (set by the admin in Edit Court), so the venue
  // page shows the union across all its courts — a player browsing a venue
  // wants to know what's available there overall, not court-by-court.
  const amenities = Array.from(new Set(venue.court.flatMap((c) => c.amenities ?? [])));

  return (
    <ScrollView className="flex-1 bg-white" showsVerticalScrollIndicator={false}>
      <View className="relative">
        {images.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollImages}
          >
            {images.map((img) => (
              <Image
                key={img.id}
                source={{ uri: img.image_url }}
                style={{ width, height: 260 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : sportFallbackImage ? (
          <Image source={sportFallbackImage} style={{ width, height: 260 }} resizeMode="cover" />
        ) : (
          <View style={{ width, height: 260 }} className="bg-primary-light" />
        )}

        <Pressable
          onPress={() => navigation.goBack()}
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/90 items-center justify-center"
          style={cardShadow}
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => toggleFavorite.mutate({ venueId: venue.id, isFavorite: !isFavorite })}
          className="absolute top-12 right-4 w-10 h-10 rounded-full bg-white/90 items-center justify-center"
          style={cardShadow}
        >
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={20}
            color={isFavorite ? colors.danger : colors.ink}
          />
        </Pressable>

        {images.length > 1 && (
          <View className="absolute bottom-6 w-full flex-row justify-center gap-1.5">
            {images.map((img, i) => (
              <View
                key={img.id}
                className={`h-1.5 rounded-full ${i === activeImage ? "bg-white w-5" : "bg-white/50 w-1.5"}`}
              />
            ))}
          </View>
        )}
      </View>

      {/* One continuous white sheet overlapping the header photo — identity,
          facilities, amenities and courts all live in it as plain sections
          (no separate card per section). */}
      <View
        className="bg-white px-5 pt-5 pb-8"
        style={{ marginTop: -20, borderTopLeftRadius: 26, borderTopRightRadius: 26, ...cardShadow }}
      >
        <View className="flex-row items-start justify-between">
          <Text className="text-xl font-extrabold text-ink flex-1 mr-3">{venue.name}</Text>
          <View
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: "#FEF9E7", gap: 4 }}
          >
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text className="text-ink font-bold text-sm">
              {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mt-2.5" style={{ gap: 6 }}>
          <Ionicons name="location-outline" size={15} color={colors.muted} />
          <Text className="text-muted flex-1" numberOfLines={1}>
            {venue.address ? `${venue.address}, ${venue.city}` : venue.city}
          </Text>
        </View>

        {(venue.start_time || venue.end_time) && (
          <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
            <Ionicons name="time-outline" size={15} color={colors.muted} />
            <Text className="text-muted">
              {venue.start_time} - {venue.end_time}
            </Text>
          </View>
        )}

        {venue.description && (
          <Text className="text-ink mt-4 leading-5">{venue.description}</Text>
        )}

      {venue.venue_facilities.length > 0 && (
        <View className="mt-6">
          <View>
            <Text className="text-ink font-bold text-base mb-3">Facilities</Text>
            <View className="flex-row flex-wrap gap-2">
              {venue.venue_facilities.map((facility) => (
                <View
                  key={facility.id}
                  className="flex-row items-center rounded-full px-3 py-1.5"
                  style={{ backgroundColor: colors.primaryLight, gap: 6 }}
                >
                  <MaterialCommunityIcons name={getAmenityIcon(facility.name)} size={15} color={colors.primaryDark} />
                  <Text className="font-semibold text-sm" style={{ color: colors.primaryDark }}>
                    {facility.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {amenities.length > 0 && (
        <View className="mt-6">
          <View>
            <Text className="text-ink font-bold text-base mb-3">Amenities</Text>
            <View className="flex-row flex-wrap" style={{ rowGap: 12, columnGap: 10 }}>
              {amenities.map((label) => (
                <View
                  key={label}
                  className="flex-row items-center rounded-2xl px-3 py-2.5"
                  style={{ width: "31%", gap: 8, borderWidth: 1, borderColor: colors.border }}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 30, height: 30, backgroundColor: colors.primaryLight }}
                  >
                    <MaterialCommunityIcons name={getAmenityIcon(label)} size={15} color={colors.primaryDark} />
                  </View>
                  <Text className="text-ink text-xs font-medium flex-1" numberOfLines={2}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      <View className="mt-6">
        <View>
          <Text className="text-ink font-bold text-base mb-3">Courts</Text>
          {venue.court.filter((c) => c.isactive).map((court) => {
            const sportName = court.sports?.name ?? "";
            const courtPhoto = [...(court.court_images ?? [])].sort((a, b) => a.display_order - b.display_order)[0]
              ?.image_url;
            // A court with no uploaded photo of its own falls back to the
            // same bundled real sport photo used elsewhere (e.g. the venue
            // header) — only if that sport has no bundled photo either does
            // this drop back to a plain icon tile.
            const fallbackImage = getSportImage(sportName);
            const { icon, bg, fg } = getSportIcon(sportName);
            return (
              <Pressable
                key={court.id}
                onPress={() =>
                  navigation.navigate("SlotPicker", {
                    courtId: court.id,
                    courtName: court.name,
                    pricePerHour: court.price_per_hour,
                    venueName: venue.name,
                    venueId: venue.id,
                    venueStartTime: venue.start_time ?? "06:00:00",
                    venueEndTime: venue.end_time ?? "23:00:00",
                    forGameId: params.forGameId,
                    sportName,
                  })
                }
                className="flex-row items-center bg-white rounded-2xl px-3 py-3 mb-2.5"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                {courtPhoto || fallbackImage ? (
                  <Image
                    source={courtPhoto ? { uri: courtPhoto } : fallbackImage!}
                    style={{ width: 56, height: 56, borderRadius: 14 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className="items-center justify-center rounded-2xl"
                    style={{ width: 56, height: 56, backgroundColor: bg }}
                  >
                    <MaterialCommunityIcons name={icon} size={24} color={fg} />
                  </View>
                )}
                <View className="flex-1 ml-3 mr-2">
                  <Text className="text-ink font-bold">{court.name}</Text>
                  <Text className="text-muted text-sm mt-0.5">
                    {sportName}
                    {court.surface_type ? ` · ${court.surface_type}` : ""}
                  </Text>
                </View>
                <Text className="font-extrabold text-sm" style={{ color: colors.primaryDark }} numberOfLines={1}>
                  Rs {court.price_per_hour}/hr
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 6 }} />
              </Pressable>
            );
          })}
        </View>
      </View>
      </View>
    </ScrollView>
  );
}
