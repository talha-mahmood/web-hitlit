import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { colors } from "@app/constants/theme";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useMarkNotificationRead, useNotifications } from "@app/hooks/useNotifications";
import { resolveNotificationTarget } from "@app/lib/notificationTarget";
import type { NotificationRow } from "@app/lib/api/notifications";
import { notificationPath } from "@/lib/notificationLinks";
import { Ionicon } from "./icons/Icon";

function iconFor(n: NotificationRow) {
  const type = String(n.type ?? "").toLowerCase();
  if (type.includes("challenge") || type.includes("fixture") || type.includes("tournament")) return "trophy-outline";
  if (type.includes("message") || type.includes("chat")) return "chatbubble-ellipses-outline";
  if (type.includes("venue") || type.includes("booking")) return "location-outline";
  return "notifications-outline";
}

// Port of InAppNotificationBanner. The app shows it for push notifications
// that arrive while it's open; the website has no push, so it shows the
// same banner for every new notification row that arrives live (the inbox
// query is realtime). Tap opens its destination (same rules as the inbox);
// it slides away after 5.5s or on ×.
export default function InAppNotificationBanner() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profileType = useProfileStore((s) => s.profile?.type);
  const { data: notifications } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<NotificationRow[]>([]);
  const [visible, setVisible] = useState(false);
  const current = queue[0] ?? null;

  // The first load is history; only rows that appear afterwards are "new".
  useEffect(() => {
    if (!notifications) return;
    if (!seen.current) {
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const fresh = notifications.filter((n) => !seen.current!.has(n.id) && !n.is_read);
    notifications.forEach((n) => seen.current!.add(n.id));
    if (fresh.length) setQueue((q) => [...q, ...fresh.reverse()]);
  }, [notifications]);
  useEffect(() => {
    seen.current = null;
    setQueue([]);
  }, [userId]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setQueue((q) => q.slice(1)), 220);
  };
  useEffect(() => {
    if (!current) return;
    const show = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(dismiss, 5500);
    return () => (cancelAnimationFrame(show), clearTimeout(t));
  }, [current]);

  if (!current || (!current.title && !current.body)) return null;
  const isAdmin = profileType === "owner" || profileType === "superadmin";
  const open = () => {
    if (!current.is_read) markRead.mutate(current.id);
    let to = notificationPath(current.data, { isAdmin });
    if (isAdmin) {
      const target = resolveNotificationTarget(current.data, { isAdmin: true });
      const base = profileType === "superadmin" ? "/superadmin" : "/admin";
      to = target?.screen === "VenueBookings" ? `${base}/venues/${target.params.venueId}/bookings` : `${base}/notifications`;
    }
    dismiss();
    navigate(to ?? "/notifications");
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3.5 top-[calc(env(safe-area-inset-top)+8px)] z-[100] mx-auto max-w-md transition-all duration-200 sm:right-6 sm:left-auto"
      style={{ transform: visible ? "translateY(0)" : "translateY(-120px)", opacity: visible ? 1 : 0 }}
    >
      <div className="flex items-start gap-2.5 overflow-hidden rounded-2xl border border-border bg-surface px-3.5 py-3 shadow-hero">
        <button type="button" onClick={open} aria-label="Open notification" className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <Ionicon name={iconFor(current)} size={19} color={colors.primary} />
          </span>
          <span className="min-w-0 flex-1">
            {current.title && <span className="block text-sm font-bold text-ink">{current.title}</span>}
            {current.body && <span className="line-clamp-4 block text-[12.5px] leading-[18px] text-muted">{current.body}</span>}
          </span>
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss notification" className="flex h-8 w-7 items-center justify-center">
          <Ionicon name="close" size={18} color={colors.muted} />
        </button>
      </div>
    </div>
  );
}
