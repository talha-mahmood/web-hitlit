import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { useAuthStore } from "../../store/authStore";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../../hooks/useNotifications";
import type { NotificationRow } from "../../lib/api/notifications";
import { colors } from "../../constants/theme";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "Notifications">,
  BottomTabNavigationProp<MainTabParamList>
>;

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  game_join_request: { icon: "person-add", color: colors.primary, bg: "bg-primary-light" },
  squad_join_request: { icon: "person-add", color: colors.primary, bg: "bg-primary-light" },
  team_join_request: { icon: "person-add", color: colors.primary, bg: "bg-primary-light" },
  game_join_approved: { icon: "checkmark-circle", color: "#16A34A", bg: "bg-green-50" },
  squad_join_approved: { icon: "checkmark-circle", color: "#16A34A", bg: "bg-green-50" },
  team_join_approved: { icon: "checkmark-circle", color: "#16A34A", bg: "bg-green-50" },
  team_approved: { icon: "checkmark-circle", color: "#16A34A", bg: "bg-green-50" },
  game_join_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  squad_join_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  team_join_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  team_rejected: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  game_removed: { icon: "exit-outline", color: "#DC2626", bg: "bg-red-50" },
  squad_removed: { icon: "exit-outline", color: "#DC2626", bg: "bg-red-50" },
  team_removed: { icon: "exit-outline", color: "#DC2626", bg: "bg-red-50" },
  game_cancelled: { icon: "alert-circle", color: "#DC2626", bg: "bg-red-50" },
  team_pending_approval: { icon: "hourglass", color: "#D97706", bg: "bg-yellow-50" },
  game_invite: { icon: "mail", color: "#3B82F6", bg: "bg-blue-50" },
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

// Every notification stores enough in `data` to know where it points —
// gameId covers games, tournaments, and team events (all surfaced on the
// game detail screen); squadId covers squad events.
function resolveTarget(n: NotificationRow): { gameId?: string; squadId?: string } {
  const data = (n.data ?? {}) as Record<string, unknown>;
  return {
    gameId: typeof data.gameId === "string" ? data.gameId : undefined,
    squadId: typeof data.squadId === "string" ? data.squadId : undefined,
  };
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: NotificationRow;
  onPress: () => void;
}) {
  const meta = TYPE_META[notification.type ?? ""] ?? DEFAULT_META;
  const unread = !notification.is_read;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row rounded-2xl mb-3 px-4 py-3.5"
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
          {unread && <View className="w-2 h-2 rounded-full bg-primary ml-2" />}
        </View>
        {notification.body && (
          <Text className="text-muted text-sm mt-1" numberOfLines={2}>
            {notification.body}
          </Text>
        )}
        <Text className="text-muted text-xs mt-1.5">{timeAgo(notification.created_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: notifications, isLoading, isRefetching, refetch } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  const handlePress = (n: NotificationRow) => {
    if (!n.is_read) markRead.mutate(n.id);
    const { gameId, squadId } = resolveTarget(n);
    if (gameId) {
      navigation.navigate("GameDetail", { gameId });
    } else if (squadId) {
      navigation.navigate("Squads", { screen: "SquadDetail", params: { squadId } });
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center justify-between px-5 mb-4">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Pressable onPress={() => navigation.goBack()} className="p-1 -ml-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="text-2xl font-bold text-ink">Notifications</Text>
        </View>
        {hasUnread && (
          <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <Text className="text-primary font-semibold text-sm">Mark all read</Text>
          </Pressable>
        )}
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
                You'll see updates here when something happens with your games, squads, or
                tournaments.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <NotificationCard notification={item} onPress={() => handlePress(item)} />
          )}
        />
      )}
    </View>
  );
}
