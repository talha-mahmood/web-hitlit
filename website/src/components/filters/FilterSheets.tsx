import { useEffect, useState, type ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { getSportIcon } from "@app/lib/sportIcons";
import { getSportImage } from "@app/lib/sportImages";
import { PAKISTAN_CITIES } from "@app/lib/pakistanCities";
import { imageUrl } from "@/lib/cn";
import Modal, { ClearApplyFooter } from "../ui/Modal";
import { Ionicon, MCIcon } from "../icons/Icon";

// Ports of SelectSportModal / SelectDistanceModal / SelectPriceModal /
// SelectLocationModal. Same interaction everywhere: the pick stays a local
// draft until "Apply Filter" (closing with X / backdrop leaves the active
// filter untouched), "Clear" applies an empty filter.

export type PriceRange = { label: string; min: number; max: number | null };

// Keeps a draft in sync with the applied value every time the sheet opens.
function useDraft<T>(open: boolean, value: T) {
  const [draft, setDraft] = useState<T>(value);
  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return [draft, setDraft] as const;
}

function CheckBadge() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand">
      <Ionicon name="checkmark" size={13} color="white" />
    </span>
  );
}

function OptionRow({ selected, icon, label, onPress }: { selected: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={selected}
      className={`mb-2.5 flex w-full items-center justify-between rounded-2xl border-[1.5px] p-3.5 text-left transition ${
        selected ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/40"
      }`}
    >
      <span className="flex items-center gap-3">
        {icon}
        <span className={`text-[15.5px] ${selected ? "font-bold text-primary-dark" : "font-semibold text-ink"}`}>{label}</span>
      </span>
      {selected && <CheckBadge />}
    </button>
  );
}

function RoundIcon({ name, selected }: { name: string; selected: boolean }) {
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${selected ? "bg-brand" : "bg-gray-100"}`}>
      <Ionicon name={name} size={18} color={selected ? "white" : colors.muted} />
    </span>
  );
}

export function SelectSportSheet({
  open,
  onClose,
  sports,
  selectedSportId,
  onApply,
  subtitle = "Choose a sport to filter games",
}: {
  open: boolean;
  onClose: () => void;
  sports: { id: string; name: string }[];
  selectedSportId: string | undefined;
  onApply: (sportId: string | undefined) => void;
  subtitle?: string;
}) {
  const [draft, setDraft] = useDraft(open, selectedSportId);
  return (
    <Modal open={open} onClose={onClose} title="Select Sport" subtitle={subtitle} footer={<ClearApplyFooter onClear={() => onApply(undefined)} onApply={() => onApply(draft)} />}>
      <div className="grid grid-cols-2 gap-3">
        {sports.map((sport) => {
          const selected = draft === sport.id;
          const { icon, bg, fg } = getSportIcon(sport.name);
          const photo = imageUrl(getSportImage(sport.name));
          return (
            <button
              key={sport.id}
              type="button"
              onClick={() => setDraft(selected ? undefined : sport.id)}
              aria-pressed={selected}
              className={`flex items-center gap-2.5 rounded-2xl border-[1.5px] p-3 text-left transition ${
                selected ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: photo ? colors.border : bg }}>
                {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <MCIcon name={icon} size={20} color={fg} />}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${selected ? "font-bold text-primary-dark" : "font-semibold text-ink"}`}>{sport.name}</span>
              {selected && <CheckBadge />}
            </button>
          );
        })}
      </div>
      {sports.length === 0 && <p className="py-6 text-center text-sm text-muted">No sports found.</p>}
    </Modal>
  );
}

export function SelectDistanceSheet({
  open,
  onClose,
  options,
  selectedKm,
  onApply,
  locationDenied,
}: {
  open: boolean;
  onClose: () => void;
  options: readonly number[];
  selectedKm: number | null;
  onApply: (km: number | null) => void;
  locationDenied?: boolean;
}) {
  const [draft, setDraft] = useDraft(open, selectedKm);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Distance"
      subtitle="Only show results within this range"
      footer={<ClearApplyFooter onClear={() => onApply(null)} onApply={() => onApply(draft)} />}
    >
      {locationDenied && <p className="mb-2.5 text-[12.5px] text-muted">Enable location to filter by distance.</p>}
      {options.map((km) => {
        const selected = draft === km;
        return (
          <OptionRow
            key={km}
            selected={selected}
            icon={<RoundIcon name="location" selected={selected} />}
            label={`Within ${km} km`}
            onPress={() => setDraft(selected ? null : km)}
          />
        );
      })}
    </Modal>
  );
}

export function SelectPriceSheet({
  open,
  onClose,
  options,
  selected,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  options: readonly PriceRange[];
  selected: PriceRange | null;
  onApply: (range: PriceRange | null) => void;
}) {
  const [draft, setDraft] = useDraft(open, selected);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Price"
      subtitle="Only show venues in this price range"
      footer={<ClearApplyFooter onClear={() => onApply(null)} onApply={() => onApply(draft)} />}
    >
      {options.map((range) => {
        const isSelected = draft?.label === range.label;
        return (
          <OptionRow
            key={range.label}
            selected={isSelected}
            icon={<RoundIcon name={isSelected ? "pricetag" : "pricetag-outline"} selected={isSelected} />}
            label={range.label}
            onPress={() => setDraft(isSelected ? null : range)}
          />
        );
      })}
    </Modal>
  );
}

export function SelectLocationSheet({
  open,
  onClose,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  value: string[];
  onApply: (locations: string[]) => void;
}) {
  const [draft, setDraft] = useDraft(open, value);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const has = (v: string) => draft.some((d) => d.toLowerCase() === v.toLowerCase());
  const addTyped = () => {
    const trimmed = typed.trim();
    if (!trimmed) return;
    setDraft((prev) => (prev.some((v) => v.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]));
    setTyped("");
  };
  const toggleCity = (city: string) =>
    setDraft((prev) => (has(city) ? prev.filter((v) => v.toLowerCase() !== city.toLowerCase()) : [...prev, city]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filter by Location"
      subtitle="Pick any number of cities or type your own"
      footer={<ClearApplyFooter onClear={() => onApply([])} onApply={() => onApply(draft)} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTyped();
        }}
        className={`mb-4 flex items-center rounded-2xl border-[1.5px] px-4 transition-colors ${typed ? "border-primary bg-primary-light" : "border-border bg-surface"}`}
      >
        <Ionicon name="location-outline" size={18} color={colors.muted} />
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type a location and add it"
          autoCapitalize="none"
          autoCorrect="off"
          className="ml-2 min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-muted"
        />
        {typed.length > 0 && (
          <button type="submit" className="rounded-lg bg-brand px-2 py-1 text-xs font-bold text-white">
            Add
          </button>
        )}
      </form>

      {draft.length > 0 && (
        <>
          <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted">SELECTED ({draft.length})</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {draft.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setDraft((prev) => prev.filter((v) => v !== tag))}
                aria-label={`Remove ${tag}`}
                className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-[9px] text-[13.5px] font-bold text-white"
              >
                {tag}
                <Ionicon name="close" size={14} color="white" />
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted">SUGGESTED CITIES</p>
      <div className="flex flex-wrap gap-2">
        {PAKISTAN_CITIES.map((city) => {
          const selected = has(city);
          return (
            <button
              key={city}
              type="button"
              onClick={() => toggleCity(city)}
              aria-pressed={selected}
              className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-[9px] text-[13.5px] transition ${
                selected ? "border-primary bg-brand font-bold text-white" : "border-border bg-surface font-medium text-ink hover:border-primary/40"
              }`}
            >
              {selected && <Ionicon name="checkmark" size={13} color="white" />}
              {city}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// Port of SelectChallengeCityModal: one city (or All Cities), with search.
export function SelectCitySheet({ open, onClose, value, onSelect }: { open: boolean; onClose: () => void; value: string | null; onSelect: (city: string | null) => void }) {
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);
  const q = search.trim().toLocaleLowerCase();
  const cities = PAKISTAN_CITIES.filter((c) => !q || c.toLocaleLowerCase().includes(q));
  const row = (label: string, selected: boolean, onPress: () => void, muted?: boolean) => (
    <button
      key={label}
      type="button"
      onClick={onPress}
      aria-pressed={selected}
      className={`flex min-h-[54px] w-full items-center justify-between border-b border-border px-4 text-left text-[17px] ${selected ? "bg-primary-light text-primary" : muted ? "text-muted hover:bg-gray-50" : "text-ink hover:bg-gray-50"}`}
    >
      {label}
      {selected && <Ionicon name="checkmark" size={23} color={colors.primary} />}
    </button>
  );
  return (
    <Modal open={open} onClose={onClose} title="Select City">
      <label className="mb-3 flex min-h-[54px] items-center gap-2 rounded-2xl border-[1.5px] border-primary bg-surface-raised px-3.5">
        <Ionicon name="search-outline" size={21} color={colors.muted} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cities..." aria-label="Search cities" className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted" autoFocus />
        {search && (
          <button type="button" aria-label="Clear" onClick={() => setSearch("")}>
            <Ionicon name="close-circle" size={19} color={colors.muted} />
          </button>
        )}
      </label>
      <div className="-mx-5 border-t border-border">
        {row("All Cities", value === null, () => onSelect(null), true)}
        {cities.map((c) => row(c, value?.toLocaleLowerCase() === c.toLocaleLowerCase(), () => onSelect(c)))}
        {cities.length === 0 && <p className="py-10 text-center text-muted">No matching cities</p>}
      </div>
    </Modal>
  );
}
