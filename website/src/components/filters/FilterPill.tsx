import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";

// The list screens' filter-row pill: white with a gray border when idle, the
// brand gradient with white text once its filter is active.
export default function FilterPill({ icon, label, active, onPress, trailingIcon }: { icon?: string; label: string; active: boolean; onPress: () => void; trailingIcon?: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-[5px] rounded-full border px-[9px] py-[5px] text-[11.5px] font-medium transition sm:px-3 sm:py-1.5 sm:text-[13px] ${
        active ? "border-primary bg-brand text-white" : "border-border bg-surface text-muted hover:border-primary/40 hover:text-ink"
      }`}
    >
      {icon && <Ionicon name={icon} size={14} color={active ? "white" : colors.muted} />}
      <span className="max-w-[160px] truncate">{label}</span>
      {trailingIcon && <Ionicon name={trailingIcon} size={14} color={active ? "white" : colors.muted} />}
    </button>
  );
}
