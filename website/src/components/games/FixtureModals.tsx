import { useEffect, useState } from "react";
import { colors } from "@app/constants/theme";
import { DAYS, TIME_SLOTS, isTimeSlotPast } from "@app/lib/gameFormHelpers";
import { Ionicon } from "../icons/Icon";
import Modal from "../ui/Modal";
import Spinner from "../ui/Spinner";

export type ScorerCandidate = { id: string; name: string; teamName: string };

// Port of SelectScorerModal: any joined tournament member (or the host) can
// be made the scorer of one match; the current scorer is highlighted.
export function SelectScorerModal({
  open,
  onClose,
  members,
  currentScorerId,
  onSelect,
  submitting,
  contextLabel = "tournament",
}: {
  open: boolean;
  onClose: () => void;
  members: ScorerCandidate[];
  currentScorerId: string | null;
  onSelect: (userId: string) => void;
  submitting?: boolean;
  contextLabel?: "game" | "tournament";
}) {
  const [pickingId, setPickingId] = useState<string | null>(null);
  useEffect(() => {
    if (!submitting) setPickingId(null);
  }, [submitting]);
  return (
    <Modal open={open} onClose={onClose} title="Select Scorer" subtitle={`Pick a ${contextLabel} member to score this match`}>
      {members.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No {contextLabel} members found yet.</p>
      ) : (
        members.map((m) => {
          const isCurrent = m.id === currentScorerId;
          return (
            <button
              key={m.id}
              type="button"
              disabled={submitting}
              onClick={() => (setPickingId(m.id), onSelect(m.id))}
              className={`mb-2 flex w-full items-center gap-2.5 rounded-2xl border-[1.5px] px-4 py-3 text-left transition ${isCurrent ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/40"}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${isCurrent ? "bg-brand text-white" : "bg-gray-100 text-muted"}`}>
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${isCurrent ? "font-bold text-primary-dark" : "font-semibold text-ink"}`}>{m.name}</span>
                <span className="block truncate text-xs text-muted">{m.teamName}</span>
              </span>
              {submitting && pickingId === m.id ? <Spinner size={18} /> : isCurrent ? <Ionicon name="checkmark-circle" size={20} color={colors.primary} /> : null}
            </button>
          );
        })
      )}
    </Modal>
  );
}

// Port of SetMatchTimeModal: date + time chips (past slots hidden).
export function SetMatchTimeModal({ open, onClose, initialIso, onConfirm, submitting }: { open: boolean; onClose: () => void; initialIso: string | null; onConfirm: (iso: string) => void; submitting?: boolean }) {
  const [dateIso, setDateIso] = useState(DAYS[0].iso);
  const [timeValue, setTimeValue] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialIso) {
      const d = new Date(initialIso);
      setDateIso(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setTimeValue(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } else {
      setDateIso(DAYS[0].iso);
      setTimeValue(null);
    }
  }, [open, initialIso]);

  const times = TIME_SLOTS.filter((t) => !isTimeSlotPast(dateIso, t.value));
  const canConfirm = !!timeValue && times.some((t) => t.value === timeValue);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set Match Time"
      subtitle="Shown on the match card — doesn't book the venue"
      footer={
        <button
          type="button"
          disabled={!canConfirm || submitting}
          onClick={() => canConfirm && onConfirm(`${dateIso}T${timeValue}:00+05:00`)}
          className={`w-full rounded-2xl py-4 text-base font-bold ${canConfirm ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-gray-200 text-muted"}`}
        >
          {submitting ? "Saving…" : "Save Time"}
        </button>
      }
    >
      <p className="mb-2 text-xs font-bold text-ink">Date</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {DAYS.filter((d) => TIME_SLOTS.some((t) => !isTimeSlotPast(d.iso, t.value))).map((d) => {
          const selected = dateIso === d.iso;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => {
                setDateIso(d.iso);
                if (timeValue && isTimeSlotPast(d.iso, timeValue)) setTimeValue(null);
              }}
              className={`flex shrink-0 flex-col items-center rounded-2xl border-[1.5px] px-3 py-2.5 ${selected ? "border-transparent bg-brand text-white" : "border-border text-ink"}`}
            >
              <span className={`text-xs ${selected ? "text-white" : "text-muted"}`}>{d.day}</span>
              <span className="mt-0.5 text-base font-bold">{d.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-2 mt-4 text-xs font-bold text-ink">Time</p>
      <div className="flex flex-wrap gap-2">
        {times.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTimeValue(t.value)}
            className={`rounded-2xl border-[1.5px] px-3.5 py-2.5 text-sm font-medium ${timeValue === t.value ? "border-transparent bg-brand text-white" : "border-border text-ink hover:border-primary/40"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
