import { colors } from "@app/constants/theme";
import { Ionicon } from "./icons/Icon";

// The app's NotificationBell: bell glyph with a red unread badge ("9+" cap).
export default function NotificationBell({
  onPress,
  size = 24,
  color = colors.ink,
  unreadCount,
}: {
  onPress: () => void;
  size?: number;
  color?: string;
  unreadCount?: number;
}) {
  const hasUnread = !!unreadCount && unreadCount > 0;
  const label = unreadCount && unreadCount > 9 ? "9+" : String(unreadCount ?? "");
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"}
      className="relative rounded-full p-1 transition hover:bg-white/10"
    >
      <Ionicon name="notifications" size={size} color={color} />
      {hasUnread && (
        <span
          className="absolute right-[-2px] top-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-danger text-[10px] font-bold leading-3 text-white"
          style={{ paddingInline: label.length > 1 ? 4 : 0 }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
