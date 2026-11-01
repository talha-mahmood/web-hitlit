import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAllGames, useDeleteGameAsSuperadmin } from "../../hooks/useSuperadmin";
import { colors } from "../../constants/theme";
import SearchField from "../../components/SearchField";
import SuperAdminSectionSwitcher from "../../components/SuperAdminSectionSwitcher";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

// Mirrors AllVenuesListScreen's layout exactly (search + delete-icon rows) —
// the only way a superadmin can delete ANY game/tournament regardless of who
// created it, since games_delete_superadmin (is_superadmin()) is a true hard
// delete, distinct from the creator-only "Cancel" status flip elsewhere.
export default function AllGamesListScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const { data: games, isLoading, refetch, isRefetching } = useAllGames(search || undefined);
  const deleteGame = useDeleteGameAsSuperadmin();

  const handleDelete = (gameId: string, title: string) => {
    Alert.alert(
      "Delete Game/Tournament",
      `Permanently delete "${title}"? This removes it and all its teams/matches/invites for everyone — this cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteGame.mutate(gameId, {
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete game.")),
            }),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="px-3.5" style={{ paddingTop: insets.top + 16, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-ink">All Games</Text>
        </View>
        <SuperAdminSectionSwitcher active="games" />
        <SearchField value={search} onChangeText={setSearch} prefix="Search by " variants={["title", "game code"]} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={games ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="trophy-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">No games found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center bg-white border border-border rounded-2xl p-4">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                    <Text className="text-muted text-xs font-medium">
                      {item.game_type === "TOURNAMENT" ? "Tournament" : "Game"}
                    </Text>
                  </View>
                </View>
                <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                  {item.sports?.name ?? "Sport not set"} · {item.game_date} · {item.status}
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.primaryDark }} numberOfLines={1}>
                  {item.profiles ? `By: ${item.profiles.full_name ?? item.profiles.email}` : "Creator unknown"}
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id, item.title)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
