import { useEffect, useMemo, useRef, useState } from "react";
import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";
import Spinner from "../ui/Spinner";

type VenueOption = { id: string; name: string; city: string | null };
const MAX_RESULTS = 30;

// Port of VenueSearchField: type-ahead over the app's venues (prefix match),
// optional "Use '<text>' as your venue" free-text fallback. Arrow keys and
// Enter work on desktop.
export default function VenueSearchField({
  venues,
  loading,
  selectedVenueId,
  customVenueName,
  onSelect,
  onSelectCustom,
  disabledReason,
  thumbnail,
}: {
  venues: VenueOption[] | undefined;
  loading: boolean;
  selectedVenueId: string | null;
  customVenueName?: string | null;
  onSelect: (venueId: string) => void;
  onSelectCustom?: (name: string) => void;
  disabledReason?: string;
  thumbnail?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = venues?.find((v) => v.id === selectedVenueId) ?? null;

  useEffect(() => () => void (blurTimeout.current && clearTimeout(blurTimeout.current)), []);
  useEffect(() => {
    if (!focused) setQuery(selected?.name ?? customVenueName ?? "");
  }, [selected?.id, selected?.name, customVenueName, focused]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? (venues ?? []).filter((v) => v.name.toLowerCase().startsWith(q)) : (venues ?? []);
  }, [venues, query]);
  const trimmed = query.trim();
  const canUseCustom = !!onSelectCustom && trimmed.length > 0 && !matches.some((v) => v.name.toLowerCase() === trimmed.toLowerCase());
  const shown = matches.slice(0, MAX_RESULTS);

  if (disabledReason) return <p className="text-sm text-muted">{disabledReason}</p>;
  if (loading) return <Spinner />;

  const clearSelection = () => {
    if (selectedVenueId) onSelect("");
    if (customVenueName) onSelectCustom?.("");
  };
  const pick = (v: VenueOption) => {
    onSelect(v.id);
    setQuery(v.name);
    setFocused(false);
  };

  return (
    <div className="relative">
      <label
        className={`flex items-center gap-2 rounded-2xl border-[1.5px] px-4 shadow-sm transition-colors ${focused ? "border-primary bg-primary-light" : "border-[#CBD5E1] bg-surface"}`}
      >
        {thumbnail && !focused && (selectedVenueId || customVenueName) ? (
          <img src={thumbnail} alt="" className="h-6 w-6 rounded-md object-cover" />
        ) : (
          <Ionicon name={focused ? "search-outline" : "location-outline"} size={18} color={colors.muted} />
        )}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            clearSelection();
          }}
          onFocus={() => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={(e) => {
            if (!focused) return;
            if (e.key === "ArrowDown") (e.preventDefault(), setHighlighted((h) => Math.min(h + 1, shown.length - 1)));
            else if (e.key === "ArrowUp") (e.preventDefault(), setHighlighted((h) => Math.max(h - 1, 0)));
            else if (e.key === "Enter" && shown[highlighted]) (e.preventDefault(), pick(shown[highlighted]));
            else if (e.key === "Escape") setFocused(false);
          }}
          placeholder="Search venue by name"
          autoCorrect="off"
          role="combobox"
          aria-expanded={focused}
          className="min-w-0 flex-1 bg-transparent py-3 text-ink outline-none placeholder:text-muted"
        />
        {query.length > 0 && (
          <button type="button" aria-label="Clear venue" onMouseDown={(e) => e.preventDefault()} onClick={() => (setQuery(""), clearSelection())}>
            <Ionicon name="close-circle" size={18} color={colors.border} />
          </button>
        )}
      </label>

      {focused && (
        <div role="listbox" onMouseDown={(e) => e.preventDefault()} className="absolute inset-x-0 z-30 mt-1.5 max-h-[260px] overflow-y-auto rounded-2xl border-[1.5px] border-border bg-surface shadow-card">
          {shown.length === 0 && !canUseCustom && (
            <p className="px-4 py-3 text-sm text-muted">{venues && venues.length > 0 ? `No venues match "${query}".` : "No venues found for this sport yet."}</p>
          )}
          {shown.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="option"
              aria-selected={v.id === selectedVenueId}
              onClick={() => pick(v)}
              className={`block w-full border-b border-border px-4 py-3 text-left ${v.id === selectedVenueId || i === highlighted ? "bg-primary-light" : "bg-surface hover:bg-gray-50"}`}
            >
              <span className="block truncate text-sm font-medium text-ink">{v.name}</span>
              <span className="mt-0.5 block truncate text-xs text-muted">{v.city ?? "—"}</span>
            </button>
          ))}
          {canUseCustom && (
            <button
              type="button"
              onClick={() => (onSelectCustom?.(trimmed), setQuery(trimmed), setFocused(false))}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-primary hover:bg-gray-50"
            >
              <Ionicon name="add-circle-outline" size={18} color={colors.primary} />
              <span className="truncate">Use "{trimmed}" as your venue</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
