import { useState } from "react";
import { colors } from "@app/constants/theme";
import { useAuthStore } from "@app/store/authStore";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useDeleteNotification, useDeleteAllNotifications } from "@app/hooks/useNotifications";
import {
  useAcceptTeamInvite,
  useDeclineTeamInvite,
  useAcceptSquadInviteFromNotification,
  useDeclineSquadInviteFromNotification,
  useTeamInviteStatuses,
  useSquadInviteStatuses,
} from "@app/hooks/useInvites";
import type { NotificationRow } from "@app/lib/api/notifications";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { notificationPath } from "@/lib/notificationLinks";
import { SkeletonCardRows } from "@/components/ui/Skeleton";

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
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
  team_challenge_received: { icon: "football", color: colors.primary, bg: "bg-primary-light" },
  team_challenge_accepted: { icon: "checkmark-circle", color: colors.primary, bg: "bg-primary-light" },
  team_challenge_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
  team_challenge_cancelled: { icon: "remove-circle", color: "#DC2626", bg: "bg-red-50" },
  team_fixture_confirmed: { icon: "calendar", color: colors.primary, bg: "bg-primary-light" },
};
const DEFAULT_META = { icon: "notifications", color: colors.muted, bg: "bg-gray-50" };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function inviteIdOf(n: NotificationRow): string | undefined {
  const data = (n.data ?? {}) as Record<string, unknown>;
  for (const key of ["inviteId", "invite_id"]) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
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
  inviteActions?: { onApprove: () => void; onDecline: () => void; isResponding: boolean };
  resolvedInviteLabel?: "Approved" | "Declined";
}) {
  const meta = TYPE_META[notification.type ?? ""] ?? DEFAULT_META;
  const unread = !notification.is_read;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => e.key === "Enter" && onPress()}
      className={`mb-3.5 flex min-h-[112px] cursor-pointer items-center gap-3 rounded-3xl border px-4 py-3.5 transition hover:shadow-card ${unread ? "border-primary/25 bg-primary-light" : "border-border bg-surface"}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-info-light">
        <Ionicon name={meta.icon} size={21} color={meta.color} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-base font-bold leading-[22px] text-ink">{notification.title}</p>
          {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        </div>
        {notification.body && <p className="line-clamp-2 text-sm leading-[19px] text-muted">{notification.body}</p>}
        <p className="mt-1 text-[13px] text-muted">{timeAgo(notification.created_at)}</p>
        {inviteActions && (
          <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={inviteActions.onDecline}
              disabled={inviteActions.isResponding}
              className="flex-1 rounded-lg border border-danger py-2 text-xs font-semibold text-danger hover:bg-red-50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={inviteActions.onApprove}
              disabled={inviteActions.isResponding}
              className="flex flex-1 items-center justify-center rounded-lg bg-brand py-2 text-xs font-semibold text-white"
            >
              {inviteActions.isResponding ? <Spinner size={16} color="white" /> : "Approve"}
            </button>
          </div>
        )}
        {resolvedInviteLabel && (
          <p className={`mt-3 text-xs font-semibold ${resolvedInviteLabel === "Approved" ? "text-primary" : "text-danger"}`}>{resolvedInviteLabel}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Delete notification"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded-full p-1 hover:bg-black/5"
      >
        <Ionicon name="trash-outline" size={22} color={colors.danger} />
      </button>
    </div>
  );
}

// Port of NotificationsScreen: live list (realtime), tap → mark read and
// open what it's about, inline Approve/Decline for team & squad invites
// (status persists from the invite row), mark all read, delete one / all.
export default function NotificationsPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack("/");
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: notifications, isLoading } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const deleteNotif = useDeleteNotification(userId);
  const deleteAll = useDeleteAllNotifications(userId);
  const acceptTeamInvite = useAcceptTeamInvite();
  const declineTeamInvite = useDeclineTeamInvite();
  const acceptSquadInvite = useAcceptSquadInviteFromNotification();
  const declineSquadInvite = useDeclineSquadInviteFromNotification();
  const [responded, setResponded] = useState<Map<string, "accepted" | "declined">>(new Map());

  const idsOf = (type: string) =>
    (notifications ?? [])
      .filter((n) => n.type === type)
      .map((n) => inviteIdOf(n))
      .filter((id): id is string => !!id);
  const { data: teamStatuses } = useTeamInviteStatuses(idsOf("team_invite"));
  const { data: squadStatuses } = useSquadInviteStatuses(idsOf("squad_invite"));
  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  // Same payload → destination rules as the app (chats, fixtures,
  // challenges, tournament fixtures, events, venues…).
  const navigateToTarget = (n: NotificationRow) => {
    const to = notificationPath(n.data);
    if (to) navigate(to);
  };

  const handlePress = (n: NotificationRow) => {
    if (!n.is_read) markRead.mutate(n.id);
    navigateToTarget(n);
  };

  const respond = (n: NotificationRow, inviteId: string, accept: boolean) => {
    const isSquad = n.type === "squad_invite";
    const m = accept ? (isSquad ? acceptSquadInvite : acceptTeamInvite) : isSquad ? declineSquadInvite : declineTeamInvite;
    m.mutate(inviteId, {
      onSuccess: () => {
        setResponded((prev) => new Map(prev).set(inviteId, accept ? "accepted" : "declined"));
        if (!n.is_read) markRead.mutate(n.id);
        if (accept) navigateToTarget(n);
      },
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, accept ? "Could not approve this request." : "Could not decline this request.")),
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-3.5 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6 lg:px-8 lg:pt-8">
      <div className="relative mb-7 flex min-h-[52px] items-center justify-center">
        <button type="button" onClick={goBack} aria-label="Go back" className="absolute left-0 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-raised hover:brightness-95">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <h1 className="text-2xl font-bold text-ink">Notifications</h1>
      </div>
      <div className="mb-4 flex items-center justify-between px-2.5">
        <p className="text-base text-muted">{(notifications ?? []).filter((n) => !n.is_read).length} unread</p>
        <div className="flex items-center gap-[18px]">
          {hasUnread && (
            <button type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="text-base font-semibold text-primary hover:underline">
              Mark all read
            </button>
          )}
          {(notifications?.length ?? 0) > 0 && (
            <button
              type="button"
              disabled={deleteAll.isPending}
              aria-label="Delete all notifications"
              title="Delete all"
              className="rounded-full p-1 hover:bg-black/5"
              onClick={() =>
                Alert.alert("Delete All Notifications", "Remove all your notifications? This can't be undone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete All",
                    style: "destructive",
                    onPress: () => deleteAll.mutate(undefined, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete notifications.")) }),
                  },
                ])
              }
            >
              <Ionicon name="trash-outline" size={19} color={colors.danger} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonCardRows />
      ) : (notifications ?? []).length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Ionicon name="notifications-outline" size={48} color={colors.border} />
          <p className="text-base font-semibold text-ink">No notifications yet</p>
          <p className="px-8 text-sm text-muted">You'll see updates here when something happens with your games, squads, or tournaments.</p>
        </div>
      ) : (
        <div className="pb-6 sm:px-1.5">
          {(notifications ?? []).map((item) => {
            const inviteId = inviteIdOf(item);
            const isInvite = item.type === "team_invite" || item.type === "squad_invite";
            const dbStatus = !inviteId ? undefined : item.type === "squad_invite" ? squadStatuses?.[inviteId] : teamStatuses?.[inviteId];
            const status = (inviteId ? responded.get(inviteId) : undefined) ?? dbStatus ?? "pending";
            const pending = isInvite && !!inviteId && status === "pending";
            const isResponding =
              !!inviteId &&
              [acceptTeamInvite, declineTeamInvite, acceptSquadInvite, declineSquadInvite].some((m) => m.isPending && m.variables === inviteId);
            return (
              <NotificationCard
                key={item.id}
                notification={item}
                onPress={() => handlePress(item)}
                onDelete={() =>
                  Alert.alert("Delete Notification", "Remove this notification?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteNotif.mutate(item.id) },
                  ])
                }
                inviteActions={pending ? { onApprove: () => respond(item, inviteId!, true), onDecline: () => respond(item, inviteId!, false), isResponding } : undefined}
                resolvedInviteLabel={isInvite && !!inviteId && status !== "pending" ? (status === "accepted" ? "Approved" : "Declined") : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
