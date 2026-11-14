import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { colors } from "@app/constants/theme";
import { toLocalDateStr } from "@app/lib/slots";
import { Ionicon } from "../icons/Icon";

export type DateSelection = { start: string; end: string };

function formatShort(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Port of BookingsDateRangeModal: green header (Close / Clear / SAVE, the
// selected day or range), a month calendar below. Tap once = one day, tap a
// second day = a range, tap again = start over. Full screen on phones, a
// dialog on larger screens.
export default function DateRangeSheet({
  open,
  initialSelection,
  onClose,
  onSave,
  onClear,
}: {
  open: boolean;
  initialSelection: DateSelection | null;
  onClose: () => void;
  onSave: (selection: DateSelection) => void;
  onClear?: () => void;
}) {
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    setStart(initialSelection?.start ?? null);
    setEnd(initialSelection?.end ?? null);
    setAwaitingEnd(false);
    setMonth(initialSelection ? new Date(`${initialSelection.start}T00:00:00`) : new Date());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const cells: (string | null)[] = Array(first.getDay()).fill(null);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= count; d++) cells.push(toLocalDateStr(new Date(month.getFullYear(), month.getMonth(), d)));
    return cells;
  }, [month]);

  if (!open) return null;

  const realEnd = end ?? start;
  const [lo, hi] = start && realEnd ? (start <= realEnd ? [start, realEnd] : [realEnd, start]) : [null, null];
  const today = toLocalDateStr(new Date());

  const pick = (day: string) => {
    if (!awaitingEnd) {
      setStart(day);
      setEnd(day);
      setAwaitingEnd(true);
      return;
    }
    if (day === start) {
      setAwaitingEnd(false);
      return;
    }
    if (start && day < start) {
      setEnd(start);
      setStart(day);
    } else setEnd(day);
    setAwaitingEnd(false);
  };

  const label = !start ? "No date selected" : start === realEnd ? formatShort(start) : `${formatShort(lo!)} – ${formatShort(hi!)}`;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-stretch justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 hidden bg-black/40 sm:block" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Select dates" className="relative flex w-full animate-fadeUp flex-col overflow-hidden bg-gray-100 sm:max-w-[420px] sm:rounded-3xl sm:shadow-hero">
        <div className="bg-brand px-5 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] sm:pt-4">
          <div className="mb-5 flex items-center justify-between">
            <button type="button" aria-label="Close" onClick={onClose}>
              <Ionicon name="close" size={24} color="white" />
            </button>
            <div className="flex items-center gap-[18px]">
              {onClear && start && (
                <button type="button" onClick={onClear} className="text-sm font-semibold text-white/85">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => (start ? onSave({ start: lo!, end: hi! }) : onClose())} className="text-sm font-bold text-white">
                SAVE
              </button>
            </div>
          </div>
          <p className="text-xs font-semibold tracking-widest text-white/80">SELECTED {start && start !== realEnd ? "RANGE" : "DAY"}</p>
          <p className="mt-1 text-3xl font-bold text-white">{label}</p>
        </div>

        <div className="bg-surface px-4 pb-6 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full p-2 hover:bg-gray-100">
              <Ionicon name="chevron-back" size={20} color={colors.primary} />
            </button>
            <span className="text-[15px] font-bold text-ink">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full p-2 hover:bg-gray-100">
              <Ionicon name="chevron-forward" size={20} color={colors.primary} />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day, i) => {
              if (!day) return <span key={`e${i}`} />;
              const inRange = lo && hi && day >= lo && day <= hi;
              const isEdge = day === lo || day === hi;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  aria-pressed={!!inRange}
                  className={`relative flex h-10 items-center justify-center text-sm ${inRange && !isEdge ? "bg-primary-light" : ""} ${day === lo && lo !== hi ? "rounded-l-full bg-primary-light" : ""} ${day === hi && lo !== hi ? "rounded-r-full bg-primary-light" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${isEdge ? "bg-primary font-bold text-white" : day === today ? "font-bold text-primary" : "text-ink hover:bg-gray-100"}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
