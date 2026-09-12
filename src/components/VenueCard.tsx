import { View, Text, Image, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import type { VenueListItem } from "../lib/api/venues";
import { getSportImage } from "../lib/sportImages";
import { getVenuePhoto } from "../lib/venuePhotos";
import Bouncy from "./Bouncy";

type VenueCardProps = {
  venue: VenueListItem;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  className?: string;
  // Entrance-animation stagger index within the list this card sits in;
  // omit for a card rendered on its own (no staggered siblings).
  index?: number;
  // Set only on distance-sorted lists (e.g. the "Venues near you" home tab).
  distanceLabel?: string;
};

// A small rotating palette so the sport chips on a venue card read as
// distinct badges rather than one flat repeated tint.
const SPORT_CHIP_COLORS = ["#0EA5E9", "#F59E0B", "#8B5CF6", "#EC4899", "#16A34A"];

export default function VenueCard({
  venue,
  isFavorite,
  onPress,
  onToggleFavorite,
  className = "",
  index,
  distanceLabel,
}: VenueCardProps) {
  const coverImage = [...venue.venue_images]
    .sort((a, b) => a.display_order - b.display_order)
    .at(0)?.image_url;
  const sportNames = Array.from(
    new Set(venue.court.map((c) => c.sports?.name).filter(Boolean))
  ) as string[];
  // No uploaded photo yet — prefer the curated demo photo for this specific
  // venue, else fall back to a real photo of the venue's own sport (same
  // bundled photos the admin dashboard uses) instead of a flat color block.
  const sportFallbackImage = getVenuePhoto(venue.id) ?? getSportImage(sportNames[0] ?? "");

  const card = (
    // Shadow lives on this outer, non-clipping wrapper — a shadow doesn't
    // render on a view with overflow:hidden (needed below to clip the cover
    // image to the rounded corners), so it has to sit one level up.
    <Bouncy
      onPress={onPress}
      className={`rounded-2xl ${className}`}
      style={{ ...cardShadow, backgroundColor: "white" }}
      scaleTo={0.98}
    >
      <View className="bg-white rounded-2xl border border-border overflow-hidden">
        <View className="relative">
          {coverImage ? (
            <Image source={{ uri: coverImage }} className="w-full h-36" resizeMode="cover" />
          ) : sportFallbackImage ? (
            <Image source={sportFallbackImage} className="w-full h-36" resizeMode="cover" />
          ) : (
            <View className="w-full h-36 bg-primary-light" />
          )}
          <Bouncy
            onPress={onToggleFavorite}
            scaleTo={0.75}
            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 items-center justify-center"
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? colors.danger : colors.ink}
              margin={9}
            />
          </Bouncy>
          {distanceLabel ? (
            <View className="absolute top-2 left-2 bg-black/60 rounded-full px-2.5 py-1">
              <Text className="text-white text-xs font-semibold">{distanceLabel}</Text>
            </View>
          ) : null}
        </View>
        <View className="p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-ink font-semibold text-base flex-1" numberOfLines={1}>
              {venue.name}
            </Text>
            <View className="flex-row items-center ml-2">
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text className="text-ink text-sm ml-1">
                {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
              </Text>
            </View>
          </View>
          <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
            {venue.city}
          </Text>
          {sportNames.length > 0 && (
            <View className="flex-row flex-wrap mt-1.5" style={{ gap: 6 }}>
              {sportNames.map((name, i) => {
                const color = SPORT_CHIP_COLORS[i % SPORT_CHIP_COLORS.length];
                return (
                  <View
                    key={name}
                    style={{
                      backgroundColor: `${color}1A`,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{name}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Bouncy>
  );

  if (index === undefined) return card;
  return <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>{card}</Animated.View>;
}
