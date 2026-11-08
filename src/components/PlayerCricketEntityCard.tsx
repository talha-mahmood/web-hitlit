import { View, Text } from "react-native";
import Image from "./images/OptimizedImage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import Bouncy from "./Bouncy";
import { getSportIcon } from "../lib/sportIcons";
import { getSportImage } from "../lib/sportImages";

// Compact variant of the same card DNA the Groups and Games/Tournaments
// listing screens use (SquadCard / GameCard: white card, border-border,
// rounded-[24px], cardShadow, sport picture tucked into a disc on the right,
// icon+title row, subtitle row, pill row) — shrunk down so 3-4 fit on one
// screen at once, for the read-only Clubs/Teams/Tournaments tabs on a
// player's profile.
export default function PlayerCricketEntityCard({
  photoUrl,
  title,
  subtitle,
  subtitleIcon = "location-outline",
  pillLabel,
  sportName = "cricket",
  onPress,
}: {
  photoUrl?: string | null;
  title: string;
  subtitle?: string | null;
  subtitleIcon?: keyof typeof Ionicons.glyphMap;
  pillLabel?: string | null;
  sportName?: string;
  onPress?: () => void;
}) {
  const sportPhoto = getSportImage(sportName);
  const sportGlyph = getSportIcon(sportName);

  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.98}
      style={{ ...cardShadow, backgroundColor: colors.surface, borderRadius: 20, marginBottom: 10 }}
    >
      <View
        className="border border-border overflow-hidden bg-surface"
        style={{ borderRadius: 20, position: "relative", minHeight: 108, paddingVertical: 12 }}
      >
        {/* Sport picture in a soft green disc, tucked into the right edge —
            same treatment as the full listing cards, just smaller. */}
        <View
          pointerEvents="none"
          className="items-center justify-center overflow-hidden"
          style={{ position: "absolute", right: -18, top: 10, width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryLight }}
        >
          {sportPhoto ? (
            <Image source={sportPhoto} style={{ width: 78, height: 44, marginRight: 16 }} resizeMode="contain" />
          ) : (
            <MaterialCommunityIcons name={sportGlyph.icon} size={30} color={sportGlyph.fg} style={{ marginRight: 16, opacity: 0.8 }} />
          )}
        </View>

        <View className="px-4" style={{ paddingRight: 72 }}>
          <View className="flex-row items-center mb-1" style={{ gap: 7 }}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={{ width: 22, height: 22, borderRadius: 6 }} resizeMode="cover" />
            ) : null}
            <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 15.5 }} numberOfLines={1}>
              {title}
            </Text>
          </View>

          {subtitle ? (
            <View className="flex-row items-center mb-2" style={{ gap: 5 }}>
              <Ionicons name={subtitleIcon} size={12.5} color={colors.muted} />
              <Text className="text-muted flex-1" style={{ fontSize: 12.5 }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          ) : null}

          <View className="bg-primary-light self-start px-2.5 py-1 rounded-full">
            <Text className="text-primary font-bold" style={{ fontSize: 11 }} numberOfLines={1}>
              {pillLabel ?? sportName}
            </Text>
          </View>
        </View>
      </View>
    </Bouncy>
  );
}
