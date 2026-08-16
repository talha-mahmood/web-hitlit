import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useVenueDetail } from "../../hooks/useVenueDetail";
import { useFavoriteVenueIds, useToggleFavoriteVenue } from "../../hooks/useFavoriteVenues";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type VenueDetailParams = { VenueDetail: { venueId: string } };
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
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const images = [...venue.venue_images].sort((a, b) => a.display_order - b.display_order);

  const handleCallToBook = () => {
    if (!venue.phone) return;
    Linking.openURL(`tel:${venue.phone}`).catch(() =>
      Alert.alert("Couldn't Open Dialer", `Call ${venue.phone} to book.`)
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: venue.phone ? 110 : 24 }}
      >
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
                  style={{ width, height: 240 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={{ width, height: 240 }} className="bg-primary-light" />
          )}

          <Pressable
            onPress={() => navigation.goBack()}
            className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/90 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <Pressable
            onPress={() => toggleFavorite.mutate({ venueId: venue.id, isFavorite: !isFavorite })}
            className="absolute top-12 right-4 w-10 h-10 rounded-full bg-white/90 items-center justify-center"
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={isFavorite ? colors.danger : colors.ink}
            />
          </Pressable>

          {images.length > 1 && (
            <View className="absolute bottom-3 w-full flex-row justify-center gap-1.5">
              {images.map((img, i) => (
                <View
                  key={img.id}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i === activeImage ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        <View className="px-5 pt-4 pb-8">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-ink flex-1">{venue.name}</Text>
            <View className="flex-row items-center ml-2">
              <Ionicons name="star" size={16} color={colors.warning} />
              <Text className="text-ink font-semibold ml-1">
                {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mt-2">
            <Ionicons name="location-outline" size={16} color={colors.muted} />
            <Text className="text-muted ml-1 flex-1">
              {venue.address ? `${venue.address}, ${venue.city}` : venue.city}
            </Text>
          </View>

          {(venue.start_time || venue.end_time) && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="time-outline" size={16} color={colors.muted} />
              <Text className="text-muted ml-1">
                {venue.start_time} - {venue.end_time}
              </Text>
            </View>
          )}

          {venue.phone && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="call-outline" size={16} color={colors.muted} />
              <Text className="text-muted ml-1">{venue.phone}</Text>
            </View>
          )}

          {venue.description && (
            <Text className="text-ink mt-4 leading-5">{venue.description}</Text>
          )}

          {venue.venue_facilities.length > 0 && (
            <View className="mt-6">
              <Text className="text-ink font-semibold text-base mb-2">Facilities</Text>
              <View className="flex-row flex-wrap gap-2">
                {venue.venue_facilities.map((facility) => (
                  <View
                    key={facility.id}
                    className="bg-primary-light px-3 py-1.5 rounded-full"
                  >
                    <Text className="text-primary-dark text-sm">{facility.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className="mt-6">
            <Text className="text-ink font-semibold text-base mb-2">Courts</Text>
            {venue.court.filter((c) => c.isactive).map((court) => (
              <View
                key={court.id}
                className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3 mb-2"
              >
                <View className="flex-1">
                  <Text className="text-ink font-medium">{court.name}</Text>
                  <Text className="text-muted text-sm mt-0.5">
                    {court.sports?.name}
                    {court.surface_type ? ` · ${court.surface_type}` : ""}
                  </Text>
                </View>
                <Text className="text-primary font-semibold">
                  {court.price_per_hour != null ? `Rs ${court.price_per_hour}/hr` : "Call for pricing"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {!venue.phone && (
          <View className="px-5 pb-8 items-center">
            <Text className="text-muted text-sm text-center">
              No booking number on file for this venue yet — visit in person to book.
            </Text>
          </View>
        )}
      </ScrollView>

      {venue.phone && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 pt-3 pb-6">
          <Pressable
            onPress={handleCallToBook}
            className="bg-primary rounded-xl py-4 flex-row items-center justify-center"
            style={{ gap: 8, ...primaryButtonShadow }}
          >
            <Ionicons name="call" size={18} color="white" />
            <Text className="text-white font-semibold text-base">Call to Book · {venue.phone}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
