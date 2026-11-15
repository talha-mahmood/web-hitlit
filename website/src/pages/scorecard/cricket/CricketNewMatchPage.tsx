import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { colors } from "@app/constants/theme";
import { linkTeamFixtureScorecard, type TeamFixturePrefill } from "@app/lib/api/teamChallenges";
import { useAuthStore } from "@app/store/authStore";
import { useSports } from "@app/hooks/useSports";
import { useCreateCricketMatch } from "@app/hooks/useCricket";
import { friendlyCricketError } from "@app/lib/api/cricket";
import { useLinkCricketMatch } from "@app/hooks/useTournamentMatches";
import { namesClash, entryCollides, disambiguateRoster, describeRosterIssue, type NamedEntry } from "@app/lib/matchNameValidation";
import type { ScorecardPrefill } from "@app/lib/api/tournamentMatches";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import { PillRow } from "@/components/forms/FormControls";
import SportNewMatchHeader from "@/components/scorecard/SportNewMatchHeader";
import AddPlayersFromGroupModal from "@/components/scorecard/AddPlayersFromGroupModal";
import { CardSection, StartMatchButton } from "@/components/scorecard/NewMatchParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const OVERS_PRESETS = ["2", "5", "10", "20", "50"];

function TeamCard({ letter, players, name, onNameChange, onPlayersChange, otherTeamName, otherTeamPlayers }: { letter: "A" | "B"; players: NamedEntry[]; name: string; onNameChange: (v: string) => void; onPlayersChange: (p: NamedEntry[]) => void; otherTeamName: string; otherTeamPlayers: NamedEntry[] }) {
  const [draft, setDraft] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const addPlayer = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (entryCollides({ name: trimmed, sourceId: null }, [...players, ...otherTeamPlayers])) {
      setAddError("Someone with this name is already in the match.");
      return;
    }
    onPlayersChange([...players, { name: trimmed, sourceId: null }]);
    setDraft("");
    setAddError(null);
  };

  return (
    <section className="mb-4 overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="flex items-center gap-2.5 bg-primary-light px-4 py-3">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{letter}</span>
        <Ionicon name="shirt-outline" size={18} color={colors.primaryDark} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Team {letter}</p>
          <p className="text-xs text-muted">Enter team name and players</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-primary-dark">
          <Ionicon name="people" size={12} color={colors.primaryDark} />
          {players.length} player{players.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="p-4">
        <p className="mb-2 text-sm font-semibold text-ink">
          Team {letter} Name <span className="text-red-500">*</span>
        </p>
        <FieldInput
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={letter === "A" ? "e.g. Strikers" : "e.g. Warriors"}
          maxLength={40}
          aria-label={`Team ${letter} name`}
          right={
            name.length > 0 ? (
              <button type="button" aria-label="Clear name" onClick={() => onNameChange("")}>
                <Ionicon name="close" size={18} color={colors.muted} />
              </button>
            ) : undefined
          }
        />
        {namesClash(name, otherTeamName) && <p className="mt-1.5 text-xs text-danger">Team A and Team B can't have the same name.</p>}

        <p className="mb-2 mt-4 text-sm font-semibold text-ink">
          Team {letter} Players <span className="text-red-500">*</span>
        </p>
        <form className="flex items-center gap-2" onSubmit={(e) => (e.preventDefault(), addPlayer())}>
          <div className="min-w-0 flex-1">
            <FieldInput
              value={draft}
              onChange={(e) => (setDraft(e.target.value), setAddError(null))}
              placeholder="Add player name"
              aria-label={`Add Team ${letter} player`}
              enterKeyHint="done"
              left={<span className="mr-2"><Ionicon name="person-outline" size={17} color={colors.muted} /></span>}
            />
          </div>
          <button type="submit" aria-label="Add player" disabled={!draft.trim()} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${draft.trim() ? "bg-brand" : "bg-gray-200"}`}>
            <Ionicon name="add" size={20} color="white" />
          </button>
        </form>
        {addError && <p className="mt-1.5 text-xs text-danger">{addError}</p>}
        <button type="button" onClick={() => setGroupOpen(true)} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary-light/50">
          <Ionicon name="people-outline" size={16} color={colors.primaryDark} />
          Add From a Squad
        </button>
        {players.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {players.map((p, i) => (
              <span key={`${p.name}-${i}`} className="flex items-center gap-1.5 rounded-full bg-primary-light py-1.5 pl-3 pr-2 text-sm font-medium text-primary">
                {p.name}
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onPlayersChange(players.filter((_, idx) => idx !== i))}>
                  <Ionicon name="close-circle" size={16} color={colors.primary} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <AddPlayersFromGroupModal
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        excludedUserIds={[...players, ...otherTeamPlayers].map((p) => p.sourceId).filter((id): id is string => !!id)}
        onAdd={(picked) => onPlayersChange([...players, ...picked.map((p) => ({ name: p.name, sourceId: p.userId }))])}
      />
    </section>
  );
}

// Port of NewMatchScreen (cricket): teams and players (or the tournament
// fixture when prefilled), venue, overs, Hard/Tape Ball, format, toss and
// Last Man Stand.
// Auto toss: the coin lifts and spins (4 turns + the landed face), then lands.
function CoinFlip({ onLand }: { onLand: (side: "HEADS" | "TAILS") => void }) {
  const [landed] = useState(() => (Math.random() < 0.5 ? "HEADS" : "TAILS") as "HEADS" | "TAILS");
  const [spin, setSpin] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setSpin(true));
    const t = setTimeout(() => onLand(landed), 1450);
    return () => (cancelAnimationFrame(raf), clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex h-24 flex-col items-center justify-center [perspective:800px]" role="status" aria-label="Flipping the coin">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-primary-dark bg-primary"
        style={{
          transform: spin ? `rotateY(${4 * 360 + (landed === "HEADS" ? 0 : 180)}deg)` : "rotateY(0deg)",
          transition: "transform 1400ms cubic-bezier(0.215, 0.61, 0.355, 1)",
          animation: "coinLift 1400ms ease-in-out",
        }}
      >
        <Ionicon name="disc-outline" size={28} color="white" />
      </span>
      <p className="mt-3 text-xs text-muted">Flipping...</p>
      <style>{"@keyframes coinLift{0%{translate:0 0}32%{translate:0 -28px}100%{translate:0 0}}"}</style>
    </div>
  );
}

export default function CricketNewMatchPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(`${paths.scorecard}/cricket`);
  const navState = useLocation().state as { prefill?: ScorecardPrefill; teamFixture?: TeamFixturePrefill } | null;
  const prefill = navState?.prefill;
  const teamFixture = navState?.teamFixture;
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateCricketMatch();
  const linkCricketMatch = useLinkCricketMatch(prefill?.gameId ?? "");

  const [teamAName, setTeamAName] = useState(prefill?.teamAName ?? teamFixture?.teamAName ?? "");
  const [teamBName, setTeamBName] = useState(prefill?.teamBName ?? teamFixture?.teamBName ?? "");
  const [teamAPlayers, setTeamAPlayers] = useState<NamedEntry[]>((prefill?.teamAPlayers ?? []).map((p) => ({ name: p.name, sourceId: p.userId })));
  const [teamBPlayers, setTeamBPlayers] = useState<NamedEntry[]>((prefill?.teamBPlayers ?? []).map((p) => ({ name: p.name, sourceId: p.userId })));
  const [oversLimit, setOversLimit] = useState<string | null>(
    teamFixture?.matchFormat === "T10" ? "10" : teamFixture?.matchFormat === "T20" ? "20" : teamFixture?.matchFormat === "ODI" ? "50" : null
  );
  const [format, setFormat] = useState<"T10" | "T20" | "ODI" | "Club" | null>(
    teamFixture && ["T10", "T20", "ODI", "Club"].includes(teamFixture.matchFormat) ? (teamFixture.matchFormat as "T10" | "T20" | "ODI" | "Club") : null
  );
  const [tossMode, setTossMode] = useState<"manual" | "auto">("manual");
  const [tossCallSide, setTossCallSide] = useState<"HEADS" | "TAILS" | null>(null);
  const [tossFlipping, setTossFlipping] = useState(false);
  const [tossResultSide, setTossResultSide] = useState<"HEADS" | "TAILS" | null>(null);
  const [tossWinner, setTossWinner] = useState<"A" | "B" | null>(null);
  const [tossDecision, setTossDecision] = useState<"BAT" | "BOWL" | null>(null);
  const [lastManStand, setLastManStand] = useState<"on" | "off">("off");
  const [venue, setVenue] = useState(prefill?.venue ?? teamFixture?.venue ?? "");
  const { data: allSports } = useSports();
  const cricketSportOptions = (allSports ?? []).filter((s) => ["hard ball", "tape ball"].includes(s.name.trim().toLowerCase()));
  const [cricketSportId, setCricketSportId] = useState<string | null>(null);

  const validationReason =
    describeRosterIssue(teamAName, teamBName, teamAPlayers, teamBPlayers, 2) ??
    (!(prefill?.sportId ?? teamFixture?.sportId) && !cricketSportId ? "Pick Hard Ball or Tape Ball." : null) ??
    (!oversLimit || parseInt(oversLimit, 10) <= 0 ? "Set the overs per innings." : null) ??
    (!format ? "Pick a match format." : null) ??
    (!tossWinner ? "Pick who won the toss." : null) ??
    (!tossDecision ? "Pick what they chose — bat or bowl." : null);
  const isValid = !validationReason;

  const handleCreate = () => {
    if (!isValid || !userId || !oversLimit || !format || !tossWinner || !tossDecision) return;
    const { teamANames, teamBNames } = disambiguateRoster(teamAPlayers, teamBPlayers);
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers: teamANames,
        teamBPlayers: teamBNames,
        oversLimit: parseInt(oversLimit, 10),
        format,
        tossWinner,
        tossDecision,
        venue: venue.trim() || undefined,
        lastManStand: lastManStand === "on",
        sportId: prefill?.sportId ?? teamFixture?.sportId ?? cricketSportId,
      },
      {
        onSuccess: async ({ matchId }) => {
          try {
            if (prefill) await linkCricketMatch.mutateAsync({ matchId: prefill.tournamentMatchId, cricketMatchId: matchId });
            if (teamFixture) await linkTeamFixtureScorecard(teamFixture.fixtureId, matchId, "cricket_matches");
          } catch (e) {
            Alert.alert("Match created", e instanceof Error ? e.message : "The scorecard was created but could not be linked to its fixture.");
          }
          navigate(paths.match("cricket", matchId), { replace: true });
        },
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not create match.")),
      }
    );
  };

  return (
    <div className="mx-auto max-w-3xl pb-16 lg:px-8">
      <SportNewMatchHeader sport="cricket" title="New Match" subtitle="Set up your match details" onBack={goBack} />
      <div className="px-5 pt-1 lg:px-0">
        {prefill ? (
          <section className="mb-4 rounded-2xl bg-surface p-4 shadow-card">
            <div className="flex items-center">
              <p className="flex-1 truncate text-base font-bold text-ink">{teamAName}</p>
              <span className="mx-2 text-xs font-bold text-muted">VS</span>
              <p className="flex-1 truncate text-right text-base font-bold text-ink">{teamBName}</p>
            </div>
            {venue ? (
              <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted">
                <Ionicon name="location-outline" size={14} color={colors.muted} />
                <span className="truncate">{venue}</span>
              </p>
            ) : null}
          </section>
        ) : (
          <>
            <div className="md:grid md:grid-cols-2 md:gap-4">
              <TeamCard letter="A" name={teamAName} onNameChange={setTeamAName} players={teamAPlayers} onPlayersChange={setTeamAPlayers} otherTeamName={teamBName} otherTeamPlayers={teamBPlayers} />
              <TeamCard letter="B" name={teamBName} onNameChange={setTeamBName} players={teamBPlayers} onPlayersChange={setTeamBPlayers} otherTeamName={teamAName} otherTeamPlayers={teamAPlayers} />
            </div>
            <CardSection icon="location-outline" title="Venue">
              <FieldInput value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Karachi Cricket Ground" maxLength={60} aria-label="Venue" />
            </CardSection>
          </>
        )}

        <CardSection icon="baseball-outline" title="Overs per Innings">
          <PillRow options={OVERS_PRESETS.map((n) => ({ label: n, value: n }))} value={OVERS_PRESETS.includes(oversLimit ?? "") ? oversLimit : null} onChange={setOversLimit} />
          <p className="mb-2 mt-3 text-xs text-muted">Or enter a custom number</p>
          <FieldInput value={oversLimit ?? ""} onChange={(e) => setOversLimit(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="e.g. 15" inputMode="numeric" maxLength={3} aria-label="Overs per innings" />
        </CardSection>

        {!prefill?.sportId && !teamFixture?.sportId && cricketSportOptions.length > 0 && (
          <CardSection icon="baseball-outline" title="Cricket Format">
            <PillRow options={cricketSportOptions.map((s) => ({ label: s.name, value: s.id }))} value={cricketSportId} onChange={setCricketSportId} />
          </CardSection>
        )}

        <CardSection icon="trophy-outline" title="Match Format">
          <PillRow
            options={[
              { label: "T10", value: "T10" as const },
              { label: "T20", value: "T20" as const },
              { label: "One Day", value: "ODI" as const },
              { label: "Club Cricket", value: "Club" as const },
            ]}
            value={format}
            onChange={setFormat}
          />
        </CardSection>

        <CardSection icon="shuffle-outline" title="Toss Mode">
          <PillRow
            options={[
              { label: "Manual Toss", value: "manual" as const },
              { label: "Auto Toss", value: "auto" as const },
            ]}
            value={tossMode}
            onChange={(mode) => {
              setTossMode(mode);
              setTossWinner(null);
              setTossCallSide(null);
              setTossFlipping(false);
              setTossResultSide(null);
            }}
          />
        </CardSection>

        {tossMode === "manual" ? (
          <div className="grid grid-cols-2 gap-3">
            <CardSection icon="trophy-outline" title="Toss Winner">
              <PillRow
                options={[
                  { label: teamAName.trim() || "Team A", value: "A" as const },
                  { label: teamBName.trim() || "Team B", value: "B" as const },
                ]}
                value={tossWinner}
                onChange={setTossWinner}
              />
            </CardSection>
            <CardSection icon="albums-outline" title="Toss Decision">
            <PillRow
              options={[
                { label: "Bat", value: "BAT" as const },
                { label: "Bowl", value: "BOWL" as const },
              ]}
              value={tossDecision}
              onChange={setTossDecision}
            />
          </CardSection>
          </div>
        ) : (
          <>
            <CardSection icon="disc-outline" title="Coin Toss">
              {tossResultSide ? (
                <div className="flex flex-col items-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary-light">
                    <Ionicon name="disc-outline" size={28} color={colors.primary} />
                  </span>
                  <p className="mt-3 text-sm font-bold text-ink">{tossResultSide === "HEADS" ? "Heads!" : "Tails!"}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">{tossWinner === "A" ? teamAName.trim() || "Team A" : teamBName.trim() || "Team B"} won the toss</p>
                  <button
                    type="button"
                    onClick={() => (setTossCallSide(null), setTossResultSide(null), setTossWinner(null))}
                    className="mt-3 flex items-center gap-1.5 rounded-xl border-[1.5px] border-border px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary-light"
                  >
                    <Ionicon name="shuffle" size={14} color={colors.primary} />
                    Toss Again
                  </button>
                </div>
              ) : tossFlipping ? (
                <CoinFlip
                  onLand={(side) => {
                    setTossResultSide(side);
                    setTossFlipping(false);
                    setTossWinner(tossCallSide === side ? "A" : "B");
                  }}
                />
              ) : (
                <div>
                  <p className="mb-2 text-xs text-muted">{teamAName.trim() || "Team A"} calls heads or tails:</p>
                  <PillRow
                    options={[
                      { label: "Heads", value: "HEADS" as const },
                      { label: "Tails", value: "TAILS" as const },
                    ]}
                    value={tossCallSide}
                    onChange={setTossCallSide}
                  />
                  <p className="mt-2.5 text-xs text-muted">
                    {teamBName.trim() || "Team B"} gets {tossCallSide === "HEADS" ? "Tails" : tossCallSide === "TAILS" ? "Heads" : "the other side"}.
                  </p>
                  <button
                    type="button"
                    disabled={!tossCallSide}
                    onClick={() => setTossFlipping(true)}
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold ${tossCallSide ? "press bg-brand text-white shadow-cta" : "bg-border text-muted"}`}
                  >
                    <Ionicon name="disc-outline" size={16} color={tossCallSide ? "white" : colors.muted} />
                    Flip Coin
                  </button>
                </div>
              )}
            </CardSection>
            <CardSection icon="albums-outline" title="Toss Decision">
            <PillRow
              options={[
                { label: "Bat", value: "BAT" as const },
                { label: "Bowl", value: "BOWL" as const },
              ]}
              value={tossDecision}
              onChange={setTossDecision}
            />
          </CardSection>
          </>
        )}

        <CardSection icon="person-outline" title="Last Man Stand">
          <PillRow
            options={[
              { label: "Last Man Not Play (Standard)", value: "off" as const },
              { label: "Last Man Play", value: "on" as const },
            ]}
            value={lastManStand}
            onChange={setLastManStand}
          />
        </CardSection>

        <StartMatchButton valid={isValid} pending={createMatch.isPending} reason={validationReason} onPress={handleCreate} />
      </div>
    </div>
  );
}
