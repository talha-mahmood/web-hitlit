import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer } from "expo-audio";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import TeamCrest from "../../components/TeamCrest";
import {
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
} from "../../hooks/useFootball";
import { friendlyFootballError, goalRowToEvent, penaltyKickRowToEvent, type RunningPhase } from "../../lib/api/football";
import { useSyncScorecardMatchResult } from "../../hooks/useTournamentMatches";
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
} from "../../lib/footballScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Route = RouteProp<ScorecardStackParamList, "FootballLiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "FootballLiveScoring">;

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

// Timeline-style goal list — minute, a colored dot connected to the next
// one, a team-colored ball badge, and the team name. Shared between the
// live-scoring view and the Match Complete summary.
function GoalHistoryCard({ goals, teamAName, teamBName }: { goals: GoalEvent[]; teamAName: string; teamBName: string }) {
  if (goals.length === 0) return null;
  return (
    <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
      <View
        className="flex-row items-center pb-3 mb-1"
        style={{ gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 26, height: 26, backgroundColor: colors.primaryLight }}
        >
          <Ionicons name="football" size={14} color={colors.primaryDark} />
        </View>
        <Text className="text-ink font-extrabold text-sm" style={{ letterSpacing: 0.5 }}>GOAL HISTORY</Text>
      </View>
      {goals.map((g, i) => {
        const teamColor = g.team === "A" ? colors.primary : "#1D4ED8";
        const teamBg = g.team === "A" ? colors.primaryLight : "#DBEAFE";
        return (
          <View key={g.seq} className="flex-row items-start" style={{ paddingVertical: 8 }}>
            <Text className="text-muted text-xs font-semibold" style={{ width: 44, marginTop: 8 }}>
              {g.minuteLabel}
            </Text>
            <View className="items-center" style={{ width: 12, marginTop: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: teamColor }} />
              {i < goals.length - 1 && <View style={{ width: 1, height: 26, backgroundColor: colors.border, marginTop: 4 }} />}
            </View>
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 30, height: 30, backgroundColor: teamBg, marginLeft: 8 }}
            >
              <Ionicons name="football" size={14} color={teamColor} />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-ink font-bold text-sm" numberOfLines={1}>
                {g.team === "A" ? teamAName : teamBName}
              </Text>
              <Text className="text-muted text-xs">Goal</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function FootballLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  // Goes back to wherever the scorer came from — the sport's match list in
  // the Scorecard tab, or a tournament's match list when started from
  // "Go To Scorecard" (that route doesn't exist in the other tab stacks).
  const leaveScorecard = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("FootballHome"));
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useFootballMatch(params.matchId);
  const addGoal = useAddFootballGoal(params.matchId);
  const deleteLastGoal = useDeleteLastFootballGoal(params.matchId);
  const addPenaltyKick = useAddPenaltyKick(params.matchId);
  const deleteLastPenaltyKick = useDeleteLastPenaltyKick(params.matchId);
  const startRunningPeriod = useStartRunningPeriod(params.matchId);
  const endRunningPeriod = useEndRunningPeriod(params.matchId);
  const pauseMatch = usePauseFootballMatch(params.matchId);
  const resumeMatch = useResumeFootballMatch(params.matchId);
  const startPenalties = useStartPenalties(params.matchId);
  const completeMatch = useCompleteFootballMatch(params.matchId);
  const syncTournamentResult = useSyncScorecardMatchResult();

  const [now, setNow] = useState(Date.now());
  const ringPlayer = useAudioPlayer(require("../../../assets/sounds/half-time-ring.wav"));
  // Which running phase's "time's up" ring is currently active for — guards
  // against re-firing every second once the boundary is crossed, and also
  // drives the "End ..." button turning red while it rings.
  const [ringingPhase, setRingingPhase] = useState<Phase | null>(null);

  const phase = (match?.phase ?? "NOT_STARTED") as Phase;
  const isRunning = RUNNING_PHASES.includes(phase);

  const endCurrentPeriod = () => {
    if (phase === "FIRST_HALF") {
      endRunningPeriod.mutate(
        { endingPhase: "FIRST_HALF", addedMinutes: 0, resultingPhase: "HALF_TIME" },
        { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the half.")) }
      );
    } else if (phase === "SECOND_HALF") {
      endRunningPeriod.mutate(
        { endingPhase: "SECOND_HALF", addedMinutes: 0, resultingPhase: "FULL_TIME" },
        { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the half.")) }
      );
    } else if (phase === "EXTRA_TIME_FIRST") {
      endRunningPeriod.mutate(
        { endingPhase: "EXTRA_TIME_FIRST", addedMinutes: 0, resultingPhase: "EXTRA_TIME_BREAK" },
        { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the period.")) }
      );
    } else if (phase === "EXTRA_TIME_SECOND") {
      endRunningPeriod.mutate(
        { endingPhase: "EXTRA_TIME_SECOND", addedMinutes: 0, resultingPhase: "EXTRA_TIME_FULL_TIME" },
        { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the period.")) }
      );
    }
  };

  useEffect(() => {
    ringPlayer.loop = true;
  }, [ringPlayer]);

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

  const matchConfig = {
    halfDurationMinutes: match?.half_duration_minutes ?? 45,
    extraTimePeriodMinutes: match?.extra_time_period_minutes ?? 15,
  };
  // While paused, freeze the clock at the instant it was stopped — reading
  // paused_at instead of the live-ticking `now` — rather than changing any
  // of the elapsed-time math itself.
  const pausedAtMs = match?.paused_at ? new Date(match.paused_at).getTime() : null;
  const isPaused = pausedAtMs !== null;
  const elapsedSeconds = timestamps ? computeElapsedSeconds(phase, timestamps, matchConfig, pausedAtMs ?? now) : 0;
  const clock = formatClock(elapsedSeconds);

  // The instant a running period reaches its scheduled length, ring
  // continuously and turn the "End ..." button red — the ring only stops
  // once the host taps that (now red) button, which immediately ends the
  // period. No popup: the button itself is the alert.
  const boundarySeconds = phaseBoundarySeconds(phase, matchConfig);
  const hasReachedScheduledEnd = isRunning && boundarySeconds !== undefined && elapsedSeconds >= boundarySeconds;
  const isRinging = ringingPhase === phase;
  useEffect(() => {
    if (!hasReachedScheduledEnd || ringingPhase === phase) return;
    setRingingPhase(phase);
    ringPlayer.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasReachedScheduledEnd, phase]);

  const handleEndPeriodPress = () => {
    // Deliberately doesn't clear `ringingPhase` — that would flip
    // `isRinging` false immediately (before the mutation resolves and
    // `phase` actually changes), which would flash the Stop/Start Time
    // button back into view for a moment. Leaving it set means the End
    // button just stays up (dimmed via isPending) until the next phase's
    // screen replaces this whole block.
    ringPlayer.pause();
    endCurrentPeriod();
  };

  const goals = useMemo(() => {
    if (!match) return [];
    return [...match.football_goals].sort((a, b) => a.seq - b.seq).map(goalRowToEvent);
  }, [match]);

  const penaltyKicks = useMemo(() => {
    if (!match) return [];
    return [...match.football_penalty_kicks].sort((a, b) => a.seq - b.seq).map(penaltyKickRowToEvent);
  }, [match]);

  const wentToExtraTime = !!match?.extra_time_first_kickoff_at;
  const scoreSummary = useMemo(() => computeScoreSummary(goals, phase, wentToExtraTime), [goals, phase, wentToExtraTime]);
  const shootout = phase === "PENALTIES" || phase === "COMPLETE" ? computePenaltyShootoutState(penaltyKicks) : null;

  // The moment a shootout is decided, persist the final result — nothing
  // further for the scorer to confirm.
  useEffect(() => {
    if (!match || phase !== "PENALTIES" || !shootout?.isDecided || match.status !== "IN_PROGRESS" || completeMatch.isPending) return;
    const summary = matchResultSummary(match.team_a_name, match.team_b_name, scoreSummary, shootout);
    completeMatch.mutate(
      { winnerTeam: shootout.winner, isDraw: false, resultSummary: summary },
      {
        onSuccess: () => {
          syncTournamentResult.mutate({ sport: "football", scorecardMatchId: params.matchId, teamAWon: shootout.winner === "A" });
        },
        onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not save the match result.")),
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shootout?.isDecided, match?.status]);

  if (isLoading || !match || !timestamps) {
    return (
      <View className="flex-1 items-center justify-center bg-green-50">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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
      const pausedDurationMs = Date.now() - pausedAtMs;
      const newKickoffAt = new Date(new Date(kickoffAt).getTime() + pausedDurationMs).toISOString();
      resumeMatch.mutate(
        { phase: phase as RunningPhase, newKickoffAt },
        { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not start the clock.")) }
      );
    } else {
      pauseMatch.mutate(undefined, {
        onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not stop the clock.")),
      });
    }
  };

  const handleGoal = (team: Team) => {
    if (!isRunning || isPaused || isRinging) return;
    const seq = goals.length + 1;
    const minuteLabel = formatGoalMinuteLabel(elapsedSeconds);
    addGoal.mutate(
      { seq, team, phase, minuteLabel },
      { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not record goal.")) }
    );
  };

  const handleUndo = () => {
    if (phase === "PENALTIES" && penaltyKicks.length > 0) {
      const last = penaltyKicks[penaltyKicks.length - 1];
      Alert.alert("Undo Last Kick", "Remove the most recent penalty kick?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo",
          style: "destructive",
          onPress: () =>
            deleteLastPenaltyKick.mutate(last.seq, {
              onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not undo.")),
            }),
        },
      ]);
      return;
    }
    if (goals.length === 0) return;
    const last = goals[goals.length - 1];
    Alert.alert("Undo Last Goal", "Remove the most recent goal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: () =>
          deleteLastGoal.mutate(last.seq, {
            onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not undo.")),
          }),
      },
    ]);
  };

  const handleStartSecondHalf = () =>
    startRunningPeriod.mutate("SECOND_HALF", {
      onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not start the second half.")),
    });

  const handleStartExtraTime = () =>
    startRunningPeriod.mutate("EXTRA_TIME_FIRST", {
      onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not start extra time.")),
    });

  const handleStartExtraTimeSecond = () =>
    startRunningPeriod.mutate("EXTRA_TIME_SECOND", {
      onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not start extra time.")),
    });

  const handleStartPenalties = () =>
    startPenalties.mutate(undefined, {
      onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not start the shootout.")),
    });

  const handleFinishAsIs = () => {
    const { a, b } = scoreSummary.current;
    const isDraw = a === b;
    const winnerTeam = isDraw ? null : a > b ? "A" : "B";
    const summary = matchResultSummary(match.team_a_name, match.team_b_name, scoreSummary, null);
    completeMatch.mutate(
      { winnerTeam, isDraw, resultSummary: summary },
      {
        onSuccess: () => {
          syncTournamentResult.mutate({
            sport: "football",
            scorecardMatchId: params.matchId,
            teamAWon: isDraw ? null : winnerTeam === "A",
          });
        },
        onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not finish the match.")),
      }
    );
  };

  const handlePenaltyKick = (team: Team, scored: boolean) => {
    const seq = penaltyKicks.length + 1;
    addPenaltyKick.mutate(
      { seq, team, scored },
      { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not record the kick.")) }
    );
  };

  // Match complete
  if (match.status === "COMPLETED") {
    const winnerName = match.winner_team === "A" ? match.team_a_name : match.winner_team === "B" ? match.team_b_name : null;
    const periodRows: { label: string; a: number; b: number }[] = [
      { label: "HALF-TIME", a: scoreSummary.halfTime.a, b: scoreSummary.halfTime.b },
      { label: "FULL-TIME", a: scoreSummary.fullTime.a, b: scoreSummary.fullTime.b },
      ...(scoreSummary.afterExtraTime ? [{ label: "EXTRA TIME", a: scoreSummary.afterExtraTime.a, b: scoreSummary.afterExtraTime.b }] : []),
      ...(shootout ? [{ label: "PENALTIES", a: shootout.scoreA, b: shootout.scoreB }] : []),
    ];
    return (
      <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center px-4 pb-3" style={{ gap: 6 }}>
          <Pressable onPress={() => leaveScorecard()} hitSlop={8} className="p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-ink font-extrabold text-base" numberOfLines={1}>Match Complete</Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>Football</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
          {/* Team crests + final score, with a winner ribbon */}
          <View className="bg-white rounded-2xl mb-4 overflow-hidden" style={{ ...cardShadow, position: "relative" }}>
            <View
              style={{
                position: "absolute", top: 0, left: 0, width: 0, height: 0,
                borderTopWidth: 56, borderRightWidth: 56,
                borderTopColor: colors.primary, borderRightColor: "transparent",
              }}
            />
            <View
              style={{
                position: "absolute", top: 0, right: 0, width: 0, height: 0,
                borderTopWidth: 56, borderLeftWidth: 56,
                borderTopColor: "#1D4ED8", borderLeftColor: "transparent",
              }}
            />
            <View className="p-5 items-center">
              <View
                className="flex-row items-center rounded-full mb-4"
                style={{ gap: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.primaryLight }}
              >
                <Ionicons name={winnerName ? "trophy" : "flag-outline"} size={15} color={colors.primaryDark} />
                <Text className="font-extrabold text-xs" style={{ color: colors.primaryDark, letterSpacing: 0.5 }}>
                  {winnerName ? `${winnerName.toUpperCase()} WINS` : "MATCH DRAWN"}
                </Text>
              </View>

              <View className="flex-row items-center justify-between w-full">
                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color={colors.primary} />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_a_name}</Text>
                </View>

                <View className="items-center" style={{ flex: 1 }}>
                  <View className="flex-row items-center" style={{ gap: 16 }}>
                    <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{scoreSummary.current.a}</Text>
                    <Text className="text-muted font-bold" style={{ fontSize: 22 }}>-</Text>
                    <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{scoreSummary.current.b}</Text>
                  </View>
                  <View className="rounded-full px-3 py-1 mt-2 bg-gray-100">
                    <Text className="text-muted text-xs font-extrabold" style={{ letterSpacing: 0.5 }}>FULL-TIME</Text>
                  </View>
                </View>

                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color="#1D4ED8" />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_b_name}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Period-by-period breakdown */}
          <View className="bg-white rounded-2xl p-4 mb-4" style={{ ...cardShadow, gap: 8 }}>
            {periodRows.map((row) => (
              <View key={row.label} className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Ionicons name="time-outline" size={14} color={colors.muted} />
                  <Text className="text-muted text-xs font-bold" style={{ letterSpacing: 0.5 }}>{row.label}</Text>
                </View>
                <Text className="text-ink font-bold text-sm">{row.a} - {row.b}</Text>
              </View>
            ))}
          </View>

          <GoalHistoryCard goals={goals} teamAName={match.team_a_name} teamBName={match.team_b_name} />

          <Pressable onPress={() => leaveScorecard()} style={primaryButtonShadow}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16 }}
            >
              <Ionicons name="arrow-back-circle-outline" size={18} color="white" style={{ marginRight: 8 }} />
              <Text className="text-white font-bold text-base">Back to Matches</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-4 pb-3" style={{ gap: 8 }}>
        <Pressable onPress={() => leaveScorecard()} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-row items-center px-2.5 py-1 rounded-full bg-red-500" style={{ gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "white" }} />
          <Text className="text-white text-xs font-bold">LIVE</Text>
        </View>
        <View className="flex-1">
          <Text className="text-ink font-extrabold text-base" numberOfLines={1}>
            {match.team_a_name} vs {match.team_b_name}
          </Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>Football</Text>
        </View>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        {/* Team crests + score */}
        <View className="bg-white rounded-2xl mb-4 overflow-hidden" style={{ ...cardShadow, position: "relative" }}>
          {/* Corner accent triangles, team-colored */}
          <View
            style={{
              position: "absolute", top: 0, left: 0, width: 0, height: 0,
              borderTopWidth: 56, borderRightWidth: 56,
              borderTopColor: colors.primary, borderRightColor: "transparent",
            }}
          />
          <View
            style={{
              position: "absolute", top: 0, right: 0, width: 0, height: 0,
              borderTopWidth: 56, borderLeftWidth: 56,
              borderTopColor: "#1D4ED8", borderLeftColor: "transparent",
            }}
          />

          <View className="p-5 items-center">
            <View className="flex-row items-center justify-between w-full">
              <View className="items-center" style={{ width: 92 }}>
                <TeamCrest color={colors.primary} />
                <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_a_name}</Text>
              </View>

              <View className="items-center" style={{ flex: 1 }}>
                <View className="flex-row items-center" style={{ gap: 16 }}>
                  <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{scoreSummary.current.a}</Text>
                  <Text className="text-muted font-bold" style={{ fontSize: 22 }}>-</Text>
                  <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{scoreSummary.current.b}</Text>
                </View>
                {isRunning && (
                  <View className="bg-white rounded-full px-3 py-1.5 mt-2" style={cardShadow}>
                    <Text className="text-ink font-extrabold" style={{ fontSize: 15 }}>{clock}</Text>
                  </View>
                )}
                <View className="rounded-full px-3 py-1 mt-2" style={{ backgroundColor: colors.primaryLight }}>
                  <Text className="text-xs font-extrabold" style={{ color: colors.primaryDark }}>
                    {PHASE_LABEL[phase] ?? phase}
                  </Text>
                </View>
              </View>

              <View className="items-center" style={{ width: 92 }}>
                <TeamCrest color="#1D4ED8" />
                <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_b_name}</Text>
              </View>
            </View>

            {/* Pitch halfway line + ball, purely decorative */}
            <View style={{ width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.7)", marginTop: 20 }} />
            <Ionicons
              name="football"
              size={28}
              color={colors.ink}
              style={{ position: "absolute", right: 14, bottom: -8, opacity: 0.9 }}
            />
          </View>
        </View>

        {/* Half-time snapshot, once known */}
        {(phase === "SECOND_HALF" || phase === "FULL_TIME" || phase === "EXTRA_TIME_FIRST" || phase === "EXTRA_TIME_BREAK" || phase === "EXTRA_TIME_SECOND" || phase === "EXTRA_TIME_FULL_TIME" || phase === "PENALTIES") && (
          <View className="flex-row items-center justify-between bg-white rounded-2xl px-4 py-3 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-semibold">HALF-TIME</Text>
            <Text className="text-ink font-bold text-sm">{scoreSummary.halfTime.a} - {scoreSummary.halfTime.b}</Text>
          </View>
        )}
        {phase === "PENALTIES" && (
          <View className="flex-row items-center justify-between bg-white rounded-2xl px-4 py-3 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-semibold">PENALTY SHOOTOUT</Text>
            <Text className="text-ink font-bold text-sm">{shootout?.scoreA ?? 0} - {shootout?.scoreB ?? 0}</Text>
          </View>
        )}

        {/* Goal history */}
        {phase !== "PENALTIES" && (
          <GoalHistoryCard goals={goals} teamAName={match.team_a_name} teamBName={match.team_b_name} />
        )}

        {/* Penalty kick history */}
        {phase === "PENALTIES" && penaltyKicks.length > 0 && (
          <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-semibold mb-2">KICKS</Text>
            {penaltyKicks.map((k) => (
              <View key={k.seq} className="flex-row items-center justify-between mt-1">
                <Text className="text-ink text-sm">{k.team === "A" ? match.team_a_name : match.team_b_name}</Text>
                <Ionicons name={k.scored ? "checkmark-circle" : "close-circle"} size={18} color={k.scored ? colors.primary : colors.danger} />
              </View>
            ))}
          </View>
        )}

        {/* Phase-specific controls */}
        {isRunning && (
          <>
            <View
              pointerEvents={addGoal.isPending || isPaused || isRinging ? "none" : "auto"}
              style={{ opacity: addGoal.isPending || isPaused || isRinging ? 0.5 : 1, gap: 10 }}
            >
              <Pressable onPress={() => handleGoal("A")} style={addGoal.isPending || isPaused || isRinging ? undefined : primaryButtonShadow}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14 }}
                >
                  <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.25)" }}>
                    <Ionicons name="football" size={18} color="white" />
                  </View>
                  <View style={{ width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.35)", marginHorizontal: 14 }} />
                  <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>{match.team_a_name} Goal</Text>
                  <Ionicons name="football-outline" size={44} color="white" style={{ position: "absolute", right: 40, opacity: 0.15 }} />
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => handleGoal("B")} style={addGoal.isPending || isPaused || isRinging ? undefined : primaryButtonShadow}>
                <LinearGradient
                  colors={["#2563EB", "#1D4ED8"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14 }}
                >
                  <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.25)" }}>
                    <Ionicons name="football" size={18} color="white" />
                  </View>
                  <View style={{ width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.35)", marginHorizontal: 14 }} />
                  <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>{match.team_b_name} Goal</Text>
                  <Ionicons name="football-outline" size={44} color="white" style={{ position: "absolute", right: 40, opacity: 0.15 }} />
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </LinearGradient>
              </Pressable>
            </View>

            {isRinging ? (
              <Pressable
                onPress={handleEndPeriodPress}
                disabled={endRunningPeriod.isPending}
                style={{ marginTop: 12, opacity: endRunningPeriod.isPending ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={[colors.danger, "#B91C1C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14 }}
                >
                  <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.25)" }}>
                    <Ionicons name="notifications-off" size={17} color="white" />
                  </View>
                  <View style={{ width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.35)", marginHorizontal: 14 }} />
                  <View style={{ flex: 1 }}>
                    <Text className="text-white font-bold text-base" numberOfLines={1}>
                      {phase === "FIRST_HALF" && "End First Half"}
                      {phase === "SECOND_HALF" && "End Second Half"}
                      {phase === "EXTRA_TIME_FIRST" && "End Extra Time (1st Half)"}
                      {phase === "EXTRA_TIME_SECOND" && "End Extra Time (2nd Half)"}
                    </Text>
                    <Text className="text-white text-xs mt-0.5" style={{ opacity: 0.85 }}>Tap to stop the alarm</Text>
                  </View>
                  <Ionicons name="notifications" size={40} color="white" style={{ position: "absolute", right: 18, opacity: 0.2 }} />
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleToggleClock}
                disabled={pauseMatch.isPending || resumeMatch.isPending}
                style={{ marginTop: 12, opacity: pauseMatch.isPending || resumeMatch.isPending ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={isPaused ? [colors.primary, colors.primaryDark] : ["#F59E0B", "#D97706"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14 }}
                >
                  <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.25)" }}>
                    <Ionicons name={isPaused ? "play" : "pause"} size={16} color="white" />
                  </View>
                  <View style={{ width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.35)", marginHorizontal: 14 }} />
                  <Text className="text-white font-bold text-base flex-1">{isPaused ? "Start Time" : "Stop Time"}</Text>
                  <Ionicons name="stopwatch-outline" size={40} color="white" style={{ position: "absolute", right: 18, opacity: 0.25 }} />
                </LinearGradient>
              </Pressable>
            )}

            <Pressable
              onPress={handleUndo}
              disabled={goals.length === 0 || deleteLastGoal.isPending || isPaused || isRinging}
              className="flex-row items-center rounded-2xl py-3.5 px-4 mt-2 bg-white"
              style={{ borderWidth: 1.5, borderColor: colors.primary, opacity: goals.length === 0 || isPaused || isRinging ? 0.5 : 1 }}
            >
              <View className="items-center justify-center rounded-full" style={{ width: 30, height: 30, backgroundColor: colors.primaryLight }}>
                <Ionicons name="refresh" size={15} color={colors.primaryDark} />
              </View>
              <View style={{ width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 12 }} />
              <Text className="font-bold text-base flex-1" style={{ color: colors.primaryDark }}>Undo Last Goal</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
            </Pressable>
          </>
        )}

        {phase === "HALF_TIME" && (
          <Pressable onPress={handleStartSecondHalf} className="rounded-2xl py-4 items-center bg-primary" style={primaryButtonShadow}>
            {startRunningPeriod.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Start Second Half</Text>}
          </Pressable>
        )}

        {phase === "FULL_TIME" && (
          <View style={{ gap: 10 }}>
            {scoreSummary.current.a === scoreSummary.current.b && match.requires_winner ? (
              <Pressable onPress={handleStartExtraTime} className="rounded-2xl py-4 items-center bg-primary" style={primaryButtonShadow}>
                {startRunningPeriod.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Start Extra Time</Text>}
              </Pressable>
            ) : (
              <Pressable onPress={handleFinishAsIs} className="rounded-2xl py-4 items-center bg-primary" style={primaryButtonShadow}>
                {completeMatch.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Finish Match</Text>}
              </Pressable>
            )}
          </View>
        )}

        {phase === "EXTRA_TIME_BREAK" && (
          <Pressable onPress={handleStartExtraTimeSecond} className="rounded-2xl py-4 items-center bg-primary" style={primaryButtonShadow}>
            {startRunningPeriod.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Start Extra Time (2nd Half)</Text>}
          </Pressable>
        )}

        {phase === "EXTRA_TIME_FULL_TIME" && (
          <View style={{ gap: 10 }}>
            {scoreSummary.current.a === scoreSummary.current.b ? (
              <Pressable onPress={handleStartPenalties} className="rounded-2xl py-4 items-center bg-primary" style={primaryButtonShadow}>
                {startPenalties.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Start Penalty Shootout</Text>}
              </Pressable>
            ) : (
              <Pressable onPress={handleFinishAsIs} className="rounded-2xl py-4 items-center bg-primary" style={primaryButtonShadow}>
                {completeMatch.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Finish Match</Text>}
              </Pressable>
            )}
          </View>
        )}

        {phase === "PENALTIES" && (
          <>
            <View pointerEvents={addPenaltyKick.isPending ? "none" : "auto"} style={{ opacity: addPenaltyKick.isPending ? 0.5 : 1, gap: 10 }}>
              <View style={{ gap: 8 }}>
                <Text className="text-ink font-semibold text-sm text-center">
                  Next kick: {penaltyKicks.length % 2 === 0 ? match.team_a_name : match.team_b_name}
                </Text>
                <View className="flex-row" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => handlePenaltyKick(penaltyKicks.length % 2 === 0 ? "A" : "B", true)}
                    className="flex-1 rounded-2xl py-4 items-center bg-primary"
                    style={addPenaltyKick.isPending ? undefined : primaryButtonShadow}
                  >
                    <Text className="text-white font-bold text-sm">Scored</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handlePenaltyKick(penaltyKicks.length % 2 === 0 ? "A" : "B", false)}
                    className="flex-1 rounded-2xl py-4 items-center"
                    style={{ backgroundColor: colors.danger, ...(addPenaltyKick.isPending ? undefined : primaryButtonShadow) }}
                  >
                    <Text className="text-white font-bold text-sm">Missed</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <Pressable
              onPress={handleUndo}
              disabled={penaltyKicks.length === 0 || deleteLastPenaltyKick.isPending}
              className="flex-row items-center justify-center rounded-2xl py-3 mt-3 border border-border"
              style={{ gap: 8, opacity: penaltyKicks.length === 0 ? 0.5 : 1 }}
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.muted} />
              <Text className="text-muted text-sm font-semibold">Undo Last Kick</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
