import { useState, type ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { namesClash, entryCollides, type NamedEntry } from "@app/lib/matchNameValidation";
import type { ScorecardPrefill } from "@app/lib/api/tournamentMatches";
import { Ionicon } from "../icons/Icon";
import FieldInput from "../ui/FieldInput";
import Spinner from "../ui/Spinner";
import { PillRow } from "../forms/FormControls";
import AddPlayersFromGroupModal from "./AddPlayersFromGroupModal";

export type PlayMode = "SINGLES" | "DOUBLES";
export type PlayerPair = [NamedEntry, NamedEntry];

export const PLAY_MODE_OPTIONS: { label: string; value: PlayMode }[] = [
  { label: "Singles", value: "SINGLES" },
  { label: "Doubles", value: "DOUBLES" },
];

// Locked (tournament-prefilled) fields render on the app's gray fill.
export const LOCKED_FIELD = "!bg-gray-100";

export const PREFILL_LOCK_NOTE = "Team/player names and venue come from the tournament match and can't be changed here — everything else is up to you.";

export function prefillPair(prefill: ScorecardPrefill | undefined, side: "A" | "B"): PlayerPair {
  const list = side === "A" ? prefill?.teamAPlayers : prefill?.teamBPlayers;
  return [
    { name: list?.[0]?.name ?? "", sourceId: list?.[0]?.userId ?? null },
    { name: list?.[1]?.name ?? "", sourceId: list?.[1]?.userId ?? null },
  ];
}

export function CardSection({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
          <Ionicon name={icon} size={17} color={colors.primaryDark} />
        </span>
        <h2 className="text-base font-bold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function InfoBox({ text }: { text: string }) {
  return (
    <div className="mt-3 flex gap-2 rounded-xl bg-primary-light px-3 py-2.5">
      <span className="mt-px shrink-0">
        <Ionicon name="information-circle" size={16} color={colors.primaryDark} />
      </span>
      <p className="flex-1 text-xs text-primary-dark">{text}</p>
    </div>
  );
}

function AddFromGroupButton({ onPress }: { onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary-light/50">
      <Ionicon name="people-outline" size={16} color={colors.primaryDark} />
      Add From a Squad
    </button>
  );
}

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-2 text-sm font-semibold text-ink ${className}`}>
      {children} <span className="text-red-500">*</span>
    </p>
  );
}

// Port of the racket sports' TeamCard: a side's name (singles player or
// doubles team), its two doubles players, "Add From a Squad", name-clash
// warnings and (Tennis/Badminton) which partner serves for the side.
export function TeamCard({
  letter,
  name,
  onNameChange,
  playMode,
  players,
  onPlayersChange,
  locked,
  otherTeamName,
  otherTeamPlayers,
  namePlaceholder,
  player2Placeholder,
  serverIndex,
  onServerIndexChange,
}: {
  letter: "A" | "B";
  name: string;
  onNameChange: (v: string) => void;
  playMode: PlayMode;
  players: PlayerPair;
  onPlayersChange: (p: PlayerPair) => void;
  locked?: boolean;
  otherTeamName: string;
  otherTeamPlayers: PlayerPair;
  namePlaceholder: string;
  player2Placeholder: string;
  serverIndex?: 0 | 1;
  onServerIndexChange?: (v: 0 | 1) => void;
}) {
  const isDoubles = playMode === "DOUBLES";
  const [groupOpen, setGroupOpen] = useState(false);
  const emptySlots = players.filter((p) => !p.name.trim()).length;
  const nameClash = namesClash(name, otherTeamName);
  const dup0 = isDoubles && !!players[0].name.trim() && entryCollides(players[0], [players[1], ...otherTeamPlayers]);
  const dup1 = isDoubles && !!players[1].name.trim() && entryCollides(players[1], [players[0], ...otherTeamPlayers]);

  const addFromGroup = (picked: { userId: string; name: string }[]) => {
    const next: PlayerPair = [...players];
    let i = 0;
    for (let slot = 0; slot < 2 && i < picked.length; slot++) {
      if (!next[slot].name.trim()) {
        next[slot] = { name: picked[i].name, sourceId: picked[i].userId };
        i++;
      }
    }
    onPlayersChange(next);
  };

  const playerField = (idx: 0 | 1, placeholder: string, dup: boolean) => (
    <>
      <Label className="mt-4">Player {idx + 1}</Label>
      <FieldInput
        value={players[idx].name}
        onChange={(e) => onPlayersChange(idx === 0 ? [{ name: e.target.value, sourceId: null }, players[1]] : [players[0], { name: e.target.value, sourceId: null }])}
        placeholder={placeholder}
        maxLength={40}
        disabled={locked}
        aria-label={`Team ${letter} player ${idx + 1}`}
        containerClassName={locked ? LOCKED_FIELD : ""}
        left={<span className="mr-2"><Ionicon name="person-outline" size={17} color={colors.muted} /></span>}
      />
      {dup && <p className="mt-1.5 text-xs text-danger">Someone with this name is already in the match.</p>}
    </>
  );

  return (
    <section className="mb-4 overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="flex items-center gap-2.5 bg-primary-light px-4 py-3">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{letter}</span>
        <h2 className="flex-1 text-sm font-bold text-ink">{isDoubles ? `Team ${letter}` : `Player ${letter}`}</h2>
      </div>
      <div className="p-4">
        <Label>{isDoubles ? `Team ${letter} Name` : `Player ${letter} Name`}</Label>
        <FieldInput
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          maxLength={40}
          disabled={locked}
          aria-label={isDoubles ? `Team ${letter} name` : `Player ${letter} name`}
          containerClassName={locked ? LOCKED_FIELD : ""}
        />
        {nameClash && <p className="mt-1.5 text-xs text-danger">{isDoubles ? "Team A and Team B can't have the same name." : "Player A and Player B can't have the same name."}</p>}
        {!isDoubles && !locked && <AddFromGroupButton onPress={() => setGroupOpen(true)} />}

        {isDoubles && (
          <>
            {playerField(0, "e.g. Alex", dup0)}
            {playerField(1, player2Placeholder, dup1)}
            {!locked && emptySlots > 0 && <AddFromGroupButton onPress={() => setGroupOpen(true)} />}
            {onServerIndexChange && (
              <>
                <p className="mb-2 mt-4 text-sm font-semibold text-ink">Serves for {name.trim() || `Team ${letter}`}</p>
                <PillRow
                  options={([0, 1] as const).filter((i) => players[i].name.trim().length > 0).map((i) => ({ label: players[i].name.trim(), value: String(i) as "0" | "1" }))}
                  value={String(serverIndex ?? 0) as "0" | "1"}
                  onChange={(v) => onServerIndexChange(v === "0" ? 0 : 1)}
                />
              </>
            )}
          </>
        )}
      </div>

      <AddPlayersFromGroupModal
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        excludedUserIds={isDoubles ? [...players, ...otherTeamPlayers].map((p) => p.sourceId).filter((id): id is string => !!id) : []}
        maxSelect={isDoubles ? emptySlots : 1}
        onAdd={(picked) => (isDoubles ? addFromGroup(picked) : onNameChange(picked[0].name))}
      />
    </section>
  );
}

// Preset pills + "Or enter a custom …" number field + explanatory info box
// (games per set, points to win, match length).
export function NumberPresetSection({
  icon,
  title,
  presets,
  value,
  onChange,
  customLabel,
  placeholder,
  maxDigits,
  info,
}: {
  icon: string;
  title: string;
  presets: { label: string; value: string }[];
  value: string | null;
  onChange: (v: string) => void;
  customLabel: string;
  placeholder: string;
  maxDigits: number;
  info: string;
}) {
  return (
    <CardSection icon={icon} title={title}>
      <PillRow options={presets} value={presets.some((p) => p.value === value) ? value : null} onChange={onChange} />
      <p className="mb-2 mt-3 text-xs text-muted">{customLabel}</p>
      <FieldInput
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, maxDigits))}
        placeholder={placeholder}
        inputMode="numeric"
        maxLength={maxDigits}
        aria-label={title}
      />
      <InfoBox text={info} />
    </CardSection>
  );
}

export function standardPresets(values: string[], standard: number) {
  return values.map((n) => ({ label: n === String(standard) ? `${n} (Standard)` : n, value: n }));
}

// Start Match: gradient when valid, gray otherwise, with the first unmet
// requirement spelled out underneath.
export function StartMatchButton({ valid, pending, reason, onPress, label = "Start Match" }: { valid: boolean; pending: boolean; reason: string | null; onPress: () => void; label?: string }) {
  return (
    <>
      <button
        type="button"
        onClick={onPress}
        disabled={!valid || pending}
        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold ${valid ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-gray-200 text-muted"}`}
      >
        {pending ? (
          <Spinner size={20} color={valid ? "white" : colors.muted} />
        ) : (
          <>
            <Ionicon name="play" size={16} color={valid ? "white" : colors.muted} />
            {label}
          </>
        )}
      </button>
      {reason && <p className="mt-2 text-center text-xs text-muted">{reason}</p>}
    </>
  );
}

export const DUPLICATE_PLAYERS_REASON = "Two players share the same name — rename one, or add them from a squad so they're tracked as separate people.";
