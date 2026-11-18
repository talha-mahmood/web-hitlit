import type { ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";

// The section card used by Create Squad / Host Event: icon on the left, a
// title row (required star / "(Optional)" / right-hand hint), optional
// subtitle, then the control(s).
export function FormCard({ icon, title, required, optional, hint, subtitle, children }: { icon: string; title: string; required?: boolean; optional?: boolean; hint?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="flex gap-[11px] rounded-2xl border border-ink/5 bg-surface p-[13px] shadow-card">
      <span className="mt-px shrink-0">
        <Ionicon name={icon} size={19} color={colors.primary} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm text-ink">
            <span className="font-bold">{title}</span>
            {required && <span className="text-danger"> *</span>}
            {optional && <span className="font-normal text-muted"> (Optional)</span>}
          </h2>
          {hint && <span className="text-right text-[11.5px] text-muted">{hint}</span>}
        </div>
        {subtitle && <p className="mt-[3px] text-xs text-muted">{subtitle}</p>}
        <div className="mt-2.5">{children}</div>
      </div>
    </section>
  );
}

// Pale-green selected chip (flat fill + dark-green text).
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPress}
      className={`shrink-0 rounded-full border-[1.5px] px-[11px] py-[6.5px] text-xs transition ${selected ? "border-primary bg-primary-light font-bold text-primary-dark" : "border-border bg-surface font-medium text-ink hover:border-primary/40"}`}
    >
      {label}
    </button>
  );
}

export function ChipRow<T extends string>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </div>
  );
}

// Horizontally scrolling chip strip (wraps on wide screens).
export function ChipStrip({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">{children}</div>;
}
