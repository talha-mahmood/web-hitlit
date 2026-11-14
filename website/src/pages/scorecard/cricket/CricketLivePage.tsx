import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { colors } from "@app/constants/theme";
import {
  useCricketMatch,
  useAddCricketBall,
  useDeleteLastCricketBall,
  useStartSecondInnings,
  useMarkInningsComplete,
  useCompleteCricketMatch,
  useCricketPendingCount,
  useAbandonCricketMatch,
  useAddRosterPlayer,
  useUpdateCricketMatchSettings,
} from "@app/hooks/useCricket";
import { useNetworkStore } from "@app/store/networkStore";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useSyncCricketMatchResult } from "@app/hooks/useTournamentMatches";
import { ballRowToEvent, friendlyCricketError } from "@app/lib/api/cricket";
import { replayInnings, formatOvers, computeRunRate, computeRequiredRunRate, matchResultSummary, groupBallsByOver, type BallEvent, type ExtraType, type WicketType, type InningsState } from "@app/lib/cricketScoring";
import { computePlayerOfTheMatch } from "@app/lib/cricketCommentary";
import { resourcePercent, computeDuckworthLewis } from "@app/lib/duckworthLewis";
import { buildCricketMatchReportHtml } from "@app/lib/matchReport/cricketReport";
import { generateAndShareMatchReport } from "@app/lib/matchReport/pdfShare";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { supabase } from "@app/lib/supabase";
import { uniqueChannelName } from "@app/lib/realtimeChannel";
import { Alert } from "@/lib/alert";
import { downloadBlob } from "@/lib/download";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import { CornerAccents, OfflineScoringBanner, ScoringCodeBadge, TeamCrest, TEAM_A_COLOR, TEAM_B_COLOR } from "@/components/scorecard/ScorecardParts";
import { LiveLoading } from "@/components/scorecard/RacketLive";
import { ballLabel, BallsTab, InfoTab, InningsCard, PlayerInitialAvatar, SegmentedPill, SummaryTab } from "@/components/cricket/CricketTabs";
import { ConfirmDialog, KeypadCell, KeypadRow, RunOutPanel, SelectPlayerPanel, type RunOutResult } from "@/components/cricket/CricketPanels";
import MatchSummaryShareCard, { type ShareCardInningsEntry } from "@/components/cricket/MatchSummaryShareCard";
import { useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const RUN_OPTIONS = [1, 2, 3, 4, 6];
const DOT_BALL = 0;
const WIDE_OPTIONS = [0, 1, 2, 3, 4, 5, 6];
const NOBALL_BAT_OPTIONS = [0, 1, 2, 3, 4, 6];
const BYE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const LEGBYE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const MORE_RUNS_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const BONUS_RUNS_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
const PENALTY_RUNS = 5;
const ABANDON_WAIT_SECONDS = 4;
const WICKET_TYPES: { label: string; value: WicketType }[] = [
  { label: "Bowled", value: "BOWLED" },
  { label: "Caught", value: "CAUGHT" },
  { label: "Stumped", value: "STUMPED" },
  { label: "LBW", value: "LBW" },
  { label: "Run Out", value: "RUN_OUT" },
  { label: "Mankad", value: "MANKAD" },
  { label: "Retired", value: "RETIRED_OUT" },
  { label: "Over The Fence", value: "OVER_THE_FENCE" },
  { label: "One Hand One Bounce", value: "ONE_HAND_ONE_BOUNCE" },
  { label: "Obstructing The Field", value: "OBSTRUCTING_THE_FIELD" },
  { label: "Hit Wicket", value: "HIT_WICKET" },
  { label: "Hit The Ball Twice", value: "HIT_THE_BALL_TWICE" },
  { label: "Timed Out", value: "TIMED_OUT" },
];

type TabKey = "scoring" | "scorecard" | "stats" | "superstars" | "summary" | "balls" | "info";
const LIVE_TABS: { key: TabKey; label: string }[] = [
  { key: "scoring", label: "Scoring" },
  { key: "scorecard", label: "Scorecard" },
  { key: "stats", label: "Stats" },
  { key: "superstars", label: "Super Stars" },
];
const COMPLETED_TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "scorecard", label: "Scorecard" },
  { key: "stats", label: "Stats" },
  { key: "superstars", label: "Super Stars" },
  { key: "balls", label: "Balls" },
  { key: "info", label: "Info" },
];
type Panel = ExtraType | "WICKET" | "MORE_RUNS" | "BONUS_RUNS" | "MORE_MENU" | "RETIRED_HURT" | "PENALTY_TEAM" | "CHANGE_TARGET" | null;
type Dialog = "ABANDON" | "END_INNINGS" | "TARGET_BLOCKED" | "RAIN_DL" | "RAIN_DL_CHASE" | null;

// Outlined choice button on the green keypad sheet.
function SheetChip({ onPress, children, className = "px-4 py-3", active }: { onPress: () => void; children: ReactNode; className?: string; active?: boolean }) {
  return (
    <button type="button" onClick={onPress} className={`rounded-xl border-[1.5px] border-white/60 text-sm font-bold text-white transition hover:bg-white/10 ${active ? "!bg-[#111827]" : ""} ${className}`}>
      {children}
    </button>
  );
}

// Port of LiveScoringScreen (the cricket Match Centre): ball-by-ball
// scoring keypad with every extra / dismissal / More-menu action for the
// match's own scorer, and Scorecard / Stats / Super Stars (live) or
// Summary / Scorecard / Stats / Super Stars / Balls / Info (completed) for
// everyone.
export default function CricketLivePage() {
  const { matchId = "" } = useParams();
  const back = useGoBack(`${paths.scorecard}/cricket`);
  const { data: match, isLoading } = useCricketMatch(matchId);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingBallCount = useCricketPendingCount(matchId);
  const addBall = useAddCricketBall(matchId);
  const deleteLastBall = useDeleteLastCricketBall(matchId);
  const startSecondInnings = useStartSecondInnings(matchId);
  const markInningsComplete = useMarkInningsComplete(matchId);
  const completeMatch = useCompleteCricketMatch();
  const syncTournamentResult = useSyncCricketMatchResult();
  const abandonMatch = useAbandonCricketMatch(matchId);
  const addRosterPlayer = useAddRosterPlayer(matchId);
  const updateSettings = useUpdateCricketMatchSettings(matchId);
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingSummaryImage, setGeneratingSummaryImage] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const oversScrollRef = useRef<HTMLDivElement>(null);

  // Live push for every viewer; the scorer's own ball inserts are already
  // in the cache, so their echo is skipped (it raced the next ball).
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ["cricketMatch", matchId] });
    const channel = supabase
      .channel(uniqueChannelName(`liveScoring:${matchId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_matches", filter: `id=eq.${matchId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_innings", filter: `match_id=eq.${matchId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_balls" }, () => {
        if (!isScorer) refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, qc, isScorer]);

  const [pendingStriker, setPendingStriker] = useState<string | null>(null);
  const [pendingNonStriker, setPendingNonStriker] = useState<string | null>(null);
  const [manualStrikeSwapped, setManualStrikeSwapped] = useState(false);
  const [pendingBowler, setPendingBowler] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  const [wicketEnd, setWicketEnd] = useState<"striker" | "nonStriker" | null>(null);
  const [fielderName, setFielderName] = useState("");
  const [stumpedWide, setStumpedWide] = useState(false);
  const [bonusSign, setBonusSign] = useState<1 | -1>(1);
  const [tab, setTab] = useState<TabKey>("scoring");
  const [scorecardInningsId, setScorecardInningsId] = useState<string | null>(null);
  const [ballsInningsNumber, setBallsInningsNumber] = useState<number | null>(null);
  const [selectBatsmanOpen, setSelectBatsmanOpen] = useState(false);
  const [selectBowlerOpen, setSelectBowlerOpen] = useState(false);
  const [selectFielderOpen, setSelectFielderOpen] = useState(false);
  const [benchedNames, setBenchedNames] = useState<Set<string>>(new Set());
  const [changeTargetDraft, setChangeTargetDraft] = useState("");
  const [revisedOversDraft, setRevisedOversDraft] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [abandonCountdown, setAbandonCountdown] = useState(ABANDON_WAIT_SECONDS);

  useEffect(() => {
    if (dialog !== "ABANDON") return;
    setAbandonCountdown(ABANDON_WAIT_SECONDS);
    const interval = setInterval(() => setAbandonCountdown((c) => Math.max(c - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [dialog]);

  const currentInnings = useMemo(() => {
    if (!match) return undefined;
    const active = match.cricket_innings.find((i) => !i.is_completed);
    if (active) return active;
    if (match.status === "COMPLETED") return [...match.cricket_innings].sort((a, b) => b.innings_number - a.innings_number)[0];
    return undefined;
  }, [match]);

  const ballEvents: BallEvent[] = useMemo(() => (currentInnings ? [...currentInnings.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent) : []), [currentInnings]);
  const battingTeam = (currentInnings?.batting_team ?? null) as "A" | "B" | null;
  const battingPlayers = battingTeam === "A" ? (match?.team_a_players ?? []) : (match?.team_b_players ?? []);
  const bowlingPlayers = battingTeam === "A" ? (match?.team_b_players ?? []) : (match?.team_a_players ?? []);
  const battingTeamName = battingTeam === "A" ? match?.team_a_name : match?.team_b_name;

  const inningsState = useMemo(() => {
    if (!battingTeam || !match) return null;
    const opener1 = ballEvents[0]?.strikerName ?? pendingStriker ?? "";
    const opener2 = ballEvents[0]?.nonStrikerName ?? pendingNonStriker ?? "";
    if (!opener1 || !opener2) return null;
    const startingRuns = battingTeam === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs;
    return replayInnings(ballEvents, battingTeam, match.overs_limit, battingPlayers.length, opener1, opener2, startingRuns, match.last_man_stand);
  }, [ballEvents, battingTeam, match, battingPlayers.length, pendingStriker, pendingNonStriker]);

  const firstInnings = useMemo(() => {
    if (!match || currentInnings?.innings_number !== 2) return null;
    const first = match.cricket_innings.find((i) => i.innings_number === 1);
    if (!first) return null;
    const balls = [...first.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
    if (balls.length === 0) return null;
    const t = first.batting_team as "A" | "B";
    return replayInnings(balls, t, match.overs_limit, (t === "A" ? match.team_a_players : match.team_b_players).length, balls[0].strikerName, balls[0].nonStrikerName ?? "", t === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs, match.last_man_stand);
  }, [match, currentInnings]);

  const scorecardInnings = useMemo(() => {
    if (!match) return [];
    return [...match.cricket_innings]
      .sort((a, b) => a.innings_number - b.innings_number)
      .map((inn) => {
        const teamName = inn.batting_team === "A" ? match.team_a_name : match.team_b_name;
        const totalPlayers = inn.batting_team === "A" ? match.team_a_players.length : match.team_b_players.length;
        const balls = [...inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
        const state = balls.length === 0 ? null : replayInnings(balls, inn.batting_team as "A" | "B", match.overs_limit, totalPlayers, balls[0].strikerName, balls[0].nonStrikerName ?? "", 0, match.last_man_stand);
        return { inn, teamName, state };
      })
      .filter((x): x is typeof x & { state: InningsState } => x.state !== null);
  }, [match]);

  const target = match?.target_override ?? (firstInnings ? firstInnings.runs + 1 : null);
  const chaseComplete = !!(target && inningsState && inningsState.runs >= target);
  const inningsOver = !!inningsState?.isComplete || chaseComplete;

  // D/L verdict when rain ends a chase: actual score vs the par score for
  // the resources team 2 has used so far.
  const rainDLChaseVerdict =
    match && firstInnings && inningsState && target
      ? (() => {
          const full = resourcePercent(match.overs_limit, 0, match.overs_limit, inningsState.totalPlayers);
          const remainingNow = resourcePercent(match.overs_limit - inningsState.legalBalls / 6, inningsState.wickets, match.overs_limit, inningsState.totalPlayers);
          const used = Math.max(full - remainingNow, 0);
          const parRounded = Math.round(full > 0 ? (target - 1) * (used / full) : 0);
          const secondName = inningsState.battingTeam === "A" ? match.team_a_name : match.team_b_name;
          const firstName = firstInnings.battingTeam === "A" ? match.team_a_name : match.team_b_name;
          if (inningsState.runs > parRounded) {
            const m = inningsState.runs - parRounded;
            return { parScore: parRounded, summary: `${secondName} won by ${m} run${m === 1 ? "" : "s"} (D/L method)`, teamAWon: inningsState.battingTeam === "A" };
          }
          if (inningsState.runs < parRounded) {
            const m = parRounded - inningsState.runs;
            return { parScore: parRounded, summary: `${firstName} won by ${m} run${m === 1 ? "" : "s"} (D/L method)`, teamAWon: firstInnings.battingTeam === "A" };
          }
          return { parScore: parRounded, summary: "Match tied (D/L method)", teamAWon: null as boolean | null };
        })()
      : null;

  const innings1Row = match?.cricket_innings.find((i) => i.innings_number === 1);
  const innings2Row = match?.cricket_innings.find((i) => i.innings_number === 2);
  const isBetweenInnings = !!innings1Row?.is_completed && !innings2Row;
  const isMatchCompleted = match?.status === "COMPLETED";

  const switchedToSummary = useRef(false);
  useEffect(() => {
    if (isMatchCompleted && !switchedToSummary.current) {
      switchedToSummary.current = true;
      setTab("summary");
    }
  }, [isMatchCompleted]);

  const baseStriker = inningsState?.striker ?? pendingStriker;
  const baseNonStriker = inningsState?.nonStriker ?? pendingNonStriker;
  const canSwapStrike = !!baseStriker && !!baseNonStriker;
  const effectiveStriker = manualStrikeSwapped && canSwapStrike ? baseNonStriker : baseStriker;
  const effectiveNonStriker = manualStrikeSwapped && canSwapStrike ? baseStriker : baseNonStriker;
  const effectiveBowler = inningsState?.currentBowler ?? pendingBowler;
  const setCurrentFacer = (name: string) => canSwapStrike && setManualStrikeSwapped(name === baseNonStriker);
  const hasActiveInnings = !!currentInnings;
  const isLastManBatting = !!match?.last_man_stand && !!inningsState && inningsState.wickets === inningsState.totalPlayers - 1;
  const needsStriker = hasActiveInnings && !inningsOver && !effectiveStriker && !isLastManBatting;
  const needsNonStriker = hasActiveInnings && !inningsOver && !!effectiveStriker && !effectiveNonStriker && !isLastManBatting;
  const readyToScore = hasActiveInnings && !inningsOver && !!effectiveStriker && (!!effectiveNonStriker || isLastManBatting) && !!effectiveBowler;
  const needsAnyBatsman = needsStriker || needsNonStriker;
  const needsAnyBowler = hasActiveInnings && !inningsOver && !effectiveBowler;
  const outBatsmen = inningsState ? Object.keys(inningsState.battingStats).filter((n) => inningsState.battingStats[n].isOut) : [];
  const otherEndBatsman = needsStriker ? effectiveNonStriker : needsNonStriker ? effectiveStriker : null;
  const excludeForNextBatsman = otherEndBatsman ? [...outBatsmen, otherEndBatsman] : outBatsmen;

  const ballsByOver = groupBallsByOver(ballEvents);
  const lastOverLegalBalls = (ballsByOver[ballsByOver.length - 1] ?? []).filter((b) => b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY").length;
  const displayOvers = readyToScore && lastOverLegalBalls >= 6 ? [...ballsByOver, []] : ballsByOver;

  // Keep the overs strip on the current over.
  useEffect(() => {
    const el = oversScrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [displayOvers.length, ballEvents.length]);

  if (isLoading || !match) return <LiveLoading />;

  const err = (fallback: string) => (e: unknown) => Alert.alert("Error", friendlyCricketError(e, fallback));

  const resetSheet = () => {
    setPanel(null);
    setWicketType(null);
    setWicketEnd(null);
    setFielderName("");
    setStumpedWide(false);
  };

  const submitBall = (partial: Omit<BallEvent, "seq" | "strikerName" | "nonStrikerName" | "bowlerName">) => {
    if (addBall.isPending) return;
    if (!currentInnings || !effectiveStriker || (!effectiveNonStriker && !isLastManBatting) || !effectiveBowler) return;
    const seq = ballEvents.length + 1;
    const ball: BallEvent = { seq, strikerName: effectiveStriker, nonStrikerName: effectiveNonStriker, bowlerName: effectiveBowler, ...partial };
    addBall.mutate(
      { inningsId: currentInnings.id, seq, ball },
      {
        onSuccess: () => {
          setPendingStriker(null);
          setPendingNonStriker(null);
          setPendingBowler(null);
          setManualStrikeSwapped(false);
          resetSheet();
        },
        onError: err("Could not record ball."),
      }
    );
  };
  const plain = { extraType: null, extraRuns: 0, isWicket: false, wicketType: null, dismissedName: null, fielderName: null } as const;
  const handleRuns = (runs: number) => submitBall({ ...plain, runsBatted: runs });
  const handleWide = (runsRun: number) => submitBall({ ...plain, runsBatted: 0, extraType: "WIDE", extraRuns: runsRun + 1 });
  const handleNoBall = (batRuns: number) => submitBall({ ...plain, runsBatted: batRuns, extraType: "NOBALL", extraRuns: 1 });
  const handleByeLegBye = (type: "BYE" | "LEGBYE", runs: number) => submitBall({ ...plain, runsBatted: 0, extraType: type, extraRuns: runs });
  const handleBonusRuns = (amount: number) => submitBall({ ...plain, runsBatted: 0, extraType: "PENALTY", extraRuns: amount * bonusSign });
  const handleRetiredHurt = (end: "striker" | "nonStriker") => {
    const name = end === "striker" ? effectiveStriker : effectiveNonStriker;
    if (name) submitBall({ ...plain, runsBatted: 0, isWicket: true, wicketType: "RETIRED_HURT", dismissedName: name });
  };
  const handleWicket = () => {
    if (!wicketType) return;
    const dismissed = wicketType === "MANKAD" ? (wicketEnd === "nonStriker" ? effectiveNonStriker : effectiveStriker) : effectiveStriker;
    submitBall({ ...plain, runsBatted: 0, isWicket: true, wicketType, dismissedName: dismissed, fielderName: fielderName.trim() || null });
  };
  const handleRunOutSubmit = ({ dismissedName, fielderName: f1, fielderName2: f2, runsCompleted, extraType }: RunOutResult) => {
    const runsBatted = extraType === "BYE" || extraType === "LEGBYE" || extraType === "WIDE" ? 0 : runsCompleted;
    const extraRuns = extraType === "BYE" || extraType === "LEGBYE" ? runsCompleted : extraType === "NOBALL" ? 1 : extraType === "WIDE" ? runsCompleted + 1 : 0;
    submitBall({ runsBatted, extraType, extraRuns, isWicket: true, wicketType: "RUN_OUT", dismissedName, fielderName: f1, fielderName2: f2 });
  };
  const handleStumpedSubmit = (fielder: string, wide: boolean) => {
    if (!effectiveStriker) return;
    submitBall({ runsBatted: 0, extraType: wide ? "WIDE" : null, extraRuns: wide ? 1 : 0, isWicket: true, wicketType: "STUMPED", dismissedName: effectiveStriker, fielderName: fielder });
  };

  const handleUndo = () => {
    if (!currentInnings || ballEvents.length === 0) return;
    const last = ballEvents[ballEvents.length - 1];
    Alert.alert("Undo Last Ball", "Remove the most recent delivery?", [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => deleteLastBall.mutate({ inningsId: currentInnings.id, seq: last.seq }, { onError: err("Could not undo.") }) },
    ]);
  };

  const handleStartSecondInnings = () => {
    if (!currentInnings || !battingTeam) return;
    markInningsComplete.mutate(currentInnings.id, {
      onSuccess: () => startSecondInnings.mutate(battingTeam === "A" ? "B" : "A", { onError: err("Could not start 2nd innings.") }),
      onError: err("Could not finish the innings."),
    });
  };

  const handleFinishMatch = () => {
    if (!currentInnings || !inningsState || !firstInnings) return;
    const summary = matchResultSummary(match.team_a_name, match.team_b_name, firstInnings, inningsState);
    const teamAWon: boolean | null = inningsState.runs === firstInnings.runs ? null : (inningsState.runs > firstInnings.runs) === (inningsState.battingTeam === "A");
    markInningsComplete.mutate(currentInnings.id, {
      onSuccess: () =>
        completeMatch.mutate({ matchId: match.id, resultSummary: summary }, { onSuccess: () => syncTournamentResult.mutate({ cricketMatchId: match.id, teamAWon }), onError: err("Could not complete match.") }),
      onError: err("Could not finish the innings."),
    });
  };

  const handleConfirmAbandon = () => {
    abandonMatch.mutate(undefined, { onError: err("Could not abandon the match.") });
    setDialog(null);
  };
  const handleConfirmEndInnings = () => {
    setDialog(null);
    if (currentInnings?.innings_number === 1) handleStartSecondInnings();
    else handleFinishMatch();
  };
  const handleOpenChangeTarget = () => (currentInnings?.innings_number !== 2 ? setDialog("TARGET_BLOCKED") : setPanel("CHANGE_TARGET"));
  const handleOpenDL = () => setDialog(currentInnings?.innings_number === 2 ? "RAIN_DL_CHASE" : "RAIN_DL");
  const rainDLOvers = Math.floor((inningsState?.legalBalls ?? 0) / 6);
  const handleToggleLastManStand = () => {
    setPanel(null);
    updateSettings.mutate({ lastManStand: !match.last_man_stand }, { onError: err("Could not change the Last Man Stand setting.") });
  };
  const handleConfirmRainDL = () => {
    setDialog(null);
    if (rainDLOvers < 1) {
      Alert.alert("Not Enough Overs Bowled", "At least one full over must be bowled before D/L can set a reduced overs count.");
      return;
    }
    updateSettings.mutate({ oversLimit: rainDLOvers }, { onError: err("Could not apply the D/L revision.") });
  };
  const handleConfirmRainDLChase = () => {
    setDialog(null);
    if (!currentInnings || !rainDLChaseVerdict) return;
    markInningsComplete.mutate(currentInnings.id, {
      onSuccess: () =>
        completeMatch.mutate(
          { matchId: match.id, resultSummary: rainDLChaseVerdict.summary },
          { onSuccess: () => syncTournamentResult.mutate({ cricketMatchId: match.id, teamAWon: rainDLChaseVerdict.teamAWon }), onError: err("Could not complete match.") }
        ),
      onError: err("Could not finish the innings."),
    });
  };
  const handleAwardPenalty = (team: "A" | "B") => {
    if (!battingTeam) return;
    if (team === battingTeam) {
      submitBall({ ...plain, runsBatted: 0, extraType: "PENALTY", extraRuns: PENALTY_RUNS });
      return;
    }
    const current = team === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs;
    updateSettings.mutate(team === "A" ? { teamAPenaltyRuns: current + PENALTY_RUNS } : { teamBPenaltyRuns: current + PENALTY_RUNS }, { onError: err("Could not award penalty runs.") });
    setPanel(null);
  };
  const handleAddPlayer = (side: "batting" | "bowling", name: string) => {
    if (!battingTeam) return;
    const team = side === "batting" ? battingTeam : battingTeam === "A" ? "B" : "A";
    addRosterPlayer.mutate({ team, name, existingPlayers: side === "batting" ? battingPlayers : bowlingPlayers }, { onError: err("Could not add player.") });
  };
  const handleChangeTarget = () => {
    const value = parseInt(changeTargetDraft, 10);
    if (!value || value <= 0) return;
    updateSettings.mutate(
      { targetOverride: value },
      {
        onSuccess: () => {
          setChangeTargetDraft("");
          setRevisedOversDraft("");
          setPanel(null);
        },
        onError: err("Could not update the target."),
      }
    );
  };
  const revisedOvers = parseFloat(revisedOversDraft);
  const dlPreview =
    firstInnings && inningsState && revisedOvers > 0
      ? (() => {
          const r1 = 100 - resourcePercent(match.overs_limit - firstInnings.legalBalls / 6, firstInnings.wickets, match.overs_limit, firstInnings.totalPlayers);
          const r2 = resourcePercent(revisedOvers - inningsState.legalBalls / 6, inningsState.wickets, revisedOvers, inningsState.totalPlayers);
          return computeDuckworthLewis(firstInnings.runs, r1, r2);
        })()
      : null;
  const toggleBench = (name: string) =>
    setBenchedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  // Web stand-ins for the app's native share sheet: the Web Share API where
  // available, otherwise copy the text / download the image.
  const handleShare = async () => {
    const message = `${match.team_a_name} vs ${match.team_b_name} — follow live scoring with code ${match.scoring_code} in the app.`;
    try {
      if (navigator.share) await navigator.share({ text: message });
      else {
        await navigator.clipboard.writeText(message);
        Alert.alert("Copied", "The match link text was copied — paste it anywhere to share.");
      }
    } catch {
      // share sheet dismissed
    }
  };
  const handleGenerateMatchReport = async () => {
    setGeneratingReport(true);
    try {
      await generateAndShareMatchReport(buildCricketMatchReportHtml(match, { organiserName: profile?.full_name ?? "—", appName: "HitLit" }));
    } catch (e) {
      Alert.alert("Error", getFriendlyErrorMessage(e, "Could not generate the match report."));
    } finally {
      setGeneratingReport(false);
    }
  };
  const handleShareMatchSummary = async () => {
    if (!shareCardRef.current || generatingSummaryImage) return;
    setGeneratingSummaryImage(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 1, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `match-summary-${match.scoring_code ?? match.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Share Match Summary" });
      else downloadBlob(blob, file.name);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") Alert.alert("Error", friendlyCricketError(e, "Could not generate the match summary image."));
    } finally {
      setGeneratingSummaryImage(false);
    }
  };

  const shareCardInnings: ShareCardInningsEntry[] = scorecardInnings.map((si) => {
    const opposing = scorecardInnings.find((o) => o.inn.id !== si.inn.id);
    return {
      teamName: si.teamName,
      score: `${si.state.runs}-${si.state.wickets}`,
      oversLabel: formatOvers(si.state.legalBalls),
      topBatters: si.state.battingOrder
        .map((n) => si.state.battingStats[n])
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 3)
        .map((b) => ({ name: b.name, statLabel: `${b.runs} (${b.balls})` })),
      topBowlers: opposing
        ? opposing.state.bowlingOrder
            .map((n) => opposing.state.bowlingStats[n])
            .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
            .slice(0, 3)
            .map((b) => ({ name: b.name, statLabel: `${b.wickets} - ${b.runsConceded}` }))
        : [],
    };
  });
  const shareCardDate = new Date(match.completed_at ?? match.created_at).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

  const legalBallsFromOversLabel = (label: string) => {
    const [o, b] = label.split(".").map(Number);
    return (o || 0) * 6 + (b || 0);
  };
  const lastWicket = inningsState?.fallOfWickets[inningsState.fallOfWickets.length - 1];
  const partnershipRuns = inningsState ? inningsState.runs - (lastWicket?.teamScore ?? 0) : 0;
  const partnershipBalls = inningsState ? inningsState.legalBalls - (lastWicket ? legalBallsFromOversLabel(lastWicket.overs) : 0) : 0;
  const extrasTotal = inningsState ? inningsState.extras.wide + inningsState.extras.noball + inningsState.extras.bye + inningsState.extras.legbye + inningsState.extras.penalty : 0;
  const strikerStat = effectiveStriker && inningsState ? inningsState.battingStats[effectiveStriker] : undefined;
  const nonStrikerStat = effectiveNonStriker && inningsState ? inningsState.battingStats[effectiveNonStriker] : undefined;
  const bowlerStat = effectiveBowler && inningsState ? inningsState.bowlingStats[effectiveBowler] : undefined;
  const runRate = inningsState ? computeRunRate(inningsState.runs, inningsState.legalBalls) : 0;
  const requiredRunRate = target && inningsState ? computeRequiredRunRate(target, inningsState.runs, inningsState.legalBalls, match.overs_limit) : null;
  const runsNeeded = target && inningsState ? Math.max(target - inningsState.runs, 0) : null;
  const ballsLeft = target && inningsState ? Math.max(match.overs_limit * 6 - inningsState.legalBalls, 0) : null;

  const closePanel = () => {
    resetSheet();
    setChangeTargetDraft("");
    setRevisedOversDraft("");
  };
  const cancelRow = (
    <button type="button" onClick={closePanel} className="mt-1 w-full py-2 text-center text-sm text-white/85 hover:text-white">
      Cancel
    </button>
  );
  const sheetTitle = (t: ReactNode) => <p className="mb-4 flex items-center gap-1.5 text-lg font-bold text-white">{t}</p>;
  const statCells = (vals: (string | number)[]) => (
    <span className="flex gap-2.5 text-sm text-muted">
      {vals.map((v, i) => (
        <span key={i} className={`text-center ${i === vals.length - 1 ? "w-[38px]" : "w-[26px]"} ${i === 0 ? "font-semibold" : ""}`}>
          {v}
        </span>
      ))}
    </span>
  );
  const tableHeader = (title: string, cols: string[]) => (
    <div className="mt-3 flex items-center justify-between border-b border-border pb-1.5">
      <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <Ionicon name="pencil" size={13} color={colors.muted} />
        {title}
      </span>
      <span className="flex gap-2.5 text-sm font-bold text-muted">
        {cols.map((h, i) => (
          <span key={h} className={`text-center ${i === cols.length - 1 ? "w-[38px]" : "w-[26px]"}`}>
            {h}
          </span>
        ))}
      </span>
    </div>
  );

  // ───── The green scoring sheet (scorer only) ─────
  const scoringSheet = (() => {
    if (!readyToScore) {
      return (
        <>
          <p className="mb-4 text-lg font-bold text-white">Select Players</p>
          <div className="flex flex-wrap justify-center gap-3.5">
            {needsAnyBatsman && <SheetChip onPress={() => setSelectBatsmanOpen(true)} className="rounded-2xl px-6 py-3.5">Select Batsman</SheetChip>}
            {needsAnyBowler && <SheetChip onPress={() => setSelectBowlerOpen(true)} className="rounded-2xl px-6 py-3.5">Select Bowler</SheetChip>}
          </div>
        </>
      );
    }
    if (panel === null) {
      return (
        <div className="border-t border-white/25">
          <KeypadRow bottomBorder>
            {RUN_OPTIONS.map((n) => (
              <KeypadCell key={n} onPress={() => handleRuns(n)} label={`${n} run${n === 1 ? "" : "s"}`}>
                <span className="text-lg font-bold text-white">{n}</span>
              </KeypadCell>
            ))}
          </KeypadRow>
          <KeypadRow bottomBorder>
            <KeypadCell onPress={() => setPanel("LEGBYE")}>
              <span className="text-sm font-bold text-white">LB</span>
            </KeypadCell>
            <KeypadCell onPress={() => setPanel("BYE")}>
              <span className="text-sm font-bold text-white">Bye</span>
            </KeypadCell>
            <KeypadCell onPress={() => setPanel("WIDE")}>
              <span className="text-sm font-bold text-white">Wide</span>
            </KeypadCell>
            <KeypadCell onPress={() => setPanel("NOBALL")}>
              <span className="text-sm font-bold text-white">NB</span>
            </KeypadCell>
            <KeypadCell onPress={() => handleRuns(DOT_BALL)} label="Dot ball">
              <span className="h-[7px] w-[7px] rounded-full bg-surface" />
            </KeypadCell>
          </KeypadRow>
          <KeypadRow>
            <KeypadCell onPress={() => setPanel("MORE_MENU")}>
              <span className="text-sm font-bold text-white">More</span>
            </KeypadCell>
            <KeypadCell onPress={() => setPanel("BONUS_RUNS")} label="Bonus runs">
              <MCIcon name="cricket" size={18} color="white" />
            </KeypadCell>
            <KeypadCell onPress={() => setPanel("MORE_RUNS")} label="More runs">
              <span className="text-xs font-bold text-white">4 5 6 7</span>
            </KeypadCell>
            <KeypadCell onPress={handleUndo} disabled={ballEvents.length === 0 || deleteLastBall.isPending}>
              <span className="text-sm font-bold text-white">Undo</span>
            </KeypadCell>
            <KeypadCell onPress={() => setPanel("WICKET")}>
              <span className="text-sm font-bold text-white">Out</span>
            </KeypadCell>
          </KeypadRow>
        </div>
      );
    }
    const optionGrid = (opts: number[], label: (n: number) => string, onPick: (n: number) => void, square?: boolean) => (
      <div className="flex flex-wrap justify-center gap-2.5">
        {opts.map((n) => (
          <SheetChip key={n} onPress={() => onPick(n)} className={square ? "flex h-12 w-14 items-center justify-center" : "px-4 py-3"}>
            {label(n)}
          </SheetChip>
        ))}
      </div>
    );
    if (panel === "WIDE") return (<>{sheetTitle("Wide")}{optionGrid(WIDE_OPTIONS, (n) => (n === 0 ? "Wd" : `${n} + Wd`), handleWide)}{cancelRow}</>);
    if (panel === "NOBALL") return (<>{sheetTitle("No Ball")}{optionGrid(NOBALL_BAT_OPTIONS, (n) => (n === 0 ? "NB" : `${n} NB`), handleNoBall)}{cancelRow}</>);
    if (panel === "LEGBYE") return (<>{sheetTitle("Leg Byes")}{optionGrid(LEGBYE_OPTIONS, (n) => `${n} LB`, (n) => handleByeLegBye("LEGBYE", n))}{cancelRow}</>);
    if (panel === "BYE") return (<>{sheetTitle("Byes")}{optionGrid(BYE_OPTIONS, (n) => `${n} B`, (n) => handleByeLegBye("BYE", n))}{cancelRow}</>);
    if (panel === "MORE_RUNS")
      return (
        <>
          {sheetTitle(<>More Runs <Ionicon name="information-circle-outline" size={16} color="rgba(255,255,255,0.7)" /></>)}
          {optionGrid(MORE_RUNS_OPTIONS, String, handleRuns, true)}
          {cancelRow}
        </>
      );
    if (panel === "BONUS_RUNS")
      return (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-lg font-bold text-white">
              Bonus Runs <Ionicon name="information-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
            </p>
            <div className="flex gap-2">
              {([1, -1] as const).map((s) => (
                <button key={s} type="button" aria-label={s === 1 ? "Add runs" : "Remove runs"} aria-pressed={bonusSign === s} onClick={() => setBonusSign(s)} className={`flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-white/60 ${bonusSign === s ? "bg-[#111827]" : ""}`}>
                  <Ionicon name={s === 1 ? "add" : "remove"} size={16} color="white" />
                </button>
              ))}
            </div>
          </div>
          {optionGrid(BONUS_RUNS_OPTIONS, String, handleBonusRuns, true)}
          {cancelRow}
        </>
      );
    if (panel === "MORE_MENU")
      return (
        <>
          {sheetTitle("More")}
          <div className="flex flex-wrap gap-2.5">
            {[
              { label: "Abandon", onPress: () => setDialog("ABANDON") },
              { label: "End Innings", onPress: () => setDialog("END_INNINGS") },
              { label: "Penalty", onPress: () => setPanel("PENALTY_TEAM") },
              { label: "Retired Hurt", onPress: () => setPanel("RETIRED_HURT") },
              { label: "D / L", onPress: handleOpenDL },
              { label: "Change Target", onPress: handleOpenChangeTarget },
              { label: `Last Man Stand: ${match.last_man_stand ? "On" : "Off"}`, onPress: handleToggleLastManStand },
              { label: "Share Match", onPress: handleShare },
            ].map((item) => (
              <SheetChip key={item.label} onPress={item.onPress} className="px-4 py-3 font-semibold">
                {item.label}
              </SheetChip>
            ))}
          </div>
          {cancelRow}
        </>
      );
    if (panel === "RETIRED_HURT")
      return (
        <>
          {sheetTitle("Retired Hurt")}
          <div className="flex justify-center gap-7">
            {([["striker", effectiveStriker], ["nonStriker", effectiveNonStriker]] as const).map(
              ([end, name]) =>
                name && (
                  <button key={end} type="button" onClick={() => handleRetiredHurt(end)} className="flex flex-col items-center gap-1.5 text-sm font-semibold text-white">
                    <PlayerInitialAvatar name={name} />
                    {name}
                  </button>
                )
            )}
          </div>
          {cancelRow}
        </>
      );
    if (panel === "PENALTY_TEAM")
      return (
        <>
          {sheetTitle(`Award +${PENALTY_RUNS} Penalty runs to?`)}
          <div className="flex justify-center gap-7">
            {(["A", "B"] as const).map((team) => (
              <button key={team} type="button" onClick={() => handleAwardPenalty(team)} className="flex max-w-[140px] flex-col items-center gap-1.5 text-sm font-semibold text-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-white/60 bg-white/15">
                  <MCIcon name="shield-account" size={24} color="white" />
                </span>
                <span className="max-w-full truncate">{team === "A" ? match.team_a_name : match.team_b_name}</span>
              </button>
            ))}
          </div>
          {cancelRow}
        </>
      );
    if (panel === "CHANGE_TARGET")
      return (
        <div className="max-h-[420px] overflow-y-auto">
          <p className="mb-1 text-lg font-bold text-white">Change Target</p>
          <p className="mb-4 text-xs text-white/80">
            Enter a revised overs count to compute a Duckworth-Lewis estimate, or type a target directly — this app's D/L curve is fitted to published reference points, not the official (commercially confidential) ICC table, so treat it as an estimate.
          </p>
          <p className="mb-1.5 text-xs font-semibold text-white/85">Revised overs for this innings</p>
          <input
            value={revisedOversDraft}
            onChange={(e) => setRevisedOversDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={String(match.overs_limit)}
            inputMode="decimal"
            aria-label="Revised overs"
            className="w-full rounded-xl border-[1.5px] border-white/60 bg-transparent px-4 py-2.5 font-semibold text-white outline-none placeholder:text-white/50"
          />
          {dlPreview && (
            <div className="mt-3 rounded-xl bg-white/[0.12] p-3">
              <p className="text-xs text-white/85">
                Team 1 used {dlPreview.team1ResourcesUsed.toFixed(1)}% of resources · Team 2 has {dlPreview.team2ResourcesAvailable.toFixed(1)}% available
              </p>
              <p className="mt-1 text-xl font-extrabold text-white">D/L Target: {dlPreview.target}</p>
              <button type="button" onClick={() => setChangeTargetDraft(String(dlPreview.target))} className="mt-2 w-full rounded-lg bg-surface py-2 text-sm font-bold text-primary-dark">
                Use This Target
              </button>
            </div>
          )}
          <p className="mb-1.5 mt-4 text-xs font-semibold text-white/85">Or set the target directly</p>
          <input
            value={changeTargetDraft}
            onChange={(e) => setChangeTargetDraft(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={target ? String(target) : "New target"}
            inputMode="numeric"
            aria-label="New target"
            className="w-full rounded-xl border-[1.5px] border-white/60 bg-transparent px-4 py-3 text-center text-lg font-bold text-white outline-none placeholder:text-white/50"
          />
          <button type="button" onClick={handleChangeTarget} disabled={!changeTargetDraft || updateSettings.isPending} className="mt-4 w-full rounded-xl bg-surface py-3 font-bold text-primary-dark disabled:opacity-60">
            Save Target
          </button>
          {cancelRow}
        </div>
      );
    if (panel === "WICKET" && !wicketType)
      return (
        <>
          {sheetTitle("Wicket")}
          <div className="flex flex-wrap gap-2">
            {WICKET_TYPES.map((w) => (
              <SheetChip key={w.value} onPress={() => setWicketType(w.value)} className="px-3.5 py-2.5 font-semibold">
                {w.label}
              </SheetChip>
            ))}
          </div>
          {cancelRow}
        </>
      );
    if (panel === "WICKET" && wicketType && wicketType !== "RUN_OUT" && wicketType !== "STUMPED") {
      const confirm = (
        <button type="button" onClick={handleWicket} disabled={addBall.isPending} className="w-full rounded-xl bg-surface py-3 font-bold text-primary-dark">
          Confirm Wicket
        </button>
      );
      return (
        <>
          {sheetTitle(WICKET_TYPES.find((w) => w.value === wicketType)?.label)}
          {wicketType === "MANKAD" && (
            <>
              <p className="mb-2 text-xs font-semibold text-white/85">Who was run out?</p>
              <div className="mb-3 flex gap-2">
                {([["striker", effectiveStriker], ["nonStriker", effectiveNonStriker]] as const).map(([end, name]) => (
                  <SheetChip key={end} onPress={() => setWicketEnd(end)} active={wicketEnd === end} className="flex-1 py-3 font-medium">
                    {name}
                  </SheetChip>
                ))}
              </div>
            </>
          )}
          {(wicketType === "CAUGHT" || wicketType === "ONE_HAND_ONE_BOUNCE") && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold text-white/85">Fielder (optional)</p>
              <div className="flex items-center justify-between rounded-xl border-[1.5px] border-white/60 px-4 py-2.5">
                <button type="button" onClick={() => setSelectFielderOpen(true)} className={`min-w-0 flex-1 truncate text-left text-white ${fielderName ? "" : "opacity-50"}`}>
                  {fielderName || "Select fielder"}
                </button>
                <span className="flex items-center gap-2.5">
                  {fielderName && (
                    <button type="button" aria-label="Clear fielder" onClick={() => setFielderName("")}>
                      <Ionicon name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
                    </button>
                  )}
                  <button type="button" aria-label="Select fielder" onClick={() => setSelectFielderOpen(true)}>
                    <Ionicon name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
                  </button>
                </span>
              </div>
            </div>
          )}
          {wicketType === "MANKAD" ? wicketEnd && confirm : confirm}
          {cancelRow}
        </>
      );
    }
    return null;
  })();

  const tabs = isMatchCompleted ? COMPLETED_TABS : LIVE_TABS;
  const showSheet = tab === "scoring" && isScorer && hasActiveInnings && !inningsOver && !isMatchCompleted;

  return (
    <div className="mx-auto max-w-5xl pb-6 lg:px-8 lg:pt-6">
      <header className="sticky top-0 z-20 bg-brand pt-[calc(env(safe-area-inset-top)+12px)] lg:rounded-[28px] lg:pt-5">
        <div className="flex items-center gap-2.5 px-4 lg:px-6">
          <button type="button" onClick={back} aria-label="Back" className="rounded-full p-0.5 hover:bg-white/10">
            <Ionicon name="arrow-back" size={22} color="white" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-white">Match Centre</h1>
          <ScoringCodeBadge code={match.scoring_code} variant="dark" />
          {match.status === "IN_PROGRESS" ? (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              <span className="h-[5px] w-[5px] animate-blink rounded-full bg-surface" />
              LIVE
            </span>
          ) : isMatchCompleted ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">MATCH COMPLETED</span>
          ) : null}
        </div>
        <div role="tablist" className="no-scrollbar flex gap-[22px] overflow-x-auto px-4 pt-4 lg:px-6">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`shrink-0 pb-3 text-sm font-semibold transition ${tab === t.key ? "text-white" : "text-white/50 hover:text-white/80"}`}>
              {t.label}
              <span className={`mt-1.5 block h-[2.5px] rounded-sm ${tab === t.key ? "bg-surface" : "bg-transparent"}`} />
            </button>
          ))}
        </div>
      </header>

      {tab === "scoring" ? (
        <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
          <div className="px-4 pt-2 lg:px-0 lg:pt-0">
            <OfflineScoringBanner isOnline={isOnline} pendingCount={pendingBallCount} unit="ball" />
            <div className="flex flex-col items-center text-center">
              <p className="max-w-full truncate text-lg font-extrabold uppercase text-ink">{battingTeamName ?? ""}</p>
              <p className="mt-0.5 text-sm font-bold text-muted">{currentInnings?.innings_number === 2 ? "2nd Innings" : "1st Innings"}</p>
              <p className="-mt-0.5 text-[52px] font-extrabold leading-[56px] text-primary">
                {inningsState?.runs ?? 0}-{inningsState?.wickets ?? 0}
              </p>
            </div>
            <div className="-mt-0.5 flex flex-wrap items-center justify-center gap-x-[18px] text-sm font-bold text-muted">
              <span>Extras - {extrasTotal}</span>
              <span>
                Overs - {formatOvers(inningsState?.legalBalls ?? 0)} / {match.overs_limit}
              </span>
              <span>CRR - {runRate.toFixed(1)}</span>
            </div>
            <p className="mt-1 text-center text-sm font-bold text-muted">
              Partnership - {partnershipRuns}({partnershipBalls})
            </p>
            {target ? (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-[18px] text-sm text-muted">
                <span>Target - {target}</span>
                <span>RRR - {requiredRunRate !== null ? requiredRunRate.toFixed(1) : "—"}</span>
                {runsNeeded !== null && ballsLeft !== null && (
                  <span>
                    Need {runsNeeded} off {ballsLeft}
                  </span>
                )}
              </div>
            ) : null}
            <div className="mb-1 mt-4 h-px bg-border" />

            {(inningsOver || !hasActiveInnings) && !isMatchCompleted ? (
              <div className="flex flex-col items-center py-6">
                <Ionicon name="checkmark-circle" size={40} color={colors.primary} />
                <p className="mt-2 text-lg font-bold text-ink">{currentInnings?.innings_number === 1 || isBetweenInnings ? "Innings Complete" : "Match Complete"}</p>
                {currentInnings?.innings_number === 1 || isBetweenInnings ? (
                  isScorer && (
                    <button type="button" onClick={handleStartSecondInnings} disabled={markInningsComplete.isPending || startSecondInnings.isPending} className="press mt-4 rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-cta">
                      Start 2nd Innings
                    </button>
                  )
                ) : hasActiveInnings ? (
                  isScorer && (
                    <button type="button" onClick={handleFinishMatch} disabled={markInningsComplete.isPending || completeMatch.isPending} className="press mt-4 rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-cta">
                      Finish Match
                    </button>
                  )
                ) : (
                  <button type="button" onClick={() => setTab("scorecard")} className="mt-4 text-sm font-semibold text-primary hover:underline">
                    View Scorecard
                  </button>
                )}
              </div>
            ) : (
              <>
                {tableHeader("Batsman", ["R", "B", "4s", "6s", "SR"])}
                {[
                  { name: effectiveStriker, stat: strikerStat, isStriker: true },
                  { name: effectiveNonStriker, stat: nonStrikerStat, isStriker: false },
                ].map((row) => {
                  if (!row.name) return null;
                  const name = row.name;
                  const canTapToSwap = isScorer && canSwapStrike && hasActiveInnings && !inningsOver;
                  return (
                    <div key={name} className="flex items-center justify-between border-b border-border py-1.5">
                      <button type="button" disabled={!canTapToSwap} onClick={() => setCurrentFacer(name)} title={canTapToSwap && !row.isStriker ? "Put on strike" : undefined} className="min-w-0 flex-1 text-left">
                        {row.isStriker ? (
                          <span className="inline-block max-w-full truncate rounded-lg bg-brand px-2.5 py-1 text-sm font-bold text-white">{name} *</span>
                        ) : (
                          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                        )}
                      </button>
                      {statCells([row.stat?.runs ?? 0, row.stat?.balls ?? 0, row.stat?.fours ?? 0, row.stat?.sixes ?? 0, row.stat && row.stat.balls > 0 ? ((row.stat.runs / row.stat.balls) * 100).toFixed(1) : "0.0"])}
                    </div>
                  );
                })}
                <div className="mt-1">{tableHeader("Bowler", ["O", "M", "R", "W", "Eco"])}</div>
                {effectiveBowler && (
                  <div className="flex items-center justify-between border-b border-border py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{effectiveBowler}</span>
                    {statCells([formatOvers(bowlerStat?.legalBalls ?? 0), bowlerStat?.maidens ?? 0, bowlerStat?.runsConceded ?? 0, bowlerStat?.wickets ?? 0, bowlerStat && bowlerStat.legalBalls > 0 ? ((bowlerStat.runsConceded / bowlerStat.legalBalls) * 6).toFixed(1) : "0.0"])}
                  </div>
                )}
                {displayOvers.length > 0 && (
                  <div ref={oversScrollRef} className="no-scrollbar mt-1 flex snap-x snap-mandatory overflow-x-auto">
                    {displayOvers.map((over, overIndex) => (
                      <div key={overIndex} className="w-full shrink-0 snap-start py-2">
                        <p className="mb-2 text-[11px] font-semibold text-muted">Over {overIndex + 1}</p>
                        <div className="flex flex-wrap gap-2">
                          {over.map((b, i) => {
                            const isLast = i === over.length - 1;
                            const label = ballLabel(b);
                            const size = b.isWicket ? 44 : 32;
                            return (
                              <span
                                key={i}
                                className="flex items-center justify-center rounded-full text-center font-bold"
                                style={{ width: size, height: size, fontSize: label.length > 2 ? 10 : 12, backgroundColor: b.isWicket ? colors.danger : isLast ? "#2563EB" : "#E5E7EB", color: b.isWicket || isLast ? "white" : colors.ink }}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {showSheet && (
            <aside className={`sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-10 mt-3 bg-brand px-5 pb-[18px] pt-2 lg:bottom-auto lg:top-36 lg:mt-0 lg:self-start lg:rounded-3xl lg:shadow-hero ${addBall.isPending ? "pointer-events-none" : ""}`}>
              {scoringSheet}
            </aside>
          )}
        </div>
      ) : (
        <div className="px-4 pb-10 pt-4 lg:px-0 lg:pt-6">
          {tab === "scorecard" && (
            <>
              <div className="relative mb-4 overflow-hidden rounded-2xl bg-surface shadow-card">
                <CornerAccents size={56} />
                <div className="relative flex flex-col items-center p-5">
                  {match.result_summary && (
                    <span className="mb-4 flex items-center gap-1.5 rounded-full bg-primary-light px-3.5 py-1.5 text-center text-xs font-extrabold uppercase tracking-[0.5px] text-primary-dark">
                      <Ionicon name="trophy" size={15} color={colors.primaryDark} />
                      {match.result_summary}
                    </span>
                  )}
                  <div className="relative flex w-full max-w-md items-center justify-between">
                    <div className="flex w-[92px] flex-col items-center">
                      <TeamCrest color={TEAM_A_COLOR} icon="cricket" />
                      <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{match.team_a_name}</p>
                    </div>
                    <span className="absolute left-1/2 top-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-xs font-extrabold text-ink shadow-card">VS</span>
                    <div className="flex w-[92px] flex-col items-center">
                      <TeamCrest color={TEAM_B_COLOR} icon="cricket" />
                      <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{match.team_b_name}</p>
                    </div>
                  </div>
                </div>
              </div>
              {scorecardInnings.length > 0 && !isMatchCompleted && (
                <button type="button" onClick={handleGenerateMatchReport} disabled={generatingReport} className="press mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-white">
                  {generatingReport ? (
                    <Spinner size={18} color="white" />
                  ) : (
                    <>
                      <Ionicon name="document-text-outline" size={18} color="white" />
                      Generate Match Report
                    </>
                  )}
                </button>
              )}
              {scorecardInnings.length === 0 ? (
                <p className="mt-10 text-center text-sm text-muted">No balls bowled yet.</p>
              ) : (
                (() => {
                  const selectedId = scorecardInningsId ?? scorecardInnings[0].inn.id;
                  const selected = scorecardInnings.find((si) => si.inn.id === selectedId) ?? scorecardInnings[0];
                  const isTeamA = selected.inn.batting_team === "A";
                  return (
                    <>
                      {scorecardInnings.length > 1 && <SegmentedPill options={scorecardInnings.map((si) => ({ key: si.inn.id, label: si.teamName.toUpperCase() }))} selected={selectedId} onSelect={setScorecardInningsId} />}
                      <InningsCard
                        key={selected.inn.id}
                        teamName={selected.teamName}
                        inningsNumber={selected.inn.innings_number}
                        color={isTeamA ? TEAM_A_COLOR : TEAM_B_COLOR}
                        state={selected.state}
                        balls={[...selected.inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent)}
                        allPlayers={isTeamA ? match.team_a_players : match.team_b_players}
                      />
                    </>
                  );
                })()
              )}
            </>
          )}
          {tab === "summary" && (
            <SummaryTab match={match} scorecardInnings={scorecardInnings} onShareReport={handleGenerateMatchReport} generatingReport={generatingReport} onShareSummary={handleShareMatchSummary} generatingSummaryImage={generatingSummaryImage} />
          )}
          {tab === "balls" && (
            <BallsTab match={match} scorecardInnings={scorecardInnings} selectedInningsNumber={ballsInningsNumber ?? scorecardInnings[scorecardInnings.length - 1]?.inn.innings_number ?? 1} onSelectInnings={setBallsInningsNumber} />
          )}
          {tab === "info" && <InfoTab match={match} />}
          {tab === "stats" && (
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-card lg:max-w-xl">
              <p className="mb-3 text-base font-bold text-ink">This Innings</p>
              {[
                { label: "Run rate", value: runRate.toFixed(2) },
                { label: "Extras", value: String(extrasTotal) },
                { label: "Boundaries (4s)", value: String(Object.values(inningsState?.battingStats ?? {}).reduce((s, b) => s + b.fours, 0)) },
                { label: "Sixes", value: String(Object.values(inningsState?.battingStats ?? {}).reduce((s, b) => s + b.sixes, 0)) },
                { label: "Dot-ball economy (bowlers)", value: `${Object.values(inningsState?.bowlingStats ?? {}).length} bowled` },
              ].map((row, i) => (
                <div key={row.label} className={`flex items-center justify-between py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                  <span className="text-ink">{row.label}</span>
                  <span className="font-bold text-ink">{row.value}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "superstars" &&
            (() => {
              const topBatter = Object.values(inningsState?.battingStats ?? {}).sort((a, b) => b.runs - a.runs)[0];
              const topBowler = Object.values(inningsState?.bowlingStats ?? {}).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];
              const card = (label: string, name: string, line: string) => (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
                  <PlayerInitialAvatar name={name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-muted">{label}</p>
                    <p className="truncate text-base font-bold text-ink">{name}</p>
                    <p className="text-sm text-muted">{line}</p>
                  </div>
                </div>
              );
              return (
                <div className="grid gap-3 md:grid-cols-2">
                  {topBatter && topBatter.runs > 0 && card("TOP SCORER", topBatter.name, `${topBatter.runs} (${topBatter.balls})`)}
                  {topBowler && topBowler.wickets > 0 && card("TOP WICKET-TAKER", topBowler.name, `${topBowler.wickets}-${topBowler.runsConceded}`)}
                  {(!topBatter || topBatter.runs === 0) && (!topBowler || topBowler.wickets === 0) && <p className="py-10 text-center text-sm text-muted md:col-span-2">No standout performances yet — keep scoring!</p>}
                </div>
              );
            })()}
        </div>
      )}

      {selectBatsmanOpen && (
        <SelectPlayerPanel
          title={needsStriker ? "Select Striker" : "Select Non-Striker"}
          names={battingPlayers}
          excluded={excludeForNextBatsman}
          selectedName={needsStriker ? null : effectiveStriker}
          benchedNames={benchedNames}
          onToggleBench={toggleBench}
          onClose={() => setSelectBatsmanOpen(false)}
          onSelect={(name) => {
            if (needsStriker) {
              setPendingStriker(name);
              if (!effectiveNonStriker) return;
            } else setPendingNonStriker(name);
            setSelectBatsmanOpen(false);
          }}
          onAddPlayer={(name) => handleAddPlayer("batting", name)}
          addPlayerPending={addRosterPlayer.isPending}
          submitting={addBall.isPending}
        />
      )}
      {selectBowlerOpen && (
        <SelectPlayerPanel
          title="Select Bowler"
          names={bowlingPlayers}
          excluded={inningsState?.previousOverBowler ? [inningsState.previousOverBowler] : []}
          selectedName={effectiveBowler}
          benchedNames={benchedNames}
          onToggleBench={toggleBench}
          onClose={() => setSelectBowlerOpen(false)}
          onSelect={(name) => (setPendingBowler(name), setSelectBowlerOpen(false))}
          onAddPlayer={(name) => handleAddPlayer("bowling", name)}
          addPlayerPending={addRosterPlayer.isPending}
          submitting={addBall.isPending}
        />
      )}
      {selectFielderOpen && (
        <SelectPlayerPanel
          title="Select Fielder"
          names={bowlingPlayers}
          excluded={[]}
          selectedName={fielderName || null}
          benchedNames={benchedNames}
          onToggleBench={toggleBench}
          onClose={() => setSelectFielderOpen(false)}
          onSelect={(name) => (setFielderName(name), setSelectFielderOpen(false))}
          onAddPlayer={(name) => handleAddPlayer("bowling", name)}
          addPlayerPending={addRosterPlayer.isPending}
          submitting={addBall.isPending}
        />
      )}
      {panel === "WICKET" && wicketType === "RUN_OUT" && effectiveStriker && effectiveNonStriker && (
        <RunOutPanel
          strikerName={effectiveStriker}
          nonStrikerName={effectiveNonStriker}
          bowlingPlayers={bowlingPlayers}
          benchedNames={benchedNames}
          onToggleBench={toggleBench}
          onAddPlayer={(name) => handleAddPlayer("bowling", name)}
          addPlayerPending={addRosterPlayer.isPending}
          onCancel={closePanel}
          onSubmit={handleRunOutSubmit}
          submitting={addBall.isPending}
        />
      )}
      {panel === "WICKET" && wicketType === "STUMPED" && (
        <SelectPlayerPanel
          title="Stumped By"
          names={bowlingPlayers}
          excluded={[]}
          selectedName={null}
          benchedNames={benchedNames}
          onToggleBench={toggleBench}
          onClose={closePanel}
          onSelect={(name) => handleStumpedSubmit(name, stumpedWide)}
          onAddPlayer={(name) => handleAddPlayer("bowling", name)}
          addPlayerPending={addRosterPlayer.isPending}
          submitting={addBall.isPending}
          listLabel="Select the wicket keeper :"
          headerExtra={
            <div className="mb-6">
              <p className="mb-3 text-sm font-bold text-ink">Is that a wide ball? (Optional)</p>
              <button type="button" aria-pressed={stumpedWide} onClick={() => setStumpedWide((w) => !w)} className={`rounded-xl border-[1.5px] px-5 py-3 text-sm font-bold ${stumpedWide ? "border-primary bg-primary text-white" : "border-border bg-surface text-ink"}`}>
                Wide
              </button>
            </div>
          }
        />
      )}

      {dialog === "ABANDON" && (
        <ConfirmDialog title="Abandon Match" message="Do you want to abandon the match?" confirmLabel="Abandon" disabledLabel={`Wait : ${abandonCountdown}`} confirmDisabled={abandonCountdown > 0} onConfirm={handleConfirmAbandon} onCancel={() => setDialog(null)} />
      )}
      {dialog === "END_INNINGS" && <ConfirmDialog title="End Innings" message="Are you sure you want to end this innings?" confirmLabel="End Innings" onConfirm={handleConfirmEndInnings} onCancel={() => setDialog(null)} />}
      {dialog === "TARGET_BLOCKED" && <ConfirmDialog title="Not Allowed" message="Target can be changed only after the first innings." singleButton onCancel={() => setDialog(null)} />}
      {dialog === "RAIN_DL" && (
        <ConfirmDialog
          title="Rain Stopped Play"
          message={`This ends the innings right now at ${formatOvers(rainDLOvers * 6)} overs — the current score stands, and team 2 will be set the same reduced overs (the D/L target is then calculated once their innings starts).`}
          confirmLabel="End Innings Now"
          onConfirm={handleConfirmRainDL}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "RAIN_DL_CHASE" && rainDLChaseVerdict && (
        <ConfirmDialog
          title="Rain Stopped Play"
          message={`No further ball can be bowled. At this point the D/L par score is ${rainDLChaseVerdict.parScore} — ${rainDLChaseVerdict.summary}. Confirm to end the match with this result.`}
          confirmLabel="Confirm Result"
          onConfirm={handleConfirmRainDLChase}
          onCancel={() => setDialog(null)}
        />
      )}

      {/* Off-screen share card, rasterised by "Share Match Summary". */}
      {scorecardInnings.length > 0 && (
        <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0">
          <MatchSummaryShareCard ref={shareCardRef} scoringCode={match.scoring_code ?? ""} innings={shareCardInnings} resultSummary={match.result_summary ?? ""} playerOfTheMatch={computePlayerOfTheMatch(scorecardInnings)} dateLabel={shareCardDate} />
        </div>
      )}
    </div>
  );
}
