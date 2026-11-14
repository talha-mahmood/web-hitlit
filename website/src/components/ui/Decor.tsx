import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";

// Ports of WaveDivider, BlinkingEyeIcon and ChatIcon.

export function WaveDivider({ color, height = 28 }: { color: string; height?: number }) {
  return (
    <svg width="100%" height={height} viewBox="0 0 400 40" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px" aria-hidden>
      <path d="M0,18 C100,-6 300,42 400,16 L400,40 L0,40 Z" fill={color} />
    </svg>
  );
}

// Eye that blinks twice, then rests ~3.5s.
export function BlinkingEyeIcon({ size = 18, color = colors.muted }: { size?: number; color?: string }) {
  return (
    <span className="inline-flex animate-blink" aria-hidden>
      <Ionicon name="eye-outline" size={size} color={color} />
    </span>
  );
}

// Chat bubble with three dots and an optional red unread badge ("9+").
export function ChatIcon({ size = 22, bubbleColor = colors.primary, dotColor = "#FFFFFF", unreadCount }: { size?: number; bubbleColor?: string; dotColor?: string; unreadCount?: number }) {
  const dot = Math.max(2, Math.round(size * 0.12));
  const hasUnread = !!unreadCount && unreadCount > 0;
  const label = unreadCount && unreadCount > 9 ? "9+" : String(unreadCount ?? "");
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <Ionicon name="chatbubble" size={size} color={bubbleColor} />
      <span className="absolute inset-x-0 flex items-center justify-center" style={{ top: size * 0.37, gap: Math.round(size * 0.1) }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full" style={{ width: dot, height: dot, backgroundColor: dotColor }} />
        ))}
      </span>
      {hasUnread && (
        <span
          className="absolute -right-2.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-danger text-[10px] font-bold leading-3 text-white"
          style={{ paddingInline: label.length > 1 ? 4 : 0 }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
