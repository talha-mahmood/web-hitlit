import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
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
      <View className="flex-1 items-center justify-center bg-gray-100">
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
    return (
      <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center px-4 pb-4" style={{ gap: 6 }}>
          <Pressable onPress={() => leaveScorecard()} hitSlop={8} className="p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="text-base font-bold text-ink">Match Complete</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View className="bg-white rounded-3xl items-center py-8 px-6" style={cardShadow}>
            <View
              className="items-center justify-center rounded-full mb-3"
              style={{ width: 72, height: 72, backgroundColor: colors.primaryLight }}
            >
              <Ionicons name={winnerName ? "trophy" : "flag-outline"} size={36} color={colors.primaryDark} />
            </View>
            <Text className="text-muted text-xs font-semibold">MATCH COMPLETE</Text>
            <Text className="text-ink font-extrabold text-xl mt-1 text-center">
              {winnerName ? `${winnerName} — Winner` : "Draw"}
            </Text>

            <View className="w-full mt-6" style={{ gap: 8 }}>
              <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <Text className="text-muted text-xs font-semibold">HALF-TIME</Text>
                <Text className="text-ink font-bold text-sm">{scoreSummary.halfTime.a} - {scoreSummary.halfTime.b}</Text>
              </View>
              <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <Text className="text-muted text-xs font-semibold">FULL-TIME</Text>
                <Text className="text-ink font-bold text-sm">{scoreSummary.fullTime.a} - {scoreSummary.fullTime.b}</Text>
              </View>
              {scoreSummary.afterExtraTime && (
                <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <Text className="text-muted text-xs font-semibold">EXTRA TIME</Text>
                  <Text className="text-ink font-bold text-sm">{scoreSummary.afterExtraTime.a} - {scoreSummary.afterExtraTime.b}</Text>
                </View>
              )}
              {shootout && (
                <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <Text className="text-muted text-xs font-semibold">PENALTIES</Text>
                  <Text className="text-ink font-bold text-sm">{shootout.scoreA} - {shootout.scoreB}</Text>
                </View>
              )}
            </View>

            {goals.length > 0 && (
              <View className="w-full mt-5">
                <Text className="text-muted text-xs font-semibold mb-2 text-center">GOALS</Text>
                {goals.map((g) => (
                  <Text key={g.seq} className="text-ink text-sm text-center mt-1">
                    {g.minuteLabel} {g.team === "A" ? match.team_a_name : match.team_b_name}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <Pressable
            onPress={() => leaveScorecard()}
            className="rounded-2xl py-4 items-center mt-6 bg-primary"
            style={primaryButtonShadow}
          >
            <Text className="text-white font-bold text-base">Back to Matches</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-4 pb-3" style={{ gap: 8 }}>
        <Pressable onPress={() => leaveScorecard()} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-row items-center px-2.5 py-1 rounded-full bg-red-500" style={{ gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "white" }} />
          <Text className="text-white text-xs font-bold">LIVE</Text>
        </View>
        <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>
          {match.team_a_name} vs {match.team_b_name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        {/* Team headers + score */}
        <View className="bg-white rounded-2xl p-5 mb-4 items-center" style={cardShadow}>
          <View className="flex-row items-center justify-between w-full mb-3">
            <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>{match.team_a_name}</Text>
            <Text className="text-ink font-bold text-base flex-1 text-right" numberOfLines={1}>{match.team_b_name}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 28 }}>
            <Text className="text-ink font-extrabold" style={{ fontSize: 40 }}>{scoreSummary.current.a}</Text>
            <Text className="text-muted font-bold" style={{ fontSize: 22 }}>-</Text>
            <Text className="text-ink font-extrabold" style={{ fontSize: 40 }}>{scoreSummary.current.b}</Text>
          </View>
          {isRunning ? (
            <Text className="text-ink font-bold text-lg mt-2">{clock}</Text>
          ) : null}
          <View className="rounded-full px-3 py-1 mt-2" style={{ backgroundColor: colors.primaryLight }}>
            <Text className="text-xs font-extrabold" style={{ color: colors.primaryDark }}>
              {PHASE_LABEL[phase] ?? phase}
            </Text>
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
        {goals.length > 0 && phase !== "PENALTIES" && (
          <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-semibold mb-2">GOAL HISTORY</Text>
            {goals.map((g) => (
              <Text key={g.seq} className="text-ink text-sm mt-1">
                {g.minuteLabel} {g.team === "A" ? match.team_a_name : match.team_b_name}
              </Text>
            ))}
          </View>
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
              <Pressable
                onPress={() => handleGoal("A")}
                className="rounded-2xl py-4 items-center bg-primary"
                style={addGoal.isPending || isPaused || isRinging ? undefined : primaryButtonShadow}
              >
                <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_a_name} Goal</Text>
              </Pressable>
              <Pressable
                onPress={() => handleGoal("B")}
                className="rounded-2xl py-4 items-center"
                style={{ backgroundColor: "#1D4ED8", ...(addGoal.isPending || isPaused || isRinging ? undefined : primaryButtonShadow) }}
              >
                <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_b_name} Goal</Text>
              </Pressable>
            </View>

            {isRinging ? (
              <Pressable
                onPress={handleEndPeriodPress}
                disabled={endRunningPeriod.isPending}
                className="flex-row items-center justify-center rounded-2xl py-3 mt-3"
                style={{ gap: 8, backgroundColor: colors.danger, opacity: endRunningPeriod.isPending ? 0.5 : 1 }}
              >
                <Ionicons name="stop-circle-outline" size={16} color="white" />
                <Text className="text-white text-sm font-semibold">
                  {phase === "FIRST_HALF" && "End First Half"}
                  {phase === "SECOND_HALF" && "End Second Half"}
                  {phase === "EXTRA_TIME_FIRST" && "End Extra Time (1st Half)"}
                  {phase === "EXTRA_TIME_SECOND" && "End Extra Time (2nd Half)"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleToggleClock}
                disabled={pauseMatch.isPending || resumeMatch.isPending}
                className="flex-row items-center justify-center rounded-2xl py-3 mt-3"
                style={{
                  gap: 8,
                  backgroundColor: isPaused ? colors.primary : colors.warning,
                  opacity: pauseMatch.isPending || resumeMatch.isPending ? 0.5 : 1,
                }}
              >
                <Ionicons name={isPaused ? "play-circle-outline" : "pause-circle-outline"} size={16} color="white" />
                <Text className="text-white text-sm font-bold">{isPaused ? "Start Time" : "Stop Time"}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleUndo}
              disabled={goals.length === 0 || deleteLastGoal.isPending || isPaused || isRinging}
              className="flex-row items-center justify-center rounded-2xl py-3 mt-2"
              style={{
                gap: 8,
                borderWidth: 1,
                borderColor: colors.warning,
                opacity: goals.length === 0 || isPaused || isRinging ? 0.5 : 1,
              }}
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.warning} />
              <Text className="text-sm font-semibold" style={{ color: colors.warning }}>Undo Last Goal</Text>
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
