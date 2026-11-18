import { useEffect, useRef, useState, type ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { getSportIcon } from "@app/lib/sportIcons";
import { getSportImage } from "@app/lib/sportImages";
import { searchUsers, type UserSearchResult } from "@app/lib/api/users";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "../icons/Icon";
import { Avatar } from "../ui/Avatar";
import Spinner from "../ui/Spinner";

// Building blocks shared by the cricket and generic-sport player tabs
// (the app repeats several of these per file; they're identical).

export function Loading() {
  return (
    <div className="mt-10 flex justify-center">
      <Spinner />
    </div>
  );
}

export function EmptyTab({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-10">
      <Ionicon name={icon} size={32} color={colors.muted} />
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}

export function SectionCard({ title, children, center }: { title: string; children: ReactNode; center?: boolean }) {
  return (
    <section className="mt-5 rounded-2xl bg-surface p-4 shadow-card">
      <h3 className={`mb-3 text-base font-bold text-ink ${center ? "text-center" : ""}`}>{title}</h3>
      {children}
    </section>
  );
}

export function TogglePill<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full bg-border" role="tablist">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={`px-4 py-1.5 text-xs font-bold ${value === o ? "bg-brand text-white" : "text-ink-secondary hover:text-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// A small table: label column + fixed-width value columns.
export function MiniTable({ cols, rows, colWidth = 64 }: { cols: string[]; rows: { label: string; values: (string | number)[] }[]; colWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex border-b border-border py-2">
        <span className="flex-1" />
        {cols.map((c) => (
          <span key={c} className="text-center text-xs font-bold text-muted" style={{ width: colWidth }}>
            {c}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center border-b border-border py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{row.label}</span>
          {row.values.map((v, i) => (
            <span key={i} className="text-center text-sm text-ink" style={{ width: colWidth }}>
              {v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// "NEW ‹ › OLD" pager for the Recent Form strip.
export function FormPager({ hasNewer, hasOlder, onNewer, onOlder }: { hasNewer: boolean; hasOlder: boolean; onNewer: () => void; onOlder: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2.5">
      <button type="button" onClick={onNewer} disabled={!hasNewer} aria-label="Newer matches">
        <Ionicon name="chevron-back" size={16} color={hasNewer ? colors.ink : colors.border} />
      </button>
      <span className="text-xs font-bold text-muted">NEW</span>
      <button type="button" onClick={onOlder} disabled={!hasOlder} aria-label="Older matches">
        <Ionicon name="chevron-forward" size={16} color={hasOlder ? colors.ink : colors.border} />
      </button>
      <span className="text-xs font-bold text-muted">OLD</span>
    </div>
  );
}

// Port of PlayerCricketEntityCard — compact team/club/tournament/match card
// with the sport picture tucked into a green disc on the right.
export function EntityCard({
  photoUrl,
  title,
  subtitle,
  subtitleIcon = "location-outline",
  pillLabel,
  sportName = "cricket",
  onPress,
}: {
  photoUrl?: string | null;
  title: string;
  subtitle?: string | null;
  subtitleIcon?: string;
  pillLabel?: string | null;
  sportName?: string;
  onPress?: () => void;
}) {
  const sportPhoto = imageUrl(getSportImage(sportName));
  const glyph = getSportIcon(sportName);
  const Tag = onPress ? "button" : "div";
  return (
    <Tag
      {...(onPress ? { type: "button" as const, onClick: onPress } : {})}
      className={`relative mb-2.5 block min-h-[108px] w-full overflow-hidden rounded-[20px] border border-border bg-surface py-3 text-left shadow-card ${onPress ? "press hover:shadow-hero" : ""}`}
    >
      <span className="pointer-events-none absolute -right-[18px] top-2.5 flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full bg-primary-light">
        {sportPhoto ? (
          <img src={sportPhoto} alt="" className="mr-4 h-11 w-[78px] object-contain mix-blend-multiply" />
        ) : (
          <MCIcon name={glyph.icon} size={30} color={glyph.fg} style={{ marginRight: 16, opacity: 0.8 }} />
        )}
      </span>
      <span className="block px-4 pr-[72px]">
        <span className="mb-1 flex items-center gap-[7px]">
          {photoUrl ? <img src={photoUrl} alt="" className="h-[22px] w-[22px] rounded-md object-cover" /> : null}
          <span className="flex-1 truncate text-[15.5px] font-extrabold text-ink">{title}</span>
        </span>
        {subtitle ? (
          <span className="mb-2 flex items-center gap-[5px] text-[12.5px] text-muted">
            <Ionicon name={subtitleIcon} size={12.5} color={colors.muted} />
            <span className="truncate">{subtitle}</span>
          </span>
        ) : null}
        <span className="inline-block truncate rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary">{pillLabel ?? sportName}</span>
      </span>
    </Tag>
  );
}

// Head-to-head bar: left bar grows leftwards, right bar rightwards.
export function CompareBar({ label, leftValue, rightValue, leftDisplay, rightDisplay }: { label: string; leftValue: number; rightValue: number; leftDisplay: string; rightDisplay: string }) {
  const max = Math.max(leftValue, rightValue, 1);
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex flex-1 items-center gap-1.5">
        <div className="flex h-2.5 flex-1 flex-row-reverse overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${(leftValue / max) * 100}%` }} />
        </div>
        <span className="min-w-9 rounded-lg border border-border px-2 py-1 text-center text-xs font-bold text-ink">{leftDisplay}</span>
      </div>
      <span className="w-[70px] truncate text-center text-xs font-semibold text-ink">{label}</span>
      <div className="flex flex-1 items-center gap-1.5">
        <span className="min-w-9 rounded-lg border border-border px-2 py-1 text-center text-xs font-bold text-ink">{rightDisplay}</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${(rightValue / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// "Search a player to compare" — live search from 2 characters.
export function ComparePlayerSearch({ onSelect }: { onSelect: (u: UserSearchResult) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef("");

  useEffect(() => {
    const t = term.trim();
    latest.current = t;
    if (t.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchUsers(t)
      .then((rows) => latest.current === t && setResults(rows))
      .finally(() => latest.current === t && setLoading(false));
  }, [term]);

  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5">
        <Ionicon name="search" size={16} color={colors.muted} />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search a player to compare"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        {loading ? <Spinner size={16} /> : null}
      </label>
      {results.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-2xl bg-surface shadow-card">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelect(u);
                setTerm("");
                setResults([]);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50"
            >
              <Avatar url={u.avatar} name={u.full_name} size={32} />
              <span className="flex-1 truncate text-sm font-semibold text-ink">{u.full_name ?? "Player"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// Solid pie for the insights tabs (cricket conceded runs, generic W/L/D).
export function ArcPie({ slices, radius = 90 }: { slices: { key: string; value: number; color: string }[]; radius?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  let cumulative = 0;
  return (
    <svg width={radius * 2} height={radius * 2} aria-hidden>
      {slices
        .filter((s) => s.value > 0)
        .map((s) => {
          const start = (cumulative / total) * 360;
          cumulative += s.value;
          const end = (cumulative / total) * 360;
          if (end - start >= 359.99) return <circle key={s.key} cx={radius} cy={radius} r={radius} fill={s.color} />;
          const a = polarToCartesian(radius, radius, radius, end);
          const b = polarToCartesian(radius, radius, radius, start);
          const d = `M ${radius} ${radius} L ${a.x} ${a.y} A ${radius} ${radius} 0 ${end - start <= 180 ? 0 : 1} 0 ${b.x} ${b.y} Z`;
          return <path key={s.key} d={d} fill={s.color} />;
        })}
    </svg>
  );
}

// Port of TeamCrest — shield with a star and the sport glyph.
export function TeamCrest({ color, size = 60, icon = "soccer" }: { color: string; size?: number; icon?: string }) {
  return (
    <span className="relative flex shrink-0 items-center justify-center rounded-full bg-surface shadow-card" style={{ width: size, height: size }}>
      <svg width={size * 0.66} height={size * 0.74} viewBox="0 0 40 46" aria-hidden>
        <path d="M20 0 L40 6 V22 C40 34 32 42 20 46 C8 42 0 34 0 22 V6 Z" fill={color} />
      </svg>
      <Ionicon name="star" size={size * 0.17} color="#FACC15" style={{ position: "absolute", top: size * 0.2 }} />
      <MCIcon name={icon} size={size * 0.32} color="white" style={{ position: "absolute", bottom: size * 0.16 }} />
    </span>
  );
}
