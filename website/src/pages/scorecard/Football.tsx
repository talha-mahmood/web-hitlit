import { linkTeamFixtureScorecard, type TeamFixturePrefill } from "@app/lib/api/teamChallenges";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useNetworkStore } from "@app/store/networkStore";
import {
  useCreateFootballMatch,
  useFootballMatch,
  useAddFootballGoal,
  useDeleteLastFootballGoal,
  useAddPenaltyKick,
  useDeleteLastPenaltyKick,
  useStartRunningPeriod,
  useEndRunningPeriod,
  usePauseFootballMatch,
  useResumeFootballMatch,
  useStartPenalties,
  useCompleteFootballMatch,
  useFootballPendingCount,
} from "@app/hooks/useFootball";
import { useLinkScorecardMatch, useSyncScorecardMatchResult } from "@app/hooks/useTournamentMatches";
import { friendlyFootballError, goalRowToEvent, penaltyKickRowToEvent, type RunningPhase } from "@app/lib/api/football";
import {
  computeElapsedSeconds,
  formatClock,
  formatGoalMinuteLabel,
  computeScoreSummary,
  computePenaltyShootoutState,
  matchResultSummary,
  phaseBoundarySeconds,
  type MatchTimestamps,
  type Phase,
  type Team,
  type GoalEvent,
} from "@app/lib/footballScoring";
import { namesClash, entryCollides, hasBlockingDuplicateNames, disambiguateRoster, type NamedEntry } from "@app/lib/matchNameValidation";
import type { ScorecardPrefill } from "@app/lib/api/tournamentMatches";
import { buildGenericMatchReportHtml } from "@app/lib/matchReport/genericMatchReport";
import { generateAndShareMatchReport } from "@app/lib/matchReport/pdfShare";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import ringUrl from "@assets/sounds/half-time-ring.wav";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { PillRow } from "@/components/forms/FormControls";
import SportNewMatchHeader from "@/components/scorecard/SportNewMatchHeader";
import AddPlayersFromGroupModal from "@/components/scorecard/AddPlayersFromGroupModal";
import { CardSection, InfoBox, NumberPresetSection, StartMatchButton, LOCKED_FIELD, DUPLICATE_PLAYERS_REASON } from "@/components/scorecard/NewMatchParts";
import { CornerAccents, OfflineScoringBanner, OutlineActionButton, ScoringCodeBadge, TeamCrest, TEAM_A_COLOR, TEAM_B_COLOR, TEAM_B_LIGHT } from "@/components/scorecard/ScorecardParts";
import { LiveLoading, RacketCompleteView, useLiveMatchChannel } from "@/components/scorecard/RacketLive";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const HOME = `${paths.scorecard}/football`;
const STANDARD_MATCH_TOTAL_MINUTES = 90;
const STANDARD_EXTRA_TIME_TOTAL_MINUTES = 30;

// Free-form team roster: type-and-add names, "Add From a Squad", removable chips.
function AddPlayersField({ players, onPlayersChange, playersLocked, otherTeamPlayers, team }: { players: NamedEntry[]; onPlayersChange: (p: NamedEntry[]) => void; playersLocked?: boolean; otherTeamPlayers: NamedEntry[]; team: "A" | "B" }) {
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
    <>
      <p className="mb-2 mt-4 text-sm font-semibold text-ink">Players</p>
      {!playersLocked && (
        <form className="flex items-center gap-2" onSubmit={(e) => (e.preventDefault(), addPlayer())}>
          <div className="min-w-0 flex-1">
            <FieldInput
              value={draft}
              onChange={(e) => (setDraft(e.target.value), setAddError(null))}
              placeholder="Add player name"
              aria-label={`Add Team ${team} player`}
              enterKeyHint="done"
              left={<span className="mr-2"><Ionicon name="person-outline" size={17} color={colors.muted} /></span>}
            />
          </div>
          <button type="submit" aria-label="Add player" disabled={!draft.trim()} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${draft.trim() ? "bg-brand" : "bg-gray-200"}`}>
            <Ionicon name="add" size={20} color="white" />
          </button>
        </form>
      )}
      {addError && <p className="mt-1.5 text-xs text-danger">{addError}</p>}
      {!playersLocked && (
        <button type="button" onClick={() => setGroupOpen(true)} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary-light/50">
          <Ionicon name="people-outline" size={16} color={colors.primaryDark} />
          Add From a Squad
        </button>
      )}
      {players.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {players.map((p, i) => (
            <span key={`${p.name}-${i}`} className="flex items-center gap-1.5 rounded-full bg-primary-light py-1.5 pl-3 pr-2 text-sm font-medium text-primary">
              {p.name}
              {!playersLocked && (
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onPlayersChange(players.filter((_, idx) => idx !== i))}>
                  <Ionicon name="close-circle" size={16} color={colors.primary} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <AddPlayersFromGroupModal
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        excludedUserIds={[...players, ...otherTeamPlayers].map((p) => p.sourceId).filter((id): id is string => !!id)}
        onAdd={(picked) => onPlayersChange([...players, ...picked.map((p) => ({ name: p.name, sourceId: p.userId }))])}
      />
    </>
  );
}

// Port of FootballNewMatchScreen.
export function FootballNewMatchPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(HOME);
  const navState = useLocation().state as { prefill?: ScorecardPrefill; teamFixture?: TeamFixturePrefill } | null;
  const prefill = navState?.prefill;
  const teamFixture = navState?.teamFixture;
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateFootballMatch();
  const linkScorecardMatch = useLinkScorecardMatch(prefill?.gameId ?? "");

  const [teamAName, setTeamAName] = useState(prefill?.teamAName ?? teamFixture?.teamAName ?? "");
  const [teamBName, setTeamBName] = useState(prefill?.teamBName ?? teamFixture?.teamBName ?? "");
  const [teamAPlayers, setTeamAPlayers] = useState<NamedEntry[]>((prefill?.teamAPlayers ?? []).map((p) => ({ name: p.name, sourceId: p.userId })));
  const [teamBPlayers, setTeamBPlayers] = useState<NamedEntry[]>((prefill?.teamBPlayers ?? []).map((p) => ({ name: p.name, sourceId: p.userId })));
  const [requiresWinner, setRequiresWinner] = useState<"NO" | "YES" | null>("NO");
  const [totalMatchMinutes, setTotalMatchMinutes] = useState<string | null>(String(STANDARD_MATCH_TOTAL_MINUTES));
  const [totalExtraTimeMinutes, setTotalExtraTimeMinutes] = useState<string | null>(String(STANDARD_EXTRA_TIME_TOTAL_MINUTES));
  const [venue, setVenue] = useState(prefill?.venue ?? teamFixture?.venue ?? "");

  const totalMatchNumber = parseInt(totalMatchMinutes ?? "", 10);
  const isMatchDurationValid = !!totalMatchMinutes && totalMatchNumber > 0;
  const halfDurationMinutes = isMatchDurationValid ? Math.max(1, Math.round(totalMatchNumber / 2)) : 0;
  const actualTotalMatchMinutes = halfDurationMinutes * 2;
  const needsExtraTime = requiresWinner === "YES";
  const totalExtraTimeNumber = parseInt(totalExtraTimeMinutes ?? "", 10);
  const isExtraTimeDurationValid = !needsExtraTime || (!!totalExtraTimeMinutes && totalExtraTimeNumber > 0);
  const extraTimePeriodMinutes = needsExtraTime && isExtraTimeDurationValid ? Math.max(1, Math.round(totalExtraTimeNumber / 2)) : 0;
  const actualTotalExtraTimeMinutes = extraTimePeriodMinutes * 2;
  const clash = namesClash(teamAName, teamBName);

  const validationReason =
    (!teamAName.trim() ? "Enter a name for Team A." : null) ??
    (!teamBName.trim() ? "Enter a name for Team B." : null) ??
    (clash ? "Team A and Team B can't have the same name." : null) ??
    (hasBlockingDuplicateNames([...teamAPlayers, ...teamBPlayers]) ? DUPLICATE_PLAYERS_REASON : null) ??
    (!requiresWinner ? "Pick whether the match requires a winner." : null) ??
    (!isMatchDurationValid ? "Set the match duration." : null) ??
    (!isExtraTimeDurationValid ? "Set the extra time duration." : null);
  const isValid = !validationReason;

  const handleCreate = () => {
    if (!isValid || !userId || !requiresWinner) return;
    const { teamANames, teamBNames } = disambiguateRoster(teamAPlayers, teamBPlayers);
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers: teamANames,
        teamBPlayers: teamBNames,
        requiresWinner: needsExtraTime,
        halfDurationMinutes,
        extraTimePeriodMinutes: needsExtraTime ? extraTimePeriodMinutes : 15,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: async ({ matchId }) => {
          try {
            if (prefill) await linkScorecardMatch.mutateAsync({ matchId: prefill.tournamentMatchId, sport: "football", scorecardMatchId: matchId });
            if (teamFixture) await linkTeamFixtureScorecard(teamFixture.fixtureId, matchId, "football_matches");
          } catch (e) {
            Alert.alert("Match created", e instanceof Error ? e.message : "The scorecard was created but could not be linked to its fixture.");
          }
          navigate(paths.match("football", matchId), { replace: true });
        },
        onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not create match.")),
      }
    );
  };

  const teamSection = (team: "A" | "B") => {
    const isA = team === "A";
    return (
      <CardSection icon="shirt-outline" title={`Team ${team}`}>
        <FieldInput
          value={isA ? teamAName : teamBName}
          onChange={(e) => (isA ? setTeamAName : setTeamBName)(e.target.value)}
          placeholder={isA ? "e.g. Strikers FC" : "e.g. United FC"}
          maxLength={40}
          disabled={!!prefill}
          aria-label={`Team ${team} name`}
          containerClassName={prefill ? LOCKED_FIELD : ""}
        />
        {clash && <p className="mt-1.5 text-xs text-danger">Team A and Team B can't have the same name.</p>}
        <AddPlayersField team={team} players={isA ? teamAPlayers : teamBPlayers} onPlayersChange={isA ? setTeamAPlayers : setTeamBPlayers} playersLocked={!!prefill} otherTeamPlayers={isA ? teamBPlayers : teamAPlayers} />
      </CardSection>
    );
  };

  return (
    <div className="mx-auto max-w-3xl pb-16 lg:px-8">
      <SportNewMatchHeader sport="football" title="New Match" subtitle="Set up your match details" onBack={goBack} />
      <div className="px-5 pt-1 lg:px-0">
        {prefill && (
          <div className="mb-4">
            <InfoBox text="Team names and venue come from the tournament match and can't be changed here — everything else is up to you." />
          </div>
        )}
        <div className="md:grid md:grid-cols-2 md:gap-4">
          {teamSection("A")}
          {teamSection("B")}
        </div>

        <CardSection icon="location-outline" title="Venue">
          <FieldInput value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. City Stadium" maxLength={60} disabled={!!prefill} aria-label="Venue" containerClassName={prefill ? LOCKED_FIELD : ""} />
        </CardSection>

        <NumberPresetSection
          icon="time-outline"
          title="Match Duration"
          presets={["20", "30", "40", "60", "90"].map((n) => ({ label: n === "90" ? "90 (Standard)" : n, value: n }))}
          value={totalMatchMinutes}
          onChange={setTotalMatchMinutes}
          customLabel="Or enter a custom total (minutes)"
          placeholder="e.g. 10"
          maxDigits={3}
          info={
            isMatchDurationValid
              ? `Split into two ${halfDurationMinutes}-minute halves${actualTotalMatchMinutes !== totalMatchNumber ? ` (${actualTotalMatchMinutes} min total)` : ""}.`
              : "Enter how many minutes the whole match should run — it's split evenly into two halves."
          }
        />

        <CardSection icon="trophy-outline" title="Needs a Winner?">
          <PillRow
            options={[
              { label: "No — a draw can stand", value: "NO" as const },
              { label: "Yes — extra time & penalties", value: "YES" as const },
            ]}
            value={requiresWinner}
            onChange={setRequiresWinner}
          />
          <InfoBox
            text={
              needsExtraTime
                ? `If the match is level after ${isMatchDurationValid ? actualTotalMatchMinutes : STANDARD_MATCH_TOTAL_MINUTES} minutes, you'll be offered extra time, then a penalty shootout if it's still level.`
                : `A draw after ${isMatchDurationValid ? actualTotalMatchMinutes : STANDARD_MATCH_TOTAL_MINUTES} minutes ends the match — no extra time or shootout will be offered.`
            }
          />
        </CardSection>

        {needsExtraTime && (
          <NumberPresetSection
            icon="timer-outline"
            title="Extra Time Duration"
            presets={["10", "20", "30"].map((n) => ({ label: n === "30" ? "30 (Standard)" : n, value: n }))}
            value={totalExtraTimeMinutes}
            onChange={setTotalExtraTimeMinutes}
            customLabel="Or enter a custom total (minutes)"
            placeholder="e.g. 10"
            maxDigits={3}
            info={
              isExtraTimeDurationValid && extraTimePeriodMinutes > 0
                ? `Split into two ${extraTimePeriodMinutes}-minute periods${actualTotalExtraTimeMinutes !== totalExtraTimeNumber ? ` (${actualTotalExtraTimeMinutes} min total)` : ""} if the match needs a decider.`
                : "Enter the total extra-time length — it's split evenly into two periods, separate from the regular match duration."
            }
          />
        )}

        <StartMatchButton valid={isValid} pending={createMatch.isPending} reason={validationReason} onPress={handleCreate} label="Kick Off" />
      </div>
    </div>
  );
}

const RUNNING_PHASES: Phase[] = ["FIRST_HALF", "SECOND_HALF", "EXTRA_TIME_FIRST", "EXTRA_TIME_SECOND"];
const PHASE_LABEL: Partial<Record<Phase, string>> = {
  FIRST_HALF: "1ST HALF",
  HALF_TIME: "HALF-TIME",
  SECOND_HALF: "2ND HALF",
  FULL_TIME: "FULL-TIME",
  EXTRA_TIME_FIRST: "EXTRA TIME — 1ST HALF",
  EXTRA_TIME_BREAK: "EXTRA TIME BREAK",
  EXTRA_TIME_SECOND: "EXTRA TIME — 2ND HALF",
  EXTRA_TIME_FULL_TIME: "EXTRA TIME — FULL-TIME",
  PENALTIES: "PENALTY SHOOTOUT",
};
const AFTER_HALF_TIME: Phase[] = ["SECOND_HALF", "FULL_TIME", "EXTRA_TIME_FIRST", "EXTRA_TIME_BREAK", "EXTRA_TIME_SECOND", "EXTRA_TIME_FULL_TIME", "PENALTIES"];

function GoalHistoryCard({ goals, teamAName, teamBName }: { goals: GoalEvent[]; teamAName: string; teamBName: string }) {
  if (goals.length === 0) return null;
  return (
    <div className="mb-4 rounded-2xl bg-surface p-4 shadow-card">
      <div className="mb-1 flex items-center gap-2 border-b border-border pb-3">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary-light">
          <Ionicon name="football" size={14} color={colors.primaryDark} />
        </span>
        <p className="text-sm font-extrabold tracking-[0.5px] text-ink">GOAL HISTORY</p>
      </div>
      <div className={goals.length > 4 ? "max-h-[248px] overflow-y-auto" : ""}>
        {goals.map((g, i) => {
          const color = g.team === "A" ? TEAM_A_COLOR : TEAM_B_COLOR;
          return (
            <div key={g.seq} className="flex items-start py-2">
              <span className="mt-2 w-11 text-xs font-semibold text-muted">{g.minuteLabel}</span>
              <span className="mt-2 flex w-3 flex-col items-center">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {i < goals.length - 1 && <span className="mt-1 h-[26px] w-px bg-border" />}
              </span>
              <span className="ml-2 flex h-[30px] w-[30px] items-center justify-center rounded-full" style={{ backgroundColor: g.team === "A" ? colors.primaryLight : TEAM_B_LIGHT }}>
                <Ionicon name="football" size={14} color={color} />
              </span>
              <span className="ml-2 min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{g.team === "A" ? teamAName : teamBName}</span>
                <span className="block truncate text-xs text-muted">{g.scorerName || "Goal"}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionButton({ onPress, disabled, from, to, icon, label, sub, watermark, shadow = true }: { onPress: () => void; disabled?: boolean; from: string; to: string; icon: string; label: string; sub?: string; watermark: string; shadow?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`press relative flex w-full items-center overflow-hidden rounded-2xl px-3.5 py-3.5 text-left ${shadow ? "shadow-cta" : ""}`}
      style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/25">
        <Ionicon name={icon} size={17} color="white" />
      </span>
      <span className="mx-3.5 h-[26px] w-px bg-white/35" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold text-white">{label}</span>
        {sub && <span className="mt-0.5 block text-xs text-white/85">{sub}</span>}
      </span>
      <span className="pointer-events-none absolute right-4 opacity-20">
        <Ionicon name={watermark} size={40} color="white" />
      </span>
    </button>
  );
}

function PrimaryBlock({ onPress, pending, label }: { onPress: () => void; pending: boolean; label: string }) {
  return (
    <button type="button" onClick={onPress} disabled={pending} className="press flex w-full items-center justify-center rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-cta">
      {pending ? <Spinner size={20} color="white" /> : label}
    </button>
  );
}

// Port of FootballLiveScoringScreen: live clock per half (stop/start time),
// goals with an optional scorer, an alarm once a half reaches its scheduled
// length, half-time → second half → full-time → extra time → penalties, and
// the final summary with a match report.
export function FootballLivePage() {
  const { matchId = "" } = useParams();
  const back = useGoBack(HOME);
  const { data: match, isLoading } = useFootballMatch(matchId);
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  useLiveMatchChannel(matchId, "football_matches", "football_goals", "footballMatch");
  useLiveMatchChannel(matchId, "football_matches", "football_penalty_kicks", "footballMatch");
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingCount = useFootballPendingCount(matchId);
  const addGoal = useAddFootballGoal(matchId);
  const deleteLastGoal = useDeleteLastFootballGoal(matchId);
  const addPenaltyKick = useAddPenaltyKick(matchId);
  const deleteLastPenaltyKick = useDeleteLastPenaltyKick(matchId);
  const startRunningPeriod = useStartRunningPeriod(matchId);
  const endRunningPeriod = useEndRunningPeriod(matchId);
  const pauseMatch = usePauseFootballMatch(matchId);
  const resumeMatch = useResumeFootballMatch(matchId);
  const startPenalties = useStartPenalties(matchId);
  const completeMatch = useCompleteFootballMatch(matchId);
  const syncTournamentResult = useSyncScorecardMatchResult();
  const profile = useProfileStore((s) => s.profile);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [goalPickerTeam, setGoalPickerTeam] = useState<Team | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ringingPhase, setRingingPhase] = useState<Phase | null>(null);

  // End-of-half alarm (loops until the scorer ends the period).
  const ring = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(ringUrl);
    audio.loop = true;
    ring.current = audio;
    return () => audio.pause();
  }, []);

  const phase = (match?.phase ?? "NOT_STARTED") as Phase;
  const isRunning = RUNNING_PHASES.includes(phase);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const timestamps: MatchTimestamps | null = match
    ? {
        firstHalfKickoffAt: match.first_half_kickoff_at,
        firstHalfAddedMinutes: match.first_half_added_minutes,
        secondHalfKickoffAt: match.second_half_kickoff_at,
        secondHalfAddedMinutes: match.second_half_added_minutes,
        extraTimeFirstKickoffAt: match.extra_time_first_kickoff_at,
        extraTimeFirstAddedMinutes: match.extra_time_first_added_minutes,
        extraTimeSecondKickoffAt: match.extra_time_second_kickoff_at,
        extraTimeSecondAddedMinutes: match.extra_time_second_added_minutes,
      }
    : null;
  const matchConfig = { halfDurationMinutes: match?.half_duration_minutes ?? 45, extraTimePeriodMinutes: match?.extra_time_period_minutes ?? 15 };
  const pausedAtMs = match?.paused_at ? new Date(match.paused_at).getTime() : null;
  const isPaused = pausedAtMs !== null;
  const elapsedSeconds = timestamps ? computeElapsedSeconds(phase, timestamps, matchConfig, pausedAtMs ?? now) : 0;
  const clock = formatClock(elapsedSeconds);
  const boundarySeconds = phaseBoundarySeconds(phase, matchConfig);
  const hasReachedScheduledEnd = isRunning && boundarySeconds !== undefined && elapsedSeconds >= boundarySeconds;
  const isRinging = ringingPhase === phase;

  useEffect(() => {
    if (!hasReachedScheduledEnd || ringingPhase === phase) return;
    setRingingPhase(phase);
    // The alarm is for whoever is running the clock; autoplay may be blocked
    // until they've interacted with the page — the red End button still shows.
    if (isScorer) ring.current?.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasReachedScheduledEnd, phase]);

  const goals = useMemo(() => (match ? [...match.football_goals].sort((a, b) => a.seq - b.seq).map(goalRowToEvent) : []), [match]);
  const penaltyKicks = useMemo(() => (match ? [...match.football_penalty_kicks].sort((a, b) => a.seq - b.seq).map(penaltyKickRowToEvent) : []), [match]);
  const wentToExtraTime = !!match?.extra_time_first_kickoff_at;
  const scoreSummary = useMemo(() => computeScoreSummary(goals, phase, wentToExtraTime), [goals, phase, wentToExtraTime]);
  const shootout = phase === "PENALTIES" || phase === "COMPLETE" ? computePenaltyShootoutState(penaltyKicks) : null;

  useEffect(() => {
    if (!match || phase !== "PENALTIES" || !shootout?.isDecided || match.status !== "IN_PROGRESS" || completeMatch.isPending) return;
    const summary = matchResultSummary(match.team_a_name, match.team_b_name, scoreSummary, shootout);
    completeMatch.mutate(
      { winnerTeam: shootout.winner, isDraw: false, resultSummary: summary },
      {
        onSuccess: () => syncTournamentResult.mutate({ sport: "football", scorecardMatchId: matchId, teamAWon: shootout.winner === "A" }),
        onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not save the match result.")),
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shootout?.isDecided, match?.status]);

  if (isLoading || !match || !timestamps) return <LiveLoading />;

  const err = (fallback: string) => (e: unknown) => Alert.alert("Error", friendlyFootballError(e, fallback));

  const endCurrentPeriod = () => {
    const next: Partial<Record<Phase, { resultingPhase: Phase; msg: string }>> = {
      FIRST_HALF: { resultingPhase: "HALF_TIME", msg: "Could not end the half." },
      SECOND_HALF: { resultingPhase: "FULL_TIME", msg: "Could not end the half." },
      EXTRA_TIME_FIRST: { resultingPhase: "EXTRA_TIME_BREAK", msg: "Could not end the period." },
      EXTRA_TIME_SECOND: { resultingPhase: "EXTRA_TIME_FULL_TIME", msg: "Could not end the period." },
    };
    const step = next[phase];
    if (!step) return;
    endRunningPeriod.mutate({ endingPhase: phase as RunningPhase, addedMinutes: 0, resultingPhase: step.resultingPhase } as Parameters<typeof endRunningPeriod.mutate>[0], { onError: err(step.msg) });
  };

  const handleEndPeriodPress = () => {
    ring.current?.pause();
    endCurrentPeriod();
  };

  const handleToggleClock = () => {
    if (isPaused && pausedAtMs !== null) {
      const kickoffAt =
        phase === "FIRST_HALF"
          ? match.first_half_kickoff_at
          : phase === "SECOND_HALF"
            ? match.second_half_kickoff_at
            : phase === "EXTRA_TIME_FIRST"
              ? match.extra_time_first_kickoff_at
              : phase === "EXTRA_TIME_SECOND"
                ? match.extra_time_second_kickoff_at
                : null;
      if (!kickoffAt) return;
      const newKickoffAt = new Date(new Date(kickoffAt).getTime() + (Date.now() - pausedAtMs)).toISOString();
      resumeMatch.mutate({ phase: phase as RunningPhase, newKickoffAt }, { onError: err("Could not start the clock.") });
    } else {
      pauseMatch.mutate(undefined, { onError: err("Could not stop the clock.") });
    }
  };

  const handleGoal = (team: Team, scorerName?: string | null) => {
    if (!isRunning || isPaused || isRinging) return;
    addGoal.mutate({ seq: goals.length + 1, team, phase, minuteLabel: formatGoalMinuteLabel(elapsedSeconds), scorerName }, { onError: err("Could not record goal.") });
  };
  const handleGoalTap = (team: Team) => {
    if (!isRunning || isPaused || isRinging) return;
    const players = team === "A" ? match.team_a_players : match.team_b_players;
    if (players.length > 0) setGoalPickerTeam(team);
    else handleGoal(team, null);
  };

  const handleUndo = () => {
    if (phase === "PENALTIES" && penaltyKicks.length > 0) {
      const last = penaltyKicks[penaltyKicks.length - 1];
      Alert.alert("Undo Last Kick", "Remove the most recent penalty kick?", [
        { text: "Cancel", style: "cancel" },
        { text: "Undo", style: "destructive", onPress: () => deleteLastPenaltyKick.mutate(last.seq, { onError: err("Could not undo.") }) },
      ]);
      return;
    }
    if (goals.length === 0) return;
    const last = goals[goals.length - 1];
    Alert.alert("Undo Last Goal", "Remove the most recent goal?", [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => deleteLastGoal.mutate(last.seq, { onError: err("Could not undo.") }) },
    ]);
  };

  const handleFinishAsIs = () => {
    const { a, b } = scoreSummary.current;
    const isDraw = a === b;
    const winnerTeam = isDraw ? null : a > b ? "A" : "B";
    const summary = matchResultSummary(match.team_a_name, match.team_b_name, scoreSummary, null);
    completeMatch.mutate(
      { winnerTeam, isDraw, resultSummary: summary },
      {
        onSuccess: () => syncTournamentResult.mutate({ sport: "football", scorecardMatchId: matchId, teamAWon: isDraw ? null : winnerTeam === "A" }),
        onError: err("Could not finish the match."),
      }
    );
  };

  const handlePenaltyKick = (team: Team, scored: boolean) => addPenaltyKick.mutate({ seq: penaltyKicks.length + 1, team, scored }, { onError: err("Could not record the kick.") });

  if (match.status === "COMPLETED") {
    const periodRows = [
      { label: "HALF-TIME", a: scoreSummary.halfTime.a, b: scoreSummary.halfTime.b },
      { label: "FULL-TIME", a: scoreSummary.fullTime.a, b: scoreSummary.fullTime.b },
      ...(scoreSummary.afterExtraTime ? [{ label: "EXTRA TIME", a: scoreSummary.afterExtraTime.a, b: scoreSummary.afterExtraTime.b }] : []),
      ...(shootout ? [{ label: "PENALTIES", a: shootout.scoreA, b: shootout.scoreB }] : []),
    ];
    const handleReport = async () => {
      setGeneratingReport(true);
      try {
        const html = buildGenericMatchReportHtml({
          sportLabel: "Football",
          teamAName: match.team_a_name,
          teamBName: match.team_b_name,
          finalScoreA: `${scoreSummary.current.a} goals`,
          finalScoreB: `${scoreSummary.current.b} goals`,
          resultSummary: match.result_summary,
          venue: match.venue,
          createdAt: match.created_at,
          formatLabel: `${match.half_duration_minutes}-min halves`,
          organiserName: profile?.full_name ?? "—",
          breakdownTitle: "Period-by-Period",
          breakdown: periodRows.map((row) => ({ label: row.label, scoreA: String(row.a), scoreB: String(row.b) })),
          eventsTitle: "Goal History",
          events: goals.map((g) => ({ time: g.minuteLabel, team: g.team, label: g.scorerName ? `Goal — ${g.scorerName}` : "Goal" })),
          appName: "HitLit",
        });
        await generateAndShareMatchReport(html);
      } catch (e) {
        Alert.alert("Error", getFriendlyErrorMessage(e, "Could not generate the match report."));
      } finally {
        setGeneratingReport(false);
      }
    };
    return (
      <RacketCompleteView
        sportLabel="Football"
        crestIcon="soccer"
        aName={match.team_a_name}
        bName={match.team_b_name}
        winner={match.winner_team === "A" ? "A" : match.winner_team === "B" ? "B" : null}
        wonA={scoreSummary.current.a}
        wonB={scoreSummary.current.b}
        tallyLabel="FULL-TIME"
        breakdown={periodRows.map((r) => ({ label: r.label, score: `${r.a} - ${r.b}` }))}
        extra={<GoalHistoryCard goals={goals} teamAName={match.team_a_name} teamBName={match.team_b_name} />}
        onBack={back}
        onReport={handleReport}
        generatingReport={generatingReport}
      />
    );
  }

  const goalBlocked = addGoal.isPending || isPaused || isRinging;
  const nextKickTeam: Team = penaltyKicks.length % 2 === 0 ? "A" : "B";
  const pickerPlayers = goalPickerTeam === "A" ? match.team_a_players : goalPickerTeam === "B" ? match.team_b_players : [];

  const controls = (
    <>
      {isRunning && (
        <>
          <div className={`flex flex-col gap-2.5 ${goalBlocked ? "pointer-events-none" : ""} ${isPaused || isRinging ? "opacity-50" : ""}`}>
            <ActionButton onPress={() => handleGoalTap("A")} from={colors.primary} to={colors.primaryDark} icon="football" label={`${match.team_a_name} Goal`} watermark="football-outline" shadow={!goalBlocked} />
            <ActionButton onPress={() => handleGoalTap("B")} from="#2563EB" to={TEAM_B_COLOR} icon="football" label={`${match.team_b_name} Goal`} watermark="football-outline" shadow={!goalBlocked} />
          </div>
          <div className="mt-3">
            {isRinging ? (
              <ActionButton
                onPress={handleEndPeriodPress}
                disabled={endRunningPeriod.isPending}
                from={colors.danger}
                to="#B91C1C"
                icon="notifications-off"
                label={phase === "FIRST_HALF" ? "End First Half" : phase === "SECOND_HALF" ? "End Second Half" : phase === "EXTRA_TIME_FIRST" ? "End Extra Time (1st Half)" : "End Extra Time (2nd Half)"}
                sub="Tap to stop the alarm"
                watermark="notifications"
                shadow={false}
              />
            ) : (
              <ActionButton
                onPress={handleToggleClock}
                disabled={pauseMatch.isPending || resumeMatch.isPending}
                from={isPaused ? colors.primary : "#F59E0B"}
                to={isPaused ? colors.primaryDark : "#D97706"}
                icon={isPaused ? "play" : "pause"}
                label={isPaused ? "Start Time" : "Stop Time"}
                watermark="stopwatch-outline"
                shadow={false}
              />
            )}
          </div>
          <OutlineActionButton
            onPress={handleUndo}
            disabled={goals.length === 0 || deleteLastGoal.isPending || isPaused || isRinging}
            icon="refresh"
            label="Undo Last Goal"
            tint={colors.primaryDark}
            className="mt-2"
            style={{ borderColor: colors.primary, opacity: goals.length === 0 || isPaused || isRinging ? 0.5 : 1 }}
          />
        </>
      )}
      {phase === "HALF_TIME" && <PrimaryBlock onPress={() => startRunningPeriod.mutate("SECOND_HALF", { onError: err("Could not start the second half.") })} pending={startRunningPeriod.isPending} label="Start Second Half" />}
      {phase === "FULL_TIME" &&
        (scoreSummary.current.a === scoreSummary.current.b && match.requires_winner ? (
          <PrimaryBlock onPress={() => startRunningPeriod.mutate("EXTRA_TIME_FIRST", { onError: err("Could not start extra time.") })} pending={startRunningPeriod.isPending} label="Start Extra Time" />
        ) : (
          <PrimaryBlock onPress={handleFinishAsIs} pending={completeMatch.isPending} label="Finish Match" />
        ))}
      {phase === "EXTRA_TIME_BREAK" && <PrimaryBlock onPress={() => startRunningPeriod.mutate("EXTRA_TIME_SECOND", { onError: err("Could not start extra time.") })} pending={startRunningPeriod.isPending} label="Start Extra Time (2nd Half)" />}
      {phase === "EXTRA_TIME_FULL_TIME" &&
        (scoreSummary.current.a === scoreSummary.current.b ? (
          <PrimaryBlock onPress={() => startPenalties.mutate(undefined, { onError: err("Could not start the shootout.") })} pending={startPenalties.isPending} label="Start Penalty Shootout" />
        ) : (
          <PrimaryBlock onPress={handleFinishAsIs} pending={completeMatch.isPending} label="Finish Match" />
        ))}
      {phase === "PENALTIES" && (
        <>
          <div className={`flex flex-col gap-2 ${addPenaltyKick.isPending ? "pointer-events-none" : ""}`}>
            <p className="text-center text-sm font-semibold text-ink">Next kick: {nextKickTeam === "A" ? match.team_a_name : match.team_b_name}</p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => handlePenaltyKick(nextKickTeam, true)} className={`press flex-1 rounded-2xl bg-brand py-4 text-sm font-bold text-white ${addPenaltyKick.isPending ? "" : "shadow-cta"}`}>
                Scored
              </button>
              <button type="button" onClick={() => handlePenaltyKick(nextKickTeam, false)} className={`press flex-1 rounded-2xl bg-danger py-4 text-sm font-bold text-white ${addPenaltyKick.isPending ? "" : "shadow-cta"}`}>
                Missed
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            disabled={penaltyKicks.length === 0 || deleteLastPenaltyKick.isPending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-muted hover:bg-gray-50"
            style={{ opacity: penaltyKicks.length === 0 ? 0.5 : 1 }}
          >
            <Ionicon name="arrow-undo-outline" size={16} color={colors.muted} />
            Undo Last Kick
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl pb-10 lg:px-8">
      <header className="sticky top-[var(--header-h)] z-20 flex items-center gap-2 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+16px)] backdrop-blur lg:px-0 lg:pt-6">
        <button type="button" onClick={back} aria-label="Back" className="rounded-full p-1 hover:bg-gray-100">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <span className="inline-flex shrink-0 items-center gap-[5px] rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-surface" />
          LIVE
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold text-ink">
            {match.team_a_name} vs {match.team_b_name}
          </h1>
          <p className="mt-0.5 text-xs text-muted">Football</p>
        </div>
        <ScoringCodeBadge code={match.scoring_code} />
      </header>

      <div className="px-5 pt-1 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:px-0">
        <div>
          <OfflineScoringBanner isOnline={isOnline} pendingCount={pendingCount} unit="event" idleText="Offline — goals are saved on this device and will sync when back online" />

          <div className="relative mb-4 overflow-hidden rounded-2xl bg-surface shadow-card">
            <CornerAccents size={56} />
            <div className="relative flex flex-col items-center p-5">
              <div className="flex w-full items-center justify-between">
                <div className="flex w-[92px] flex-col items-center">
                  <TeamCrest color={TEAM_A_COLOR} />
                  <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{match.team_a_name}</p>
                </div>
                <div className="flex flex-1 flex-col items-center">
                  <div className="flex items-center gap-4">
                    <span className="text-[42px] font-extrabold leading-none text-ink">{scoreSummary.current.a}</span>
                    <span className="text-[22px] font-bold text-muted">-</span>
                    <span className="text-[42px] font-extrabold leading-none text-ink">{scoreSummary.current.b}</span>
                  </div>
                  {isRunning && <span className="mt-2 rounded-full bg-surface px-3 py-1.5 text-[15px] font-extrabold tabular-nums text-ink shadow-card" aria-label="Match clock">{clock}</span>}
                  <span className="mt-2 rounded-full bg-primary-light px-3 py-1 text-xs font-extrabold text-primary-dark">{PHASE_LABEL[phase] ?? phase}</span>
                </div>
                <div className="flex w-[92px] flex-col items-center">
                  <TeamCrest color={TEAM_B_COLOR} />
                  <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{match.team_b_name}</p>
                </div>
              </div>
              <span className="mt-5 h-px w-full bg-white/70" />
              <span className="absolute -bottom-2 right-3.5 opacity-90">
                <Ionicon name="football" size={28} color={colors.ink} />
              </span>
            </div>
          </div>

          {AFTER_HALF_TIME.includes(phase) && (
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
              <span className="text-xs font-semibold text-muted">HALF-TIME</span>
              <span className="text-sm font-bold text-ink">
                {scoreSummary.halfTime.a} - {scoreSummary.halfTime.b}
              </span>
            </div>
          )}
          {phase === "PENALTIES" && (
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
              <span className="text-xs font-semibold text-muted">PENALTY SHOOTOUT</span>
              <span className="text-sm font-bold text-ink">
                {shootout?.scoreA ?? 0} - {shootout?.scoreB ?? 0}
              </span>
            </div>
          )}
          {phase !== "PENALTIES" && <GoalHistoryCard goals={goals} teamAName={match.team_a_name} teamBName={match.team_b_name} />}
          {phase === "PENALTIES" && penaltyKicks.length > 0 && (
            <div className="mb-4 rounded-2xl bg-surface p-4 shadow-card">
              <p className="mb-2 text-xs font-semibold text-muted">KICKS</p>
              {penaltyKicks.map((k) => (
                <div key={k.seq} className="mt-1 flex items-center justify-between">
                  <span className="text-sm text-ink">{k.team === "A" ? match.team_a_name : match.team_b_name}</span>
                  <Ionicon name={k.scored ? "checkmark-circle" : "close-circle"} size={18} color={k.scored ? colors.primary : colors.danger} />
                </div>
              ))}
            </div>
          )}
        </div>

        {isScorer && <aside className="mt-1 lg:sticky lg:top-[calc(var(--header-h)+96px)] lg:mt-0 lg:self-start">{controls}</aside>}
      </div>

      <Modal open={!!goalPickerTeam} onClose={() => setGoalPickerTeam(null)} title="Select a Player" subtitle={`Who scored for ${goalPickerTeam === "A" ? match.team_a_name : match.team_b_name}?`}>
        {pickerPlayers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No players added for this team.</p>
        ) : (
          pickerPlayers.map((name, i) => (
            <button
              key={`${name}-${i}`}
              type="button"
              onClick={() => {
                if (!goalPickerTeam) return;
                handleGoal(goalPickerTeam, name);
                setGoalPickerTeam(null);
              }}
              className="mb-2 flex w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3 text-left hover:border-primary/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-muted">{name.charAt(0).toUpperCase()}</span>
              <span className="flex-1 truncate text-sm font-semibold text-ink">{name}</span>
              <Ionicon name="chevron-forward" size={16} color={colors.muted} />
            </button>
          ))
        )}
      </Modal>
    </div>
  );
}
