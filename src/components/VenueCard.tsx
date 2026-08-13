import { View, Text, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import type { VenueListItem } from "../lib/api/venues";

type VenueCardProps = {
  venue: VenueListItem;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  className?: string;
};

export default function VenueCard({
  venue,
  isFavorite,
  onPress,
  onToggleFavorite,
  className = "",
}: VenueCardProps) {
  const coverImage = [...venue.venue_images]
    .sort((a, b) => a.display_order - b.display_order)
    .at(0)?.image_url;
  const sportNames = Array.from(
    new Set(venue.court.map((c) => c.sports?.name).filter(Boolean))
  ) as string[];

  return (
    // Shadow lives on this outer, non-clipping wrapper \u2014 a shadow doesn't
    // render on a view with overflow:hidden (needed below to clip the cover
    // image to the rounded corners), so it has to sit one level up.
    <Pressable onPress={onPress} className={`rounded-2xl ${className}`} style={cardShadow}>
      <View className="bg-white rounded-2xl border border-border overflow-hidden">
        <View className="relative">
          {coverImage ? (
            <Image source={{ uri: coverImage }} className="w-full h-36" resizeMode="cover" />
          ) : (
            <View className="w-full h-36 bg-primary-light" />
          )}
          <Pressable
            onPress={onToggleFavorite}
            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 items-center justify-center"
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? colors.danger : colors.ink}
            />
          </Pressable>
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
            <Text className="text-muted text-xs mt-1" numberOfLines={1}>
              {sportNames.join(" \u00b7 ")}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
