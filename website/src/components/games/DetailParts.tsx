import type { ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";
import Spinner from "../ui/Spinner";
import { Avatar } from "../ui/Avatar";

// Shared by the Game and Group detail pages (the app's two detail screens
// use the same InfoRow shell and invite banner).

export function InfoRow({ icon, label, value, action, pillColor, badge, divider = true }: { icon: string; label: string; value: string; action?: ReactNode; pillColor?: string; badge?: { label: string; color: string }; divider?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${divider ? "border-b border-border" : ""}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
        <Ionicon name={icon} size={17} color={colors.primaryDark} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted">{label}</span>
          {badge && (
            <span className="rounded-full px-1.5 py-px text-[10px] font-bold text-white" style={{ backgroundColor: badge.color }}>
              {badge.label}
            </span>
          )}
        </div>
        {pillColor ? (
          <span className={`mt-1 inline-block rounded-full px-2 py-[3px] text-xs font-bold text-white ${pillColor === colors.primary ? "bg-brand" : ""}`} style={pillColor === colors.primary ? undefined : { backgroundColor: pillColor }}>
            {value}
          </span>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function InviteBanner({ text, sub, onDismiss, onDecline, onAccept, busy, accepting }: { text: string; sub: string; onDismiss: () => void; onDecline: () => void; onAccept: () => void; busy: boolean; accepting: boolean }) {
  return (
    <div className="mx-5 mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 lg:mx-0">
      <div className="flex items-start">
        <p className="mb-1 flex-1 pr-2 text-sm font-semibold text-ink">{text}</p>
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="-mr-1 -mt-1 p-1">
          <Ionicon name="close" size={18} color={colors.muted} />
        </button>
      </div>
      <p className="mb-3 text-xs text-muted">{sub}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onDecline} disabled={busy} className="flex-1 rounded-lg border border-danger py-2.5 text-sm font-semibold text-danger hover:bg-red-50">
          Decline
        </button>
        <button type="button" onClick={onAccept} disabled={busy} className="flex flex-1 items-center justify-center rounded-lg bg-brand py-2.5 text-sm font-semibold text-white">
          {accepting ? <Spinner size={18} color="white" /> : "Accept"}
        </button>
      </div>
    </div>
  );
}

// Member bubble for squads/events: avatar (tap → profile), an optional
// manage-menu dot for the owner/hosts, and an owner / co-host badge.
export function MemberBubble({ name, avatar, badge, onOpenMenu, onPressAvatar }: { name: string | null; avatar: string | null; badge?: string | null; onOpenMenu?: () => void; onPressAvatar?: () => void }) {
  return (
    <div className="flex w-16 flex-col items-center">
      <div className="relative">
        <button type="button" onClick={onPressAvatar} disabled={!onPressAvatar} aria-label={name ?? "Member"}>
          <Avatar url={avatar} name={name} size={48} />
        </button>
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label={`Manage ${name ?? "member"}`}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface shadow-[0_2px_3px_rgba(15,23,42,0.12)] hover:bg-gray-50"
          >
            <Ionicon name="ellipsis-vertical" size={11} color={colors.ink} />
          </button>
        )}
      </div>
      {badge && <span className="mt-1 rounded-full bg-brand px-1.5 py-0.5 text-xs font-medium text-white">{badge}</span>}
      <span className="mt-1 w-full truncate text-center text-xs text-muted">{(name ?? "Member").split(" ")[0]}</span>
    </div>
  );
}

// The "Block New Users" toggle glyph: a person with a small ban badge (red
// while open, green once blocked).
export function BlockGlyph({ blocked }: { blocked: boolean }) {
  const tone = blocked ? colors.primary : colors.danger;
  return (
    <span className="relative inline-block h-[13px] w-[13px]">
      <Ionicon name="person" size={13} color={tone} />
      <span className={`absolute -bottom-[3px] -right-[3px] flex h-[9px] w-[9px] items-center justify-center rounded-full border border-white ${blocked ? "bg-brand" : "bg-danger"}`}>
        <Ionicon name="ban" size={6} color="white" />
      </span>
    </span>
  );
}
