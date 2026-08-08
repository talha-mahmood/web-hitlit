import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSquads } from "../../hooks/useSquads";
import { colors } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { SquadListItem } from "../../lib/api/squads";
import { useAuthStore } from "../../store/authStore";

type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadsList">;

const SKILL_COLORS: Record<string, { bg: string; text: string }> = {
  beginner:     { bg: "bg-green-50",  text: "text-green-700"  },
  intermediate: { bg: "bg-yellow-50", text: "text-yellow-700" },
  expert:       { bg: "bg-red-50",    text: "text-red-600"    },
};

function SquadCard({ squad, onPress, currentUserId }: {
  squad: SquadListItem;
  onPress: () => void;
  currentUserId?: string;
}) {
  const active = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const isFull = !!squad.max_players && active.length >= squad.max_players;
  const isMySquad = squad.squad_owner_id === currentUserId;
  const skill = squad.skill_level;
  const skillStyle = skill ? SKILL_COLORS[skill] : null;

  return (
    <Pressable
      onPress={onPress}
      className="border border-border rounded-2xl mb-3 overflow-hidden bg-white"
    >
      <View className="bg-primary h-1" />
      <View className="px-4 pt-3 pb-4">
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          {skillStyle && (
            <View className={`px-2 py-0.5 rounded-full ${skillStyle.bg}`}>
              <Text className={`text-xs font-medium ${skillStyle.text}`}>
                {skill!.charAt(0).toUpperCase() + skill!.slice(1)}
              </Text>
            </View>
          )}
          {isMySquad && (
            <View className="bg-blue-50 px-2 py-0.5 rounded-full">
              <Text className="text-blue-600 text-xs font-medium">My Squad</Text>
            </View>
          )}
          <View className="flex-1" />
          {isFull && (
            <View className="bg-red-50 px-2 py-0.5 rounded-full">
              <Text className="text-red-600 text-xs font-medium">Full</Text>
            </View>
          )}
        </View>

        <Text className="text-ink font-bold text-base mb-1" numberOfLines={1}>
          {squad.name}
        </Text>

        <View className="flex-row items-center justify-between mt-1">
          <View className="flex-row items-center" style={{ gap: 4, flex: 1 }}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text className="text-muted text-sm" numberOfLines={1}>
              {squad.location ?? "Location not set"}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="people-outline" size={13} color={colors.muted} />
            <Text className="text-muted text-sm">
              {active.length}{squad.max_players ? `/${squad.max_players}` : ""}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
          <Ionicons name="person-circle-outline" size={14} color={colors.muted} />
          <Text className="text-muted text-sm" numberOfLines={1}>
            {squad.profiles?.full_name ?? "Unknown"}
          </Text>
        </View>
      </View>
    </Pressable>
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
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Text className="text-2xl font-bold text-ink">Squads</Text>
        <Pressable
          onPress={() => navigation.navigate("CreateSquad")}
          className="flex-row items-center bg-primary rounded-xl px-3 py-2"
          style={{ gap: 4 }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white font-semibold text-sm">Create</Text>
        </Pressable>
      </View>

      {/* Search by squad name or squad ID */}
      <View className="px-5 mb-3">
        <View className="flex-row items-center border border-border rounded-xl px-3" style={{ gap: 8 }}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search by squad name or squad ID"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 py-2.5 text-ink text-sm"
          />
          {searchInput.length > 0 && (
            <Pressable onPress={() => setSearchInput("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.border} />
            </Pressable>
          )}
        </View>
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
          renderItem={({ item }) => (
            <SquadCard
              squad={item}
              currentUserId={userId}
              onPress={() => navigation.navigate("SquadDetail", { squadId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}
