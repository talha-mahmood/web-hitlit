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
  useTeamInviteStatuses,
  useSquadInviteStatuses,
} from "../../hooks/useInvites";
import type { NotificationRow } from "../../lib/api/notifications";
import { colors } from "../../constants/theme";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { resolveNotificationTarget } from "../../lib/notificationTarget";
import GradientFill from "../../components/GradientFill";
import { SkeletonCardRows } from "../../components/Skeleton";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "Notifications">,
  BottomTabNavigationProp<MainTabParamList>
>;

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  game_join_request: { icon: "person-add", get color() { return colors.primary; }, bg: "bg-primary-light" },
  squad_join_request: { icon: "person-add", get color() { return colors.primary; }, bg: "bg-primary-light" },
  team_join_request: { icon: "person-add", get color() { return colors.primary; }, bg: "bg-primary-light" },
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
  followed_post: { icon: "chatbubble-ellipses", get color() { return colors.primary; }, bg: "bg-primary-light" },
  team_challenge_received: { icon: "football", get color() { return colors.primary; }, bg: "bg-primary-light" },
  team_challenge_accepted: { icon: "checkmark-circle", get color() { return colors.primary; }, bg: "bg-primary-light" },
  team_challenge_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  team_challenge_cancelled: { icon: "remove-circle", color: "#DC2626", bg: "bg-red-50" },
  team_fixture_confirmed: { icon: "calendar", get color() { return colors.primary; }, bg: "bg-primary-light" },
};
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
function resolveTarget(n: NotificationRow): { gameId?: string; squadId?: string; commentId?: string; inviteId?: string; challengeId?: string } {
  const data = (n.data ?? {}) as Record<string, unknown>;
  return {
    gameId: typeof data.gameId === "string" ? data.gameId : undefined,
    squadId: typeof data.squadId === "string" ? data.squadId : undefined,
    commentId: typeof data.commentId === "string" ? data.commentId : undefined,
    inviteId: typeof data.inviteId === "string" ? data.inviteId : undefined,
    challengeId: typeof data.challengeId === "string" ? data.challengeId : undefined,
  };
}

function NotificationCard({
  notification,
  onPress,
  onDelete,
  inviteActions,
  resolvedInviteLabel,
}: {
  notification: NotificationRow;
  onPress: () => void;
  onDelete: () => void;
  // Only set for a still-pending team_invite/squad_invite — the notification
  // types that are acted on right here instead of just navigating away, so
  // the recipient can approve/decline without leaving this list.
  inviteActions?: { onApprove: () => void; onDecline: () => void; isResponding: boolean };
  // Set once that invite is no longer pending (accepted/declined, whether
  // just now or in an earlier visit) — shown in place of the Approve/
  // Decline buttons instead of leaving them clickable forever.
  resolvedInviteLabel?: "Approved" | "Declined";
}) {
  const meta = TYPE_META[notification.type ?? ""] ?? { icon: "notifications" as const, color: colors.muted, bg: "bg-gray-50" };
  const unread = !notification.is_read;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center mb-3.5 px-4 py-3.5"
      style={{
        gap: 12,
        minHeight: 112,
        borderRadius: 24,
        backgroundColor: unread ? colors.primaryLight : colors.surface,
        borderWidth: 1,
        borderColor: unread ? `${colors.primary}40` : colors.border,
      }}
    >
      <View className="h-11 w-11 rounded-full items-center justify-center" style={{ backgroundColor: colors.infoLight }}>
        <Ionicons name={meta.icon} size={21} color={meta.color} />
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text className="text-ink font-bold flex-1" style={{ fontSize: 16, lineHeight: 22 }} numberOfLines={1}>
            {notification.title}
          </Text>
          {unread && <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />}
        </View>
        {notification.body && (
          <Text className="text-muted" style={{ fontSize: 14, lineHeight: 19 }} numberOfLines={2}>
            {notification.body}
          </Text>
        )}
        <Text className="text-muted mt-1" style={{ fontSize: 13 }}>{timeAgo(notification.created_at)}</Text>
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
                  <Text className="text-jazba-white text-xs font-semibold">Approve</Text>
                )}
              </GradientFill>
            </Pressable>
          </View>
        )}
        {resolvedInviteLabel && (
          <View className="mt-3">
            <Text
              className={`text-xs font-semibold ${resolvedInviteLabel === "Approved" ? "text-primary" : "text-danger"}`}
            >
              {resolvedInviteLabel}
            </Text>
          </View>
        )}
      </View>
      <Pressable onPress={onDelete} hitSlop={10} className="p-1">
        <Ionicons name="trash-outline" size={22} color={colors.danger} />
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
  // Instant local overlay for "I just acted on this" — shows the resolved
  // label right away, before the status queries below have refetched. The
  // real, persisted source of truth is each invite's own status row (see
  // teamInviteStatuses/squadInviteStatuses) — without that, this map alone
  // would reset to empty the moment the screen remounts (e.g. navigating
  // away and back), leaving an already-resolved invite's Approve/Decline
  // buttons clickable again.
  const [respondedInvites, setRespondedInvites] = useState<Map<string, "accepted" | "declined">>(new Map());

  const teamInviteIds = (notifications ?? [])
    .filter((n) => n.type === "team_invite")
    .map((n) => resolveTarget(n).inviteId)
    .filter((id): id is string => !!id);
  const squadInviteIds = (notifications ?? [])
    .filter((n) => n.type === "squad_invite")
    .map((n) => resolveTarget(n).inviteId)
    .filter((id): id is string => !!id);
  const { data: teamInviteStatuses } = useTeamInviteStatuses(teamInviteIds);
  const { data: squadInviteStatuses } = useSquadInviteStatuses(squadInviteIds);

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  // Shared by tapping the card itself and by approving an invite from it —
  // both land the user on whatever the notification is actually about.
  const navigateToTarget = (n: NotificationRow) => {
    const target = resolveNotificationTarget(n.data);
    if (!target) return;

    switch (target.screen) {
      case "CommentThread":
        navigation.navigate("Community", { screen: "CommentThread", params: target.params });
        break;
      case "SquadDetail":
        navigation.navigate("Community", { screen: "SquadDetail", params: target.params });
        break;
      case "GameDetail":
        navigation.navigate("GameDetail", target.params);
        break;
      case "EventDetail":
        navigation.navigate("EventDetail", target.params);
        break;
      case "VenueDetail":
        navigation.navigate("VenueDetail", target.params);
        break;
      case "TeamChallengeDetails":
        navigation.navigate("TeamChallengeDetails", target.params);
        break;
      case "TeamFixtureDetails":
        navigation.navigate("TeamFixtureDetails", target.params);
        break;
      case "VenueBookings":
        // Admin venue notifications are handled by AdminNotificationsScreen.
        break;
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
        setRespondedInvites((prev) => new Map(prev).set(inviteId, "accepted"));
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
        setRespondedInvites((prev) => new Map(prev).set(inviteId, "declined"));
        if (!n.is_read) markRead.mutate(n.id);
      },
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not decline this request.")),
    });
  };

  return (
    <View className="flex-1 bg-app" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center justify-center px-6 mb-7" style={{ minHeight: 52 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          className="h-12 w-12 items-center justify-center rounded-full border border-border"
          style={{ position: "absolute", left: 16, backgroundColor: colors.surfaceRaised }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-2xl font-bold text-ink">Notifications</Text>
      </View>

      <View className="flex-row items-center justify-between px-6 mb-4">
        <Text className="text-muted" style={{ fontSize: 16 }}>
          {notifications?.filter((item) => !item.is_read).length ?? 0} unread
        </Text>
        <View className="flex-row items-center" style={{ gap: 18 }}>
          {hasUnread && (
            <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <Text className="text-primary font-semibold" style={{ fontSize: 16 }}>Mark all read</Text>
            </Pressable>
          )}
          {(notifications?.length ?? 0) > 0 && (
            <Pressable onPress={handleDeleteAll} disabled={deleteAll.isPending} hitSlop={8} accessibilityLabel="Delete all notifications">
              <Ionicons name="trash-outline" size={19} color={colors.danger} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="px-5"><SkeletonCardRows /></View>
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 0, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
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
          renderItem={({ item }) => {
            const { inviteId } = resolveTarget(item);
            const isInviteType = item.type === "team_invite" || item.type === "squad_invite";
            // Local "just acted on it" overlay wins instantly; otherwise fall
            // back to the invite's actual persisted status; default to
            // "pending" while that query hasn't loaded yet so the buttons
            // don't flash into a false "resolved" state on first render.
            const dbStatus = !inviteId
              ? undefined
              : item.type === "squad_invite"
                ? squadInviteStatuses?.[inviteId]
                : teamInviteStatuses?.[inviteId];
            const effectiveStatus = (inviteId ? respondedInvites.get(inviteId) : undefined) ?? dbStatus ?? "pending";
            const isPendingInvite = isInviteType && !!inviteId && effectiveStatus === "pending";
            const resolvedInviteLabel =
              isInviteType && !!inviteId && effectiveStatus !== "pending"
                ? effectiveStatus === "accepted"
                  ? ("Approved" as const)
                  : ("Declined" as const)
                : undefined;
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
                resolvedInviteLabel={resolvedInviteLabel}
              />
            );
          }}
        />
      )}
    </View>
  );
}
