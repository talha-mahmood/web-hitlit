import { View, Text, Pressable } from "react-native";
import Image from "./images/OptimizedImage";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import type { VenueListItem } from "../lib/api/venues";
import { getSportImage } from "../lib/sportImages";
import { getVenuePhoto } from "../lib/venuePhotos";
import Bouncy from "./Bouncy";

type VenueCardProps = {
  venue: VenueListItem;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
  // Defaults to shown; pass false to omit the heart/favorite button
  // entirely (e.g. the venue listing page no longer has one).
  showFavorite?: boolean;
  className?: string;
  // Entrance-animation stagger index within the list this card sits in;
  // omit for a card rendered on its own (no staggered siblings).
  index?: number;
  // Set only on distance-sorted lists (e.g. the "Venues near you" home tab).
  distanceLabel?: string;
  // Caps how many sport chips render (extras are just dropped, no "+N")
  // and — only when this prop is passed — reserves that row's height even
  // when a venue has zero courts, so every card in a row of fixed-size
  // cards (the home screen's "Venues near you") ends up the same size
  // whether the venue has no courts or several. Omitted (the
  // VenuesListScreen default) keeps today's behavior: every sport shown,
  // row absent entirely when there are none.
  maxSportChips?: number;
  // Just the photo (with the rating pinned on it) and the venue's name
  // beneath — no city, sport chips or distance. Used by the home screen.
  minimal?: boolean;
};

// A small rotating palette so the sport chips on a venue card read as
// distinct badges rather than one flat repeated tint.
const SPORT_CHIP_COLORS = ["#0EA5E9", "#F59E0B", "#8B5CF6", "#EC4899", "#16A34A"];

export default function VenueCard({
  venue,
  isFavorite,
  onPress,
  onToggleFavorite,
  showFavorite = true,
  className = "",
  index,
  distanceLabel,
  maxSportChips,
  minimal = false,
}: VenueCardProps) {
  const coverImage = [...venue.venue_images]
    .sort((a, b) => a.display_order - b.display_order)
    .at(0)?.image_url;
  const allSportNames = Array.from(
    new Set(venue.court.map((c) => c.sports?.name).filter(Boolean))
  ) as string[];
  const sportNames =
    maxSportChips !== undefined ? allSportNames.slice(0, maxSportChips) : allSportNames;
  // No uploaded photo yet — prefer the curated demo photo for this specific
  // venue, else fall back to a real photo of the venue's own sport (same
  // bundled photos the admin dashboard uses) instead of a flat color block.
  const sportFallbackImage = getVenuePhoto(venue.id) ?? getSportImage(allSportNames[0] ?? "");

  const card = (
    // Shadow lives on this outer, non-clipping wrapper — a shadow doesn't
    // render on a view with overflow:hidden (needed below to clip the cover
    // image to the rounded corners), so it has to sit one level up.
    <Bouncy
      onPress={onPress}
      className={`rounded-2xl ${className}`}
      style={{ ...cardShadow, backgroundColor: colors.surface }}
      scaleTo={0.98}
    >
      <View className="bg-surface rounded-2xl border border-border overflow-hidden">
        <View className="relative">
          {/* Landscape, not square — this card's width (home screen: ~48% of
              the device width) made a flat h-36 read as near-square. */}
          {coverImage ? (
            <Image source={{ uri: coverImage }} className="w-full h-24" resizeMode="cover" />
          ) : sportFallbackImage ? (
            <Image source={sportFallbackImage} className="w-full h-24" resizeMode="cover" />
          ) : (
            <View className="w-full h-24 bg-primary-light" />
          )}
          {showFavorite && (
            <Bouncy
              onPress={onToggleFavorite}
              scaleTo={0.75}
              className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-surface/90 items-center justify-center"
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={16}
                color={isFavorite ? colors.danger : colors.ink}
                margin={8}
              />
            </Bouncy>
          )}
          {minimal && (
            <View
              className="absolute flex-row items-center bg-black/60 rounded-full"
              style={{ left: 6, bottom: 6, paddingHorizontal: 7, paddingVertical: 3, gap: 3 }}
            >
              <Ionicons name="star" size={11} color={colors.warning} />
              <Text className="text-jazba-white text-xs font-bold">
                {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
              </Text>
            </View>
          )}
          {minimal && distanceLabel ? (
            <View
              className="absolute bg-black/60 rounded-full"
              style={{ left: 6, top: 6, paddingHorizontal: 7, paddingVertical: 3 }}
            >
              <Text className="text-jazba-white text-xs font-semibold">{distanceLabel}</Text>
            </View>
          ) : null}
          {!minimal && distanceLabel ? (
            <View className="absolute top-2 left-2 bg-black/60 rounded-full px-2.5 py-1">
              <Text className="text-jazba-white text-xs font-semibold">{distanceLabel}</Text>
            </View>
          ) : null}
        </View>
        <View className="p-2.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-ink font-semibold flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
              {venue.name}
            </Text>
            {!minimal && (
              <View className="flex-row items-center ml-2">
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text className="text-ink text-sm ml-1">
                  {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
                </Text>
              </View>
            )}
          </View>
          {!minimal && (
            <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
              {venue.city}
            </Text>
          )}
          {!minimal && (maxSportChips !== undefined || sportNames.length > 0) ? (
            <View
              className="flex-row flex-wrap mt-1.5"
              style={{ gap: 6, minHeight: maxSportChips !== undefined ? 20 : undefined }}
            >
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
          ) : null}
        </View>
      </View>
    </Bouncy>
  );

  if (index === undefined) return card;
  return <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>{card}</Animated.View>;
}
