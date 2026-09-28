import { View, Text, Pressable, ActivityIndicator, Image } from "react-native";
// Gesture-handler's ScrollView (not RN's): this dropdown is absolutely
// positioned *outside* its parent's bounds (top/bottom: 100%), and on
// Android RN's own touch system never delivers touches that land outside a
// parent's bounds — so RN's ScrollView here can't receive scroll drags.
// Gesture-handler recognizes gestures natively at the root view (see
// GestureHandlerRootView in App.tsx), so it scrolls fine from there.
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import type { MentionSuggestion } from "../lib/api/mentions";
import type { MentionEntityType } from "../lib/mentionParser";

const TYPE_FILTERS: { type: MentionEntityType | undefined; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: undefined, label: "All", icon: "apps-outline" },
  { type: "player", label: "Players", icon: "person-outline" },
  { type: "game", label: "Games", icon: "game-controller-outline" },
  { type: "tournament", label: "Tournaments", icon: "trophy-outline" },
  { type: "squad", label: "Squads", icon: "people-outline" },
];

// Per-type accent — a small colored badge on every row so the type reads at
// a glance even before you reach the subtitle text (matches the "⚽ Player /
// 🏆 Tournament" visual grouping from the spec).
const TYPE_META: Record<MentionEntityType, { icon: keyof typeof MaterialCommunityIcons.glyphMap; bg: string; fg: string; label: string }> = {
  player: { icon: "account", bg: "#EFF6FF", fg: "#2563EB", label: "Player" },
  game: { icon: "calendar-star", bg: "#F0FDF4", fg: colors.primaryDark, label: "Game" },
  tournament: { icon: "trophy", bg: "#FFFBEB", fg: "#D97706", label: "Tournament" },
  squad: { icon: "account-group", bg: "#FDF2F8", fg: "#DB2777", label: "Squad" },
};

function SuggestionRow({ item, onPress }: { item: MentionSuggestion; onPress: () => void }) {
  const meta = TYPE_META[item.entityType];
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-3 py-2.5"
      style={{ gap: 10 }}
    >
      {item.entityType === "player" && item.avatar ? (
        <Image source={{ uri: item.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
      ) : (
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 36, height: 36, backgroundColor: meta.bg }}
        >
          <MaterialCommunityIcons name={meta.icon} size={18} color={meta.fg} />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-ink font-bold text-sm" numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <View className="rounded-full px-2 py-1" style={{ backgroundColor: meta.bg }}>
        <Text className="text-[10px] font-bold" style={{ color: meta.fg }}>
          {meta.label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MentionSuggestionsList({
  visible,
  position,
  query,
  activeType,
  onChangeType,
  suggestions,
  isLoading,
  isError,
  onSelect,
}: {
  visible: boolean;
  // Anchored to the composer that owns it — "above" opens upward (composer
  // sits at the bottom of the screen), "below" opens downward (composer
  // sits at the top).
  position: "above" | "below";
  query: string;
  activeType: MentionEntityType | undefined;
  onChangeType: (type: MentionEntityType | undefined) => void;
  suggestions: MentionSuggestion[];
  isLoading: boolean;
  isError: boolean;
  onSelect: (item: MentionSuggestion) => void;
}) {
  if (!visible) return null;

  const anchorStyle = position === "above" ? { bottom: "100%" as const, marginBottom: 8 } : { top: "100%" as const, marginTop: 8 };

  return (
    <View
      className="bg-white"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...anchorStyle,
        borderRadius: 16,
        maxHeight: 280,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        ...heroShadow,
      }}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}
        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        {TYPE_FILTERS.map((f) => {
          const active = activeType === f.type;
          return (
            <Pressable
              key={f.label}
              onPress={() => onChangeType(f.type)}
              className="flex-row items-center rounded-full"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                gap: 5,
                backgroundColor: active ? colors.primary : "#F3F4F6",
              }}
            >
              <Ionicons name={f.icon} size={13} color={active ? "white" : colors.muted} />
              <Text className="text-xs font-semibold" style={{ color: active ? "white" : colors.muted }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : isError ? (
        <View className="py-6 px-4 items-center">
          <Ionicons name="cloud-offline-outline" size={20} color={colors.muted} />
          <Text className="text-muted text-xs mt-1.5 text-center">Couldn't search right now.</Text>
        </View>
      ) : query.trim().length === 0 ? (
        <View className="py-6 px-4 items-center">
          <Text className="text-muted text-xs text-center">
            Keep typing a name to find a player, game, tournament, or squad.
          </Text>
        </View>
      ) : suggestions.length === 0 ? (
        <View className="py-6 px-4 items-center">
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <Text className="text-muted text-xs mt-1.5 text-center">No matches for "{query.trim()}".</Text>
        </View>
      ) : (
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 230 }}>
          {suggestions.map((item) => (
            <SuggestionRow key={`${item.entityType}:${item.entityId}`} item={item} onPress={() => onSelect(item)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
