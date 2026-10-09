import { useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
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
  useDeleteNotification,
  useDeleteAllNotifications,
} from "../../hooks/useNotifications";
import {
  useAcceptTeamInvite,
  useDeclineTeamInvite,
  useAcceptSquadInviteFromNotification,
  useDeclineSquadInviteFromNotification,
} from "../../hooks/useInvites";
import type { NotificationRow } from "../../lib/api/notifications";
import { colors } from "../../constants/theme";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GradientFill from "../../components/GradientFill";

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
  squad_invite: { icon: "mail", color: "#3B82F6", bg: "bg-blue-50" },
  team_invite: { icon: "mail", color: "#3B82F6", bg: "bg-blue-50" },
  game_invite_accepted: { icon: "checkmark-circle", color: "#16A34A", bg: "bg-green-50" },
  squad_invite_accepted: { icon: "checkmark-circle", color: "#16A34A", bg: "bg-green-50" },
  team_invite_accepted: { icon: "checkmark-circle", color: "#16A34A", bg: "bg-green-50" },
  game_invite_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  squad_invite_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  team_invite_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  community_reply: { icon: "chatbubble-ellipses", color: "#3B82F6", bg: "bg-blue-50" },
  followed_post: { icon: "chatbubble-ellipses", color: colors.primary, bg: "bg-primary-light" },
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
// game detail screen); squadId covers squad events; inviteId is only set on
// a team_invite, for its inline Approve/Decline below.
function resolveTarget(n: NotificationRow): { gameId?: string; squadId?: string; commentId?: string; inviteId?: string } {
  const data = (n.data ?? {}) as Record<string, unknown>;
  return {
    gameId: typeof data.gameId === "string" ? data.gameId : undefined,
    squadId: typeof data.squadId === "string" ? data.squadId : undefined,
    commentId: typeof data.commentId === "string" ? data.commentId : undefined,
    inviteId: typeof data.inviteId === "string" ? data.inviteId : undefined,
  };
}

function NotificationCard({
  notification,
  onPress,
  onDelete,
  inviteActions,
}: {
  notification: NotificationRow;
  onPress: () => void;
  onDelete: () => void;
  // Only set for a still-pending team_invite/squad_invite — the notification
  // types that are acted on right here instead of just navigating away, so
  // the recipient can approve/decline without leaving this list.
  inviteActions?: { onApprove: () => void; onDecline: () => void; isResponding: boolean };
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
        {inviteActions && (
          <View className="flex-row mt-3" style={{ gap: 8 }}>
            <Pressable
              onPress={inviteActions.onDecline}
              disabled={inviteActions.isResponding}
              className="flex-1 border border-danger rounded-lg py-2 items-center"
            >
              <Text className="text-danger text-xs font-semibold">Decline</Text>
            </Pressable>
            <Pressable
              onPress={inviteActions.onApprove}
              disabled={inviteActions.isResponding}
              className="flex-1"
            >
              <GradientFill className="rounded-lg py-2 items-center">
                {inviteActions.isResponding ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white text-xs font-semibold">Approve</Text>
                )}
              </GradientFill>
            </Pressable>
          </View>
        )}
      </View>
      <Pressable onPress={onDelete} hitSlop={10} className="p-1 -mt-1 -mr-1">
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
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
  const deleteNotif = useDeleteNotification(userId);
  const deleteAll = useDeleteAllNotifications(userId);
  const acceptTeamInvite = useAcceptTeamInvite();
  const declineTeamInvite = useDeclineTeamInvite();
  const acceptSquadInvite = useAcceptSquadInviteFromNotification();
  const declineSquadInvite = useDeclineSquadInviteFromNotification();
  // Session-only — once an invite is acted on, its Approve/Decline pair
  // hides in favor of the notification's own text, without needing to alter
  // the notification row itself (it's just a plain info feed otherwise).
  const [respondedInviteIds, setRespondedInviteIds] = useState<Set<string>>(new Set());

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  // Shared by tapping the card itself and by approving an invite from it —
  // both land the user on whatever the notification is actually about.
  const navigateToTarget = (n: NotificationRow) => {
    const { gameId, squadId, commentId } = resolveTarget(n);
    if (gameId) {
      navigation.navigate("GameDetail", { gameId });
    } else if (squadId) {
      navigation.navigate("Community", { screen: "SquadDetail", params: { squadId } });
    } else if (commentId) {
      navigation.navigate("Community", { screen: "CommentThread", params: { rootId: commentId } });
    }
  };

  const handlePress = (n: NotificationRow) => {
    if (!n.is_read) markRead.mutate(n.id);
    navigateToTarget(n);
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

  const handleDelete = (n: NotificationRow) => {
    Alert.alert("Delete Notification", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteNotif.mutate(n.id),
      },
    ]);
  };

  // Both team_invite and squad_invite notifications get the same inline
  // Approve/Decline treatment — just backed by a different pair of mutations.
  const handleApproveInvite = (n: NotificationRow, inviteId: string) => {
    const accept = n.type === "squad_invite" ? acceptSquadInvite : acceptTeamInvite;
    accept.mutate(inviteId, {
      onSuccess: () => {
        setRespondedInviteIds((prev) => new Set(prev).add(inviteId));
        if (!n.is_read) markRead.mutate(n.id);
        navigateToTarget(n);
      },
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not approve this request.")),
    });
  };

  const handleDeclineInvite = (n: NotificationRow, inviteId: string) => {
    const decline = n.type === "squad_invite" ? declineSquadInvite : declineTeamInvite;
    decline.mutate(inviteId, {
      onSuccess: () => {
        setRespondedInviteIds((prev) => new Set(prev).add(inviteId));
        if (!n.is_read) markRead.mutate(n.id);
      },
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not decline this request.")),
    });
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
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
                You'll see updates here when something happens with your games, groups, or
                tournaments.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const { inviteId } = resolveTarget(item);
            const isPendingInvite =
              (item.type === "team_invite" || item.type === "squad_invite") &&
              !!inviteId &&
              !respondedInviteIds.has(inviteId);
            const isResponding =
              !!inviteId &&
              ((acceptTeamInvite.isPending && acceptTeamInvite.variables === inviteId) ||
                (declineTeamInvite.isPending && declineTeamInvite.variables === inviteId) ||
                (acceptSquadInvite.isPending && acceptSquadInvite.variables === inviteId) ||
                (declineSquadInvite.isPending && declineSquadInvite.variables === inviteId));
            return (
              <NotificationCard
                notification={item}
                onPress={() => handlePress(item)}
                onDelete={() => handleDelete(item)}
                inviteActions={
                  isPendingInvite
                    ? {
                        onApprove: () => handleApproveInvite(item, inviteId!),
                        onDecline: () => handleDeclineInvite(item, inviteId!),
                        isResponding,
                      }
                    : undefined
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}
