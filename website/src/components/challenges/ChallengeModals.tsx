import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colors } from "@app/constants/theme";
import { DAYS, TIME_SLOTS, isTimeSlotPast } from "@app/lib/gameFormHelpers";
import { useSendTeamChallenge } from "@app/hooks/useSquads";
import type { SquadListItem } from "@app/lib/api/squads";
import type { TeamChallengeFormat } from "@app/lib/api/teamChallenges";
import { challengeFormatsForSport } from "@app/lib/teamChallengeFormats";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import GeneratedEntityVisual from "@/components/GeneratedEntityVisual";

// A centered dialog over a dark scrim (the app's fade-in Modal with a card).
export function CenterDialog({ open, onClose, label, maxWidth = 520, children }: { open: boolean; onClose: () => void; label: string; maxWidth?: number; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={label} className="relative flex max-h-[88dvh] w-full animate-pop flex-col overflow-hidden rounded-3xl border border-border bg-surface" style={{ maxWidth }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

// Port of TeamManagerRequiredModal: challenging/messaging teams needs a team
// you manage first.
export function TeamManagerRequiredModal({ open, onClose, onCreateTeam }: { open: boolean; onClose: () => void; onCreateTeam: () => void }) {
  return (
    <CenterDialog open={open} onClose={onClose} label="Create a team first" maxWidth={440}>
      <div className="px-6 pb-6 pt-7">
        <div className="flex flex-col items-center">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-info-light">
            <Ionicon name="information-circle" size={46} color="#38BDF8" />
          </span>
          <h2 className="mt-5 text-center text-[23px] font-extrabold text-[#38BDF8]">Create a team first</h2>
          <p className="mt-3 text-center text-[17px] leading-[25px] text-muted">Challenging and messaging teams is for team managers. Create your team first.</p>
        </div>
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="button" onClick={onClose} className="min-h-[58px] rounded-2xl border border-border bg-surface-raised text-lg font-bold text-ink">
            Not now
          </button>
          <button type="button" onClick={onCreateTeam} className="min-h-[58px] rounded-2xl bg-primary text-lg font-bold text-white">
            Create Team
          </button>
        </div>
      </div>
    </CenterDialog>
  );
}

// Racquet sports are 1-a-side or 2-a-side: a 1/2 picker, not a number field.
const RACQUET_SPORTS = new Set(["padel", "tennis", "badminton", "pickleball", "table tennis"]);

function requestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
      });
}

function Choice({ selected, onPress, children, className = "" }: { selected: boolean; onPress: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPress}
      className={`shrink-0 rounded-xl border ${selected ? "border-primary bg-primary-light" : "border-border bg-surface-raised hover:border-primary/40"} ${className}`}
    >
      {children}
    </button>
  );
}

// Port of TeamChallengeComposerModal: pick your team (same sport), venue,
// date, time, format and total players, then send. A per-open idempotency
// key keeps a retried send from creating a second challenge.
export function TeamChallengeComposerModal({
  open,
  senderTeams,
  opponent,
  initialFormat,
  onClose,
  onSent,
}: {
  open: boolean;
  senderTeams: SquadListItem[];
  opponent: SquadListItem | null;
  initialFormat?: TeamChallengeFormat | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const teamIds = useMemo(() => senderTeams.map((t) => t.id).sort(), [senderTeams]);
  const sendChallenge = useSendTeamChallenge(teamIds);
  const [senderSquadId, setSenderSquadId] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState(DAYS[0]?.iso ?? "");
  const [time, setTime] = useState("");
  const [format, setFormat] = useState<TeamChallengeFormat>("5v5");
  const [totalPlayers, setTotalPlayers] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(requestKey);
  const sportName = opponent?.sports?.name ?? "";
  const formats = useMemo(() => challengeFormatsForSport(sportName), [sportName]);
  const isRacquetSport = RACQUET_SPORTS.has(sportName.trim().toLowerCase());
  const matchingSenderTeams = useMemo(() => senderTeams.filter((t) => t.sport_id === opponent?.sport_id), [senderTeams, opponent?.sport_id]);
  const { reset } = sendChallenge;

  useEffect(() => {
    if (!open) return;
    setSenderSquadId(matchingSenderTeams[0]?.id ?? "");
    setVenue("");
    setDate(DAYS[0]?.iso ?? "");
    setTime("");
    setFormat(initialFormat && formats.some((o) => o.value === initialFormat) ? initialFormat : (formats[0]?.value ?? "5v5"));
    setTotalPlayers("");
    setIdempotencyKey(requestKey());
    reset();
  }, [open, matchingSenderTeams, formats, initialFormat, reset]);

  const totalPlayersValue = Number(totalPlayers);
  const totalPlayersValid = totalPlayers.length > 0 && Number.isInteger(totalPlayersValue) && totalPlayersValue >= 1 && totalPlayersValue <= 20;
  const valid = Boolean(
    opponent &&
      matchingSenderTeams.some((t) => t.id === senderSquadId) &&
      senderSquadId !== opponent.id &&
      formats.some((o) => o.value === format) &&
      venue.trim().length >= 2 &&
      date &&
      time &&
      !isTimeSlotPast(date, time) &&
      totalPlayersValid
  );
  const times = TIME_SLOTS.filter((slot) => !isTimeSlotPast(date, slot.value));

  const submit = async () => {
    if (!valid || !opponent) return;
    try {
      await sendChallenge.mutateAsync({
        senderSquadId,
        receiverSquadId: opponent.id,
        venue: venue.trim(),
        scheduledAt: new Date(`${date}T${time}:00+05:00`).toISOString(),
        matchFormat: format,
        sportId: opponent.sport_id!,
        idempotencyKey,
        totalPlayers: totalPlayersValue,
      });
      onSent();
    } catch {
      // The form and idempotency key stay intact for a safe retry.
    }
  };

  const inputCls = "min-h-[52px] w-full rounded-2xl border border-border bg-surface-raised px-[15px] text-[15px] text-ink outline-none placeholder:text-muted focus:border-primary";

  return (
    <CenterDialog open={open} onClose={onClose} label="Send Challenge">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-ink">Send Challenge</h2>
          <p className="mt-1 truncate text-muted">vs {opponent?.name ?? "Team"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close challenge form" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
          <Ionicon name="close" size={22} color={colors.ink} />
        </button>
      </div>
      <form className="min-h-0 flex-1 overflow-y-auto px-5 pb-5" onSubmit={(e) => (e.preventDefault(), void submit())}>
        {senderTeams.length > 1 ? (
          <>
            <p className="mb-2 mt-4 font-semibold text-ink">Challenge from</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {matchingSenderTeams.map((team) => (
                <Choice key={team.id} selected={team.id === senderSquadId} onPress={() => setSenderSquadId(team.id)} className="flex items-center gap-2 rounded-2xl px-3 py-2">
                  <GeneratedEntityVisual id={team.id} name={team.name} sport={team.sports?.name} kind="team" imageUrl={team.icon_url} size={26} />
                  <span className="max-w-[160px] truncate font-semibold text-ink">{team.name}</span>
                </Choice>
              ))}
            </div>
          </>
        ) : matchingSenderTeams[0] ? (
          <p className="mt-4 flex items-center gap-2 text-muted">
            <Ionicon name="shield-checkmark" size={17} color={colors.primary} />
            <span>
              Sending as <b className="font-semibold text-ink">{matchingSenderTeams[0].name}</b>
            </span>
          </p>
        ) : null}

        <label className="mb-2 mt-5 block font-semibold text-ink" htmlFor="challenge-venue">
          Venue
        </label>
        <input id="challenge-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Enter venue" maxLength={160} className={inputCls} />

        <p className="mb-2 mt-5 font-semibold text-ink">Date</p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {DAYS.map((day) => (
            <Choice key={day.iso} selected={date === day.iso} onPress={() => (setDate(day.iso), setTime(""))} className="flex min-w-[62px] flex-col items-center rounded-2xl px-3 py-2">
              <span className={`text-xs ${date === day.iso ? "text-primary" : "text-muted"}`}>{day.day}</span>
              <span className="mt-0.5 font-bold text-ink">{day.label}</span>
            </Choice>
          ))}
        </div>

        <p className="mt-5 flex items-center justify-between font-semibold text-ink">
          Time
          <Ionicon name="time-outline" size={18} color={colors.primary} />
        </p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pt-2">
          {times.map((slot) => (
            <Choice key={slot.value} selected={time === slot.value} onPress={() => setTime(slot.value)} className="px-3 py-2">
              <span className={`font-semibold ${time === slot.value ? "text-primary" : "text-ink"}`}>{slot.label}</span>
            </Choice>
          ))}
          {times.length === 0 && <span className="py-2 text-muted">No future times left today</span>}
        </div>

        <p className="mt-5 flex items-center justify-between font-semibold text-ink">
          {sportName} format
          <Ionicon name="people-outline" size={18} color={colors.primary} />
        </p>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pr-5">
          {formats.map(({ value, label }) => (
            <Choice key={value} selected={format === value} onPress={() => setFormat(value)} className="px-4 py-2.5">
              <span className={`font-bold ${format === value ? "text-primary" : "text-ink"}`}>{label}</span>
            </Choice>
          ))}
        </div>

        <p className="mb-2 mt-5 font-semibold text-ink">Total players</p>
        {isRacquetSport ? (
          <div className="flex gap-2.5">
            {["1", "2"].map((v) => (
              <Choice key={v} selected={totalPlayers === v} onPress={() => setTotalPlayers(v)} className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl">
                <span className={`text-base font-bold ${totalPlayers === v ? "text-primary" : "text-ink"}`}>{v}</span>
              </Choice>
            ))}
          </div>
        ) : (
          <>
            <input
              value={totalPlayers}
              onChange={(e) => setTotalPlayers(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              placeholder="e.g. 11"
              inputMode="numeric"
              maxLength={2}
              aria-label="Total players"
              className={inputCls}
            />
            {totalPlayers.length > 0 && !totalPlayersValid && <p className="mt-1.5 text-xs text-danger">Enter a number from 1 to 20</p>}
          </>
        )}

        {sendChallenge.error && <p className="mt-4 text-sm text-danger">{getFriendlyErrorMessage(sendChallenge.error, "We couldn't send this challenge. Please try again.")}</p>}
        <div className="mt-6 flex gap-2.5">
          <button type="button" onClick={onClose} disabled={sendChallenge.isPending} className="min-h-14 flex-1 rounded-2xl border border-border bg-surface-raised font-bold text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || sendChallenge.isPending}
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-bold text-white"
            style={{ backgroundColor: valid ? colors.primary : colors.primaryDark, opacity: valid ? 1 : 0.62 }}
          >
            {sendChallenge.isPending && <Spinner size={16} color="white" />}
            {sendChallenge.isPending ? "Sending…" : "Send Challenge"}
          </button>
        </div>
      </form>
    </CenterDialog>
  );
}
