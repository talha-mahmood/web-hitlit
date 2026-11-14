import { useEffect, useState } from "react";
import { colors } from "@app/constants/theme";
import type { Database } from "@app/types/database.types";
import { Ionicon } from "../icons/Icon";
import Modal from "../ui/Modal";
import Spinner from "../ui/Spinner";
import { LocationPickerField, SectionLabel } from "../forms/FormControls";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

const SKILL_LEVELS: { label: string; value: SkillLevel }[] = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Expert", value: "expert" },
];

// Port of JoinRequestModal: skill level + location (required), then the
// request goes to the host for approval.
export function JoinRequestModal({
  open,
  onClose,
  onSubmit,
  submitting,
  title = "Request to Join",
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (skillLevel: SkillLevel, location: string) => void;
  submitting: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [location, setLocation] = useState("");
  const canSend = !!skillLevel && !!location.trim();

  return (
    <Modal open={open} onClose={onClose}>
      <div className="relative pt-4">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-0 top-3">
          <Ionicon name="close" size={24} color={colors.ink} />
        </button>
        <div className="flex items-start">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <Ionicon name="people" size={24} color={colors.primaryDark} />
            <span className="absolute bottom-1 right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-brand">
              <Ionicon name="add" size={11} color="white" />
            </span>
          </span>
          <div className="ml-3.5 mr-6 flex-1">
            <h2 className="text-xl font-extrabold text-ink">{title}</h2>
            {!!subtitle && <p className="mt-1 text-[13.5px] leading-[19px] text-muted">{subtitle}</p>}
          </div>
        </div>

        <SectionLabel title="Your Skill Level" required />
        <div className="flex gap-2.5">
          {SKILL_LEVELS.map((s) => {
            const selected = skillLevel === s.value;
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setSkillLevel(s.value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[26px] border-[1.5px] py-3.5 text-[13px] font-bold transition ${
                  selected ? "border-transparent bg-brand text-white shadow-cta" : "border-border bg-surface text-ink hover:border-primary/40"
                }`}
              >
                <Ionicon name="bar-chart" size={15} color={selected ? "white" : colors.muted} />
                {s.label}
              </button>
            );
          })}
        </div>

        <SectionLabel title="Your Location" required />
        <LocationPickerField value={location} onChange={setLocation} showPinIcon />

        <button
          type="button"
          onClick={() => canSend && skillLevel && onSubmit(skillLevel, location.trim())}
          disabled={!canSend || submitting}
          className={`mb-2 mt-6 flex w-full items-center justify-center gap-2 rounded-[28px] py-4 text-base font-bold ${canSend ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-border text-muted"}`}
        >
          {submitting ? <Spinner color="white" /> : (
            <>
              <Ionicon name="send" size={17} color={canSend ? "white" : colors.muted} />
              Send Request
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

export type JoinableTeam = { id: string; name: string; joinedCount: number; requiredSize: number };

// Port of SelectJoinTeamModal: teams with an open slot, tap to join one.
export function SelectJoinTeamModal({ open, onClose, teams, onSelect, submitting }: { open: boolean; onClose: () => void; teams: JoinableTeam[]; onSelect: (teamId: string) => void; submitting?: boolean }) {
  const [pickingId, setPickingId] = useState<string | null>(null);
  useEffect(() => {
    if (!submitting) setPickingId(null);
  }, [submitting]);
  return (
    <Modal open={open} onClose={onClose} title="Join a Team" subtitle="Pick a team with an open slot to join">
      {teams.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No teams with an open slot right now.</p>
      ) : (
        teams.map((team) => (
          <button
            key={team.id}
            type="button"
            disabled={submitting}
            onClick={() => {
              setPickingId(team.id);
              onSelect(team.id);
            }}
            className="mb-2 flex w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3 text-left hover:border-primary/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-muted">{team.name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{team.name}</span>
              <span className="block truncate text-xs text-muted">
                {team.joinedCount}/{team.requiredSize || "—"} players
              </span>
            </span>
            {submitting && pickingId === team.id ? <Spinner size={18} /> : <Ionicon name="chevron-forward" size={16} color={colors.muted} />}
          </button>
        ))
      )}
    </Modal>
  );
}

// Port of EventJoinRequestModal: just your location, then the host approves.
export function EventJoinRequestModal({ open, onClose, onSubmit, submitting, title = "Request to Join", subtitle }: { open: boolean; onClose: () => void; onSubmit: (location: string) => void; submitting: boolean; title?: string; subtitle?: string }) {
  const [location, setLocation] = useState("");
  const canSend = !!location.trim();
  return (
    <Modal open={open} onClose={onClose}>
      <div className="relative pt-4">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-0 top-3">
          <Ionicon name="close" size={24} color={colors.ink} />
        </button>
        <div className="flex items-start">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <Ionicon name="calendar" size={24} color={colors.primaryDark} />
            <span className="absolute bottom-1 right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-brand">
              <Ionicon name="add" size={11} color="white" />
            </span>
          </span>
          <div className="ml-3.5 mr-6 flex-1">
            <h2 className="text-xl font-extrabold text-ink">{title}</h2>
            {!!subtitle && <p className="mt-1 text-[13.5px] leading-[19px] text-muted">{subtitle}</p>}
          </div>
        </div>
        <SectionLabel title="Your Location" required />
        <LocationPickerField value={location} onChange={setLocation} showPinIcon />
        <button
          type="button"
          onClick={() => canSend && onSubmit(location.trim())}
          disabled={!canSend || submitting}
          className={`mb-2 mt-6 flex w-full items-center justify-center gap-2 rounded-[28px] py-4 text-base font-bold ${canSend ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-border text-muted"}`}
        >
          {submitting ? (
            <Spinner color="white" />
          ) : (
            <>
              <Ionicon name="send" size={17} color={canSend ? "white" : colors.muted} />
              Send Request
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
