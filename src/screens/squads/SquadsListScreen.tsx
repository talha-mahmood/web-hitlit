import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSquads } from "../../hooks/useSquads";
import SearchField from "../../components/SearchField";
import Bouncy from "../../components/Bouncy";
import AvatarStack from "../../components/AvatarStack";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { SquadListItem } from "../../lib/api/squads";
import { useAuthStore } from "../../store/authStore";
import { SQUAD_SKILL_COLORS } from "../../lib/badgeColors";

type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadsList">;

function SquadCard({ squad, onPress, currentUserId, index }: {
  squad: SquadListItem;
  onPress: () => void;
  currentUserId?: string;
  index: number;
}) {
  const active = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const isFull = !!squad.max_players && active.length >= squad.max_players;
  const isMySquad = squad.squad_owner_id === currentUserId;
  const skill = squad.skill_level;
  const skillColor = skill ? SQUAD_SKILL_COLORS[skill] : null;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      {/* Shadow lives on this outer, non-clipping wrapper — a shadow doesn't
          render on a view with overflow:hidden (needed below to clip the top
          accent bar to the rounded corners), so it has to sit one level up. */}
      <Bouncy onPress={onPress} className="mb-3" style={cardShadow} scaleTo={0.98}>
        <View className="border border-border rounded-2xl overflow-hidden bg-white mb-3">
        <View className="bg-primary h-1" />
        <View className="px-4 pt-3 pb-4">
          <View className="flex-row items-center mb-2.5" style={{ gap: 8 }}>
            <AvatarStack
              people={active.map((m) => ({
                avatar: m.profiles?.avatar ?? null,
                name: m.profiles?.full_name ?? null,
              }))}
              size={24}
            />
            <Text className="text-muted text-sm font-medium">
              {active.length} member{active.length !== 1 ? "s" : ""}
            </Text>
            <View className="flex-1" />
            {isMySquad && (
              <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                <Text className="text-blue-600 text-xs font-medium">My Squad</Text>
              </View>
            )}
            {isFull && (
              <View className="bg-red-50 px-2 py-0.5 rounded-full">
                <Text className="text-red-600 text-xs font-medium">Full</Text>
              </View>
            )}
          </View>

          <Text className="text-ink font-bold text-base mb-1" numberOfLines={1}>
            {squad.name}
          </Text>

          <View className="flex-row items-center mb-2" style={{ gap: 4 }}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text className="text-muted text-sm flex-1" numberOfLines={1}>
              {squad.location ?? "Location not set"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-2" style={{ gap: 6 }}>
              {skillColor && skill && (
                <View style={{ backgroundColor: skillColor, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                  </Text>
                </View>
              )}
              <Ionicons name="person-circle-outline" size={14} color={colors.muted} />
              <Text className="text-muted text-sm flex-1" numberOfLines={1}>
                {squad.profiles?.full_name ?? "Unknown"}
              </Text>
            </View>
            {!!squad.max_players && (
              <Text className="text-muted text-xs">
                {active.length}/{squad.max_players}
              </Text>
            )}
          </View>
        </View>
        </View>
      </Bouncy>
    </Animated.View>
  );
}

export default function SquadsListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: squads, isLoading, isRefetching, refetch } = useSquads({
    search: debouncedSearch || undefined,
  });

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Text className="text-2xl font-bold text-ink">Squads</Text>
        <Pressable
          onPress={() => navigation.navigate("CreateSquad")}
          className="flex-row items-center bg-primary rounded-xl px-3 py-2"
          style={{ gap: 4, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white font-semibold text-sm">Create</Text>
        </Pressable>
      </View>

      {/* Search by squad name or squad ID */}
      <View className="px-5 mb-3">
        <SearchField
          value={searchInput}
          onChangeText={setSearchInput}
          prefix="Search by "
          variants={["squad name", "squad ID"]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Squads list */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={squads ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 0 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            debouncedSearch ? (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No squads found</Text>
                <Text className="text-muted text-sm text-center px-8">
                  No squads match "{debouncedSearch}". Try a different name or squad ID.
                </Text>
              </View>
            ) : (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="people-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No squads yet</Text>
                <Text className="text-muted text-sm text-center px-8">
                  Create a squad to find regular playmates near you!
                </Text>
                <Pressable
                  onPress={() => navigation.navigate("CreateSquad")}
                  className="bg-primary rounded-xl px-6 py-3 mt-2"
                >
                  <Text className="text-white font-semibold">Create a Squad</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <SquadCard
              squad={item}
              currentUserId={userId}
              index={index}
              onPress={() => navigation.navigate("SquadDetail", { squadId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}
