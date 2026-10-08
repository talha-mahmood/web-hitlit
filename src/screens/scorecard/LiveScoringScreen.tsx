import { Children, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput, Share } from "react-native";
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
  useCricketPendingCount,
  useAbandonCricketMatch,
  useAddRosterPlayer,
  useUpdateCricketMatchSettings,
} from "../../hooks/useCricket";
import { useNetworkStore } from "../../store/networkStore";
import { useSyncCricketMatchResult } from "../../hooks/useTournamentMatches";
import { ballRowToEvent, friendlyCricketError } from "../../lib/api/cricket";
import {
  replayInnings,
  formatOvers,
  computeRunRate,
  computeRequiredRunRate,
  matchResultSummary,
  groupBallsByOver,
  type BallEvent,
  type ExtraType,
  type WicketType,
} from "../../lib/cricketScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import ScoringCodeBadge from "../../components/ScoringCodeBadge";
type Route = RouteProp<ScorecardStackParamList, "LiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "LiveScoring">;

const RUN_OPTIONS = [1, 2, 3, 4, 6];
const DOT_BALL = 0;
const WIDE_OPTIONS = [0, 1, 2, 3, 4, 5, 6];
const NOBALL_BAT_OPTIONS = [0, 1, 2, 3, 4, 6];
const BYE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const LEGBYE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
// "4 5 6 7" on the main pad — an off-the-bat run value beyond the quick
// 1/2/3/4/6 buttons (a scored 5, or a big overthrow total).
const MORE_RUNS_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
// The cricket-ball icon on the main pad — umpire-awarded penalty/bonus runs,
// added straight to the total without counting as a delivery (extra_type
// "PENALTY" — see applyBall). The +/- toggle picks the sign.
const BONUS_RUNS_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
// The 13 dismissal types the Match Centre's Wicket panel offers. Bowled/
// Caught/Stumped/LBW/HitWicket/Mankad/OverTheFence/OneHandOneBounce credit
// the bowler with the wicket; RunOut/Retired/ObstructingTheField/
// HitTheBallTwice/TimedOut don't (see BOWLER_CREDIT_WICKETS in
// cricketScoring.ts) — Retired Hurt isn't offered here since it isn't a
// dismissal at all (see the More menu instead).
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

const MATCH_CENTRE_TABS: { key: "scoring" | "scorecard" | "stats" | "superstars" | "balls"; label: string }[] = [
  { key: "scoring", label: "Scoring" },
  { key: "scorecard", label: "Scorecard" },
  { key: "stats", label: "Stats" },
  { key: "superstars", label: "Super Stars" },
  { key: "balls", label: "Balls" },
];

// Short label for one delivery — "W" for a wicket, the usual Wd/Nb/B/Lb/P
// shorthand for extras, or the plain runs scored. Shared by the current-over
// strip above the keypad and the Balls tab's full over-by-over log.
function ballLabel(b: BallEvent): string {
  if (b.isWicket) return "W";
  if (b.extraType === "WIDE") return `Wd${b.extraRuns > 1 ? "+" + (b.extraRuns - 1) : ""}`;
  if (b.extraType === "NOBALL") return `Nb${b.runsBatted > 0 ? "+" + b.runsBatted : ""}`;
  if (b.extraType === "BYE") return `B${b.extraRuns}`;
  if (b.extraType === "LEGBYE") return `Lb${b.extraRuns}`;
  if (b.extraType === "PENALTY") return `P${b.extraRuns >= 0 ? "+" : ""}${b.extraRuns}`;
  return String(b.runsBatted);
}

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

// A true fixed 5-column grid row for the main scoring keypad — every cell is
// exactly 20% wide (not flex, which can round unevenly across screen sizes)
// with a shared divider line between every cell and, when bottomBorder is
// set, one more under the whole row, matching the reference's full-grid look
// exactly instead of the uneven flex-gap spacing this had before.
function KeypadRow({ children, bottomBorder }: { children: React.ReactNode; bottomBorder?: boolean }) {
  const items = Children.toArray(children);
  return (
    <View
      className="flex-row"
      style={bottomBorder ? { borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.25)" } : undefined}
    >
      {items.map((child, i) => (
        <View
          key={i}
          style={{ width: "20%", borderRightWidth: i < items.length - 1 ? 1 : 0, borderColor: "rgba(255,255,255,0.25)" }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

function KeypadCell({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} className="items-center justify-center py-4" style={{ opacity: disabled ? 0.5 : 1 }}>
      {children}
    </Pressable>
  );
}

// Full-screen "Select Batsman"/"Select Bowler" list — numbered rows with an
// avatar and a Playing/Bench toggle, matching the Match Centre reference
// exactly (just this app's green instead of its orange). Playing/Bench is a
// local, per-session filter only (there's no "bench" concept in the
// database — see benchedNames in LiveScoringScreen) — it never changes who's
// actually on the match's roster, only who shows up as selectable right now.
// "ADD / CREATE PLAYER" appends a genuinely new name to that roster.
function SelectPlayerPanel({
  title,
  names,
  excluded,
  selectedName,
  benchedNames,
  onToggleBench,
  onSelect,
  onClose,
  onAddPlayer,
  addPlayerPending,
}: {
  title: string;
  names: string[];
  excluded: string[];
  selectedName: string | null;
  benchedNames: Set<string>;
  onToggleBench: (name: string) => void;
  onSelect: (name: string) => void;
  onClose: () => void;
  onAddPlayer: (name: string) => void;
  addPlayerPending: boolean;
}) {
  const [addDraft, setAddDraft] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View
          className="flex-row items-center px-4 pb-3"
          style={{ paddingTop: 54, backgroundColor: colors.primary, gap: 12 }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          <Text className="text-white font-bold text-lg flex-1">{title}</Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {names.map((name, i) => {
            const isExcluded = excluded.includes(name);
            const isBenched = benchedNames.has(name);
            const isSelected = name === selectedName;
            const disabled = isExcluded || isBenched;
            return (
              <Pressable
                key={`${name}-${i}`}
                onPress={() => !disabled && onSelect(name)}
                disabled={disabled}
                className="flex-row items-center rounded-2xl mb-2.5 px-3 py-2.5"
                style={{
                  backgroundColor: isSelected ? colors.primaryLight : "white",
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <View
                  className="items-center justify-center rounded-full mr-3"
                  style={{ width: 26, height: 26, backgroundColor: "#F3F4F6" }}
                >
                  <Text className="text-ink font-bold" style={{ fontSize: 12 }}>{i + 1}</Text>
                </View>
                <View className="mr-3">
                  <PlayerAvatar name={name} />
                </View>
                <Text className="text-ink text-base font-semibold flex-1" numberOfLines={1}>
                  {name}
                </Text>
                {!isExcluded && (
                  <View className="flex-row" style={{ gap: 6 }}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        if (isBenched) onToggleBench(name);
                      }}
                      className="rounded-lg px-2.5 py-1.5"
                      style={{ backgroundColor: !isBenched ? colors.primaryLight : "#F3F4F6" }}
                    >
                      <Text className="text-xs font-bold" style={{ color: !isBenched ? colors.primaryDark : colors.muted }}>
                        Playing
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        if (!isBenched) onToggleBench(name);
                      }}
                      className="rounded-lg px-2.5 py-1.5"
                      style={{ backgroundColor: isBenched ? "#FEE2E2" : "#F3F4F6" }}
                    >
                      <Text className="text-xs font-bold" style={{ color: isBenched ? "#DC2626" : colors.muted }}>
                        Bench
                      </Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          })}
          {names.length === 0 && (
            <Text className="text-muted text-sm text-center py-6">No players available.</Text>
          )}

          {showAdd && (
            <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
              <TextInput
                value={addDraft}
                onChangeText={setAddDraft}
                placeholder="Player name"
                className="flex-1 border border-border rounded-xl px-4 py-2.5 text-ink"
                autoFocus
              />
              <Pressable
                onPress={() => {
                  const trimmed = addDraft.trim();
                  if (!trimmed) return;
                  onAddPlayer(trimmed);
                  setAddDraft("");
                  setShowAdd(false);
                }}
                disabled={!addDraft.trim() || addPlayerPending}
                className="bg-primary rounded-xl px-4 py-2.5"
              >
                {addPlayerPending ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="checkmark" size={18} color="white" />}
              </Pressable>
            </View>
          )}
        </ScrollView>

        <Pressable
          onPress={() => setShowAdd(true)}
          className="absolute bottom-0 left-0 right-0 items-center py-4"
          style={{ backgroundColor: colors.primaryDark, paddingBottom: 28 }}
        >
          <Text className="text-white font-bold tracking-wide">ADD / CREATE PLAYER</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default function LiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useCricketMatch(params.matchId);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingBallCount = useCricketPendingCount(params.matchId);
  const addBall = useAddCricketBall(params.matchId);
  const deleteLastBall = useDeleteLastCricketBall(params.matchId);
  const startSecondInnings = useStartSecondInnings(params.matchId);
  const markInningsComplete = useMarkInningsComplete(params.matchId);
  const completeMatch = useCompleteCricketMatch();
  const syncTournamentResult = useSyncCricketMatchResult();

  const abandonMatch = useAbandonCricketMatch(params.matchId);
  const addRosterPlayer = useAddRosterPlayer(params.matchId);
  const updateSettings = useUpdateCricketMatchSettings(params.matchId);

  const [pendingStriker, setPendingStriker] = useState<string | null>(null);
  const [pendingNonStriker, setPendingNonStriker] = useState<string | null>(null);
  const [pendingBowler, setPendingBowler] = useState<string | null>(null);
  // Which bottom-panel sheet is showing on the Scoring tab. Keypad sub-panels
  // reuse the extra-type values they already submit through; the rest are
  // Match-Centre-only panels (More menu, Bonus/More Runs, Retired Hurt, …).
  const [panel, setPanel] = useState<
    ExtraType | "WICKET" | "MORE_RUNS" | "BONUS_RUNS" | "MORE_MENU" | "RETIRED_HURT" | "CHANGE_TARGET" | "OVERS_FORMAT" | "SETTINGS" | null
  >(null);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  const [wicketEnd, setWicketEnd] = useState<"striker" | "nonStriker" | null>(null);
  const [fielderName, setFielderName] = useState("");
  const [bonusSign, setBonusSign] = useState<1 | -1>(1);
  const [matchCentreTab, setMatchCentreTab] = useState<"scoring" | "scorecard" | "stats" | "superstars" | "balls">("scoring");
  const [selectBatsmanOpen, setSelectBatsmanOpen] = useState(false);
  const [selectBowlerOpen, setSelectBowlerOpen] = useState(false);
  // Which roster names are benched for this session — a scoring-convenience
  // filter only (there's no "bench" concept in the database), so it resets
  // whenever the screen remounts and never affects anyone else's view of the
  // match.
  const [benchedNames, setBenchedNames] = useState<Set<string>>(new Set());
  const [changeTargetDraft, setChangeTargetDraft] = useState("");
  const [oversDraft, setOversDraft] = useState("");
  const [formatDraft, setFormatDraft] = useState<"T10" | "T20" | "ODI" | "Club" | null>(null);
  const [venueDraft, setVenueDraft] = useState("");
  const recentBallsScrollRef = useRef<ScrollView>(null);

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

  // A manually-set target (More > Change Target, after a rain delay or
  // similar) always wins over the plain first-innings-runs+1 computation.
  const target = match?.target_override ?? (firstInnings ? firstInnings.runs + 1 : null);
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
  const readyToScore = hasActiveInnings && !inningsOver && !!effectiveStriker && !!effectiveNonStriker && !!effectiveBowler;
  // The Match Centre's "Select Players" panel offers Batsman and Bowler as
  // two independent buttons — either can be picked first, matching the
  // reference (unlike needsStriker/needsNonStriker above, which still decide
  // which slot a batsman pick actually fills once that panel is open).
  const needsAnyBatsman = needsStriker || needsNonStriker;
  const needsAnyBowler = hasActiveInnings && !inningsOver && !effectiveBowler;

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
          setPanel(null);
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

  // "4 5 6 7" on the main pad — an off-the-bat run value beyond the quick
  // pad, scored exactly like tapping 4/6 there.
  const handleMoreRuns = (runs: number) => {
    submitBall({ runsBatted: runs, extraType: null, extraRuns: 0, isWicket: false, wicketType: null, dismissedName: null, fielderName: null });
  };

  // The ball-icon button — umpire-awarded penalty/bonus runs added straight
  // to the total (extra_type "PENALTY"), not tied to this delivery's bat
  // value and not counted as a ball bowled (see applyBall).
  const handleBonusRuns = (amount: number) => {
    submitBall({
      runsBatted: 0,
      extraType: "PENALTY",
      extraRuns: amount * bonusSign,
      isWicket: false,
      wicketType: null,
      dismissedName: null,
      fielderName: null,
    });
  };

  // Lets a batsman leave the crease without actually being out (they can be
  // selected again later and pick their stats back up) — More menu > Retired
  // Hurt, choosing which end is leaving.
  const handleRetiredHurt = (end: "striker" | "nonStriker") => {
    const name = end === "striker" ? effectiveStriker : effectiveNonStriker;
    if (!name) return;
    submitBall({
      runsBatted: 0,
      extraType: null,
      extraRuns: 0,
      isWicket: true,
      wicketType: "RETIRED_HURT",
      dismissedName: name,
      fielderName: null,
    });
  };

  const handleWicket = (runsCompleted: number) => {
    if (!wicketType) return;
    // Run outs and Mankads both dismiss whichever end the scorer picked
    // (Mankad is conventionally the non-striker, but the picker stays open
    // in case the scorer needs the other end for an unusual case).
    const dismissed =
      wicketType === "RUN_OUT" || wicketType === "MANKAD"
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
      // This used to fail silently offline — it no longer queues as an
      // error (see useMarkInningsComplete), but a genuine failure still
      // needs to say so instead of leaving the button looking like it did
      // nothing.
      onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not finish the innings.")),
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
      onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not finish the innings.")),
    });
  };

  const handleAbandon = () => {
    Alert.alert("Abandon Match", "This ends the match right now with no result. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Abandon",
        style: "destructive",
        onPress: () =>
          abandonMatch.mutate(undefined, {
            onSuccess: () => navigation.replace("FullScorecard", { matchId: match.id }),
            onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not abandon the match.")),
          }),
      },
    ]);
  };

  // `side` picks which roster this name is appended to — the batting side's
  // team letter when adding from "Select Batsman", the bowling side's when
  // adding from "Select Bowler" (battingPlayers/bowlingPlayers already
  // resolve those to the real A/B letters for the current innings).
  const handleAddPlayer = (side: "batting" | "bowling", name: string) => {
    if (!battingTeam) return;
    const team = side === "batting" ? battingTeam : battingTeam === "A" ? "B" : "A";
    const existingPlayers = side === "batting" ? battingPlayers : bowlingPlayers;
    addRosterPlayer.mutate(
      { team, name, existingPlayers },
      { onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not add player.")) }
    );
  };

  // Not a real Duckworth-Lewis calculation — that needs resource-percentage
  // tables this app doesn't have — just a direct manual override of the
  // chase target, entered by the host after a rain delay or similar.
  const handleChangeTarget = () => {
    const value = parseInt(changeTargetDraft, 10);
    if (!value || value <= 0) return;
    updateSettings.mutate(
      { targetOverride: value },
      {
        onSuccess: () => {
          setChangeTargetDraft("");
          setPanel(null);
        },
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not update the target.")),
      }
    );
  };

  const handleSaveOversFormat = () => {
    const overs = parseInt(oversDraft, 10);
    const updates: Parameters<typeof updateSettings.mutate>[0] = {};
    if (overs > 0) updates.oversLimit = overs;
    if (formatDraft) updates.format = formatDraft;
    if (Object.keys(updates).length === 0) {
      setPanel(null);
      return;
    }
    updateSettings.mutate(updates, {
      onSuccess: () => setPanel(null),
      onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not update match settings.")),
    });
  };

  const handleSaveVenue = () => {
    updateSettings.mutate(
      { venue: venueDraft.trim() || null },
      {
        onSuccess: () => setPanel(null),
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not update the venue.")),
      }
    );
  };

  const toggleBench = (name: string) => {
    setBenchedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleShare = () => {
    Share.share({
      message: `${match.team_a_name} vs ${match.team_b_name} — follow live scoring with code ${match.scoring_code} in the app.`,
    }).catch(() => {});
  };

  // Real partnership (runs/balls added since the last wicket fell by this
  // pair) — derived the same replay-based way as everything else, not a
  // separately-tracked counter.
  const legalBallsFromOversLabel = (label: string) => {
    const [o, b] = label.split(".").map(Number);
    return (o || 0) * 6 + (b || 0);
  };
  const lastWicket = inningsState?.fallOfWickets[inningsState.fallOfWickets.length - 1];
  const partnershipRuns = inningsState ? inningsState.runs - (lastWicket?.teamScore ?? 0) : 0;
  const partnershipBalls = inningsState ? inningsState.legalBalls - (lastWicket ? legalBallsFromOversLabel(lastWicket.overs) : 0) : 0;
  const extrasTotal = inningsState
    ? inningsState.extras.wide + inningsState.extras.noball + inningsState.extras.bye + inningsState.extras.legbye + inningsState.extras.penalty
    : 0;

  const battingStat = (name: string | null) => (name && inningsState ? inningsState.battingStats[name] : undefined);
  const bowlingStat = (name: string | null) => (name && inningsState ? inningsState.bowlingStats[name] : undefined);
  const strikerStat = battingStat(effectiveStriker);
  const nonStrikerStat = battingStat(effectiveNonStriker);
  const bowlerStat = bowlingStat(effectiveBowler);

  const runRate = inningsState ? computeRunRate(inningsState.runs, inningsState.legalBalls) : 0;
  const requiredRunRate =
    target && inningsState ? computeRequiredRunRate(target, inningsState.runs, inningsState.legalBalls, match.overs_limit) : null;

  // Every over of the current innings, oldest first — Recent Balls shows
  // all of them side by side (one column per over) rather than just
  // whichever over is in progress, so a user can scroll back through the
  // innings instead of losing each over's balls the moment the next one starts.
  // Not memoized: this runs after the loading early-return above, so a
  // useMemo here would be called conditionally and break the Rules of Hooks
  // (React would see a different hook count between the loading and loaded
  // renders) — and grouping a single innings' balls is cheap enough that it
  // doesn't need memoizing anyway.
  const ballsByOver = groupBallsByOver(ballEvents);

  const runsNeeded = target && inningsState ? Math.max(target - inningsState.runs, 0) : null;
  const ballsLeft = target && inningsState ? Math.max(match.overs_limit * 6 - inningsState.legalBalls, 0) : null;

  const closePanel = () => {
    setPanel(null);
    setWicketType(null);
    setWicketEnd(null);
    setFielderName("");
  };

  const cancelRow = (
    <Pressable onPress={closePanel} className="items-center py-2 mt-1">
      <Text className="text-white text-center text-sm" style={{ opacity: 0.85 }}>Cancel</Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-white">
      <View
        className="overflow-hidden"
        style={{ backgroundColor: "#0E4429", paddingTop: insets.top + 12, paddingBottom: 4 }}
      >
        <View
          pointerEvents="none"
          style={{ position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.06)", top: -80, right: -50 }}
        />
        <View className="flex-row items-center px-4" style={{ gap: 10 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <Text className="text-white font-bold text-lg flex-1" numberOfLines={1}>
            Match Centre
          </Text>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <ScoringCodeBadge code={match.scoring_code} variant="dark" />
            {match.status === "IN_PROGRESS" ? (
              <View className="flex-row items-center bg-red-500 rounded-full px-2 py-0.5" style={{ gap: 4 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "white" }} />
                <Text className="text-white text-[10px] font-bold">LIVE</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Match Centre tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 22 }}>
          {MATCH_CENTRE_TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setMatchCentreTab(t.key)} className="items-center pb-3">
              <Text
                className="font-semibold text-sm"
                style={{ color: matchCentreTab === t.key ? "white" : "rgba(255,255,255,0.5)" }}
              >
                {t.label}
              </Text>
              {matchCentreTab === t.key && (
                <View style={{ height: 2.5, width: "100%", backgroundColor: "white", borderRadius: 2, marginTop: 6 }} />
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {matchCentreTab === "scoring" ? (
        <>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            {(!isOnline || pendingBallCount > 0) && (
              <View
                className="flex-row items-center rounded-2xl px-3.5 py-2.5 mb-4"
                style={{ backgroundColor: isOnline ? colors.primaryLight : "#FEF3C7", gap: 8 }}
              >
                <Ionicons
                  name={isOnline ? "cloud-upload-outline" : "cloud-offline-outline"}
                  size={16}
                  color={isOnline ? colors.primaryDark : "#92400E"}
                />
                <Text className="flex-1 text-xs font-semibold" style={{ color: isOnline ? colors.primaryDark : "#92400E" }}>
                  {isOnline
                    ? `Syncing ${pendingBallCount} ball${pendingBallCount === 1 ? "" : "s"}…`
                    : pendingBallCount > 0
                      ? `Offline — ${pendingBallCount} ball${pendingBallCount === 1 ? "" : "s"} saved, will sync when back online`
                      : "Offline — scoring is saved on this device and will sync when back online"}
                </Text>
              </View>
            )}

            {/* Score card */}
            <View className="items-center">
              <Text className="text-ink font-extrabold text-xl text-center" numberOfLines={1}>
                {(battingTeamName ?? "").toUpperCase()}
              </Text>
              <Text className="text-muted text-sm mt-0.5">
                {currentInnings?.innings_number === 2 ? "2nd Innings" : "1st Innings"}
              </Text>
              <Text style={{ fontSize: 46, fontWeight: "800", color: colors.primary, marginTop: 2 }}>
                {inningsState?.runs ?? 0}-{inningsState?.wickets ?? 0}
              </Text>
            </View>

            <View className="flex-row items-center justify-between mt-2 mb-3">
              <Pressable
                onPress={() => setPanel("OVERS_FORMAT")}
                className="flex-row items-center rounded-full px-2.5 py-1.5"
                style={{ gap: 6, backgroundColor: "#111827" }}
              >
                <Text className="text-white font-bold text-xs">{inningsState?.wickets ?? 0}</Text>
                <Ionicons name="settings-outline" size={13} color="white" />
              </Pressable>
              <View className="flex-row" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setPanel("SETTINGS")}
                  className="items-center justify-center rounded-full"
                  style={{ width: 34, height: 34, backgroundColor: "#111827" }}
                >
                  <Ionicons name="volume-mute-outline" size={16} color="white" />
                </Pressable>
                <Pressable
                  onPress={handleShare}
                  className="items-center justify-center rounded-full"
                  style={{ width: 34, height: 34, backgroundColor: "#111827" }}
                >
                  <Ionicons name="share-social-outline" size={16} color="white" />
                </Pressable>
              </View>
            </View>

            <View className="flex-row items-center justify-center flex-wrap" style={{ gap: 18 }}>
              <Text className="text-muted text-sm">Extras - {extrasTotal}</Text>
              <Text className="text-muted text-sm">
                Overs - {formatOvers(inningsState?.legalBalls ?? 0)} / {match.overs_limit}
              </Text>
              <Text className="text-muted text-sm">CRR - {runRate.toFixed(1)}</Text>
            </View>
            <Text className="text-muted text-sm text-center mt-1">
              Partnership - {partnershipRuns}({partnershipBalls})
            </Text>
            {target ? (
              <View className="flex-row items-center justify-center flex-wrap mt-1" style={{ gap: 18 }}>
                <Text className="text-muted text-sm">Target - {target}</Text>
                <Text className="text-muted text-sm">
                  RRR - {requiredRunRate !== null ? requiredRunRate.toFixed(1) : "—"}
                </Text>
                {runsNeeded !== null && ballsLeft !== null ? (
                  <Text className="text-muted text-sm">
                    Need {runsNeeded} off {ballsLeft}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View className="h-px bg-border mt-4 mb-1" />

            {inningsOver || !hasActiveInnings ? (
              <View className="items-center py-6">
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
                {/* Batsman table — every row (header included) carries its
                    own bottom border, so there's a continuous grid line
                    under the headers and between each player, matching the
                    reference exactly instead of only separating data rows. */}
                <View
                  className="flex-row items-center justify-between mt-3 pb-1.5"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <Ionicons name="pencil" size={13} color={colors.muted} />
                    <Text className="text-ink font-bold text-sm">Batsman</Text>
                  </View>
                  <View className="flex-row" style={{ gap: 14 }}>
                    {["R", "B", "4s", "6s", "SR"].map((h) => (
                      <Text key={h} className="text-muted text-xs font-bold" style={{ width: 26, textAlign: "center" }}>
                        {h}
                      </Text>
                    ))}
                  </View>
                </View>
                {[{ name: effectiveStriker, stat: strikerStat, isStriker: true }, { name: effectiveNonStriker, stat: nonStrikerStat, isStriker: false }].map(
                  (row) =>
                    row.name && (
                      <View
                        key={row.name}
                        className="flex-row items-center justify-between py-1.5"
                        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                      >
                        <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={1}>
                          {row.name}
                          {row.isStriker ? " *" : ""}
                        </Text>
                        <View className="flex-row" style={{ gap: 14 }}>
                          <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{row.stat?.runs ?? 0}</Text>
                          <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{row.stat?.balls ?? 0}</Text>
                          <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{row.stat?.fours ?? 0}</Text>
                          <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{row.stat?.sixes ?? 0}</Text>
                          <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>
                            {row.stat && row.stat.balls > 0 ? ((row.stat.runs / row.stat.balls) * 100).toFixed(1) : "0.0"}
                          </Text>
                        </View>
                      </View>
                    )
                )}

                {/* Bowler table */}
                <View
                  className="flex-row items-center justify-between mt-4 pb-1.5"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <Ionicons name="pencil" size={13} color={colors.muted} />
                    <Text className="text-ink font-bold text-sm">Bowler</Text>
                  </View>
                  <View className="flex-row" style={{ gap: 14 }}>
                    {["O", "M", "R", "W", "Eco"].map((h) => (
                      <Text key={h} className="text-muted text-xs font-bold" style={{ width: 26, textAlign: "center" }}>
                        {h}
                      </Text>
                    ))}
                  </View>
                </View>
                {effectiveBowler && (
                  <View
                    className="flex-row items-center justify-between py-1.5"
                    style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={1}>{effectiveBowler}</Text>
                    <View className="flex-row" style={{ gap: 14 }}>
                      <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{formatOvers(bowlerStat?.legalBalls ?? 0)}</Text>
                      <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{bowlerStat?.maidens ?? 0}</Text>
                      <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{bowlerStat?.runsConceded ?? 0}</Text>
                      <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>{bowlerStat?.wickets ?? 0}</Text>
                      <Text className="text-ink text-sm" style={{ width: 26, textAlign: "center" }}>
                        {bowlerStat && bowlerStat.legalBalls > 0 ? ((bowlerStat.runsConceded / bowlerStat.legalBalls) * 6).toFixed(1) : "0.0"}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Current over so far — the most recent ball highlighted,
                    same balls the Balls tab's full log shows. */}
                {(() => {
                  const currentOver = ballsByOver[ballsByOver.length - 1] ?? [];
                  if (currentOver.length === 0) return null;
                  return (
                    <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
                      {currentOver.map((b, i) => {
                        const isLast = i === currentOver.length - 1;
                        return (
                          <View
                            key={i}
                            className="items-center justify-center rounded-full"
                            style={{ width: 32, height: 32, backgroundColor: isLast ? "#2563EB" : "#E5E7EB" }}
                          >
                            <Text className="font-bold text-xs" style={{ color: isLast ? "white" : colors.ink }}>
                              {ballLabel(b)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </>
            )}
          </ScrollView>

          {/* Fixed bottom panel — Select Players, the main keypad, or
              whichever sub-panel is active. Locked while a ball is being
              saved so a slow network or a fast double-tap can never fire two
              deliveries for the same ball. */}
          {hasActiveInnings && !inningsOver && (
            <View
              pointerEvents={addBall.isPending ? "none" : "auto"}
              style={{ backgroundColor: colors.primary, paddingTop: 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 18, opacity: addBall.isPending ? 0.6 : 1 }}
            >
              {!readyToScore ? (
                <>
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-white font-bold text-lg">Select Players</Text>
                  </View>
                  <View className="flex-row justify-center" style={{ gap: 14 }}>
                    {needsAnyBatsman && (
                      <Pressable
                        onPress={() => setSelectBatsmanOpen(true)}
                        className="rounded-2xl px-6 py-3.5"
                        style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      >
                        <Text className="text-white font-bold">Select Batsman</Text>
                      </Pressable>
                    )}
                    {needsAnyBowler && (
                      <Pressable
                        onPress={() => setSelectBowlerOpen(true)}
                        className="rounded-2xl px-6 py-3.5"
                        style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      >
                        <Text className="text-white font-bold">Select Bowler</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              ) : panel === null ? (
                <View style={{ borderTopWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
                  <KeypadRow bottomBorder>
                    {RUN_OPTIONS.map((n) => (
                      <KeypadCell key={n} onPress={() => handleRuns(n)}>
                        <Text className="text-white font-bold text-lg">{n}</Text>
                      </KeypadCell>
                    ))}
                  </KeypadRow>
                  <KeypadRow bottomBorder>
                    <KeypadCell onPress={() => setPanel("LEGBYE")}>
                      <Text className="text-white font-bold text-sm">LB</Text>
                    </KeypadCell>
                    <KeypadCell onPress={() => setPanel("BYE")}>
                      <Text className="text-white font-bold text-sm">Bye</Text>
                    </KeypadCell>
                    <KeypadCell onPress={() => setPanel("WIDE")}>
                      <Text className="text-white font-bold text-sm">Wide</Text>
                    </KeypadCell>
                    <KeypadCell onPress={() => setPanel("NOBALL")}>
                      <Text className="text-white font-bold text-sm">NB</Text>
                    </KeypadCell>
                    <KeypadCell onPress={() => handleRuns(DOT_BALL)}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "white" }} />
                    </KeypadCell>
                  </KeypadRow>
                  <KeypadRow>
                    <KeypadCell onPress={() => setPanel("MORE_MENU")}>
                      <Text className="text-white font-bold text-sm">More</Text>
                    </KeypadCell>
                    <KeypadCell onPress={() => setPanel("BONUS_RUNS")}>
                      <MaterialCommunityIcons name="cricket" size={18} color="white" />
                    </KeypadCell>
                    <KeypadCell onPress={() => setPanel("MORE_RUNS")}>
                      <Text className="text-white font-bold" style={{ fontSize: 12 }}>4 5 6 7</Text>
                    </KeypadCell>
                    <KeypadCell onPress={handleUndo} disabled={ballEvents.length === 0 || deleteLastBall.isPending}>
                      <Text className="text-white font-bold text-sm">Undo</Text>
                    </KeypadCell>
                    <KeypadCell onPress={() => setPanel("WICKET")}>
                      <Text className="text-white font-bold text-sm">Out</Text>
                    </KeypadCell>
                  </KeypadRow>
                </View>
              ) : panel === "WIDE" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Wide</Text>
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
                    {WIDE_OPTIONS.map((n) => (
                      <Pressable key={n} onPress={() => handleWide(n)} className="rounded-xl px-4 py-3" style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-bold text-sm">{n === 0 ? "Wd" : `${n} + Wd`}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "NOBALL" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">No Ball</Text>
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
                    {NOBALL_BAT_OPTIONS.map((n) => (
                      <Pressable key={n} onPress={() => handleNoBall(n)} className="rounded-xl px-4 py-3" style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-bold text-sm">{n === 0 ? "NB" : `${n} NB`}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "LEGBYE" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Leg Byes</Text>
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
                    {LEGBYE_OPTIONS.map((n) => (
                      <Pressable key={n} onPress={() => handleByeLegBye("LEGBYE", n)} className="rounded-xl px-4 py-3" style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-bold text-sm">{n} LB</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "BYE" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Byes</Text>
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
                    {BYE_OPTIONS.map((n) => (
                      <Pressable key={n} onPress={() => handleByeLegBye("BYE", n)} className="rounded-xl px-4 py-3" style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-bold text-sm">{n} B</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "MORE_RUNS" ? (
                <>
                  <View className="flex-row items-center mb-4" style={{ gap: 6 }}>
                    <Text className="text-white font-bold text-lg">More Runs</Text>
                    <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
                  </View>
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
                    {MORE_RUNS_OPTIONS.map((n) => (
                      <Pressable key={n} onPress={() => handleMoreRuns(n)} className="rounded-xl items-center justify-center" style={{ width: 56, height: 48, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-bold">{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "BONUS_RUNS" ? (
                <>
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-white font-bold text-lg">Bonus Runs</Text>
                      <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
                    </View>
                    <View className="flex-row" style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => setBonusSign(1)}
                        className="items-center justify-center rounded-full"
                        style={{ width: 32, height: 32, backgroundColor: bonusSign === 1 ? "#111827" : "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      >
                        <Ionicons name="add" size={16} color="white" />
                      </Pressable>
                      <Pressable
                        onPress={() => setBonusSign(-1)}
                        className="items-center justify-center rounded-full"
                        style={{ width: 32, height: 32, backgroundColor: bonusSign === -1 ? "#111827" : "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      >
                        <Ionicons name="remove" size={16} color="white" />
                      </Pressable>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
                    {BONUS_RUNS_OPTIONS.map((n) => (
                      <Pressable key={n} onPress={() => handleBonusRuns(n)} className="rounded-xl items-center justify-center" style={{ width: 56, height: 48, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-bold">{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "MORE_MENU" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">More</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                    {([
                      { label: "Abandon", onPress: handleAbandon },
                      {
                        label: "End Innings",
                        onPress: currentInnings?.innings_number === 1 ? handleStartSecondInnings : handleFinishMatch,
                      },
                      { label: "Penalty", onPress: () => setPanel("BONUS_RUNS") },
                      { label: "Retired Hurt", onPress: () => setPanel("RETIRED_HURT") },
                      {
                        label: "D / L",
                        onPress: () =>
                          Alert.alert(
                            "Duckworth-Lewis",
                            "This app doesn't compute a real D/L figure (it needs resource tables we don't have). Use Change Target to set a revised target by hand instead."
                          ),
                      },
                      { label: "Change Target", onPress: () => setPanel("CHANGE_TARGET") },
                      { label: "Overs/Format/Wickets", onPress: () => setPanel("OVERS_FORMAT") },
                      { label: "Settings", onPress: () => setPanel("SETTINGS") },
                    ] as { label: string; onPress: () => void; disabled?: boolean }[]).map((item) => (
                      <Pressable
                        key={item.label}
                        onPress={item.onPress}
                        disabled={item.disabled}
                        className="rounded-xl px-4 py-3"
                        style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)", opacity: item.disabled ? 0.4 : 1 }}
                      >
                        <Text className="text-white font-semibold text-sm">{item.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "RETIRED_HURT" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Who's retiring hurt?</Text>
                  <View className="flex-row" style={{ gap: 10 }}>
                    {effectiveStriker && (
                      <Pressable onPress={() => handleRetiredHurt("striker")} className="flex-1 items-center rounded-xl py-3" style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-semibold">{effectiveStriker}</Text>
                      </Pressable>
                    )}
                    {effectiveNonStriker && (
                      <Pressable onPress={() => handleRetiredHurt("nonStriker")} className="flex-1 items-center rounded-xl py-3" style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                        <Text className="text-white font-semibold">{effectiveNonStriker}</Text>
                      </Pressable>
                    )}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "CHANGE_TARGET" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-1">Change Target</Text>
                  <Text className="text-white text-xs mb-4" style={{ opacity: 0.8 }}>
                    A manual override — not a computed Duckworth-Lewis figure.
                  </Text>
                  <TextInput
                    value={changeTargetDraft}
                    onChangeText={(t) => setChangeTargetDraft(t.replace(/[^0-9]/g, ""))}
                    placeholder={target ? String(target) : "New target"}
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    keyboardType="number-pad"
                    className="rounded-xl px-4 py-3 text-white font-bold text-lg text-center"
                    style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                  />
                  <Pressable
                    onPress={handleChangeTarget}
                    disabled={!changeTargetDraft || updateSettings.isPending}
                    className="bg-white rounded-xl py-3 items-center mt-4"
                  >
                    <Text className="font-bold" style={{ color: colors.primaryDark }}>Save Target</Text>
                  </Pressable>
                  {cancelRow}
                </>
              ) : panel === "OVERS_FORMAT" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Overs / Format / Wickets</Text>
                  <Text className="text-white text-xs mb-1.5" style={{ opacity: 0.85 }}>Overs per innings</Text>
                  <TextInput
                    value={oversDraft}
                    onChangeText={(t) => setOversDraft(t.replace(/[^0-9]/g, ""))}
                    placeholder={String(match.overs_limit)}
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    keyboardType="number-pad"
                    className="rounded-xl px-4 py-2.5 text-white font-semibold"
                    style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                  />
                  <Text className="text-white text-xs mt-3 mb-1.5" style={{ opacity: 0.85 }}>Format</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {(["T10", "T20", "ODI", "Club"] as const).map((f) => (
                      <Pressable
                        key={f}
                        onPress={() => setFormatDraft(f)}
                        className="rounded-full px-3.5 py-2"
                        style={{ backgroundColor: (formatDraft ?? match.format) === f ? "#111827" : "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      >
                        <Text className="text-white font-semibold text-xs">{f}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text className="text-white text-xs mt-3" style={{ opacity: 0.7 }}>
                    Wickets: the innings ends after {Math.max(battingPlayers.length - 1, 0)} wickets ({battingPlayers.length} players on the batting side) — set by the team roster, not editable here.
                  </Text>
                  <Pressable
                    onPress={handleSaveOversFormat}
                    disabled={updateSettings.isPending}
                    className="bg-white rounded-xl py-3 items-center mt-4"
                  >
                    <Text className="font-bold" style={{ color: colors.primaryDark }}>Save</Text>
                  </Pressable>
                  {cancelRow}
                </>
              ) : panel === "SETTINGS" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Settings</Text>
                  <Text className="text-white text-xs mb-1.5" style={{ opacity: 0.85 }}>Venue</Text>
                  <TextInput
                    value={venueDraft}
                    onChangeText={setVenueDraft}
                    placeholder={match.venue ?? "e.g. Karachi Cricket Ground"}
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    className="rounded-xl px-4 py-2.5 text-white font-semibold"
                    style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                  />
                  <Pressable
                    onPress={handleSaveVenue}
                    disabled={updateSettings.isPending}
                    className="bg-white rounded-xl py-3 items-center mt-4"
                  >
                    <Text className="font-bold" style={{ color: colors.primaryDark }}>Save</Text>
                  </Pressable>
                  {cancelRow}
                </>
              ) : panel === "WICKET" && !wicketType ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Wicket</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {WICKET_TYPES.map((w) => (
                      <Pressable
                        key={w.value}
                        onPress={() => setWicketType(w.value)}
                        className="rounded-xl px-3.5 py-2.5"
                        style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      >
                        <Text className="text-white font-semibold text-sm">{w.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "WICKET" && wicketType ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">{WICKET_TYPES.find((w) => w.value === wicketType)?.label}</Text>
                  {(wicketType === "RUN_OUT" || wicketType === "MANKAD") && (
                    <>
                      <Text className="text-white text-xs font-semibold mb-2" style={{ opacity: 0.85 }}>Who was run out?</Text>
                      <View className="flex-row mb-3" style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => setWicketEnd("striker")}
                          className="flex-1 items-center rounded-xl py-3"
                          style={{ backgroundColor: wicketEnd === "striker" ? "#111827" : "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                        >
                          <Text className="text-white text-sm font-medium">{effectiveStriker}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setWicketEnd("nonStriker")}
                          className="flex-1 items-center rounded-xl py-3"
                          style={{ backgroundColor: wicketEnd === "nonStriker" ? "#111827" : "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                        >
                          <Text className="text-white text-sm font-medium">{effectiveNonStriker}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                  {(wicketType === "CAUGHT" || wicketType === "STUMPED" || wicketType === "RUN_OUT" || wicketType === "ONE_HAND_ONE_BOUNCE") && (
                    <View className="mb-3">
                      <Text className="text-white text-xs font-semibold mb-2" style={{ opacity: 0.85 }}>Fielder (optional)</Text>
                      <TextInput
                        value={fielderName}
                        onChangeText={setFielderName}
                        placeholder="Fielder name"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        className="rounded-xl px-4 py-2.5 text-white"
                        style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      />
                    </View>
                  )}
                  {wicketType === "RUN_OUT" ? (
                    wicketEnd && (
                      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                        {[0, 1, 2, 3].map((n) => (
                          <Pressable key={n} onPress={() => handleWicket(n)} className="rounded-xl items-center justify-center" style={{ width: 52, height: 48, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}>
                            <Text className="text-white font-bold">{n}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )
                  ) : wicketType === "MANKAD" ? (
                    wicketEnd && (
                      <Pressable onPress={() => handleWicket(0)} disabled={addBall.isPending} className="bg-white rounded-xl py-3 items-center">
                        <Text className="font-bold" style={{ color: colors.primaryDark }}>Confirm Wicket</Text>
                      </Pressable>
                    )
                  ) : (
                    <Pressable onPress={() => handleWicket(0)} disabled={addBall.isPending} className="bg-white rounded-xl py-3 items-center">
                      <Text className="font-bold" style={{ color: colors.primaryDark }}>Confirm Wicket</Text>
                    </Pressable>
                  )}
                  {cancelRow}
                </>
              ) : null}
            </View>
          )}
        </>
      ) : matchCentreTab === "scorecard" ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <Text className="text-ink font-bold text-base mb-3">Full Scorecard</Text>
          <Pressable
            onPress={() => navigation.navigate("FullScorecard", { matchId: match.id })}
            className="flex-row items-center justify-between bg-white rounded-2xl border border-border px-4 py-4"
            style={cardShadow}
          >
            <Text className="text-ink font-semibold">Open full batting &amp; bowling scorecard</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </ScrollView>
      ) : matchCentreTab === "stats" ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <View className="bg-white rounded-2xl border border-border p-4" style={cardShadow}>
            <Text className="text-ink font-bold text-base mb-3">This Innings</Text>
            {[
              { label: "Run rate", value: runRate.toFixed(2) },
              { label: "Extras", value: String(extrasTotal) },
              { label: "Boundaries (4s)", value: String(Object.values(inningsState?.battingStats ?? {}).reduce((s, b) => s + b.fours, 0)) },
              { label: "Sixes", value: String(Object.values(inningsState?.battingStats ?? {}).reduce((s, b) => s + b.sixes, 0)) },
              { label: "Dot-ball economy (bowlers)", value: `${Object.values(inningsState?.bowlingStats ?? {}).length} bowled` },
            ].map((row, i) => (
              <View key={row.label} className="flex-row items-center justify-between py-2.5" style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                <Text className="text-ink text-sm">{row.label}</Text>
                <Text className="text-ink font-bold text-sm">{row.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : matchCentreTab === "superstars" ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {(() => {
            const topBatter = Object.values(inningsState?.battingStats ?? {}).sort((a, b) => b.runs - a.runs)[0];
            const topBowler = Object.values(inningsState?.bowlingStats ?? {}).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];
            return (
              <View style={{ gap: 12 }}>
                {topBatter && topBatter.runs > 0 && (
                  <View className="bg-white rounded-2xl border border-border p-4 flex-row items-center" style={{ ...cardShadow, gap: 12 }}>
                    <PlayerAvatar name={topBatter.name} />
                    <View className="flex-1">
                      <Text className="text-muted text-xs font-bold">TOP SCORER</Text>
                      <Text className="text-ink font-bold text-base">{topBatter.name}</Text>
                      <Text className="text-muted text-sm">{topBatter.runs} ({topBatter.balls})</Text>
                    </View>
                  </View>
                )}
                {topBowler && topBowler.wickets > 0 && (
                  <View className="bg-white rounded-2xl border border-border p-4 flex-row items-center" style={{ ...cardShadow, gap: 12 }}>
                    <PlayerAvatar name={topBowler.name} />
                    <View className="flex-1">
                      <Text className="text-muted text-xs font-bold">TOP WICKET-TAKER</Text>
                      <Text className="text-ink font-bold text-base">{topBowler.name}</Text>
                      <Text className="text-muted text-sm">{topBowler.wickets}-{topBowler.runsConceded}</Text>
                    </View>
                  </View>
                )}
                {(!topBatter || topBatter.runs === 0) && (!topBowler || topBowler.wickets === 0) && (
                  <Text className="text-muted text-sm text-center py-10">No standout performances yet — keep scoring!</Text>
                )}
              </View>
            );
          })()}
        </ScrollView>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <View className="bg-white rounded-2xl border border-border p-3.5" style={cardShadow}>
            <ScrollView
              ref={recentBallsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onContentSizeChange={() => recentBallsScrollRef.current?.scrollToEnd({ animated: true })}
            >
              <View className="flex-row items-start" style={{ gap: 14 }}>
                {(ballsByOver.length > 0 ? ballsByOver : [[]]).map((over, overIndex) => (
                  <View key={overIndex} className="items-start">
                    <Text className="text-muted text-xs font-semibold mb-2">Over {overIndex + 1}</Text>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      {Array.from({ length: Math.max(6, over.length) }).map((_, i) => {
                        const b = over[i];
                        if (!b) {
                          return (
                            <View key={i} className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: "#F3F4F6" }}>
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
                              {ballLabel(b)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {selectBatsmanOpen && (
        <SelectPlayerPanel
          title="Select Batsman"
          names={battingPlayers}
          excluded={excludeForNextBatsman}
          selectedName={needsStriker ? null : effectiveStriker}
          benchedNames={benchedNames}
          onToggleBench={toggleBench}
          onClose={() => setSelectBatsmanOpen(false)}
          onSelect={(name) => {
            if (needsStriker) setPendingStriker(name);
            else setPendingNonStriker(name);
            setSelectBatsmanOpen(false);
          }}
          onAddPlayer={(name) => handleAddPlayer("batting", name)}
          addPlayerPending={addRosterPlayer.isPending}
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
          onSelect={(name) => {
            setPendingBowler(name);
            setSelectBowlerOpen(false);
          }}
          onAddPlayer={(name) => handleAddPlayer("bowling", name)}
          addPlayerPending={addRosterPlayer.isPending}
        />
      )}
    </View>
  );
}
