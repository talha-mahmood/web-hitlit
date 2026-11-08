import { View, Text, Pressable, Dimensions } from "react-native";
import Image from "./images/OptimizedImage";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Bouncy from "./Bouncy";
import { colors, cardShadow } from "../constants/theme";
import { getSportIcon } from "../lib/sportIcons";
import { getSportImage } from "../lib/sportImages";
import { getVenuePhoto } from "../lib/venuePhotos";
import { SPORT_ICON_BADGE_SIZE } from "./SportsBySportSection";
import { dayLabel, timeBadgeColor } from "../lib/badgeColors";
import { formatDistanceKm } from "../lib/distance";
import type { GameListItem } from "../lib/api/games";
import type { SquadListItem } from "../lib/api/squads";
import type { VenueListItem } from "../lib/api/venues";

// Every card in every "near you" row (games, tournaments, venues, squads) is
// sized to exactly match the Games/Tournaments/Venues/Squads/Players
// Dashboard action cards on the home screen (48% of the row width, 120 tall)
// so the two card families read as one consistent size language.
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SECTION_HORIZONTAL_PADDING = 14; // matches the home screen's px-3.5 wrapper
export const NEARBY_CARD_GAP = 10;
export const NEARBY_CARD_WIDTH = Math.round(
  (SCREEN_WIDTH - SECTION_HORIZONTAL_PADDING * 2) * 0.48
);
// Every card in every "near you" row (games, tournaments, venues, squads)
// uses this exact width + height — no card is ever taller/shorter or
// wider/narrower than another, regardless of how much content it holds.
export const NEARBY_CARD_HEIGHT = 120;
// Fixed footer height on the venue card's text block — the photo above it
// gets whatever's left of NEARBY_CARD_HEIGHT, so the two card styles still
// line up to the same total height. Computed as plain numbers (not
// flex/percentage) so the image always gets an exact, definite pixel size
// instead of depending on nested flex resolution.
const VENUE_TEXT_BLOCK_HEIGHT = 40;
const VENUE_IMAGE_HEIGHT = NEARBY_CARD_HEIGHT - VENUE_TEXT_BLOCK_HEIGHT;
// Horizontal padding inside the icon-led cards (px-2 on each side) — text
// gets an explicit maxWidth of the card minus this, so a long title/address
// truncates with an ellipsis instead of ever widening the card itself.
const CARD_INNER_PADDING = 8;
const CARD_TEXT_MAX_WIDTH = NEARBY_CARD_WIDTH - CARD_INNER_PADDING * 2;

function formatTimeRange(startTime: string, endTime: string): string {
  const fmt = (t: string) =>
    new Date(`2000-01-01T${t}`).toLocaleTimeString("en-PK", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${fmt(startTime)} - ${fmt(endTime)}`;
}

function SportBadge({
  sportName,
  size = SPORT_ICON_BADGE_SIZE,
  iconUrl,
}: {
  sportName: string;
  size?: number;
  iconUrl?: string | null;
}) {
  const photo = iconUrl ? { uri: iconUrl } : getSportImage(sportName);
  const { icon, bg, fg } = getSportIcon(sportName);

  if (photo) {
    return (
      <Image
        source={photo}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.55} color={fg} />
    </View>
  );
}

function DistancePill({ km }: { km: number | null }) {
  if (km === null) return null;
  return (
    <View className="flex-row items-center justify-center" style={{ gap: 3 }}>
      <Ionicons name="location" size={10} color={colors.primary} />
      <Text className="text-primary text-[10px] font-semibold">{formatDistanceKm(km)}</Text>
    </View>
  );
}

// Friendly placeholder shown in place of a horizontal row when it has no
// data — spans the row's full width rather than leaving a tiny line of text
// where three cards would otherwise sit.
export function NearbyEmptyRow({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View
      className="items-center justify-center rounded-2xl border border-dashed border-border bg-surface"
      style={{ paddingVertical: 22 }}
    >
      <View className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center mb-2">
        <Ionicons name={icon} size={20} color={colors.muted} />
      </View>
      <Text className="text-muted text-xs font-medium text-center">{label}</Text>
    </View>
  );
}

// Compact, centered "tile" card for a horizontally-scrollable "near you" row
// — sport icon up top, then title/meta stacked below. Used for both regular
// games and tournaments (the caller distinguishes via `game.game_type`).
export function NearbyGameCard({
  game,
  distanceKm,
  onPress,
}: {
  game: GameListItem;
  distanceKm: number | null;
  onPress: () => void;
}) {
  const isTournament = game.game_type === "TOURNAMENT";
  const badgeColor = isTournament ? "#7C3AED" : timeBadgeColor(game.start_time);
  const placeName = game.venues?.name ?? game.custom_venue_name ?? "Location TBD";

  return (
    <Bouncy
      onPress={onPress}
      style={{
        ...cardShadow,
        backgroundColor: colors.surface,
        borderRadius: 16,
        width: NEARBY_CARD_WIDTH,
        height: NEARBY_CARD_HEIGHT,
      }}
      scaleTo={0.97}
    >
      <View
        className="border border-border rounded-2xl bg-surface items-center"
        style={{
          width: NEARBY_CARD_WIDTH,
          height: NEARBY_CARD_HEIGHT,
          overflow: "hidden",
          justifyContent: "space-between",
          paddingHorizontal: CARD_INNER_PADDING,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        <View style={{ alignItems: "center", maxWidth: CARD_TEXT_MAX_WIDTH }}>
          <SportBadge sportName={game.sports?.name ?? ""} iconUrl={game.icon_url} />
          <Text
            className="text-ink font-bold text-[11px] mt-2 text-center"
            numberOfLines={1}
            style={{ maxWidth: CARD_TEXT_MAX_WIDTH }}
          >
            {game.title}
          </Text>
          <Text
            className="text-muted text-[9px] mt-0.5 text-center"
            numberOfLines={1}
            style={{ maxWidth: CARD_TEXT_MAX_WIDTH }}
          >
            {placeName}
          </Text>
        </View>
        <View style={{ alignItems: "center", maxWidth: CARD_TEXT_MAX_WIDTH }}>
          <View
            style={{
              backgroundColor: badgeColor,
              paddingHorizontal: 7,
              paddingVertical: 2.5,
              borderRadius: 999,
              maxWidth: CARD_TEXT_MAX_WIDTH,
            }}
          >
            <Text
              style={{ color: "white", fontSize: 9, fontWeight: "700", maxWidth: CARD_TEXT_MAX_WIDTH - 14 }}
              numberOfLines={1}
            >
              {dayLabel(game.game_date)} · {formatTimeRange(game.start_time, game.end_time).split(" - ")[0]}
            </Text>
          </View>
          <View className="mt-1.5">
            <DistancePill km={distanceKm} />
          </View>
        </View>
      </View>
    </Bouncy>
  );
}

export function NearbySquadCard({
  squad,
  distanceKm,
  onPress,
}: {
  squad: SquadListItem;
  distanceKm: number | null;
  onPress: () => void;
}) {
  const approved = squad.squad_members.filter((m) => m.status === "ACTIVE");

  return (
    <Bouncy
      onPress={onPress}
      style={{
        ...cardShadow,
        backgroundColor: colors.surface,
        borderRadius: 16,
        width: NEARBY_CARD_WIDTH,
        height: NEARBY_CARD_HEIGHT,
      }}
      scaleTo={0.97}
    >
      <View
        className="border border-border rounded-2xl bg-surface items-center"
        style={{
          width: NEARBY_CARD_WIDTH,
          height: NEARBY_CARD_HEIGHT,
          overflow: "hidden",
          justifyContent: "space-between",
          paddingHorizontal: CARD_INNER_PADDING,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        <View style={{ alignItems: "center", maxWidth: CARD_TEXT_MAX_WIDTH }}>
          <SportBadge sportName={squad.sports?.name ?? ""} iconUrl={squad.icon_url} />
          <Text
            className="text-ink font-bold text-[11px] mt-2 text-center"
            numberOfLines={1}
            style={{ maxWidth: CARD_TEXT_MAX_WIDTH }}
          >
            {squad.name}
          </Text>
          <Text
            className="text-muted text-[9px] mt-0.5 text-center"
            numberOfLines={1}
            style={{ maxWidth: CARD_TEXT_MAX_WIDTH }}
          >
            {squad.location ?? "Location not set"}
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <View className="flex-row items-center" style={{ gap: 3 }}>
            <Ionicons name="people" size={11} color={colors.muted} />
            <Text className="text-muted text-[10px] font-medium">{approved.length}</Text>
          </View>
          <View className="mt-1.5">
            <DistancePill km={distanceKm} />
          </View>
        </View>
      </View>
    </Bouncy>
  );
}

// Photo-led (rather than icon-led) compact card for the "Venues near you"
// row — venues are physical places, so a real photo carries more of the
// "which one is this" signal than a generic sport icon would.
export function NearbyVenueCard({
  venue,
  distanceKm,
  isFavorite,
  onPress,
  onToggleFavorite,
}: {
  venue: VenueListItem;
  distanceKm: number | null;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const coverImage = [...venue.venue_images]
    .sort((a, b) => a.display_order - b.display_order)
    .at(0)?.image_url;
  // No uploaded photo yet — prefer the curated demo photo for this specific
  // venue, else fall back to a real photo of the venue's own sport (same
  // bundled photos the admin dashboard uses) instead of a flat color block.
  const sportFallbackImage = getVenuePhoto(venue.id) ?? getSportImage(venue.court[0]?.sports?.name ?? "");

  return (
    <Bouncy
      onPress={onPress}
      style={{
        ...cardShadow,
        backgroundColor: colors.surface,
        borderRadius: 16,
        width: NEARBY_CARD_WIDTH,
        height: NEARBY_CARD_HEIGHT,
      }}
      scaleTo={0.97}
    >
      <View
        className="border border-border rounded-2xl bg-surface"
        style={{ width: NEARBY_CARD_WIDTH, height: NEARBY_CARD_HEIGHT, overflow: "hidden" }}
      >
        <View style={{ width: NEARBY_CARD_WIDTH, height: VENUE_IMAGE_HEIGHT, position: "relative" }}>
          {coverImage ? (
            <Image
              source={{ uri: coverImage }}
              style={{ width: NEARBY_CARD_WIDTH, height: VENUE_IMAGE_HEIGHT }}
              resizeMode="cover"
            />
          ) : sportFallbackImage ? (
            <Image
              source={sportFallbackImage}
              style={{ width: NEARBY_CARD_WIDTH, height: VENUE_IMAGE_HEIGHT }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: NEARBY_CARD_WIDTH, height: VENUE_IMAGE_HEIGHT }} className="bg-primary-light" />
          )}
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={6}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-surface/90 items-center justify-center"
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={12}
              color={isFavorite ? colors.danger : colors.ink}
            />
          </Pressable>
          {distanceKm !== null && (
            <View className="absolute bottom-1 left-1 bg-black/60 rounded-full px-1.5 py-0.5">
              <Text className="text-jazba-white text-[9px] font-semibold">{formatDistanceKm(distanceKm)}</Text>
            </View>
          )}
        </View>
        <View
          className="px-2 pt-1.5 pb-2 justify-center"
          style={{ width: NEARBY_CARD_WIDTH, height: VENUE_TEXT_BLOCK_HEIGHT }}
        >
          <Text className="text-ink font-bold text-[11px]" numberOfLines={1} style={{ maxWidth: CARD_TEXT_MAX_WIDTH }}>
            {venue.name}
          </Text>
          <View className="flex-row items-center mt-0.5" style={{ gap: 3 }}>
            <Ionicons name="star" size={10} color={colors.warning} />
            <Text className="text-muted text-[10px]">{venue.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </Bouncy>
  );
}
