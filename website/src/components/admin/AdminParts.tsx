import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { formatCompactNumber } from "@app/lib/adminDashboard";
import { getSportImage } from "@app/lib/sportImages";
import { getSportIcon } from "@app/lib/sportIcons";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "../icons/Icon";
import Spinner from "../ui/Spinner";
import FieldInput from "../ui/FieldInput";
import { useGoBack } from "@/routes/navigation";

// ───── Where admin pages live ─────
// Venue admins ("owner") are under /admin, superadmins under /superadmin;
// the venue-editing pages are shared by both, exactly like the app's
// VenueEditingParamList screens registered in both navigators.
export type AdminRole = "owner" | "superadmin";
const AdminRoleContext = createContext<AdminRole>("owner");
export const AdminRoleProvider = AdminRoleContext.Provider;
export function useAdminRole() {
  return useContext(AdminRoleContext);
}

export function adminPaths(role: AdminRole) {
  const base = role === "superadmin" ? "/superadmin" : "/admin";
  const venue = (id: string) => `${base}/venues/${id}`;
  return {
    home: base,
    notifications: `${base}/notifications`,
    venue,
    editVenue: (id: string) => `${venue(id)}/edit`,
    venuePhotos: (id: string) => `${venue(id)}/photos`,
    courts: (id: string) => `${venue(id)}/courts`,
    newCourt: (id: string) => `${venue(id)}/courts/new`,
    court: (id: string, courtId: string) => `${venue(id)}/courts/${courtId}`,
    courtPhotos: (id: string, courtId: string) => `${venue(id)}/courts/${courtId}/photos`,
    courtSlots: (id: string, courtId: string) => `${venue(id)}/courts/${courtId}/slots`,
    bookings: (id: string) => `${venue(id)}/bookings`,
    reviews: (id: string) => `${venue(id)}/reviews`,
    analytics: (id: string) => `${venue(id)}/analytics`,
    boost: (id: string) => `${venue(id)}/boost`,
    admins: (id: string) => `${venue(id)}/admins`,
    // superadmin-only sections
    createVenue: `${base}/venues/new`,
    games: `${base}/games`,
    groups: `${base}/groups`,
    events: `${base}/events`,
    reports: `${base}/reports`,
    users: `${base}/users`,
  };
}

export function useAdminPaths() {
  return adminPaths(useAdminRole());
}

// ───── Page chrome ─────
// The admin screens' plain header: back arrow, bold title, optional actions.
export function AdminPageHeader({ title, backTo, right, back = true }: { title: ReactNode; backTo: string; right?: ReactNode; back?: boolean }) {
  const goBack = useGoBack(backTo);
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-app/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] backdrop-blur lg:px-8 lg:pt-6">
      {back && (
        <button type="button" onClick={goBack} aria-label="Back" className="mr-1 rounded-full p-1 hover:bg-black/5">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-base font-bold text-ink lg:text-lg">{title}</h1>
      {right}
    </div>
  );
}

export function GradientAction({ onPress, disabled, pending, icon, label, small }: { onPress: () => void; disabled?: boolean; pending?: boolean; icon?: string; label: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled || pending}
      className={`press flex shrink-0 items-center gap-1 bg-brand font-semibold text-white shadow-cta disabled:opacity-70 ${small ? "rounded-lg px-3 py-1.5 text-xs" : "rounded-xl px-4 py-2 text-sm"}`}
    >
      {pending ? (
        <Spinner size={16} color="white" />
      ) : (
        <>
          {icon && <Ionicon name={icon} size={small ? 14 : 16} color="white" />}
          {label}
        </>
      )}
    </button>
  );
}

export function PageBody({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <div className={`mx-auto w-full px-4 pb-16 pt-5 lg:px-8 ${narrow ? "max-w-2xl" : "max-w-5xl"}`}>{children}</div>;
}

export function EmptyBox({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-8 text-center">
      <Ionicon name={icon} size={32} color={colors.border} />
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <p className="mb-1.5 text-xs font-semibold text-muted">{children}</p>
      {hint && <p className="mb-2 text-[11px] text-muted">{hint}</p>}
    </>
  );
}

export function TextArea({ value, onChange, placeholder, maxLength, rows = 3, label }: { value: string; onChange: (v: string) => void; placeholder: string; maxLength: number; rows?: number; label?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows}
      aria-label={label}
      className="mb-4 w-full resize-y rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-primary focus:bg-primary-light"
    />
  );
}

// The app's Switch row ("Open for bookings", "Active").
export function SwitchRow({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="flex-1">
        <span className="block font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={title}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-primary" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

// ───── Cards ─────
export function DeltaLabel({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className="mt-1 flex items-center gap-0.5 text-[11px]" style={{ color: up ? colors.primary : colors.danger }}>
      <Ionicon name={up ? "arrow-up" : "arrow-down"} size={11} color={up ? colors.primary : colors.danger} />
      {Math.abs(value)}
      {suffix} vs yesterday
    </span>
  );
}

export function StatCard({ icon, iconBg, iconColor, label, value, delta, iconSize = 40 }: { icon: string; iconBg: string; iconColor: string; label: string; value: string; delta?: number | null; iconSize?: number }) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-surface p-4">
      <span className="mb-3 flex items-center justify-center rounded-full" style={{ width: iconSize, height: iconSize, backgroundColor: iconBg }}>
        <Ionicon name={icon} size={iconSize / 2} color={iconColor} />
      </span>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate text-xl font-extrabold text-ink">{value}</p>
      {delta !== undefined && <DeltaLabel value={delta} suffix="%" />}
    </div>
  );
}

export function SectionCard({ title, action, onAction, children, subtitle }: { title: string; action?: string; onAction?: () => void; children: ReactNode; subtitle?: string }) {
  return (
    <section className="mb-4 rounded-2xl border border-ink/5 bg-surface p-4">
      <div className={`flex items-center justify-between ${subtitle ? "mb-1" : "mb-3"}`}>
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {action && (
          <button type="button" onClick={onAction} className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
            {action}
            <Ionicon name="arrow-forward" size={12} color={colors.primary} />
          </button>
        )}
      </div>
      {subtitle && <p className="mb-3 text-xs text-muted">{subtitle}</p>}
      {children}
    </section>
  );
}

export function StatusBadge({ badge }: { badge: { bg: string; text: string; label: string } | undefined }) {
  if (!badge) return null;
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>;
}

export function SportIconBadge({ sportName, size = 34 }: { sportName: string | undefined; size?: number }) {
  const photo = imageUrl(getSportImage(sportName ?? ""));
  const { icon, bg, fg } = getSportIcon(sportName ?? "");
  if (photo) return <img src={photo} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: bg }}>
      <MCIcon name={icon} size={size * 0.55} color={fg} />
    </span>
  );
}

// Days / Weeks / Months / Year segmented control for the revenue charts.
export function ScaleToggle<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-app p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize ${value === o ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// Port of RevenueBarChart.
export function RevenueBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-[150px] items-end justify-between gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
          <span className="mb-1 truncate text-[9px] font-semibold text-ink">{v > 0 ? formatCompactNumber(v) : ""}</span>
          <span className="w-full rounded-t-md transition-all" style={{ height: Math.max(4, Math.round((v / max) * 90)), backgroundColor: v > 0 ? colors.primary : colors.border }} title={`${labels[i]}: Rs ${v.toLocaleString()}`} />
          <span className="mt-1.5 text-[10px] text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Port of RevenueLineChart (scales to the card's width instead of the screen's).
export function RevenueLineChart({ labels, values }: { labels: string[]; values: number[] }) {
  const W = 600;
  const H = 120;
  const PAD = 14;
  const TOP = 18;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const pts = values.map((v, i) => ({ x: values.length > 1 ? i * step : W / 2, y: TOP + PAD + (H - PAD * 2) - (v / max) * (H - PAD * 2), v }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <div>
      <svg viewBox={`-8 0 ${W + 16} ${H + TOP}`} className="h-auto w-full" preserveAspectRatio="none" aria-label="Revenue trend">
        <polygon points={`0,${H + TOP} ${line} ${W},${H + TOP}`} fill={colors.primary} fillOpacity={0.12} />
        <polyline points={line} fill="none" stroke={colors.primary} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={colors.primary}>
              <title>{`${labels[i]}: Rs ${p.v.toLocaleString()}`}</title>
            </circle>
            {p.v > 0 && (
              <text x={p.x} y={Math.max(9, p.y - 8)} textAnchor="middle" fontSize={10} fontWeight={600} fill={colors.ink}>
                {formatCompactNumber(p.v)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between">
        {labels.map((l, i) => (
          <span key={i} className="w-8 text-center text-[10px] text-muted">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// Port of SearchField: search input whose placeholder cycles "Search by …"
// through its variants once a second.
export function CyclingSearchField({ value, onChange, prefix, variants }: { value: string; onChange: (v: string) => void; prefix: string; variants: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (variants.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % variants.length), 1000);
    return () => clearInterval(id);
  }, [variants]);
  return (
    <div className="relative">
      <FieldInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="search"
        aria-label={`${prefix}${variants.join(", ")}`}
        containerClassName="h-[52px] !rounded-[28px] !bg-surface"
        left={<span className="mr-2"><Ionicon name="search-outline" size={20} color={colors.muted} /></span>}
      />
      {!value && (
        <span className="pointer-events-none absolute left-[46px] top-1/2 -translate-y-1/2 text-muted">
          {prefix}
          <span key={index} className="inline-block animate-fadeUp">
            {variants[index]}
          </span>
        </span>
      )}
    </div>
  );
}

// Venue / court photo grid with reorder, download and delete (ManageVenueImages
// and ManageCourtImages share this exact layout).
export function PhotoGrid({
  images,
  onMove,
  onDownload,
  onDelete,
  downloadingId,
}: {
  images: { id: string; image_url: string }[];
  onMove: (index: number, direction: -1 | 1) => void;
  onDownload: (id: string, url: string) => void;
  onDelete: (id: string) => void;
  downloadingId: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img, index) => (
        <div key={img.id}>
          <div className="relative">
            <img src={img.image_url} alt={`Photo ${index + 1}`} className="h-[120px] w-full rounded-xl bg-app object-cover sm:h-36" />
            {index === 0 && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">COVER</span>}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex gap-1.5">
              <button type="button" aria-label="Move earlier" onClick={() => onMove(index, -1)} disabled={index === 0}>
                <Ionicon name="chevron-back-circle-outline" size={20} color={index === 0 ? colors.border : colors.muted} />
              </button>
              <button type="button" aria-label="Move later" onClick={() => onMove(index, 1)} disabled={index === images.length - 1}>
                <Ionicon name="chevron-forward-circle-outline" size={20} color={index === images.length - 1 ? colors.border : colors.muted} />
              </button>
            </span>
            <span className="flex items-center gap-2.5">
              <button type="button" aria-label="Download photo" onClick={() => onDownload(img.id, img.image_url)} disabled={downloadingId === img.id}>
                {downloadingId === img.id ? <Spinner size={16} color={colors.muted} /> : <Ionicon name="download-outline" size={18} color={colors.muted} />}
              </button>
              <button type="button" aria-label="Delete photo" onClick={() => onDelete(img.id)}>
                <Ionicon name="trash-outline" size={18} color={colors.danger} />
              </button>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
