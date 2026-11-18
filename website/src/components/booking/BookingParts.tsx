import type { ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { getSportIcon } from "@app/lib/sportIcons";
import { Ionicon, MCIcon } from "../icons/Icon";

// "09:00" → "9:00 AM" (whole hours, same as the app's booking screens).
export function formatHour(timeStr: string): string {
  const h = parseInt(timeStr.split(":")[0], 10);
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

// The booking flow's hero: primary-light panel, round white back button, a
// big rotated sport-icon watermark, then the screen's own content.
export function BookingHero({
  sportName,
  watermarkIcon,
  onBack,
  right,
  title,
  subtitle,
  children,
}: {
  sportName?: string;
  watermarkIcon?: string;
  onBack: () => void;
  right?: ReactNode;
  // Title/subtitle shown in the same row as the back button (Checkout, My
  // Bookings); `children` render below the row instead (Slot Picker).
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const icon = watermarkIcon ?? getSportIcon(sportName ?? "").icon;
  return (
    <header className="relative overflow-hidden bg-primary-light pb-5 pt-[calc(env(safe-area-inset-top)+16px)] lg:rounded-[28px] lg:pb-7 lg:pt-6">
      <MCIcon
        name={icon}
        size={150}
        color={colors.primaryDark}
        className="pointer-events-none absolute -right-5 -top-2.5 opacity-[0.16]"
        style={{ transform: "rotate(-12deg)" }}
      />
      <div className="relative px-4 lg:px-7">
        <div className={`flex justify-between gap-3 ${title ? "items-center" : "items-start"}`}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-card transition hover:bg-gray-50"
          >
            <Ionicon name="arrow-back" size={20} color={colors.ink} />
          </button>
          {title ? (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[22px] font-extrabold text-ink">{title}</h1>
              {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
            </div>
          ) : null}
          {right}
        </div>
        {children}
      </div>
    </header>
  );
}

// Fixed-at-bottom action area (sits above the phone tab bar).
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-30 mt-4 border-t border-border bg-surface px-4 pb-4 pt-3 lg:rounded-b-2xl lg:px-0">
      {children}
    </div>
  );
}

export function DetailRow({ icon, label, value, divider = true }: { icon: string; label: string; value: string; divider?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${divider ? "border-b border-border" : ""}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
        <Ionicon name={icon} size={17} color={colors.primaryDark} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-0.5 text-base font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}
