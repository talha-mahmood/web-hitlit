import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAllEvents, useDisbandEventAsSuperadmin } from "../../hooks/useSuperadmin";
import { colors } from "../../constants/theme";
import SearchField from "../../components/SearchField";
import SuperAdminSectionSwitcher from "../../components/SuperAdminSectionSwitcher";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

// Mirrors AllGroupsListScreen's layout exactly — the only way a superadmin
// can delete ANY event regardless of who owns it, via the
// events_delete_superadmin (is_superadmin()) RLS policy added alongside the
// existing owner/host-only disbandEvent hard delete.
export default function AllEventsListScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const { data: events, isLoading, refetch, isRefetching } = useAllEvents(search || undefined);
  const disbandEvent = useDisbandEventAsSuperadmin();

  const handleDelete = (eventId: string, name: string) => {
    Alert.alert(
      "Delete Event",
      `Permanently delete "${name}"? This removes the event and its members for everyone — this cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            disbandEvent.mutate(eventId, {
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete event.")),
            }),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="px-3.5" style={{ paddingTop: insets.top + 16, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-ink">All Events</Text>
        </View>
        <SuperAdminSectionSwitcher active="events" />
        <SearchField value={search} onChangeText={setSearch} prefix="Search by " variants={["event name", "event code"]} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={events ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="calendar-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">No events found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center bg-white border border-border rounded-2xl p-4">
              <View className="flex-1 mr-3">
                <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                  {item.event_type} · {item.location ?? "Location not set"}
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.primaryDark }} numberOfLines={1}>
                  {item.profiles ? `Owner: ${item.profiles.full_name ?? item.profiles.email}` : "Owner unknown"}
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id, item.name)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
