import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAllEvents, useDisbandEventAsSuperadmin } from "../../hooks/useSuperadmin";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";
import SearchField from "../../components/SearchField";
import SuperAdminSectionSwitcher from "../../components/SuperAdminSectionSwitcher";
import NotificationBell from "../../components/NotificationBell";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList, "AllEventsList">;

// Mirrors AllGroupsListScreen's layout exactly — the only way a superadmin
// can delete ANY event regardless of who owns it, via the
// events_delete_superadmin (is_superadmin()) RLS policy added alongside the
// existing owner/host-only disbandEvent hard delete.
export default function AllEventsListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: unreadCount } = useUnreadNotificationCount(userId);
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
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <SuperAdminSectionSwitcher active="events" />
            <Text className="text-2xl font-bold text-ink">All Events</Text>
          </View>
          <NotificationBell
            unreadCount={unreadCount}
            onPress={() => navigation.navigate("AdminNotifications")}
          />
        </View>
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
            <View className="flex-row items-center bg-surface border border-border rounded-2xl p-4">
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
