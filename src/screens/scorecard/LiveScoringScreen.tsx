import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import {
  useCricketMatch,
  useAddCricketBall,
  useDeleteLastCricketBall,
  useStartSecondInnings,
  useMarkInningsComplete,
  useCompleteCricketMatch,
} from "../../hooks/useCricket";
import { useSyncCricketMatchResult } from "../../hooks/useTournamentMatches";
import { ballRowToEvent, friendlyCricketError } from "../../lib/api/cricket";
import {
  replayInnings,
  formatOvers,
  computeRunRate,
  computeRequiredRunRate,
  matchResultSummary,
  type BallEvent,
  type ExtraType,
  type WicketType,
} from "../../lib/cricketScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
type Route = RouteProp<ScorecardStackParamList, "LiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "LiveScoring">;

const RUN_OPTIONS = [0, 1, 2, 3, 4, 6];
const WIDE_OPTIONS = [0, 1, 2, 3, 4, 5];
const NOBALL_BAT_OPTIONS = [0, 1, 2, 3, 4, 6];
const BYE_OPTIONS = [0, 1, 2, 3, 4];
const EXTRA_TYPES: { label: string; value: ExtraType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Wide", value: "WIDE", icon: "swap-horizontal-outline" },
  { label: "No Ball", value: "NOBALL", icon: "ban-outline" },
  { label: "Bye", value: "BYE", icon: "walk-outline" },
  { label: "Leg Bye", value: "LEGBYE", icon: "hand-left-outline" },
];
const WICKET_TYPES: { label: string; value: WicketType }[] = [
  { label: "Bowled", value: "BOWLED" },
  { label: "Caught", value: "CAUGHT" },
  { label: "LBW", value: "LBW" },
  { label: "Run Out", value: "RUN_OUT" },
  { label: "Stumped", value: "STUMPED" },
  { label: "Hit Wicket", value: "HIT_WICKET" },
  { label: "Retired Out", value: "RETIRED_OUT" },
];

// The three questions needed before scoring can start at the very beginning
// of an innings (opening striker, non-striker, opening bowler) share one
// continuous modal with a progress stepper instead of three separate popups
// closing and reopening one after another. The same modal is reused
// mid-innings — a wicket needs a replacement batsman, an over completing
// needs a new bowler — but those are each a single standalone question, so
// they get their own wording ("Select Next Batsman" / "Select Next Bowler")
// and no stepper, since there's nothing else queued up after them.
const OPENING_SETUP_STEPS = [
  { key: "striker", title: "Select Opening Striker", subtitle: "Who's facing the first ball?" },
  { key: "nonStriker", title: "Select Non-Striker", subtitle: "Who's at the other end?" },
  { key: "bowler", title: "Select Opening Bowler", subtitle: "Who's bowling this over?" },
] as const;

function PlayerAvatar({ name }: { name: string }) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: 38, height: 38, backgroundColor: colors.primaryLight }}
    >
      <Text className="font-bold" style={{ color: colors.primaryDark, fontSize: 15 }}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

function InningsSetupModal({
  kind,
  isOpeningSetup,
  strikerName,
  nonStrikerName,
  battingNames,
  bowlingNames,
  excludeForBatsman,
  excludeForBowler,
  onSelect,
  onBack,
}: {
  kind: "striker" | "nonStriker" | "bowler";
  // True only for the very start of the innings, before the first ball —
  // false for any later replacement (wicket, new over), even though it
  // reuses the same "striker"/"nonStriker"/"bowler" kind.
  isOpeningSetup: boolean;
  strikerName: string | null;
  nonStrikerName: string | null;
  battingNames: string[];
  bowlingNames: string[];
  excludeForBatsman: string[];
  excludeForBowler?: string[];
  onSelect: (name: string) => void;
  onBack: () => void;
}) {
  const openingStepIndex = kind === "striker" ? 0 : kind === "nonStriker" ? 1 : 2;
  const showStepper = isOpeningSetup;

  const title = isOpeningSetup
    ? OPENING_SETUP_STEPS[openingStepIndex].title
    : kind === "bowler"
      ? "Select Next Bowler"
      : "Select Next Batsman";
  const subtitle = isOpeningSetup
    ? OPENING_SETUP_STEPS[openingStepIndex].subtitle
    : kind === "bowler"
      ? "Who's bowling the next over?"
      : "Who's coming in to bat?";

  const names =
    kind === "bowler"
      ? bowlingNames.filter((n) => !excludeForBowler?.includes(n))
      : battingNames.filter((n) => !excludeForBatsman.includes(n));

  return (
    <Modal visible animationType="slide" transparent>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 32, maxHeight: "80%" }}>
          {/* Step progress — only during the genuine opening sequence, not a
              standalone mid-innings replacement. */}
          {showStepper && (
            <View className="flex-row items-center mb-4">
              {OPENING_SETUP_STEPS.map((s, i) => (
                <View key={s.key} className="flex-1 flex-row items-center">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 26,
                      height: 26,
                      backgroundColor: i <= openingStepIndex ? colors.primary : "#F3F4F6",
                    }}
                  >
                    {i < openingStepIndex ? (
                      <Ionicons name="checkmark" size={14} color="white" />
                    ) : (
                      <Text
                        className="font-bold"
                        style={{ fontSize: 11, color: i === openingStepIndex ? "white" : colors.muted }}
                      >
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  {i < OPENING_SETUP_STEPS.length - 1 && (
                    <View
                      style={{
                        flex: 1,
                        height: 2,
                        marginHorizontal: 4,
                        backgroundColor: i < openingStepIndex ? colors.primary : "#F3F4F6",
                      }}
                    />
                  )}
                </View>
              ))}
            </View>
          )}

          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-lg font-bold text-ink">{title}</Text>
              <Text className="text-muted text-xs mt-0.5">{subtitle}</Text>
            </View>
            {showStepper && openingStepIndex > 0 && (
              <Pressable onPress={onBack} hitSlop={8} className="flex-row items-center pt-0.5" style={{ gap: 2 }}>
                <Ionicons name="chevron-back" size={16} color={colors.primaryDark} />
                <Text className="text-sm font-semibold" style={{ color: colors.primaryDark }}>Back</Text>
              </Pressable>
            )}
          </View>

          {/* Already-picked names, kept visible for context instead of
              disappearing once you move to the next question — only
              relevant during the multi-step opening sequence. */}
          {showStepper && openingStepIndex > 0 && (
            <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
              {strikerName && (
                <View className="flex-row items-center bg-primary-light rounded-full px-3 py-1.5" style={{ gap: 5 }}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primaryDark} />
                  <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }}>
                    Striker: {strikerName}
                  </Text>
                </View>
              )}
              {openingStepIndex > 1 && nonStrikerName && (
                <View className="flex-row items-center bg-primary-light rounded-full px-3 py-1.5" style={{ gap: 5 }}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primaryDark} />
                  <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }}>
                    Non-Striker: {nonStrikerName}
                  </Text>
                </View>
              )}
            </View>
          )}

          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            {names.map((name) => (
              <Pressable
                key={name}
                onPress={() => onSelect(name)}
                className="flex-row items-center rounded-2xl mb-2.5 px-3 py-2.5 border border-border bg-white"
              >
                <View className="mr-3">
                  <PlayerAvatar name={name} />
                </View>
                <Text className="text-ink text-base font-medium flex-1">{name}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {names.length === 0 && (
              <Text className="text-muted text-sm text-center py-6">No players available.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RunPad({
  options,
  onPress,
  label,
  disabled,
  highlightBoundaries,
}: {
  options: number[];
  onPress: (n: number) => void;
  label?: string;
  disabled?: boolean;
  // Only meaningful for panels where the numbers really are runs scored off
  // the bat (the main run pad, and the no-ball "runs off the bat" pad) — a
  // 4 there is a genuine boundary. Wide/bye totals reuse the same component
  // but the numbers mean something else, so they never pass this.
  highlightBoundaries?: boolean;
}) {
  return (
    <View>
      {label && <Text className="text-muted text-xs font-semibold mb-2">{label}</Text>}
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((n) => {
          const isFour = highlightBoundaries && n === 4;
          const isSix = highlightBoundaries && n === 6;
          return (
            <Pressable
              key={n}
              onPress={() => onPress(n)}
              disabled={disabled}
              className="items-center justify-center rounded-xl"
              style={{
                width: 52,
                height: 52,
                opacity: disabled ? 0.5 : 1,
                backgroundColor: isSix ? colors.primary : isFour ? colors.primaryLight : "#F3F4F6",
              }}
            >
              <Text
                className="font-bold text-base"
                style={{ color: isSix ? "white" : isFour ? colors.primaryDark : colors.ink }}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function LiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useCricketMatch(params.matchId);
  const addBall = useAddCricketBall(params.matchId);
  const deleteLastBall = useDeleteLastCricketBall(params.matchId);
  const startSecondInnings = useStartSecondInnings(params.matchId);
  const markInningsComplete = useMarkInningsComplete(params.matchId);
  const completeMatch = useCompleteCricketMatch();
  const syncTournamentResult = useSyncCricketMatchResult();

  const [pendingStriker, setPendingStriker] = useState<string | null>(null);
  const [pendingNonStriker, setPendingNonStriker] = useState<string | null>(null);
  const [pendingBowler, setPendingBowler] = useState<string | null>(null);
  const [extraMode, setExtraMode] = useState<ExtraType | "WICKET" | null>(null);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  const [wicketEnd, setWicketEnd] = useState<"striker" | "nonStriker" | null>(null);
  const [fielderName, setFielderName] = useState("");

  const currentInnings = useMemo(() => {
    if (!match) return undefined;
    return match.cricket_innings.find((i) => !i.is_completed);
  }, [match]);

  const ballEvents: BallEvent[] = useMemo(() => {
    if (!currentInnings) return [];
    return [...currentInnings.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
  }, [currentInnings]);

  const battingTeam = (currentInnings?.batting_team ?? null) as "A" | "B" | null;
  const battingPlayers =
    battingTeam === "A" ? (match?.team_a_players ?? []) : (match?.team_b_players ?? []);
  const bowlingPlayers =
    battingTeam === "A" ? (match?.team_b_players ?? []) : (match?.team_a_players ?? []);
  const battingTeamName = battingTeam === "A" ? match?.team_a_name : match?.team_b_name;

  const inningsState = useMemo(() => {
    if (!battingTeam || !match) return null;
    const opener1 = ballEvents[0]?.strikerName ?? pendingStriker ?? "";
    const opener2 = ballEvents[0]?.nonStrikerName ?? pendingNonStriker ?? "";
    if (!opener1 || !opener2) return null;
    return replayInnings(ballEvents, battingTeam, match.overs_limit, battingPlayers.length, opener1, opener2);
  }, [ballEvents, battingTeam, match, battingPlayers.length, pendingStriker, pendingNonStriker]);

  // Only relevant chasing in the 2nd innings.
  const firstInnings = useMemo(() => {
    if (!match || currentInnings?.innings_number !== 2) return null;
    const first = match.cricket_innings.find((i) => i.innings_number === 1);
    if (!first) return null;
    const balls = [...first.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
    if (balls.length === 0) return null;
    const firstBattingTeam = first.batting_team as "A" | "B";
    const firstBattingPlayers = firstBattingTeam === "A" ? match.team_a_players : match.team_b_players;
    return replayInnings(
      balls,
      firstBattingTeam,
      match.overs_limit,
      firstBattingPlayers.length,
      balls[0].strikerName,
      balls[0].nonStrikerName
    );
  }, [match, currentInnings]);

  const target = firstInnings ? firstInnings.runs + 1 : null;
  const chaseComplete = !!(target && inningsState && inningsState.runs >= target);
  const inningsOver = !!inningsState?.isComplete || chaseComplete;

  // "Start 2nd Innings" chains two mutations (mark innings 1 complete, then
  // — in its onSuccess — insert the innings 2 row). In the network gap
  // between them, innings 1 is already completed but innings 2 doesn't
  // exist yet, so currentInnings (the not-yet-completed innings) is
  // momentarily undefined — which used to make the button briefly flash to
  // "View Final Scorecard" before snapping back. Looking at the full innings
  // list instead of the transient currentInnings avoids that gap.
  const innings1Row = match?.cricket_innings.find((i) => i.innings_number === 1);
  const innings2Row = match?.cricket_innings.find((i) => i.innings_number === 2);
  const isBetweenInnings = !!innings1Row?.is_completed && !innings2Row;

  const effectiveStriker = inningsState?.striker ?? pendingStriker;
  const effectiveNonStriker = inningsState?.nonStriker ?? pendingNonStriker;
  const effectiveBowler = inningsState?.currentBowler ?? pendingBowler;
  // Once the last innings is marked complete there's no active innings left
  // (currentInnings is undefined) — without this, the "Select Opening
  // Striker" picker would flash up for the split second between finishing
  // the match and landing on the final scorecard.
  const hasActiveInnings = !!currentInnings;
  const needsStriker = hasActiveInnings && !inningsOver && !effectiveStriker;
  const needsNonStriker = hasActiveInnings && !inningsOver && !!effectiveStriker && !effectiveNonStriker;
  const needsBowler = hasActiveInnings && !inningsOver && !!effectiveStriker && !!effectiveNonStriker && !effectiveBowler;
  const readyToScore = hasActiveInnings && !inningsOver && !!effectiveStriker && !!effectiveNonStriker && !!effectiveBowler;

  // True only before the innings' very first ball — once a ball has been
  // recorded, any further striker/non-striker/bowler need is a mid-innings
  // replacement (a wicket, or a new over), not the opening setup.
  const isOpeningSetup = ballEvents.length === 0;
  // A replacement batsman can't be someone already dismissed, or the
  // batsman still in at the other end.
  const outBatsmen = inningsState
    ? Object.keys(inningsState.battingStats).filter((n) => inningsState.battingStats[n].isOut)
    : [];
  const otherEndBatsman = needsStriker ? effectiveNonStriker : needsNonStriker ? effectiveStriker : null;
  const excludeForNextBatsman = otherEndBatsman ? [...outBatsmen, otherEndBatsman] : outBatsmen;

  if (isLoading || !match) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const submitBall = (partial: Omit<BallEvent, "seq" | "strikerName" | "nonStrikerName" | "bowlerName">) => {
    if (!currentInnings || !effectiveStriker || !effectiveNonStriker || !effectiveBowler) return;
    const seq = ballEvents.length + 1;
    const ball: BallEvent = {
      seq,
      strikerName: effectiveStriker,
      nonStrikerName: effectiveNonStriker,
      bowlerName: effectiveBowler,
      ...partial,
    };
    addBall.mutate(
      { inningsId: currentInnings.id, seq, ball },
      {
        onSuccess: () => {
          setPendingStriker(null);
          setPendingNonStriker(null);
          setPendingBowler(null);
          setExtraMode(null);
          setWicketType(null);
          setWicketEnd(null);
          setFielderName("");
        },
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not record ball.")),
      }
    );
  };

  const handleRuns = (runs: number) => {
    submitBall({ runsBatted: runs, extraType: null, extraRuns: 0, isWicket: false, wicketType: null, dismissedName: null, fielderName: null });
  };

  const handleWide = (runsRun: number) => {
    // The mandatory 1 for the wide itself is always added on top of whatever
    // the batsmen ran — selecting 0 records a bare wide (1 total run),
    // selecting 1 records a wide plus a run (2 total runs), and so on.
    submitBall({ runsBatted: 0, extraType: "WIDE", extraRuns: runsRun + 1, isWicket: false, wicketType: null, dismissedName: null, fielderName: null });
  };

  const handleNoBall = (batRuns: number) => {
    submitBall({ runsBatted: batRuns, extraType: "NOBALL", extraRuns: 1, isWicket: false, wicketType: null, dismissedName: null, fielderName: null });
  };

  const handleByeLegBye = (type: "BYE" | "LEGBYE", runs: number) => {
    submitBall({ runsBatted: 0, extraType: type, extraRuns: runs, isWicket: false, wicketType: null, dismissedName: null, fielderName: null });
  };

  const handleWicket = (runsCompleted: number) => {
    if (!wicketType) return;
    const dismissed =
      wicketType === "RUN_OUT"
        ? wicketEnd === "nonStriker"
          ? effectiveNonStriker
          : effectiveStriker
        : effectiveStriker;
    submitBall({
      runsBatted: wicketType === "RUN_OUT" ? runsCompleted : 0,
      extraType: null,
      extraRuns: 0,
      isWicket: true,
      wicketType,
      dismissedName: dismissed,
      fielderName: fielderName.trim() || null,
    });
  };

  const handleUndo = () => {
    if (!currentInnings || ballEvents.length === 0) return;
    const last = ballEvents[ballEvents.length - 1];
    Alert.alert("Undo Last Ball", "Remove the most recent delivery?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: () =>
          deleteLastBall.mutate(
            { inningsId: currentInnings.id, seq: last.seq },
            {
              onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not undo.")),
            }
          ),
      },
    ]);
  };

  const handleStartSecondInnings = () => {
    if (!currentInnings || !battingTeam) return;
    markInningsComplete.mutate(currentInnings.id, {
      onSuccess: () => {
        startSecondInnings.mutate(battingTeam === "A" ? "B" : "A", {
          onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not start 2nd innings.")),
        });
      },
    });
  };

  const handleFinishMatch = () => {
    if (!currentInnings || !inningsState || !firstInnings) return;
    const summary = matchResultSummary(match.team_a_name, match.team_b_name, firstInnings, inningsState);
    // Same comparison matchResultSummary makes internally, just kept as a
    // plain A/B/tie result so it can be carried over to the tournament
    // match this scorecard was started from (if any) — see
    // syncCricketMatchResult.
    const teamAWon: boolean | null =
      inningsState.runs === firstInnings.runs ? null : (inningsState.runs > firstInnings.runs) === (inningsState.battingTeam === "A");
    markInningsComplete.mutate(currentInnings.id, {
      onSuccess: () => {
        completeMatch.mutate(
          { matchId: match.id, resultSummary: summary },
          {
            onSuccess: () => {
              // Best-effort — a sync failure (e.g. this wasn't actually a
              // tournament match) shouldn't block the host from seeing
              // their finished scorecard.
              syncTournamentResult.mutate({ cricketMatchId: match.id, teamAWon });
              navigation.replace("FullScorecard", { matchId: match.id });
            },
            onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not complete match.")),
          }
        );
      },
    });
  };

  const battingStat = (name: string | null) => (name && inningsState ? inningsState.battingStats[name] : undefined);
  const bowlingStat = (name: string | null) => (name && inningsState ? inningsState.bowlingStats[name] : undefined);
  const strikerStat = battingStat(effectiveStriker);
  const nonStrikerStat = battingStat(effectiveNonStriker);
  const bowlerStat = bowlingStat(effectiveBowler);

  const runRate = inningsState ? computeRunRate(inningsState.runs, inningsState.legalBalls) : 0;
  const requiredRunRate =
    target && inningsState ? computeRequiredRunRate(target, inningsState.runs, inningsState.legalBalls, match.overs_limit) : null;

  // Only this over's deliveries — resets to empty right as a new over
  // starts, rather than a rolling last-6 window that used to keep the
  // previous over's balls on screen after the first ball of the next one.
  const thisOverBalls: BallEvent[] = [];
  {
    let legalCount = 0;
    for (const b of ballEvents) {
      thisOverBalls.push(b);
      const isLegal = b.extraType !== "WIDE" && b.extraType !== "NOBALL";
      if (isLegal) legalCount += 1;
      if (legalCount === 6) {
        thisOverBalls.length = 0;
        legalCount = 0;
      }
    }
  }

  const runsNeeded = target && inningsState ? Math.max(target - inningsState.runs, 0) : null;
  const ballsLeft = target && inningsState ? Math.max(match.overs_limit * 6 - inningsState.legalBalls, 0) : null;

  return (
    <View className="flex-1 bg-white">
      <View
        className="overflow-hidden"
        style={{ backgroundColor: "#0E4429", paddingTop: insets.top + 16, paddingBottom: 16 }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: "rgba(255,255,255,0.06)",
            top: -80,
            right: -50,
          }}
        />
        <View className="flex-row items-center px-4" style={{ gap: 10 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
              <Text className="text-white font-bold text-lg" numberOfLines={1}>
                {match.team_a_name} vs {match.team_b_name}
              </Text>
              {match.status === "IN_PROGRESS" ? (
                <View className="flex-row items-center bg-red-500 rounded-full px-2 py-0.5" style={{ gap: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "white" }} />
                  <Text className="text-white text-[10px] font-bold">LIVE</Text>
                </View>
              ) : null}
            </View>
            {match.venue ? (
              <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }} numberOfLines={1}>
                  {match.venue}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => navigation.navigate("FullScorecard", { matchId: match.id })}
            hitSlop={8}
            className="items-center justify-center rounded-full"
            style={{ width: 38, height: 38, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}
          >
            <Ionicons name="stats-chart" size={17} color="white" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Score header */}
        <View className="bg-white rounded-2xl border border-border p-4 mb-4" style={cardShadow}>
          <Text className="text-xs font-bold" style={{ color: colors.primaryDark }}>
            {battingTeamName} batting {currentInnings?.innings_number === 2 ? "(2nd innings)" : "(1st innings)"}
          </Text>
          <View className="flex-row items-center justify-between mt-1.5">
            <View className="flex-row items-end" style={{ gap: 8 }}>
              <Text className="text-ink font-extrabold text-3xl">
                {inningsState?.runs ?? 0}/{inningsState?.wickets ?? 0}
              </Text>
              <Text className="text-muted text-base mb-1">
                ({formatOvers(inningsState?.legalBalls ?? 0)} ov)
              </Text>
            </View>
            {runsNeeded !== null && ballsLeft !== null ? (
              <View className="rounded-2xl px-3 py-2" style={{ backgroundColor: colors.primaryLight, maxWidth: 150 }}>
                <Text className="text-xs font-bold text-center" style={{ color: colors.primaryDark }}>
                  {runsNeeded} runs needed from {ballsLeft} balls
                </Text>
              </View>
            ) : null}
          </View>

          <View className="h-px bg-border mt-3 mb-2.5" />

          <View className="flex-row items-center">
            <View className="flex-1 items-center">
              <Text className="text-muted text-xs">CRR</Text>
              <Text className="text-ink font-bold text-base mt-0.5">{runRate.toFixed(2)}</Text>
            </View>
            {target ? (
              <>
                <View style={{ width: 1, height: 30, backgroundColor: colors.border }} />
                <View className="flex-1 items-center">
                  <Text className="text-muted text-xs">Target</Text>
                  <Text className="text-ink font-bold text-base mt-0.5">{target}</Text>
                </View>
                <View style={{ width: 1, height: 30, backgroundColor: colors.border }} />
                <View className="flex-1 items-center">
                  <Text className="text-muted text-xs">RRR</Text>
                  <Text className="text-ink font-bold text-base mt-0.5">
                    {requiredRunRate !== null ? requiredRunRate.toFixed(2) : "—"}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {inningsOver || !hasActiveInnings ? (
          <View className="bg-white rounded-2xl border border-border p-5 items-center" style={cardShadow}>
            <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
            <Text className="text-ink font-bold text-lg mt-2">
              {currentInnings?.innings_number === 1 || isBetweenInnings ? "Innings Complete" : "Match Complete"}
            </Text>
            {currentInnings?.innings_number === 1 || isBetweenInnings ? (
              <Pressable
                onPress={handleStartSecondInnings}
                disabled={markInningsComplete.isPending || startSecondInnings.isPending}
                className="bg-primary rounded-xl px-5 py-3 mt-4"
                style={primaryButtonShadow}
              >
                <Text className="text-white font-semibold">Start 2nd Innings</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={hasActiveInnings ? handleFinishMatch : () => navigation.replace("FullScorecard", { matchId: match.id })}
                disabled={markInningsComplete.isPending || completeMatch.isPending}
                className="bg-primary rounded-xl px-5 py-3 mt-4"
                style={primaryButtonShadow}
              >
                <Text className="text-white font-semibold">View Final Scorecard</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {/* Batsmen & bowler */}
            <View className="flex-row" style={{ gap: 10 }}>
              <View className="flex-1 bg-white rounded-2xl border border-border p-3" style={cardShadow}>
                <View className="flex-row items-center mb-1.5" style={{ gap: 5 }}>
                  <MaterialCommunityIcons name="cricket" size={13} color={colors.primaryDark} />
                  <Text className="text-muted text-xs font-semibold">Batting</Text>
                </View>
                {effectiveStriker && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-ink text-sm font-bold flex-1" numberOfLines={1}>
                      {effectiveStriker}*
                    </Text>
                    <View className="flex-row items-center" style={{ gap: 3 }}>
                      <Text className="text-ink text-sm font-semibold">
                        {strikerStat?.runs ?? 0} ({strikerStat?.balls ?? 0})
                      </Text>
                      <Ionicons name="play" size={9} color={colors.primary} />
                    </View>
                  </View>
                )}
                {effectiveNonStriker && (
                  <View className="flex-row items-center justify-between mt-1">
                    <Text className="text-muted text-sm flex-1" numberOfLines={1}>
                      {effectiveNonStriker}
                    </Text>
                    <Text className="text-muted text-sm">
                      {nonStrikerStat?.runs ?? 0} ({nonStrikerStat?.balls ?? 0})
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1 bg-white rounded-2xl border border-border p-3" style={cardShadow}>
                <View className="flex-row items-center mb-1.5" style={{ gap: 5 }}>
                  <Ionicons name="ellipse" size={11} color={colors.primaryDark} />
                  <Text className="text-muted text-xs font-semibold">Bowling</Text>
                </View>
                {effectiveBowler && (
                  <>
                    <Text className="text-ink text-sm font-bold" numberOfLines={1}>
                      {effectiveBowler}
                    </Text>
                    <Text className="text-muted text-sm mt-1">
                      {formatOvers(bowlerStat?.legalBalls ?? 0)} - {bowlerStat?.maidens ?? 0} -{" "}
                      {bowlerStat?.runsConceded ?? 0} - {bowlerStat?.wickets ?? 0}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Recent balls (this over) */}
            <View className="bg-white rounded-2xl border border-border p-3.5 mt-4" style={cardShadow}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-ink font-bold text-base">Recent Balls</Text>
                <View className="flex-row items-center" style={{ gap: 3 }}>
                  <Text className="text-muted text-sm font-medium">This Over</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.muted} />
                </View>
              </View>
              <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                {Array.from({ length: Math.max(6, thisOverBalls.length) }).map((_, i) => {
                  const b = thisOverBalls[i];
                  if (!b) {
                    return (
                      <View
                        key={i}
                        className="items-center justify-center rounded-full"
                        style={{ width: 34, height: 34, backgroundColor: "#F3F4F6" }}
                      >
                        <Text className="text-muted text-xs font-bold">-</Text>
                      </View>
                    );
                  }
                  return (
                    <View
                      key={i}
                      className={`items-center justify-center rounded-full ${b.isWicket ? "bg-red-500" : b.extraType ? "bg-yellow-100" : "bg-gray-100"}`}
                      style={{ width: 34, height: 34 }}
                    >
                      <Text className={`text-xs font-bold ${b.isWicket ? "text-white" : "text-ink"}`}>
                        {b.isWicket
                          ? "W"
                          : b.extraType === "WIDE"
                            ? `Wd${b.extraRuns > 1 ? "+" + (b.extraRuns - 1) : ""}`
                            : b.extraType === "NOBALL"
                              ? `Nb${b.runsBatted > 0 ? "+" + b.runsBatted : ""}`
                              : b.extraType === "BYE"
                                ? `B${b.extraRuns}`
                                : b.extraType === "LEGBYE"
                                  ? `Lb${b.extraRuns}`
                                  : b.runsBatted}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Scoring pad — locked while a ball is being saved so a slow
                network or a fast double-tap can never fire two deliveries
                for the same ball (that used to surface a raw "duplicate key"
                database error instead of just... not doing anything twice). */}
            <View pointerEvents={addBall.isPending ? "none" : "auto"} style={{ opacity: addBall.isPending ? 0.5 : 1 }}>
            {readyToScore && extraMode === null && (
              <View className="mt-5">
                <Text className="text-ink font-bold text-base mb-3">Add Runs</Text>
                <RunPad options={RUN_OPTIONS} onPress={handleRuns} highlightBoundaries />

                <Text className="text-ink font-bold text-base mt-5 mb-3">Extras</Text>
                <View className="flex-row" style={{ gap: 8 }}>
                  {EXTRA_TYPES.map((type) => (
                    <Pressable
                      key={type.value}
                      onPress={() => setExtraMode(type.value)}
                      className="flex-1 items-center justify-center rounded-2xl border border-border bg-white py-3.5"
                      style={{ gap: 6 }}
                    >
                      <Ionicons name={type.icon} size={18} color={colors.ink} />
                      <Text className="text-ink font-semibold text-xs">{type.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={() => setExtraMode("WICKET")}
                  className="flex-row items-center justify-center bg-red-500 rounded-2xl py-3.5 mt-3"
                  style={{ gap: 8 }}
                >
                  <MaterialCommunityIcons name="gate" size={18} color="white" />
                  <Text className="text-white font-bold text-base">WICKET</Text>
                </Pressable>

                <Pressable
                  onPress={handleUndo}
                  disabled={ballEvents.length === 0 || deleteLastBall.isPending}
                  className="flex-row items-center justify-center border border-border bg-white rounded-2xl py-3 mt-3"
                  style={{ gap: 6, opacity: ballEvents.length === 0 ? 0.5 : 1 }}
                >
                  <Ionicons name="arrow-undo" size={16} color={colors.muted} />
                  <Text className="text-muted text-sm font-semibold">Undo Last Ball</Text>
                </Pressable>

                <View
                  className="flex-row items-center rounded-2xl px-4 py-3 mt-3"
                  style={{ backgroundColor: colors.primaryLight, gap: 8 }}
                >
                  <Ionicons name="bulb" size={16} color={colors.primaryDark} />
                  <Text className="text-xs font-medium flex-1" style={{ color: colors.primaryDark }}>
                    Tap a run or extra to add to the score
                  </Text>
                </View>
              </View>
            )}

            {readyToScore && extraMode === "WIDE" && (
              <View className="mt-5">
                <RunPad options={WIDE_OPTIONS} onPress={handleWide} label="Runs run on the wide" />
                <Pressable onPress={() => setExtraMode(null)} className="mt-3 py-2">
                  <Text className="text-muted text-center text-sm">Cancel</Text>
                </Pressable>
              </View>
            )}

            {readyToScore && extraMode === "NOBALL" && (
              <View className="mt-5">
                <RunPad options={NOBALL_BAT_OPTIONS} onPress={handleNoBall} label="Runs off the bat" highlightBoundaries />
                <Pressable onPress={() => setExtraMode(null)} className="mt-3 py-2">
                  <Text className="text-muted text-center text-sm">Cancel</Text>
                </Pressable>
              </View>
            )}

            {readyToScore && (extraMode === "BYE" || extraMode === "LEGBYE") && (
              <View className="mt-5">
                <RunPad options={BYE_OPTIONS} onPress={(n) => handleByeLegBye(extraMode, n)} label="Runs taken" />
                <Pressable onPress={() => setExtraMode(null)} className="mt-3 py-2">
                  <Text className="text-muted text-center text-sm">Cancel</Text>
                </Pressable>
              </View>
            )}

            {readyToScore && extraMode === "WICKET" && !wicketType && (
              <View className="mt-5">
                <Text className="text-muted text-xs font-semibold mb-2">How was the batsman out?</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {WICKET_TYPES.map((w) => (
                    <Pressable
                      key={w.value}
                      onPress={() => setWicketType(w.value)}
                      className="rounded-xl px-4 py-3 border border-border bg-white"
                    >
                      <Text className="text-ink font-semibold text-sm">{w.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setExtraMode(null)} className="mt-3 py-2">
                  <Text className="text-muted text-center text-sm">Cancel</Text>
                </Pressable>
              </View>
            )}

            {readyToScore && extraMode === "WICKET" && wicketType && (
              <View className="mt-5">
                {wicketType === "RUN_OUT" && (
                  <>
                    <Text className="text-muted text-xs font-semibold mb-2">Who was run out?</Text>
                    <View className="flex-row" style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => setWicketEnd("striker")}
                        className={`flex-1 items-center rounded-xl py-3 border ${wicketEnd === "striker" ? "border-primary bg-primary-light" : "border-border bg-white"}`}
                      >
                        <Text className="text-ink text-sm font-medium">{effectiveStriker}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setWicketEnd("nonStriker")}
                        className={`flex-1 items-center rounded-xl py-3 border ${wicketEnd === "nonStriker" ? "border-primary bg-primary-light" : "border-border bg-white"}`}
                      >
                        <Text className="text-ink text-sm font-medium">{effectiveNonStriker}</Text>
                      </Pressable>
                    </View>
                  </>
                )}
                {(wicketType === "CAUGHT" || wicketType === "STUMPED" || wicketType === "RUN_OUT") && (
                  <View className="mt-3">
                    <Text className="text-muted text-xs font-semibold mb-2">Fielder (optional)</Text>
                    <TextInput
                      value={fielderName}
                      onChangeText={setFielderName}
                      placeholder="Fielder name"
                      className="border border-border rounded-xl px-4 py-2.5 text-ink"
                    />
                  </View>
                )}
                {wicketType === "RUN_OUT" ? (
                  wicketEnd && (
                    <View className="mt-3">
                      <RunPad options={[0, 1, 2, 3]} onPress={handleWicket} label="Runs completed before the run out" />
                    </View>
                  )
                ) : (
                  <Pressable
                    onPress={() => handleWicket(0)}
                    disabled={addBall.isPending}
                    className="bg-red-500 rounded-xl py-3 items-center mt-4"
                  >
                    <Text className="text-white font-bold">Confirm Wicket</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    setExtraMode(null);
                    setWicketType(null);
                    setWicketEnd(null);
                    setFielderName("");
                  }}
                  className="mt-3 py-2"
                >
                  <Text className="text-muted text-center text-sm">Cancel</Text>
                </Pressable>
              </View>
            )}
            </View>
          </>
        )}
      </ScrollView>

      {(needsStriker || needsNonStriker || needsBowler) && (
        <InningsSetupModal
          kind={needsStriker ? "striker" : needsNonStriker ? "nonStriker" : "bowler"}
          isOpeningSetup={isOpeningSetup}
          strikerName={effectiveStriker}
          nonStrikerName={effectiveNonStriker}
          battingNames={battingPlayers}
          bowlingNames={bowlingPlayers}
          excludeForBatsman={excludeForNextBatsman}
          excludeForBowler={inningsState?.previousOverBowler ? [inningsState.previousOverBowler] : []}
          onSelect={(name) => {
            if (needsStriker) setPendingStriker(name);
            else if (needsNonStriker) setPendingNonStriker(name);
            else setPendingBowler(name);
          }}
          onBack={() => {
            if (needsNonStriker) setPendingStriker(null);
            else if (needsBowler) setPendingNonStriker(null);
          }}
        />
      )}
    </View>
  );
}
