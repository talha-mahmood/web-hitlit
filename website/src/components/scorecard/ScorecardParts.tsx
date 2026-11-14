import { useState, type CSSProperties } from "react";
import { colors } from "@app/constants/theme";
import { Ionicon, MCIcon } from "../icons/Icon";
import Spinner from "../ui/Spinner";

export const TEAM_A_COLOR = colors.primary;
export const TEAM_B_COLOR = "rgb(var(--jz-blue-700))";
export const TEAM_B_LIGHT = "rgb(var(--jz-blue-100))";

// Port of TeamCrest: a drawn shield (sport glyph + star) standing in for a
// team badge, colored per side.
export function TeamCrest({ color, size = 60, icon = "soccer" }: { color: string; size?: number; icon?: string }) {
  return (
    <span className="relative flex shrink-0 items-center justify-center rounded-full bg-surface shadow-card" style={{ width: size, height: size }}>
      <svg width={size * 0.66} height={size * 0.74} viewBox="0 0 40 46" aria-hidden>
        <path d="M20 0 L40 6 V22 C40 34 32 42 20 46 C8 42 0 34 0 22 V6 Z" fill={color} />
      </svg>
      <span className="absolute" style={{ top: size * 0.2 }}>
        <Ionicon name="star" size={size * 0.17} color="#FACC15" />
      </span>
      <span className="absolute" style={{ bottom: size * 0.16 }}>
        <MCIcon name={icon} size={size * 0.32} color="white" />
      </span>
    </span>
  );
}

// Port of GradientActionButton: the live-scoring screens' primary action pill.
export function GradientActionButton({
  onPress,
  disabled,
  from,
  to,
  icon,
  label,
  sublabel,
  watermarkIcon,
  showChevron = true,
  shadow = true,
}: {
  onPress: () => void;
  disabled?: boolean;
  from: string;
  to: string;
  icon: string;
  label: string;
  sublabel?: string;
  watermarkIcon?: string;
  showChevron?: boolean;
  shadow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`press relative flex w-full items-center overflow-hidden rounded-2xl px-3.5 py-3.5 text-left transition hover:brightness-105 disabled:cursor-not-allowed ${shadow ? "shadow-cta" : ""}`}
      style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/25">
        <Ionicon name={icon} size={17} color="white" />
      </span>
      <span className="mx-3.5 h-[26px] w-px bg-white/35" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold text-white">{label}</span>
        {sublabel && <span className="mt-0.5 block truncate text-xs text-white/85">{sublabel}</span>}
      </span>
      {watermarkIcon && (
        <span className="pointer-events-none absolute opacity-20" style={{ right: showChevron ? 38 : 16 }}>
          <Ionicon name={watermarkIcon} size={40} color="white" />
        </span>
      )}
      {showChevron && <Ionicon name="chevron-forward" size={20} color="white" />}
    </button>
  );
}

// Port of OutlineActionButton (Undo and similar lower-emphasis actions).
export function OutlineActionButton({
  onPress,
  disabled,
  icon,
  label,
  tint = colors.primary,
  tintLight = colors.primaryLight,
  className = "",
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
  tint?: string;
  tintLight?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`flex w-full items-center rounded-2xl border-[1.5px] bg-surface px-4 py-3.5 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed ${className}`}
      style={{ borderColor: tint, ...style }}
    >
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tintLight }}>
        <Ionicon name={icon} size={15} color={tint} />
      </span>
      <span className="mx-3 h-[22px] w-px bg-border" />
      <span className="flex-1 text-base font-bold" style={{ color: tint }}>
        {label}
      </span>
      <Ionicon name="chevron-forward" size={18} color={tint} />
    </button>
  );
}

// Port of ScoringCodeBadge: tap to copy the match's scoring code.
export function ScoringCodeBadge({ code, variant = "light" }: { code: string | null | undefined; variant?: "dark" | "light" }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const dark = variant === "dark";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the code is on screen
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy scoring ID"
      aria-label={`Copy scoring ID ${code}`}
      className={`flex shrink-0 items-center gap-[5px] rounded-full border px-2.5 py-1.5 text-xs font-bold tracking-[1px] ${dark ? "border-white/30 bg-white/[0.16] text-white" : "border-border bg-gray-100 text-ink hover:bg-gray-200"}`}
    >
      {code}
      <Ionicon name={copied ? "checkmark" : "copy-outline"} size={13} color={dark ? "white" : colors.muted} />
    </button>
  );
}

// Port of ViewScoringPanel: look a match up by its 6-character scoring ID.
export function ViewScoringPanel({ onLookup }: { onLookup: (code: string) => Promise<string | null> }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const matchId = await onLookup(trimmed);
      if (!matchId) setError("No match found with this scoring ID. Double-check the code and try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mx-auto mt-6 flex max-w-md flex-col gap-4 px-5" onSubmit={(e) => (e.preventDefault(), submit())}>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <Ionicon name="eye-outline" size={28} color={colors.primaryDark} />
        </span>
        <p className="text-base font-bold text-ink">View a Match's Scoring</p>
        <p className="px-4 text-sm text-muted">Enter the scoring ID shared by the host to watch this match's scorecard — you don't need to be a player.</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface px-4 py-2 shadow-card focus-within:border-primary">
        <input
          value={code}
          onChange={(e) => (setCode(e.target.value.toUpperCase()), setError(null))}
          placeholder="e.g. 7K2M9P"
          aria-label="Scoring ID"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={6}
          className="w-full bg-transparent py-2.5 text-center text-[22px] font-semibold tracking-[4px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      {error && <p className="px-2 text-center text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className={`press flex items-center justify-center rounded-xl bg-brand py-4 text-base font-bold text-white shadow-cta ${loading || !code.trim() ? "opacity-60" : ""}`}
      >
        {loading ? <Spinner size={20} color="white" /> : "View Scorecard"}
      </button>
    </form>
  );
}

// "LIVE" pill (red, white dot) / "COMPLETED" pill used on match cards and headers.
export function LiveBadge({ live, completedLabel = "COMPLETED" }: { live: boolean; completedLabel?: string }) {
  return (
    <span className={`inline-flex items-center gap-[5px] rounded-full px-2.5 py-1 text-xs font-bold ${live ? "bg-red-500 text-white" : "bg-green-50 text-green-700"}`}>
      {live && <span className="h-1.5 w-1.5 rounded-full bg-surface" />}
      {live ? "LIVE" : completedLabel}
    </span>
  );
}

// The point/rally sports' offline banner: amber while offline, green while
// queued points sync.
export function OfflineScoringBanner({ isOnline, pendingCount, unit, idleText = "Offline — scoring is saved on this device and will sync when back online" }: { isOnline: boolean; pendingCount: number; unit: "point" | "rally" | "event" | "ball"; idleText?: string }) {
  if (isOnline && pendingCount === 0) return null;
  const plural = (n: number) => `${n} ${unit === "rally" ? (n === 1 ? "rally" : "rallys") : `${unit}${n === 1 ? "" : "s"}`}`;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ backgroundColor: isOnline ? colors.primaryLight : "rgb(var(--jz-amber-100))" }}>
      <Ionicon name={isOnline ? "cloud-upload-outline" : "cloud-offline-outline"} size={16} color={isOnline ? colors.primaryDark : "rgb(var(--jz-amber-800))"} />
      <p className="flex-1 text-xs font-semibold" style={{ color: isOnline ? colors.primaryDark : "rgb(var(--jz-amber-800))" }}>
        {isOnline
          ? `Syncing ${plural(pendingCount)}…`
          : pendingCount > 0
            ? `Offline — ${plural(pendingCount)} saved, will sync when back online`
            : idleText}
      </p>
    </div>
  );
}

// Team-colored corner triangles on match cards.
export function CornerAccents({ size = 34 }: { size?: number }) {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0" style={{ width: 0, height: 0, borderTop: `${size}px solid ${TEAM_A_COLOR}`, borderRight: `${size}px solid transparent` }} />
      <span className="pointer-events-none absolute right-0 top-0" style={{ width: 0, height: 0, borderTop: `${size}px solid ${TEAM_B_COLOR}`, borderLeft: `${size}px solid transparent` }} />
    </>
  );
}
