import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import {
  useFootballMatch,
  useAddFootballGoal,
  useDeleteLastFootballGoal,
  useAddPenaltyKick,
  useDeleteLastPenaltyKick,
  useStartRunningPeriod,
  useEndRunningPeriod,
  useStartPenalties,
  useCompleteFootballMatch,
} from "../../hooks/useFootball";
import { friendlyFootballError, goalRowToEvent, penaltyKickRowToEvent } from "../../lib/api/football";
import {
  computeElapsedSeconds,
  formatClock,
  formatGoalMinuteLabel,
  computeScoreSummary,
  computePenaltyShootoutState,
  matchResultSummary,
  type MatchTimestamps,
  type Phase,
  type Team,
} from "../../lib/footballScoring";
import { PillRow } from "../../components/GameFormControls";
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

const ADDED_TIME_OPTIONS = ["0", "1", "2", "3", "4", "5"];

function AddedTimeModal({
  visible,
  onClose,
  onConfirm,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  submitting: boolean;
}) {
  const [minutes, setMinutes] = useState("0");
  useEffect(() => {
    if (visible) setMinutes("0");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View className="bg-white rounded-2xl p-5 w-full" style={cardShadow}>
          <Text className="text-ink font-bold text-base mb-1">Added Time</Text>
          <Text className="text-muted text-xs mb-3">How many minutes of stoppage time?</Text>
          <PillRow options={ADDED_TIME_OPTIONS.map((n) => ({ label: n, value: n }))} value={minutes} onChange={setMinutes} />
          <View className="flex-row mt-4" style={{ gap: 10 }}>
            <Pressable onPress={onClose} className="flex-1 border border-border rounded-xl py-3 items-center">
              <Text className="text-muted font-semibold text-sm">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(parseInt(minutes, 10) || 0)}
              disabled={submitting}
              className="flex-1 bg-primary rounded-xl py-3 items-center"
            >
              {submitting ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-semibold text-sm">Confirm</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FootballLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useFootballMatch(params.matchId);
  const addGoal = useAddFootballGoal(params.matchId);
  const deleteLastGoal = useDeleteLastFootballGoal(params.matchId);
  const addPenaltyKick = useAddPenaltyKick(params.matchId);
  const deleteLastPenaltyKick = useDeleteLastPenaltyKick(params.matchId);
  const startRunningPeriod = useStartRunningPeriod(params.matchId);
  const endRunningPeriod = useEndRunningPeriod(params.matchId);
  const startPenalties = useStartPenalties(params.matchId);
  const completeMatch = useCompleteFootballMatch(params.matchId);

  const [now, setNow] = useState(Date.now());
  const [endingPeriod, setEndingPeriod] = useState(false);

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

  const elapsedSeconds = timestamps ? computeElapsedSeconds(phase, timestamps, now) : 0;
  const clock = formatClock(elapsedSeconds, phase);

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
      { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not save the match result.")) }
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

  const handleGoal = (team: Team) => {
    if (!isRunning) return;
    const seq = goals.length + 1;
    const minuteLabel = formatGoalMinuteLabel(elapsedSeconds, phase);
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

  const handleConfirmEndPeriod = (addedMinutes: number) => {
    if (phase === "FIRST_HALF") {
      endRunningPeriod.mutate(
        { endingPhase: "FIRST_HALF", addedMinutes, resultingPhase: "HALF_TIME" },
        { onSuccess: () => setEndingPeriod(false), onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the half.")) }
      );
    } else if (phase === "SECOND_HALF") {
      endRunningPeriod.mutate(
        { endingPhase: "SECOND_HALF", addedMinutes, resultingPhase: "FULL_TIME" },
        { onSuccess: () => setEndingPeriod(false), onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the half.")) }
      );
    } else if (phase === "EXTRA_TIME_FIRST") {
      endRunningPeriod.mutate(
        { endingPhase: "EXTRA_TIME_FIRST", addedMinutes, resultingPhase: "EXTRA_TIME_BREAK" },
        { onSuccess: () => setEndingPeriod(false), onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the period.")) }
      );
    } else if (phase === "EXTRA_TIME_SECOND") {
      endRunningPeriod.mutate(
        { endingPhase: "EXTRA_TIME_SECOND", addedMinutes, resultingPhase: "EXTRA_TIME_FULL_TIME" },
        { onSuccess: () => setEndingPeriod(false), onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not end the period.")) }
      );
    }
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
    const summary = matchResultSummary(match.team_a_name, match.team_b_name, scoreSummary, null);
    completeMatch.mutate(
      { winnerTeam: a === b ? null : a > b ? "A" : "B", isDraw: a === b, resultSummary: summary },
      { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not finish the match.")) }
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
          <Pressable onPress={() => navigation.navigate("FootballHome")} hitSlop={8} className="p-1">
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
            onPress={() => navigation.navigate("FootballHome")}
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
        <Pressable onPress={() => navigation.navigate("FootballHome")} hitSlop={8} className="p-1">
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
            <View pointerEvents={addGoal.isPending ? "none" : "auto"} style={{ opacity: addGoal.isPending ? 0.5 : 1, gap: 10 }}>
              <Pressable
                onPress={() => handleGoal("A")}
                className="rounded-2xl py-4 items-center bg-primary"
                style={addGoal.isPending ? undefined : primaryButtonShadow}
              >
                <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_a_name} Goal</Text>
              </Pressable>
              <Pressable
                onPress={() => handleGoal("B")}
                className="rounded-2xl py-4 items-center"
                style={{ backgroundColor: "#1D4ED8", ...(addGoal.isPending ? undefined : primaryButtonShadow) }}
              >
                <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_b_name} Goal</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setEndingPeriod(true)}
              className="flex-row items-center justify-center rounded-2xl py-3 mt-3 border border-border"
              style={{ gap: 8 }}
            >
              <Ionicons name="stop-circle-outline" size={16} color={colors.muted} />
              <Text className="text-muted text-sm font-semibold">
                {phase === "FIRST_HALF" && "End First Half"}
                {phase === "SECOND_HALF" && "End Second Half"}
                {phase === "EXTRA_TIME_FIRST" && "End Extra Time (1st Half)"}
                {phase === "EXTRA_TIME_SECOND" && "End Extra Time (2nd Half)"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleUndo}
              disabled={goals.length === 0 || deleteLastGoal.isPending}
              className="flex-row items-center justify-center rounded-2xl py-3 mt-2 border border-border"
              style={{ gap: 8, opacity: goals.length === 0 ? 0.5 : 1 }}
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.muted} />
              <Text className="text-muted text-sm font-semibold">Undo Last Goal</Text>
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
                    style={primaryButtonShadow}
                  >
                    <Text className="text-white font-bold text-sm">Scored</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handlePenaltyKick(penaltyKicks.length % 2 === 0 ? "A" : "B", false)}
                    className="flex-1 rounded-2xl py-4 items-center"
                    style={{ backgroundColor: colors.danger, ...primaryButtonShadow }}
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

      <AddedTimeModal
        visible={endingPeriod}
        onClose={() => setEndingPeriod(false)}
        onConfirm={handleConfirmEndPeriod}
        submitting={endRunningPeriod.isPending}
      />
    </View>
  );
}
