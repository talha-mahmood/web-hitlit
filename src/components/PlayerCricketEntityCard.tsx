import { View, Text, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { cardShadow } from "../constants/theme";
import Bouncy from "./Bouncy";
import { getSportIcon } from "../lib/sportIcons";

// Shared card for the Clubs/Teams/Tournaments tabs on the Player Profile
// screen — dark card, square photo/icon on the left, title + subtitle, and a
// small sport-icon badge at the bottom, matching the reference screenshot.
// There's no "country" concept anywhere in this app's data model, so unlike
// the reference image this never invents a flag — only the real sport icon.
export default function PlayerCricketEntityCard({
  photoUrl,
  fallbackIcon = "cricket",
  title,
  subtitle,
  sportName = "cricket",
  onPress,
}: {
  photoUrl?: string | null;
  fallbackIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string | null;
  sportName?: string;
  onPress?: () => void;
}) {
  const { icon, fg, bg } = getSportIcon(sportName);
  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.98}
      style={{ ...cardShadow, borderRadius: 20, marginBottom: 12, backgroundColor: "#111827" }}
    >
      <View className="flex-row items-center rounded-[20px] p-4" style={{ gap: 16 }}>
        <View
          className="items-center justify-center overflow-hidden rounded-2xl"
          style={{ width: 84, height: 84, backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <MaterialCommunityIcons name={fallbackIcon} size={32} color="rgba(255,255,255,0.4)" />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold" style={{ fontSize: 17 }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 3 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <View
            className="items-center justify-center rounded-full mt-3"
            style={{ width: 24, height: 24, backgroundColor: bg }}
          >
            <MaterialCommunityIcons name={icon} size={13} color={fg} />
          </View>
        </View>
      </View>
    </Bouncy>
  );
}
