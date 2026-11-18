import { Children, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colors } from "@app/constants/theme";
import type { ExtraType } from "@app/lib/cricketScoring";
import { Ionicon } from "../icons/Icon";
import Spinner from "../ui/Spinner";
import { PlayerInitialAvatar } from "./CricketTabs";

// Full-screen sheet with the brand-gradient header (the app's slide-up
// Modals): edge to edge on phones, a tall centered dialog on desktop.
// Stacks above earlier panels; Esc closes.
export function FullScreenPanel({ title, onClose, children, footer, zIndex = 95 }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; zIndex?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=alertdialog]")) {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-6" style={{ zIndex }}>
      <div className="absolute inset-0 hidden bg-black/40 sm:block" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex h-full w-full flex-col overflow-hidden bg-surface sm:h-[min(820px,90dvh)] sm:max-w-lg sm:rounded-3xl sm:shadow-hero">
        <div className="flex items-center gap-3 bg-brand px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] sm:pt-4">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-0.5 hover:bg-white/10">
            <Ionicon name="close" size={24} color="white" />
          </button>
          <h2 className="flex-1 text-lg font-bold text-white">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer}
      </div>
    </div>,
    document.body
  );
}

// Centered white confirm card (Abandon / End Innings / "Not Allowed"),
// with a disableable, relabelled confirm button for Abandon's countdown.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  disabledLabel,
  onConfirm,
  onCancel,
  confirmDisabled,
  singleButton,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  disabledLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  singleButton?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-10">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-[340px] animate-pop overflow-hidden rounded-2xl bg-surface">
        <div className="p-5">
          <h2 className="mb-2 text-lg font-bold text-ink">{title}</h2>
          <p className="text-sm leading-5 text-ink">{message}</p>
        </div>
        <div className="h-px bg-border" />
        <div className="flex">
          {!singleButton && (
            <button type="button" onClick={onConfirm} disabled={confirmDisabled} className="flex-1 border-r border-border py-3.5 font-bold hover:bg-gray-50 disabled:cursor-not-allowed" style={{ color: confirmDisabled ? colors.muted : colors.primaryDark }}>
              {confirmDisabled ? disabledLabel : confirmLabel}
            </button>
          )}
          <button type="button" onClick={onCancel} className="flex-1 py-3.5 font-bold text-primary-dark hover:bg-gray-50">
            {singleButton ? "Ok" : "Cancel"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// "Select Batsman" / "Select Bowler" / fielder list: numbered rows with an
// avatar and a per-session Playing/Bench toggle, plus ADD / CREATE PLAYER.
export function SelectPlayerPanel({
  title,
  names,
  excluded,
  selectedName,
  benchedNames,
  onToggleBench,
  onSelect,
  onClose,
  onAddPlayer,
  addPlayerPending,
  headerExtra,
  listLabel,
  submitting,
  zIndex = 100,
}: {
  title: string;
  names: string[];
  excluded: string[];
  selectedName: string | null;
  benchedNames: Set<string>;
  onToggleBench: (name: string) => void;
  onSelect: (name: string) => void;
  onClose: () => void;
  onAddPlayer: (name: string) => void;
  addPlayerPending: boolean;
  headerExtra?: ReactNode;
  listLabel?: string;
  submitting?: boolean;
  zIndex?: number;
}) {
  const [addDraft, setAddDraft] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const submitAdd = () => {
    const trimmed = addDraft.trim();
    if (!trimmed) return;
    onAddPlayer(trimmed);
    setAddDraft("");
    setShowAdd(false);
  };

  return (
    <FullScreenPanel
      title={title}
      onClose={onClose}
      zIndex={zIndex}
      footer={
        <button type="button" onClick={() => setShowAdd(true)} className="bg-brand py-4 pb-[calc(env(safe-area-inset-bottom)+16px)] text-center font-bold tracking-wide text-white hover:brightness-105 sm:pb-4">
          ADD / CREATE PLAYER
        </button>
      }
    >
      {headerExtra}
      {listLabel && <p className="mb-3 text-sm font-bold text-ink">{listLabel}</p>}
      {names.map((name, i) => {
        const isExcluded = excluded.includes(name);
        const isBenched = benchedNames.has(name);
        const isSelected = name === selectedName;
        const disabled = isExcluded || isBenched || !!submitting;
        return (
          <div
            key={`${name}-${i}`}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={() => !disabled && onSelect(name)}
            onKeyDown={(e) => e.key === "Enter" && !disabled && onSelect(name)}
            className={`mb-2.5 flex items-center rounded-2xl border px-3 py-2.5 transition ${isSelected ? "border-primary bg-primary-light" : "border-border bg-surface"} ${disabled ? "opacity-50" : "cursor-pointer hover:border-primary/50"}`}
          >
            <span className="mr-3 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-ink">{i + 1}</span>
            <span className="mr-3">
              <PlayerInitialAvatar name={name} />
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{name}</span>
            {!isExcluded && (
              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => (e.stopPropagation(), isBenched && onToggleBench(name))}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${!isBenched ? "bg-primary-light text-primary-dark" : "bg-gray-100 text-muted"}`}
                >
                  Playing
                </button>
                <button
                  type="button"
                  onClick={(e) => (e.stopPropagation(), !isBenched && onToggleBench(name))}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${isBenched ? "bg-red-100 text-red-600" : "bg-gray-100 text-muted"}`}
                >
                  Bench
                </button>
              </span>
            )}
          </div>
        );
      })}
      {names.length === 0 && <p className="py-6 text-center text-sm text-muted">No players available.</p>}
      {showAdd && (
        <form className="mt-2 flex items-center gap-2" onSubmit={(e) => (e.preventDefault(), submitAdd())}>
          <input
            value={addDraft}
            onChange={(e) => setAddDraft(e.target.value)}
            placeholder="Player name"
            aria-label="New player name"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-border px-4 py-2.5 text-ink outline-none focus:border-primary"
          />
          <button type="submit" aria-label="Add player" disabled={!addDraft.trim() || addPlayerPending} className="flex h-11 items-center rounded-xl bg-brand px-4">
            {addPlayerPending ? <Spinner size={18} color="white" /> : <Ionicon name="checkmark" size={18} color="white" />}
          </button>
        </form>
      )}
    </FullScreenPanel>
  );
}

export function ToggleOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPress}
      className={`flex-1 rounded-xl border-[1.5px] py-3 text-sm font-bold transition ${selected ? "border-primary bg-primary text-white" : "border-border bg-surface text-ink hover:border-primary/40"}`}
    >
      {label}
    </button>
  );
}

export type RunOutResult = { dismissedName: string; fielderName: string; fielderName2: string | null; runsCompleted: number; extraType: ExtraType };

// Dedicated Run Out flow: which batsman, one or two fielders, runs
// completed, and whether the delivery was also a bye/leg-bye or no-ball/wide
// (a single extra type — picking one clears the other).
export function RunOutPanel({
  strikerName,
  nonStrikerName,
  bowlingPlayers,
  benchedNames,
  onToggleBench,
  onAddPlayer,
  addPlayerPending,
  onCancel,
  onSubmit,
  submitting,
}: {
  strikerName: string;
  nonStrikerName: string;
  bowlingPlayers: string[];
  benchedNames: Set<string>;
  onToggleBench: (name: string) => void;
  onAddPlayer: (name: string) => void;
  addPlayerPending: boolean;
  onCancel: () => void;
  onSubmit: (result: RunOutResult) => void;
  submitting: boolean;
}) {
  const [dismissedEnd, setDismissedEnd] = useState<"striker" | "nonStriker" | null>(null);
  const [fielder1, setFielder1] = useState("");
  const [fielder2, setFielder2] = useState("");
  const [fielderSlotOpen, setFielderSlotOpen] = useState<1 | 2 | null>(null);
  const [runs, setRuns] = useState(0);
  const [extra, setExtra] = useState<ExtraType>(null);
  const dismissedName = dismissedEnd === "striker" ? strikerName : dismissedEnd === "nonStriker" ? nonStrikerName : null;
  const canSubmit = !!dismissedName && !!fielder1.trim();
  const toggleExtra = (t: ExtraType) => setExtra(extra === t ? null : t);

  return (
    <>
      <FullScreenPanel
        title="Run Out"
        onClose={onCancel}
        footer={
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2 sm:pb-4">
            <button
              type="button"
              onClick={() => dismissedName && fielder1.trim() && onSubmit({ dismissedName, fielderName: fielder1.trim(), fielderName2: fielder2.trim() || null, runsCompleted: runs, extraType: extra })}
              disabled={!canSubmit || submitting}
              className={`flex w-full items-center justify-center rounded-xl bg-brand py-3.5 font-bold tracking-wide text-white ${canSubmit && !submitting ? "" : "opacity-50"}`}
            >
              {submitting ? <Spinner size={20} color="white" /> : "DONE"}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm font-bold text-ink">Select the batsman *</p>
        <div className="mb-6 flex gap-3">
          {(
            [
              { end: "striker" as const, name: strikerName },
              { end: "nonStriker" as const, name: nonStrikerName },
            ]
          ).map(({ end, name }) => (
            <button
              key={end}
              type="button"
              aria-pressed={dismissedEnd === end}
              onClick={() => setDismissedEnd(end)}
              className={`flex flex-1 flex-col items-center rounded-2xl border-[1.5px] py-4 ${dismissedEnd === end ? "border-primary bg-primary-light" : "border-border bg-surface"}`}
            >
              <PlayerInitialAvatar name={name} />
              <span className="mt-2 max-w-full truncate px-2 text-sm font-semibold text-ink">{name}</span>
            </button>
          ))}
        </div>

        <p className="mb-3 text-sm font-bold text-ink">Select fielder (Fielder 01 is mandatory)</p>
        <div className="mb-6 flex gap-7">
          {(
            [
              { slot: 1 as const, name: fielder1, label: "Fielder 01*" },
              { slot: 2 as const, name: fielder2, label: "Fielder 02" },
            ]
          ).map(({ slot, name, label }) => (
            <button key={slot} type="button" onClick={() => setFielderSlotOpen(slot)} className="flex w-[76px] flex-col items-center gap-1.5">
              {name ? (
                <PlayerInitialAvatar name={name} />
              ) : (
                <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gray-100">
                  <Ionicon name="add" size={20} color={colors.muted} />
                </span>
              )}
              <span className="max-w-full truncate text-xs font-medium text-ink">{name || label}</span>
            </button>
          ))}
        </div>

        <p className="mb-3 text-sm font-bold text-ink">Did batsman complete any runs? (optional)</p>
        <div className="mb-6 flex flex-wrap gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={runs === n}
              onClick={() => setRuns(runs === n ? 0 : n)}
              className={`flex h-12 w-[52px] items-center justify-center rounded-xl border-[1.5px] font-bold ${runs === n ? "border-primary bg-primary text-white" : "border-border bg-surface text-ink"}`}
            >
              {n}
            </button>
          ))}
        </div>

        <p className="mb-3 text-sm font-bold text-ink">Is that a byes or leg bye? (optional)</p>
        <div className="mb-6 flex gap-3">
          <ToggleOption label="Byes" selected={extra === "BYE"} onPress={() => toggleExtra("BYE")} />
          <ToggleOption label="Leg Byes" selected={extra === "LEGBYE"} onPress={() => toggleExtra("LEGBYE")} />
        </div>
        <p className="mb-3 text-sm font-bold text-ink">Is that a noball or wide? (optional)</p>
        <div className="mb-2 flex gap-3">
          <ToggleOption label="No Ball" selected={extra === "NOBALL"} onPress={() => toggleExtra("NOBALL")} />
          <ToggleOption label="Wide" selected={extra === "WIDE"} onPress={() => toggleExtra("WIDE")} />
        </div>
      </FullScreenPanel>

      {fielderSlotOpen && (
        <SelectPlayerPanel
          title={fielderSlotOpen === 1 ? "Select Fielder 01" : "Select Fielder 02"}
          names={bowlingPlayers}
          excluded={[]}
          selectedName={(fielderSlotOpen === 1 ? fielder1 : fielder2) || null}
          benchedNames={benchedNames}
          onToggleBench={onToggleBench}
          onClose={() => setFielderSlotOpen(null)}
          onSelect={(name) => {
            if (fielderSlotOpen === 1) setFielder1(name);
            else setFielder2(name);
            setFielderSlotOpen(null);
          }}
          onAddPlayer={onAddPlayer}
          addPlayerPending={addPlayerPending}
          submitting={submitting}
          zIndex={110}
        />
      )}
    </>
  );
}

// The main scoring keypad's fixed 5-column grid with hairline dividers.
export function KeypadRow({ children, bottomBorder }: { children: ReactNode; bottomBorder?: boolean }) {
  const items = Children.toArray(children);
  return (
    <div className={`grid grid-cols-5 ${bottomBorder ? "border-b border-white/25" : ""}`}>
      {items.map((child, i) => (
        <div key={i} className={i < items.length - 1 ? "border-r border-white/25" : ""}>
          {child}
        </div>
      ))}
    </div>
  );
}

export function KeypadCell({ onPress, disabled, children, label }: { onPress: () => void; disabled?: boolean; children: ReactNode; label?: string }) {
  return (
    <button type="button" onClick={onPress} disabled={disabled} aria-label={label} className={`flex w-full items-center justify-center py-4 transition hover:bg-white/10 active:bg-white/20 ${disabled ? "opacity-50" : ""}`}>
      {children}
    </button>
  );
}
