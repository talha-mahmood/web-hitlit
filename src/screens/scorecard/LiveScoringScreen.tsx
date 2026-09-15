import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import {
  useCricketMatch,
  useAddCricketBall,
  useDeleteLastCricketBall,
  useStartSecondInnings,
  useMarkInningsComplete,
  useCompleteCricketMatch,
} from "../../hooks/useCricket";
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
const WIDE_OPTIONS = [1, 2, 3, 4, 5];
const NOBALL_BAT_OPTIONS = [0, 1, 2, 3, 4, 6];
const BYE_OPTIONS = [1, 2, 3, 4];
const WICKET_TYPES: { label: string; value: WicketType }[] = [
  { label: "Bowled", value: "BOWLED" },
  { label: "Caught", value: "CAUGHT" },
  { label: "LBW", value: "LBW" },
  { label: "Run Out", value: "RUN_OUT" },
  { label: "Stumped", value: "STUMPED" },
  { label: "Hit Wicket", value: "HIT_WICKET" },
  { label: "Retired Out", value: "RETIRED_OUT" },
];

function NamePickerModal({
  visible,
  title,
  names,
  exclude,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  names: string[];
  exclude?: string[];
  onSelect: (name: string) => void;
  onClose?: () => void;
}) {
  const options = names.filter((n) => !exclude?.includes(n));
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 32, maxHeight: "70%" }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-ink">{title}</Text>
            {onClose && (
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <ScrollView>
            {options.map((name) => (
              <Pressable
                key={name}
                onPress={() => onSelect(name)}
                className="py-3.5 border-b border-border"
              >
                <Text className="text-ink text-base">{name}</Text>
              </Pressable>
            ))}
            {options.length === 0 && (
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
}: {
  options: number[];
  onPress: (n: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <View>
      {label && <Text className="text-muted text-xs font-semibold mb-2">{label}</Text>}
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((n) => (
          <Pressable
            key={n}
            onPress={() => onPress(n)}
            disabled={disabled}
            className="items-center justify-center rounded-xl bg-gray-100"
            style={{ width: 52, height: 52, opacity: disabled ? 0.5 : 1 }}
          >
            <Text className="text-ink font-bold text-base">{n}</Text>
          </Pressable>
        ))}
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

  const effectiveStriker = inningsState?.striker ?? pendingStriker;
  const effectiveNonStriker = inningsState?.nonStriker ?? pendingNonStriker;
  const effectiveBowler = inningsState?.currentBowler ?? pendingBowler;
  const needsStriker = !inningsOver && !effectiveStriker;
  const needsNonStriker = !inningsOver && !!effectiveStriker && !effectiveNonStriker;
  const needsBowler = !inningsOver && !!effectiveStriker && !!effectiveNonStriker && !effectiveBowler;
  const readyToScore = !inningsOver && !!effectiveStriker && !!effectiveNonStriker && !!effectiveBowler;

  if (isLoading || !match) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
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

  const handleWide = (total: number) => {
    submitBall({ runsBatted: 0, extraType: "WIDE", extraRuns: total, isWicket: false, wicketType: null, dismissedName: null, fielderName: null });
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
    markInningsComplete.mutate(currentInnings.id, {
      onSuccess: () => {
        completeMatch.mutate(
          { matchId: match.id, resultSummary: summary },
          {
            onSuccess: () => navigation.replace("FullScorecard", { matchId: match.id }),
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

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row items-center bg-primary px-4 pb-4" style={{ paddingTop: insets.top + 16, gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>
        <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>
          {match.team_a_name} vs {match.team_b_name}
        </Text>
        <Pressable onPress={() => navigation.navigate("FullScorecard", { matchId: match.id })} hitSlop={8}>
          <Ionicons name="stats-chart" size={20} color="white" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Score header */}
        <View className="bg-white rounded-2xl border border-border p-4 mb-4" style={cardShadow}>
          <Text className="text-muted text-xs font-semibold">
            {battingTeamName} batting {currentInnings?.innings_number === 2 ? "(2nd innings)" : "(1st innings)"}
          </Text>
          <View className="flex-row items-end mt-1" style={{ gap: 8 }}>
            <Text className="text-ink font-extrabold text-3xl">
              {inningsState?.runs ?? 0}/{inningsState?.wickets ?? 0}
            </Text>
            <Text className="text-muted text-base mb-1">
              ({formatOvers(inningsState?.legalBalls ?? 0)} ov)
            </Text>
          </View>
          <View className="flex-row items-center mt-1" style={{ gap: 16 }}>
            <Text className="text-muted text-xs">CRR: {runRate.toFixed(2)}</Text>
            {target && (
              <>
                <Text className="text-muted text-xs">Target: {target}</Text>
                {requiredRunRate !== null && <Text className="text-muted text-xs">RRR: {requiredRunRate.toFixed(2)}</Text>}
              </>
            )}
          </View>
          {target && inningsState && (
            <Text className="text-primary text-xs font-semibold mt-1">
              {Math.max(target - inningsState.runs, 0)} runs needed from{" "}
              {Math.max(match.overs_limit * 6 - inningsState.legalBalls, 0)} balls
            </Text>
          )}
        </View>

        {inningsOver ? (
          <View className="bg-white rounded-2xl border border-border p-5 items-center" style={cardShadow}>
            <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
            <Text className="text-ink font-bold text-lg mt-2">
              {currentInnings?.innings_number === 1 ? "Innings Complete" : "Match Complete"}
            </Text>
            {currentInnings?.innings_number === 1 ? (
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
                onPress={handleFinishMatch}
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
                <Text className="text-muted text-xs font-semibold mb-1">Batting</Text>
                {effectiveStriker && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-ink text-sm font-bold" numberOfLines={1}>
                      {effectiveStriker}*
                    </Text>
                    <Text className="text-ink text-sm">
                      {strikerStat?.runs ?? 0} ({strikerStat?.balls ?? 0})
                    </Text>
                  </View>
                )}
                {effectiveNonStriker && (
                  <View className="flex-row items-center justify-between mt-1">
                    <Text className="text-muted text-sm" numberOfLines={1}>
                      {effectiveNonStriker}
                    </Text>
                    <Text className="text-muted text-sm">
                      {nonStrikerStat?.runs ?? 0} ({nonStrikerStat?.balls ?? 0})
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1 bg-white rounded-2xl border border-border p-3" style={cardShadow}>
                <Text className="text-muted text-xs font-semibold mb-1">Bowling</Text>
                {effectiveBowler && (
                  <>
                    <Text className="text-ink text-sm font-bold" numberOfLines={1}>
                      {effectiveBowler}
                    </Text>
                    <Text className="text-muted text-sm mt-1">
                      {formatOvers(bowlerStat?.legalBalls ?? 0)}-{bowlerStat?.maidens ?? 0}-
                      {bowlerStat?.runsConceded ?? 0}-{bowlerStat?.wickets ?? 0}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* This over */}
            {thisOverBalls.length > 0 && (
              <View className="flex-row items-center flex-wrap mt-4" style={{ gap: 6 }}>
                {thisOverBalls.map((b, i) => (
                  <View
                    key={i}
                    className={`items-center justify-center rounded-full ${b.isWicket ? "bg-red-500" : b.extraType ? "bg-yellow-100" : "bg-gray-100"}`}
                    style={{ width: 30, height: 30 }}
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
                ))}
              </View>
            )}

            {/* Scoring pad — locked while a ball is being saved so a slow
                network or a fast double-tap can never fire two deliveries
                for the same ball (that used to surface a raw "duplicate key"
                database error instead of just... not doing anything twice). */}
            <View pointerEvents={addBall.isPending ? "none" : "auto"} style={{ opacity: addBall.isPending ? 0.5 : 1 }}>
            {readyToScore && extraMode === null && (
              <View className="mt-5">
                <RunPad options={RUN_OPTIONS} onPress={handleRuns} />
                <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                  {(["WIDE", "NOBALL", "BYE", "LEGBYE"] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setExtraMode(type)}
                      className="rounded-xl px-4 py-3 border border-border bg-white"
                    >
                      <Text className="text-ink font-semibold text-sm">
                        {type === "WIDE" ? "Wide" : type === "NOBALL" ? "No Ball" : type === "BYE" ? "Bye" : "Leg Bye"}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => setExtraMode("WICKET")}
                    className="rounded-xl px-4 py-3 bg-red-500"
                  >
                    <Text className="text-white font-bold text-sm">WICKET</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={handleUndo}
                  disabled={ballEvents.length === 0 || deleteLastBall.isPending}
                  className="flex-row items-center justify-center mt-4 py-2"
                  style={{ gap: 6 }}
                >
                  <Ionicons name="arrow-undo" size={16} color={colors.muted} />
                  <Text className="text-muted text-sm font-medium">Undo Last Ball</Text>
                </Pressable>
              </View>
            )}

            {readyToScore && extraMode === "WIDE" && (
              <View className="mt-5">
                <RunPad options={WIDE_OPTIONS} onPress={handleWide} label="Total runs on the wide" />
                <Pressable onPress={() => setExtraMode(null)} className="mt-3 py-2">
                  <Text className="text-muted text-center text-sm">Cancel</Text>
                </Pressable>
              </View>
            )}

            {readyToScore && extraMode === "NOBALL" && (
              <View className="mt-5">
                <RunPad options={NOBALL_BAT_OPTIONS} onPress={handleNoBall} label="Runs off the bat" />
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

      <NamePickerModal
        visible={needsStriker}
        title="Select Opening Striker"
        names={battingPlayers}
        onSelect={setPendingStriker}
      />
      <NamePickerModal
        visible={needsNonStriker}
        title="Select Non-Striker"
        names={battingPlayers}
        exclude={effectiveStriker ? [effectiveStriker] : []}
        onSelect={setPendingNonStriker}
      />
      <NamePickerModal
        visible={needsBowler}
        title="Select Bowler"
        names={bowlingPlayers}
        exclude={inningsState?.previousOverBowler ? [inningsState.previousOverBowler] : []}
        onSelect={setPendingBowler}
      />
    </View>
  );
}
