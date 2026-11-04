import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useDeleteNotification,
  useDeleteAllNotifications,
} from "../../hooks/useNotifications";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import type { NotificationRow } from "../../lib/api/notifications";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import GradientFill from "../../components/GradientFill";

type Nav = NativeStackNavigationProp<VenueEditingParamList, "AdminNotifications">;

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  venue_booking_created: { icon: "calendar", color: colors.primary, bg: "bg-primary-light" },
  venue_booking_cancelled: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
};
const DEFAULT_META = { icon: "notifications" as const, color: colors.muted, bg: "bg-gray-50" };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function resolveVenueId(n: NotificationRow): string | undefined {
  const data = (n.data ?? {}) as Record<string, unknown>;
  return typeof data.venue_id === "string" ? data.venue_id : undefined;
}

function NotificationCard({
  notification,
  onPress,
  onDelete,
}: {
  notification: NotificationRow;
  onPress: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[notification.type ?? ""] ?? DEFAULT_META;
  const unread = !notification.is_read;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start rounded-2xl mb-3 px-4 py-3.5"
      style={{
        gap: 12,
        backgroundColor: unread ? colors.primaryLight : "white",
        borderWidth: 1,
        borderColor: unread ? colors.primary : colors.border,
      }}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center ${meta.bg}`}>
        <Ionicons name={meta.icon} size={19} color={meta.color} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>
            {notification.title}
          </Text>
          {unread && <GradientFill className="w-2 h-2 rounded-full ml-2" />}
        </View>
        {notification.body && (
          <Text className="text-muted text-sm mt-1" numberOfLines={2}>
            {notification.body}
          </Text>
        )}
        <Text className="text-muted text-xs mt-1.5">{timeAgo(notification.created_at)}</Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={10} className="p-1 -mt-1 -mr-1">
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

export default function AdminNotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: notifications, isLoading, isRefetching, refetch } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const deleteNotif = useDeleteNotification(userId);
  const deleteAll = useDeleteAllNotifications(userId);

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  const handlePress = (n: NotificationRow) => {
    if (!n.is_read) markRead.mutate(n.id);
    const venueId = resolveVenueId(n);
    if (venueId) {
      navigation.navigate("VenueBookings", { venueId });
    }
  };

  const handleDelete = (n: NotificationRow) => {
    Alert.alert("Delete Notification", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteNotif.mutate(n.id) },
    ]);
  };

  const handleDeleteAll = () => {
    Alert.alert("Delete All Notifications", "Remove all your notifications? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All",
        style: "destructive",
        onPress: () =>
          deleteAll.mutate(undefined, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete notifications.")),
          }),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center justify-between px-3.5 mb-4">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Pressable onPress={() => navigation.goBack()} className="p-1 -ml-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="text-2xl font-bold text-ink">Notifications</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 16 }}>
          {hasUnread && (
            <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <Text className="text-primary font-semibold text-sm">Mark all read</Text>
            </Pressable>
          )}
          {(notifications?.length ?? 0) > 0 && (
            <Pressable onPress={handleDeleteAll} disabled={deleteAll.isPending} hitSlop={8}>
              <Text className="text-danger font-semibold text-sm">Delete all</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="items-center mt-16" style={{ gap: 12 }}>
              <Ionicons name="notifications-outline" size={48} color={colors.border} />
              <Text className="text-ink font-semibold text-base">No notifications yet</Text>
              <Text className="text-muted text-sm text-center px-8">
                You'll see updates here when your venues get new bookings or cancellations.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}
    </View>
  );
}
