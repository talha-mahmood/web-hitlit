import { useState } from "react";
import { colors } from "@app/constants/theme";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { detectCurrentLocationLabel } from "@app/lib/locationPicker";
import { Alert } from "@/lib/alert";
import { Ionicon } from "../icons/Icon";
import FieldInput from "../ui/FieldInput";
import Spinner from "../ui/Spinner";

// Ports of GameFormControls (SectionLabel, PillRow) and LocationPickerField.

export function SectionLabel({ title, required, variant, icon, compact }: { title: string; required?: boolean; variant?: "onGreen"; icon?: string; compact?: boolean }) {
  const onGreen = variant === "onGreen";
  return (
    <div className={`mb-2 flex items-center ${compact ? "mt-3" : "mt-5"}`}>
      {icon && <Ionicon name={icon} size={15} color={onGreen ? "white" : colors.primary} style={{ marginRight: 6 }} />}
      <span className={`text-sm font-semibold ${onGreen ? "text-white" : "text-ink"}`}>{title}</span>
      {required && <span className={`ml-1 ${onGreen ? "text-red-200" : "text-red-500"}`}>*</span>}
    </div>
  );
}

export function PillRow<T extends string>({ options, value, onChange, variant }: { options: { label: string; value: T }[]; value: T | null; onChange: (v: T) => void; variant?: "onGreen" }) {
  const onGreen = variant === "onGreen";
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const selected = value === o.value;
        const cls = onGreen
          ? selected
            ? "border-white bg-surface text-primary shadow-md"
            : "border-white/45 bg-white/[0.14] text-white"
          : selected
            ? "border-primary bg-brand text-white shadow-cta"
            : "border-border bg-surface text-ink hover:border-primary/40";
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-2xl border-[1.5px] px-4 py-2.5 text-sm font-medium transition active:scale-95 ${cls}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function LocationPickerField({
  value,
  onChange,
  placeholder,
  variant,
  showPinIcon,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: "card";
  showPinIcon?: boolean;
}) {
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      onChange(await detectCurrentLocationLabel());
    } catch (err) {
      Alert.alert("Couldn't Detect Location", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div>
      <FieldInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "e.g. DHA Phase 6, Lahore"}
        maxLength={120}
        containerClassName="gap-2"
        left={showPinIcon ? <Ionicon name="location" size={18} color={colors.muted} /> : undefined}
        right={
          <button type="button" onClick={handleDetect} disabled={detecting} aria-label="Use my current location">
            {detecting ? <Spinner size={18} /> : <Ionicon name="locate-outline" size={20} color={colors.primary} />}
          </button>
        }
      />
      <button
        type="button"
        onClick={handleDetect}
        disabled={detecting}
        className={variant === "card" ? "mt-3 flex items-center gap-2 text-sm font-semibold text-primary" : "mt-1.5 text-xs font-medium text-primary hover:underline"}
      >
        {variant === "card" ? <Ionicon name="navigate" size={16} color={colors.primary} /> : null}
        {detecting ? "Detecting your location..." : "Use my current location"}
      </button>
    </div>
  );
}
