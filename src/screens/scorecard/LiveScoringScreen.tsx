import { Children, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput, Share, useWindowDimensions } from "react-native";
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
import { ballRowToEvent, friendlyCricketError, type CricketMatchDetail, type CricketInnings, type CricketBallRow } from "../../lib/api/cricket";
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
  type InningsState,
} from "../../lib/cricketScoring";
import { describeBallCommentary, computePartnerships, computePlayerOfTheMatch } from "../../lib/cricketCommentary";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import ScoringCodeBadge from "../../components/ScoringCodeBadge";
import GradientFill from "../../components/GradientFill";
import { resourcePercent, computeDuckworthLewis } from "../../lib/duckworthLewis";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import TeamCrest from "../../components/TeamCrest";
import { buildCricketMatchReportHtml } from "../../lib/matchReport/cricketReport";
import { generateAndShareMatchReport } from "../../lib/matchReport/pdfShare";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import { uniqueChannelName } from "../../lib/realtimeChannel";
import { useQueryClient } from "@tanstack/react-query";
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

type MatchCentreTabKey = "scoring" | "scorecard" | "stats" | "superstars" | "summary" | "balls" | "info";

// While a match is live, the tab bar is exactly what it's always been
// (Scoring is where the keypad lives). Once a match is COMPLETED there's
// nothing left to score, so "Scoring" is dropped in favor of the completed-
// match tab set (Summary becomes the default landing tab instead) — see
// isMatchCompleted/activeTabs below.
const LIVE_TABS: { key: MatchCentreTabKey; label: string }[] = [
  { key: "scoring", label: "Scoring" },
  { key: "scorecard", label: "Scorecard" },
  { key: "stats", label: "Stats" },
  { key: "superstars", label: "Super Stars" },
];
const COMPLETED_TABS: { key: MatchCentreTabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "scorecard", label: "Scorecard" },
  { key: "stats", label: "Stats" },
  { key: "superstars", label: "Super Stars" },
  { key: "balls", label: "Balls" },
  { key: "info", label: "Info" },
];

// Short label for one delivery — the usual Wd/Nb/B/Lb/P shorthand for
// extras, the plain runs scored, or "W" for a wicket. A run out can land on
// an extra too (see RunOutPanel) — that still shows the extra's own
// shorthand, with " W" appended, rather than collapsing to a bare "W" and
// losing which kind of delivery it was. Shared by the current-over strip
// above the keypad and the Balls tab's full over-by-over log.
function ballLabel(b: BallEvent): string {
  const extraLabel =
    b.extraType === "WIDE"
      ? `Wd${b.extraRuns > 1 ? "+" + (b.extraRuns - 1) : ""}`
      : b.extraType === "NOBALL"
        ? `Nb${b.runsBatted > 0 ? "+" + b.runsBatted : ""}`
        : b.extraType === "BYE"
          ? `B${b.extraRuns}`
          : b.extraType === "LEGBYE"
            ? `Lb${b.extraRuns}`
            : b.extraType === "PENALTY"
              ? `P${b.extraRuns >= 0 ? "+" : ""}${b.extraRuns}`
              : null;
  if (b.isWicket) return extraLabel ? `${extraLabel} W` : "W";
  return extraLabel ?? String(b.runsBatted);
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

// Shared rounded segmented toggle — used for the Scorecard tab's team
// switcher and the Balls tab's 1st/2nd-innings switcher (identical visuals,
// different option lists), matching the reference design's pill control.
function SegmentedPill({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View className="flex-row bg-gray-100 rounded-full p-1 mb-4">
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onSelect(o.key)}
          className="flex-1 items-center rounded-full py-2.5"
          style={{ backgroundColor: selected === o.key ? colors.primary : "transparent" }}
        >
          <Text
            className="text-xs font-bold"
            numberOfLines={1}
            style={{ color: selected === o.key ? "white" : colors.muted }}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// One innings' full batting/bowling card — same content the old
// FullScorecardScreen showed, now rendered inline in this screen's
// "Scorecard" tab instead of a separate read-only screen. `balls` (the raw
// chronological ball log) and `allPlayers` (the batting team's full roster)
// feed the Partnership list and Did Not Bat line respectively — neither is
// derivable from `state` alone.
function InningsCard({
  teamName,
  inningsNumber,
  color,
  state,
  balls,
  allPlayers,
}: {
  teamName: string;
  inningsNumber: number;
  color: string;
  state: InningsState;
  balls: BallEvent[];
  allPlayers: string[];
}) {
  const runRate = computeRunRate(state.runs, state.legalBalls);
  const didNotBat = allPlayers.filter((n) => !state.battingOrder.includes(n));
  const extrasTotal = state.extras.bye + state.extras.wide + state.extras.noball + state.extras.legbye;
  const extrasParts = [
    state.extras.bye > 0 ? `B ${state.extras.bye}` : null,
    state.extras.wide > 0 ? `WD ${state.extras.wide}` : null,
    state.extras.noball > 0 ? `NB ${state.extras.noball}` : null,
    state.extras.legbye > 0 ? `LB ${state.extras.legbye}` : null,
  ].filter((p): p is string => !!p);
  const partnerships = computePartnerships(balls);

  return (
    <View className="rounded-2xl border border-border overflow-hidden mb-4 bg-white" style={cardShadow}>
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
          <TeamCrest color={color} size={36} icon="cricket" />
          <View className="flex-1">
            <Text className="text-ink font-bold text-base" numberOfLines={1}>{teamName}</Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
              {inningsNumber === 1 ? "1st" : "2nd"} Innings · {state.isComplete ? "Completed" : "Batting"}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
            {state.runs}/{state.wickets}
          </Text>
          <Text className="text-muted text-xs" numberOfLines={1}>
            ({formatOvers(state.legalBalls)} ov, RR {runRate.toFixed(2)})
          </Text>
        </View>
      </View>

      <View className="px-4 pb-4">
        <View className="flex-row pb-2 border-b border-border">
          <Text className="text-muted text-xs font-semibold flex-1">Batsman</Text>
          <Text className="text-muted text-xs font-semibold" style={{ width: 40, textAlign: "center" }}>R</Text>
          <Text className="text-muted text-xs font-semibold" style={{ width: 36, textAlign: "center" }}>B</Text>
          <Text className="text-muted text-xs font-semibold" style={{ width: 30, textAlign: "center" }}>4s</Text>
          <Text className="text-muted text-xs font-semibold" style={{ width: 30, textAlign: "center" }}>6s</Text>
          <Text className="text-muted text-xs font-semibold" style={{ width: 44, textAlign: "center" }}>SR</Text>
        </View>
        {state.battingOrder.map((name) => {
          const s = state.battingStats[name];
          const sr = s.balls > 0 ? (s.runs / s.balls) * 100 : 0;
          return (
            <View key={name} className="py-2.5 border-b border-border">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-ink text-sm font-semibold" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                    {s.isOut ? s.outDescription : "not out"}
                  </Text>
                </View>
                <Text className="text-ink text-sm font-semibold" style={{ width: 40, textAlign: "center" }}>{s.runs}</Text>
                <Text className="text-ink text-sm" style={{ width: 36, textAlign: "center" }}>{s.balls}</Text>
                <Text className="text-ink text-sm" style={{ width: 30, textAlign: "center" }}>{s.fours}</Text>
                <Text className="text-ink text-sm" style={{ width: 30, textAlign: "center" }}>{s.sixes}</Text>
                <Text className="text-ink text-sm" style={{ width: 44, textAlign: "center" }}>{sr.toFixed(1)}</Text>
              </View>
            </View>
          );
        })}

        <View className="rounded-xl bg-gray-50 px-3 py-3 mt-3">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-muted text-xs">Extras</Text>
              <Text className="text-ink text-sm font-semibold mt-0.5">{extrasTotal}</Text>
              <Text className="text-xs font-bold mt-2.5" style={{ color }}>Total</Text>
              <Text className="font-extrabold text-base" style={{ color }}>{state.runs}/{state.wickets}</Text>
            </View>
            <View className="items-end">
              <Text className="text-muted text-xs">Overs</Text>
              <Text className="text-ink text-sm font-semibold mt-0.5">{formatOvers(state.legalBalls)}</Text>
              <Text className="text-muted text-xs mt-2.5">Run Rate</Text>
              <Text className="text-ink text-sm font-semibold">{runRate.toFixed(1)}</Text>
            </View>
          </View>
          {extrasParts.length > 0 && <Text className="text-muted text-xs mt-3">{extrasParts.join(" | ")}</Text>}
        </View>
        {didNotBat.length > 0 && (
          <Text className="text-muted text-xs mt-2.5" numberOfLines={2}>Did Not Bat - {didNotBat.join(", ")}</Text>
        )}

        {state.bowlingOrder.length > 0 && (
          <>
            <View className="flex-row pt-4 pb-2 border-b border-border mt-2">
              <Text className="text-muted text-xs font-semibold flex-1">Bowler</Text>
              <Text className="text-muted text-xs font-semibold" style={{ width: 40, textAlign: "center" }}>O</Text>
              <Text className="text-muted text-xs font-semibold" style={{ width: 32, textAlign: "center" }}>M</Text>
              <Text className="text-muted text-xs font-semibold" style={{ width: 32, textAlign: "center" }}>R</Text>
              <Text className="text-muted text-xs font-semibold" style={{ width: 32, textAlign: "center" }}>W</Text>
              <Text className="text-muted text-xs font-semibold" style={{ width: 44, textAlign: "center" }}>Eco</Text>
            </View>
            {state.bowlingOrder.map((name) => {
              const b = state.bowlingStats[name];
              const econ = b.legalBalls > 0 ? (b.runsConceded / b.legalBalls) * 6 : 0;
              return (
                <View key={name} className="flex-row items-center py-2.5 border-b border-border">
                  <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={1}>{name}</Text>
                  <Text className="text-ink text-sm" style={{ width: 40, textAlign: "center" }}>{formatOvers(b.legalBalls)}</Text>
                  <Text className="text-ink text-sm" style={{ width: 32, textAlign: "center" }}>{b.maidens}</Text>
                  <Text className="text-ink text-sm" style={{ width: 32, textAlign: "center" }}>{b.runsConceded}</Text>
                  <Text className="text-ink text-sm" style={{ width: 32, textAlign: "center" }}>{b.wickets}</Text>
                  <Text className="text-ink text-sm" style={{ width: 44, textAlign: "center" }}>{econ.toFixed(1)}</Text>
                </View>
              );
            })}
          </>
        )}

        {state.fallOfWickets.length > 0 && (
          <View className="mt-4">
            <Text className="text-ink font-bold text-sm mb-2">Fall of wickets</Text>
            {state.fallOfWickets.map((f, i) => (
              <View
                key={i}
                className="flex-row items-center justify-between py-2"
                style={i < state.fallOfWickets.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
              >
                <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
                  <Text className="text-muted text-xs font-semibold" style={{ width: 18 }}>{f.wicketNumber}</Text>
                  <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{f.playerOut.toUpperCase()}</Text>
                </View>
                <Text className="text-ink text-sm">{f.teamScore} ({f.overs})</Text>
              </View>
            ))}
          </View>
        )}

        {partnerships.length > 0 && (
          <View className="mt-4 mb-1">
            <Text className="text-ink font-bold text-sm mb-2">Partnership</Text>
            {partnerships.map((p, i) => {
              const statA = state.battingStats[p.batsmanA];
              const statB = p.batsmanB ? state.battingStats[p.batsmanB] : undefined;
              return (
                <View key={i} className="flex-row items-center justify-between py-2.5">
                  <View className="flex-1">
                    <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{p.batsmanA.toUpperCase()}</Text>
                    {statA && <Text className="text-muted text-xs mt-0.5">{statA.runs}({statA.balls})</Text>}
                  </View>
                  <View className="items-center" style={{ width: 70 }}>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 40, height: 40, borderWidth: 1.5, borderColor: color }}
                    >
                      <Text className="font-extrabold text-sm" style={{ color }}>{p.runs}</Text>
                    </View>
                    <Text className="text-muted text-[10px] mt-1">{p.balls} Balls</Text>
                  </View>
                  <View className="flex-1 items-end">
                    {p.batsmanB ? (
                      <>
                        <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{p.batsmanB.toUpperCase()}</Text>
                        {statB && <Text className="text-muted text-xs mt-0.5">{statB.runs}({statB.balls})</Text>}
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

// Shared shape of the per-innings data every completed-match tab below
// works from (the main screen's own scorecardInnings useMemo produces an
// array of exactly this).
type ScorecardInningsEntry = {
  inn: CricketInnings & { cricket_balls: CricketBallRow[] };
  teamName: string;
  state: InningsState;
};

// Completed-match "Summary" tab — both teams' final score + their own top 3
// batters paired with the opposing team's top 3 bowlers (the side that
// actually bowled at them), a Winner card and a Player of the Match card
// (both read-only, computed from already-fetched data — no new schema),
// and the two share actions.
function SummaryTab({
  match,
  scorecardInnings,
  onShareReport,
  generatingReport,
  onShareSummary,
}: {
  match: CricketMatchDetail;
  scorecardInnings: ScorecardInningsEntry[];
  onShareReport: () => void;
  generatingReport: boolean;
  onShareSummary: () => void;
}) {
  if (scorecardInnings.length === 0) {
    return (
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-muted text-sm text-center mt-10">No balls bowled yet.</Text>
      </ScrollView>
    );
  }

  const potm = computePlayerOfTheMatch(scorecardInnings);

  const [first, second] = scorecardInnings;
  let winnerName: string | null = null;
  let winnerColor = colors.primary;
  if (first && second) {
    if (second.state.runs > first.state.runs) {
      winnerName = second.teamName;
      winnerColor = second.inn.batting_team === "A" ? colors.primary : "#1D4ED8";
    } else if (first.state.runs > second.state.runs) {
      winnerName = first.teamName;
      winnerColor = first.inn.batting_team === "A" ? colors.primary : "#1D4ED8";
    }
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {scorecardInnings.map((si) => {
        const isTeamA = si.inn.batting_team === "A";
        const color = isTeamA ? colors.primary : "#1D4ED8";
        const opposing = scorecardInnings.find((o) => o.inn.id !== si.inn.id);
        const topBatters = si.state.battingOrder
          .map((n) => si.state.battingStats[n])
          .sort((a, b) => b.runs - a.runs)
          .slice(0, 3);
        const topBowlers = opposing
          ? opposing.state.bowlingOrder
              .map((n) => opposing.state.bowlingStats[n])
              .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
              .slice(0, 3)
          : [];
        return (
          <View key={si.inn.id} className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
                <TeamCrest color={color} size={32} icon="cricket" />
                <Text className="font-bold text-base flex-1" numberOfLines={1} style={{ color }}>
                  {si.teamName.toUpperCase()}
                </Text>
              </View>
              <Text className="font-extrabold text-base" style={{ color }}>
                {si.state.runs}-{si.state.wickets}{" "}
                <Text className="text-muted text-xs font-semibold">({formatOvers(si.state.legalBalls)})</Text>
              </Text>
            </View>
            <View className="h-px bg-border mb-2" />
            {Array.from({ length: Math.max(topBatters.length, topBowlers.length) }, (_, row) => (
              <View key={row} className="flex-row items-center justify-between py-1.5">
                <Text className="text-ink text-sm flex-1" numberOfLines={1}>
                  {topBatters[row] ? `${topBatters[row].name} ${topBatters[row].runs}(${topBatters[row].balls})` : ""}
                </Text>
                <Text className="text-ink text-sm flex-1 text-right" numberOfLines={1}>
                  {topBowlers[row] ? `${topBowlers[row].name} ${topBowlers[row].wickets}-${topBowlers[row].runsConceded}` : ""}
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      {winnerName && (
        <View className="bg-white rounded-2xl p-4 mb-3 flex-row items-center" style={{ ...cardShadow, gap: 12 }}>
          <TeamCrest color={winnerColor} size={44} icon="cricket" />
          <View className="flex-1">
            <Text className="text-muted text-xs">Winner</Text>
            <Text className="text-ink font-bold text-base mt-0.5" numberOfLines={2}>
              {match.result_summary ?? `${winnerName} won`}
            </Text>
          </View>
        </View>
      )}

      {potm && (
        <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center" style={{ ...cardShadow, gap: 12 }}>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="person" size={22} color={colors.primaryDark} />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs">Player Of The Match</Text>
            <Text className="text-ink font-bold text-base mt-0.5" numberOfLines={1}>{potm}</Text>
          </View>
        </View>
      )}

      <Pressable
        onPress={onShareReport}
        disabled={generatingReport}
        className="flex-row items-center justify-center rounded-2xl py-3.5 mb-3"
        style={{ borderWidth: 1.5, borderColor: colors.border, gap: 8 }}
      >
        {generatingReport ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text className="font-semibold text-sm" style={{ color: colors.ink }}>Share Match Report</Text>
          </>
        )}
      </Pressable>
      <Pressable
        onPress={onShareSummary}
        className="flex-row items-center justify-center rounded-2xl py-3.5"
        style={{ borderWidth: 1.5, borderColor: colors.border, gap: 8 }}
      >
        <Ionicons name="share-social-outline" size={18} color={colors.ink} />
        <Text className="font-semibold text-sm" style={{ color: colors.ink }}>Share Match Summary</Text>
      </Pressable>
    </ScrollView>
  );
}

// Completed-match "Balls" tab — a reverse-chronological, over-grouped
// commentary feed for whichever innings is selected. Each over's snapshot
// card is computed by replaying that innings' chronological ball-prefix up
// through the over's last ball (innings are short, so re-replaying per over
// has no real performance cost for a one-time completed-match render).
function BallsTab({
  match,
  scorecardInnings,
  selectedInningsNumber,
  onSelectInnings,
}: {
  match: CricketMatchDetail;
  scorecardInnings: ScorecardInningsEntry[];
  selectedInningsNumber: number;
  onSelectInnings: (n: number) => void;
}) {
  if (scorecardInnings.length === 0) {
    return (
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-muted text-sm text-center mt-10">No balls bowled yet.</Text>
      </ScrollView>
    );
  }

  const selected =
    scorecardInnings.find((si) => si.inn.innings_number === selectedInningsNumber) ??
    scorecardInnings[scorecardInnings.length - 1];
  const battingTeamLetter = selected.inn.batting_team as "A" | "B";
  const battingPlayers = battingTeamLetter === "A" ? match.team_a_players : match.team_b_players;
  const startingRuns = battingTeamLetter === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs;
  const chronBalls = [...selected.inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
  const overs = groupBallsByOver(chronBalls);

  let consumed = 0;
  const overGroups = overs.map((over, overIdx) => {
    consumed += over.length;
    const prefix = chronBalls.slice(0, consumed);
    const snapshot = replayInnings(
      prefix,
      battingTeamLetter,
      match.overs_limit,
      battingPlayers.length,
      chronBalls[0].strikerName,
      chronBalls[0].nonStrikerName ?? "",
      startingRuns,
      match.last_man_stand
    );
    // A wide/no-ball doesn't advance the ball count, so it shares the same
    // "over.ball" label as whichever legal delivery it's attached to —
    // standard scorecard notation.
    let legalSoFar = 0;
    const labeled = over.map((b) => {
      const label = `${overIdx + 1}.${legalSoFar + 1}`;
      if (b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY") legalSoFar += 1;
      return { ball: b, label };
    });
    return { over: labeled, state: snapshot, runsInOver: over.reduce((s, b) => s + b.runsBatted + b.extraRuns, 0) };
  });

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {scorecardInnings.length > 1 && (
        <SegmentedPill
          options={scorecardInnings.map((si) => ({
            key: String(si.inn.innings_number),
            label: si.inn.innings_number === 1 ? "1st Innings" : "2nd Innings",
          }))}
          selected={String(selectedInningsNumber)}
          onSelect={(k) => onSelectInnings(Number(k))}
        />
      )}
      {[...overGroups].reverse().map((group, gi) => {
        const lastBall = group.over[group.over.length - 1].ball;
        const strikerStat = group.state.striker ? group.state.battingStats[group.state.striker] : undefined;
        const nonStrikerStat = group.state.nonStriker ? group.state.battingStats[group.state.nonStriker] : undefined;
        const bowlerStat = group.state.bowlingStats[lastBall.bowlerName];
        return (
          <View key={gi} style={{ marginBottom: 18 }}>
            <View className="bg-gray-50 rounded-2xl px-3.5 py-3 mb-2">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  {group.state.striker && (
                    <Text className="text-ink text-sm font-semibold" numberOfLines={1}>
                      {group.state.striker} {strikerStat ? `${strikerStat.runs}(${strikerStat.balls})` : ""}
                    </Text>
                  )}
                  {group.state.nonStriker && (
                    <Text className="text-ink text-sm font-semibold mt-0.5" numberOfLines={1}>
                      {group.state.nonStriker} {nonStrikerStat ? `${nonStrikerStat.runs}(${nonStrikerStat.balls})` : ""}
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{lastBall.bowlerName}</Text>
                  {bowlerStat && (
                    <Text className="text-muted text-xs mt-0.5">
                      {formatOvers(bowlerStat.legalBalls)} - {bowlerStat.maidens} - {bowlerStat.runsConceded} - {bowlerStat.wickets}
                    </Text>
                  )}
                </View>
              </View>
              <View
                className="flex-row items-center justify-between mt-2.5 pt-2"
                style={{ borderTopWidth: 1, borderTopColor: colors.border }}
              >
                <Text className="text-muted text-xs font-semibold">Overs {formatOvers(group.state.legalBalls)}</Text>
                <Text className="text-muted text-xs font-semibold">Runs {group.runsInOver}</Text>
                <Text className="text-muted text-xs font-semibold">Score {group.state.runs}-{group.state.wickets}</Text>
              </View>
            </View>
            {[...group.over].reverse().map(({ ball, label }, bi) => (
              <View
                key={bi}
                className="flex-row items-start py-2.5"
                style={{ gap: 10, borderBottomWidth: bi < group.over.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
              >
                <Text className="text-muted text-xs font-semibold" style={{ width: 32, marginTop: 2 }}>{label}</Text>
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: ball.isWicket ? 30 : 26,
                    height: ball.isWicket ? 30 : 26,
                    backgroundColor: ball.isWicket ? colors.danger : "#E5E7EB",
                  }}
                >
                  <Text className="font-bold text-center" style={{ color: ball.isWicket ? "white" : colors.ink, fontSize: 11 }}>
                    {ballLabel(ball)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{ball.bowlerName} to {ball.strikerName}</Text>
                  <Text className="text-muted text-xs mt-0.5">{describeBallCommentary(ball)}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

// Completed-match "Info" tab — no reference screenshot was given for this
// one, so it's populated with the match metadata this screen already has
// (nothing new fetched), in the app's standard card style.
function InfoTab({ match }: { match: CricketMatchDetail }) {
  const rows: { label: string; value: string }[] = [
    { label: "Venue", value: match.venue || "Not set" },
    { label: "Overs", value: `${match.overs_limit} overs` },
    { label: "Toss", value: match.toss_winner ? `${match.toss_winner} chose to ${match.toss_decision ?? "—"}` : "—" },
    { label: "Last Man Stand", value: match.last_man_stand ? "On" : "Off" },
    { label: "Scoring Code", value: match.scoring_code ?? "—" },
    {
      label: "Completed",
      value: match.completed_at
        ? new Date(match.completed_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })
        : "—",
    },
  ];
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="bg-white rounded-2xl p-4" style={cardShadow}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            className="flex-row items-center justify-between py-2.5"
            style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
          >
            <Text className="text-muted text-sm">{r.label}</Text>
            <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{r.value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
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

// A centered white card dialog (title, message, divider, button row) — the
// reference's confirmation style for Abandon/End Innings/the "Not Allowed"
// eligibility messages, distinct from the native Alert.alert look used
// elsewhere, since this needs a disableable/counting button (Abandon) that a
// native alert can't do.
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  disabledLabel,
  onConfirm,
  onCancel,
  confirmDisabled,
  singleButton,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  // Shown on the confirm button instead of confirmLabel while
  // confirmDisabled is true — e.g. Abandon's "Wait : 4" countdown.
  disabledLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  singleButton?: boolean;
}) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/40 items-center justify-center px-10">
        <View className="bg-white rounded-2xl w-full overflow-hidden" style={{ maxWidth: 340 }}>
          <View className="px-5 pt-5 pb-5">
            <Text className="text-ink font-bold text-lg mb-2">{title}</Text>
            <Text className="text-ink text-sm" style={{ lineHeight: 20 }}>{message}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View className="flex-row">
            {!singleButton && (
              <Pressable
                onPress={onConfirm}
                disabled={confirmDisabled}
                className="flex-1 items-center py-3.5"
                style={{ borderRightWidth: 1, borderColor: colors.border }}
              >
                <Text className="font-bold" style={{ color: confirmDisabled ? colors.muted : colors.primaryDark }}>
                  {confirmDisabled ? disabledLabel : confirmLabel}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={onCancel} className="flex-1 items-center py-3.5">
              <Text className="font-bold" style={{ color: colors.primaryDark }}>
                {singleButton ? "Ok" : "Cancel"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  headerExtra,
  listLabel,
  submitting,
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
  // Extra content rendered between the header and the player list — used by
  // the Stumped flow's "Is that a wide ball?" toggle, so that flow can reuse
  // this exact same squad-list UI instead of duplicating it.
  headerExtra?: ReactNode;
  listLabel?: string;
  // True while a tap on a row is already being submitted (e.g. the Stumped
  // flow's onSelect records the dismissal immediately) — disables every row
  // so a second quick tap on a different name can't fire a second ball.
  // submitBall itself also guards against this, so this is belt-and-
  // suspenders visual feedback, not the only thing preventing it.
  submitting?: boolean;
}) {
  const [addDraft, setAddDraft] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <GradientFill
          className="flex-row items-center px-4 pb-3"
          style={{ paddingTop: 54, gap: 12 }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          <Text className="text-white font-bold text-lg flex-1">{title}</Text>
        </GradientFill>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {headerExtra}
          {listLabel && <Text className="text-ink font-bold text-sm mb-3">{listLabel}</Text>}
          {names.map((name, i) => {
            const isExcluded = excluded.includes(name);
            const isBenched = benchedNames.has(name);
            const isSelected = name === selectedName;
            const disabled = isExcluded || isBenched || !!submitting;
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
              >
                <GradientFill className="rounded-xl px-4 py-2.5">
                  {addPlayerPending ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="checkmark" size={18} color="white" />}
                </GradientFill>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <Pressable
          onPress={() => setShowAdd(true)}
          className="absolute bottom-0 left-0 right-0 items-center py-4"
          style={{ paddingBottom: 28 }}
        >
          <GradientFill style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text className="text-white font-bold tracking-wide">ADD / CREATE PLAYER</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// A toggle pill shared by the byes/leg-bye and no-ball/wide rows below —
// selected state fills with the brand green, matching the app's existing
// "selected chip" convention (e.g. PillRow) rather than the translucent
// white-on-green style the inline keypad panels use, since this is a
// light-surface full-screen modal, not the green bottom sheet.
function ToggleOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center rounded-xl py-3"
      style={{
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : "white",
      }}
    >
      <Text className="font-bold text-sm" style={{ color: selected ? "white" : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Dedicated full-screen Run Out flow — distinct from every other dismissal
// type's inline bottom-sheet step (see the WICKET panel further down) since
// a run out alone needs two fielder slots, a wider runs-completed range, and
// the option to flag the same delivery as a bye/leg-bye or no-ball/wide (a
// run out can happen on any of those) — more fields than comfortably fit in
// the keypad's green sheet. Self-contained local state; the parent only
// hears about the final choice via onSubmit.
function RunOutPanel({
  strikerName,
  nonStrikerName,
  bowlingPlayers,
  benchedNames,
  onToggleBench,
  onAddPlayer,
  addPlayerPending,
  onCancel,
  onSubmit,
  submitting,
}: {
  strikerName: string;
  nonStrikerName: string;
  bowlingPlayers: string[];
  benchedNames: Set<string>;
  onToggleBench: (name: string) => void;
  onAddPlayer: (name: string) => void;
  addPlayerPending: boolean;
  onCancel: () => void;
  onSubmit: (result: {
    dismissedName: string;
    fielderName: string;
    fielderName2: string | null;
    runsCompleted: number;
    extraType: ExtraType;
  }) => void;
  submitting: boolean;
}) {
  const [dismissedEnd, setDismissedEnd] = useState<"striker" | "nonStriker" | null>(null);
  const [fielder1, setFielder1] = useState("");
  const [fielder2, setFielder2] = useState("");
  const [fielderSlotOpen, setFielderSlotOpen] = useState<1 | 2 | null>(null);
  const [runs, setRuns] = useState(0);
  // Both toggle rows below share this single value — a delivery can only
  // really be recorded one way at a time (BallEvent.extraType is a single
  // field), so picking "Wide" clears a prior "Byes" pick and vice versa,
  // even though they're shown as two separate optional questions.
  const [extra, setExtra] = useState<ExtraType>(null);

  const dismissedName = dismissedEnd === "striker" ? strikerName : dismissedEnd === "nonStriker" ? nonStrikerName : null;
  const canSubmit = !!dismissedName && !!fielder1.trim();

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 bg-white">
        <GradientFill className="flex-row items-center px-4 pb-3" style={{ paddingTop: 54, gap: 12 }}>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          <Text className="text-white font-bold text-lg flex-1">Run Out</Text>
        </GradientFill>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <Text className="text-ink font-bold text-sm mb-3">Select the batsman *</Text>
          <View className="flex-row mb-6" style={{ gap: 12 }}>
            {(
              [
                { end: "striker" as const, name: strikerName },
                { end: "nonStriker" as const, name: nonStrikerName },
              ]
            ).map(({ end, name }) => (
              <Pressable
                key={end}
                onPress={() => setDismissedEnd(end)}
                className="flex-1 items-center rounded-2xl py-4"
                style={{
                  borderWidth: 1.5,
                  borderColor: dismissedEnd === end ? colors.primary : colors.border,
                  backgroundColor: dismissedEnd === end ? colors.primaryLight : "white",
                }}
              >
                <PlayerAvatar name={name} />
                <Text className="text-ink text-sm font-semibold mt-2" numberOfLines={1}>
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-ink font-bold text-sm mb-3">Select fielder (Fielder 01 is mandatory)</Text>
          <View className="flex-row mb-6" style={{ gap: 28 }}>
            {(
              [
                { slot: 1 as const, name: fielder1, label: "Fielder 01*" },
                { slot: 2 as const, name: fielder2, label: "Fielder 02" },
              ]
            ).map(({ slot, name, label }) => (
              <Pressable key={slot} onPress={() => setFielderSlotOpen(slot)} className="items-center" style={{ gap: 6, width: 76 }}>
                {name ? (
                  <PlayerAvatar name={name} />
                ) : (
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 38, height: 38, backgroundColor: "#F3F4F6" }}
                  >
                    <Ionicons name="add" size={20} color={colors.muted} />
                  </View>
                )}
                <Text className="text-ink text-xs font-medium" numberOfLines={1}>
                  {name || label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-ink font-bold text-sm mb-3">Did batsman complete any runs? (optional)</Text>
          <View className="flex-row flex-wrap mb-6" style={{ gap: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Pressable
                key={n}
                onPress={() => setRuns(runs === n ? 0 : n)}
                className="rounded-xl items-center justify-center"
                style={{
                  width: 52,
                  height: 48,
                  borderWidth: 1.5,
                  borderColor: runs === n ? colors.primary : colors.border,
                  backgroundColor: runs === n ? colors.primary : "white",
                }}
              >
                <Text className="font-bold" style={{ color: runs === n ? "white" : colors.ink }}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-ink font-bold text-sm mb-3">Is that a byes or leg bye? (optional)</Text>
          <View className="flex-row mb-6" style={{ gap: 12 }}>
            <ToggleOption label="Byes" selected={extra === "BYE"} onPress={() => setExtra(extra === "BYE" ? null : "BYE")} />
            <ToggleOption
              label="Leg Byes"
              selected={extra === "LEGBYE"}
              onPress={() => setExtra(extra === "LEGBYE" ? null : "LEGBYE")}
            />
          </View>

          <Text className="text-ink font-bold text-sm mb-3">Is that a noball or wide? (optional)</Text>
          <View className="flex-row mb-6" style={{ gap: 12 }}>
            <ToggleOption
              label="No Ball"
              selected={extra === "NOBALL"}
              onPress={() => setExtra(extra === "NOBALL" ? null : "NOBALL")}
            />
            <ToggleOption label="Wide" selected={extra === "WIDE"} onPress={() => setExtra(extra === "WIDE" ? null : "WIDE")} />
          </View>
        </ScrollView>

        <View className="px-4" style={{ paddingBottom: 28 }}>
          <Pressable
            onPress={() => {
              if (!dismissedName || !fielder1.trim()) return;
              onSubmit({
                dismissedName,
                fielderName: fielder1.trim(),
                fielderName2: fielder2.trim() || null,
                runsCompleted: runs,
                extraType: extra,
              });
            }}
            disabled={!canSubmit || submitting}
            style={{ opacity: canSubmit && !submitting ? 1 : 0.5 }}
          >
            <GradientFill className="rounded-xl py-3.5 items-center">
              {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold tracking-wide">DONE</Text>}
            </GradientFill>
          </Pressable>
        </View>
      </View>

      {fielderSlotOpen && (
        <SelectPlayerPanel
          title={fielderSlotOpen === 1 ? "Select Fielder 01" : "Select Fielder 02"}
          names={bowlingPlayers}
          excluded={[]}
          selectedName={(fielderSlotOpen === 1 ? fielder1 : fielder2) || null}
          benchedNames={benchedNames}
          onToggleBench={onToggleBench}
          onClose={() => setFielderSlotOpen(null)}
          onSelect={(name) => {
            if (fielderSlotOpen === 1) setFielder1(name);
            else setFielder2(name);
            setFielderSlotOpen(null);
          }}
          onAddPlayer={onAddPlayer}
          addPlayerPending={addPlayerPending}
          submitting={submitting}
        />
      )}
    </Modal>
  );
}

export default function LiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
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
  const qc = useQueryClient();

  // RLS only ever lets cricket_matches.user_id write to this match's own
  // tables (cricket_matches_owner/cricket_innings_owner/cricket_balls_owner
  // — every scoring insert/update would be silently rejected for anyone
  // else), so this is the one check that actually matches what the backend
  // enforces — not a separate permission model invented client-side. Every
  // other signed-in tournament player can still open this screen and watch
  // (reads are open to any signed-in user), just without the scoring
  // controls below.
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  const [generatingReport, setGeneratingReport] = useState(false);

  // Live push for every viewer (not just the scorer) — a ball the scorer
  // just added, an innings starting/completing, or a match-level settings
  // change (overs/target/penalty/Last Man Stand) all land here instantly
  // instead of needing a manual refresh. Same uniqueChannelName +
  // postgres_changes pattern already used throughout the app.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName(`liveScoring:${params.matchId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cricket_matches", filter: `id=eq.${params.matchId}` },
        () => qc.invalidateQueries({ queryKey: ["cricketMatch", params.matchId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cricket_innings", filter: `match_id=eq.${params.matchId}` },
        () => qc.invalidateQueries({ queryKey: ["cricketMatch", params.matchId] })
      )
      // cricket_balls has no direct match_id column (only innings_id), so
      // this one stays unfiltered — any ball anywhere invalidates this
      // match's query, a harmless no-op refetch for every other match.
      //
      // Skipped entirely for the scorer's own device: every ball they add
      // already lands in the cache the instant it's tapped, and again (just
      // an id swap, same content) once the insert confirms — see
      // useAddCricketBall's own patchInningsBalls calls. Realtime still
      // echoes that same insert straight back to the device that made it,
      // and invalidating here on top of that raced the very next ball: a
      // fresh whole-match refetch kicked off by this echo could still be in
      // flight when the next tap's own optimistic ball landed, and resolve
      // *after* it with a snapshot that doesn't have that ball yet —
      // overwriting (reverting) it until the next realtime echo caught back
      // up. A spectator (no mutation of their own) still needs this to see
      // new balls live, so it only skips for the one device where it's both
      // redundant and actively harmful.
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_balls" }, () => {
        if (isScorer) return;
        qc.invalidateQueries({ queryKey: ["cricketMatch", params.matchId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.matchId, qc, isScorer]);

  const [pendingStriker, setPendingStriker] = useState<string | null>(null);
  const [pendingNonStriker, setPendingNonStriker] = useState<string | null>(null);
  // Manual strike swap — the scorer tapping the non-striker's name to make
  // them the one facing, without an actual run/ball happening (e.g. they
  // crossed mid-over for a reason this app doesn't model, like a mix-up at
  // the non-striker's end). Purely a local override of which of the two
  // already-derived ends is "on strike" — it never touches ball history
  // directly; the next ball submitted just carries whichever name is
  // currently on strike as its strikerName (see submitBall), so the swap
  // becomes real history at that point and this flag resets.
  const [manualStrikeSwapped, setManualStrikeSwapped] = useState(false);
  const [pendingBowler, setPendingBowler] = useState<string | null>(null);
  // Which bottom-panel sheet is showing on the Scoring tab. Keypad sub-panels
  // reuse the extra-type values they already submit through; the rest are
  // Match-Centre-only panels (More menu, Bonus/More Runs, Retired Hurt, …).
  const [panel, setPanel] = useState<
    ExtraType | "WICKET" | "MORE_RUNS" | "BONUS_RUNS" | "MORE_MENU" | "RETIRED_HURT" | "PENALTY_TEAM" | "CHANGE_TARGET" | null
  >(null);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  const [wicketEnd, setWicketEnd] = useState<"striker" | "nonStriker" | null>(null);
  const [fielderName, setFielderName] = useState("");
  // Stumped-specific: a stumping can happen on a wide (never a no-ball), so
  // this is its own flag rather than reusing RunOutPanel's extraType toggle.
  const [stumpedWide, setStumpedWide] = useState(false);
  const [bonusSign, setBonusSign] = useState<1 | -1>(1);
  const [matchCentreTab, setMatchCentreTab] = useState<MatchCentreTabKey>("scoring");
  // Scorecard tab's team switcher / Balls tab's innings switcher — both
  // default to the first available option once there's data (see the
  // render below), so these start null rather than guessing.
  const [scorecardInningsId, setScorecardInningsId] = useState<string | null>(null);
  const [ballsInningsNumber, setBallsInningsNumber] = useState<number | null>(null);
  const [selectBatsmanOpen, setSelectBatsmanOpen] = useState(false);
  const [selectBowlerOpen, setSelectBowlerOpen] = useState(false);
  const [selectFielderOpen, setSelectFielderOpen] = useState(false);
  // Which roster names are benched for this session — a scoring-convenience
  // filter only (there's no "bench" concept in the database), so it resets
  // whenever the screen remounts and never affects anyone else's view of the
  // match.
  const [benchedNames, setBenchedNames] = useState<Set<string>>(new Set());
  const [changeTargetDraft, setChangeTargetDraft] = useState("");
  const [revisedOversDraft, setRevisedOversDraft] = useState("");
  // Centered confirm-card dialogs (Abandon/End Innings/the two "Not Allowed"
  // eligibility messages) — separate from `panel` since these float over
  // everything rather than living in the bottom sheet.
  const [dialog, setDialog] = useState<"ABANDON" | "END_INNINGS" | "TARGET_BLOCKED" | "RAIN_DL" | "RAIN_DL_CHASE" | null>(null);
  const ABANDON_WAIT_SECONDS = 4;
  const [abandonCountdown, setAbandonCountdown] = useState(ABANDON_WAIT_SECONDS);
  const mainOverScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (dialog !== "ABANDON") return;
    setAbandonCountdown(ABANDON_WAIT_SECONDS);
    const interval = setInterval(() => {
      setAbandonCountdown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [dialog]);

  const currentInnings = useMemo(() => {
    if (!match) return undefined;
    const active = match.cricket_innings.find((i) => !i.is_completed);
    if (active) return active;
    // Once the match is genuinely finished (not just between innings — see
    // isBetweenInnings below, which checks the DB completion flags
    // directly), fall back to the last innings played so this screen keeps
    // showing its real final score/batting/bowling figures instead of
    // blanking to 0-0. The tick-overlay JSX further down is what actually
    // stops offering scoring controls once match.status is COMPLETED, not
    // this fallback.
    if (match.status === "COMPLETED") {
      return [...match.cricket_innings].sort((a, b) => b.innings_number - a.innings_number)[0];
    }
    return undefined;
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
    const startingRuns = battingTeam === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs;
    return replayInnings(
      ballEvents,
      battingTeam,
      match.overs_limit,
      battingPlayers.length,
      opener1,
      opener2,
      startingRuns,
      match.last_man_stand
    );
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
    const startingRuns = firstBattingTeam === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs;
    return replayInnings(
      balls,
      firstBattingTeam,
      match.overs_limit,
      firstBattingPlayers.length,
      balls[0].strikerName,
      balls[0].nonStrikerName ?? "",
      startingRuns,
      match.last_man_stand
    );
  }, [match, currentInnings]);

  // Every completed/in-progress innings, replayed for the "Scorecard" tab —
  // same derivation the old standalone FullScorecardScreen used, just
  // computed here now that this screen is the permanent scorecard too.
  const scorecardInnings = useMemo(() => {
    if (!match) return [];
    return [...match.cricket_innings]
      .sort((a, b) => a.innings_number - b.innings_number)
      .map((inn) => {
        const teamName = inn.batting_team === "A" ? match.team_a_name : match.team_b_name;
        const totalPlayers = inn.batting_team === "A" ? match.team_a_players.length : match.team_b_players.length;
        const balls = [...inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
        const state =
          balls.length === 0
            ? null
            : replayInnings(
                balls,
                inn.batting_team as "A" | "B",
                match.overs_limit,
                totalPlayers,
                balls[0].strikerName,
                balls[0].nonStrikerName ?? "",
                0,
                match.last_man_stand
              );
        return { inn, teamName, state };
      })
      .filter((x): x is typeof x & { state: InningsState } => x.state !== null);
  }, [match]);

  const handleGenerateMatchReport = async () => {
    if (!match) return;
    setGeneratingReport(true);
    try {
      const html = buildCricketMatchReportHtml(match, {
        organiserName: profile?.full_name ?? "—",
        appName: "HitLit",
      });
      await generateAndShareMatchReport(html);
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the match report."));
    } finally {
      setGeneratingReport(false);
    }
  };

  // A manually-set target (More > Change Target, after a rain delay or
  // similar) always wins over the plain first-innings-runs+1 computation.
  const target = match?.target_override ?? (firstInnings ? firstInnings.runs + 1 : null);
  const chaseComplete = !!(target && inningsState && inningsState.runs >= target);
  const inningsOver = !!inningsState?.isComplete || chaseComplete;

  // D/L verdict for a rain interruption mid-chase ("no further ball can be
  // bowled"): compares team 2's actual score against the D/L par score at
  // this exact point — the target scaled down by how much of team 2's
  // resources have actually been used so far — not the full target, which
  // assumes a complete, uninterrupted innings.
  const rainDLChaseVerdict =
    match && firstInnings && inningsState && target
      ? (() => {
          const team2FullResources = resourcePercent(match.overs_limit, 0, match.overs_limit, inningsState.totalPlayers);
          const team2OversRemainingNow = match.overs_limit - inningsState.legalBalls / 6;
          const team2ResourcesRemainingNow = resourcePercent(team2OversRemainingNow, inningsState.wickets, match.overs_limit, inningsState.totalPlayers);
          const team2ResourcesUsedSoFar = Math.max(team2FullResources - team2ResourcesRemainingNow, 0);
          const finalParScore = target - 1;
          const parScore = team2FullResources > 0 ? finalParScore * (team2ResourcesUsedSoFar / team2FullResources) : 0;
          const parRounded = Math.round(parScore);
          const battingSecondName = inningsState.battingTeam === "A" ? match.team_a_name : match.team_b_name;
          const battingFirstName = firstInnings.battingTeam === "A" ? match.team_a_name : match.team_b_name;
          if (inningsState.runs > parRounded) {
            const margin = inningsState.runs - parRounded;
            return {
              parScore: parRounded,
              summary: `${battingSecondName} won by ${margin} run${margin === 1 ? "" : "s"} (D/L method)`,
              teamAWon: inningsState.battingTeam === "A",
            };
          }
          if (inningsState.runs < parRounded) {
            const margin = parRounded - inningsState.runs;
            return {
              parScore: parRounded,
              summary: `${battingFirstName} won by ${margin} run${margin === 1 ? "" : "s"} (D/L method)`,
              teamAWon: firstInnings.battingTeam === "A",
            };
          }
          return { parScore: parRounded, summary: "Match tied (D/L method)", teamAWon: null as boolean | null };
        })()
      : null;

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
  const isMatchCompleted = match?.status === "COMPLETED";

  // Lands on the new Summary tab the moment a match finishes — whether that
  // happens while this screen is already open, or it's opened directly on
  // an already-completed match. Only fires once per true→false transition
  // (the ref guard) so it doesn't fight a viewer who's since browsed to
  // another tab.
  const hasAutoSwitchedToSummary = useRef(false);
  useEffect(() => {
    if (isMatchCompleted && !hasAutoSwitchedToSummary.current) {
      hasAutoSwitchedToSummary.current = true;
      setMatchCentreTab("summary");
    }
  }, [isMatchCompleted]);

  const baseStriker = inningsState?.striker ?? pendingStriker;
  const baseNonStriker = inningsState?.nonStriker ?? pendingNonStriker;
  const canSwapStrike = !!baseStriker && !!baseNonStriker;
  const effectiveStriker = manualStrikeSwapped && canSwapStrike ? baseNonStriker : baseStriker;
  const effectiveNonStriker = manualStrikeSwapped && canSwapStrike ? baseStriker : baseNonStriker;
  const effectiveBowler = inningsState?.currentBowler ?? pendingBowler;
  // Sets whichever of the two current batsmen is named "on strike" — a
  // no-op if they already are. See manualStrikeSwapped above.
  const setCurrentFacer = (name: string) => {
    if (!canSwapStrike) return;
    setManualStrikeSwapped(name === baseNonStriker);
  };
  // Once the last innings is marked complete there's no active innings left
  // (currentInnings is undefined) — without this, the "Select Opening
  // Striker" picker would flash up for the split second between finishing
  // the match and landing on the final scorecard.
  const hasActiveInnings = !!currentInnings;
  // Last Man Stand: once the second-to-last wicket falls, the other crease
  // slot has no one left to fill (every other teammate is already out) — it
  // stays permanently empty instead of prompting for a replacement that
  // doesn't exist, and scoring continues with just the lone survivor.
  const isLastManBatting = !!match?.last_man_stand && !!inningsState && inningsState.wickets === inningsState.totalPlayers - 1;
  const needsStriker = hasActiveInnings && !inningsOver && !effectiveStriker && !isLastManBatting;
  const needsNonStriker = hasActiveInnings && !inningsOver && !!effectiveStriker && !effectiveNonStriker && !isLastManBatting;
  const readyToScore =
    hasActiveInnings && !inningsOver && !!effectiveStriker && (!!effectiveNonStriker || isLastManBatting) && !!effectiveBowler;
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

  // The single choke point every scoring action goes through — the
  // addBall.isPending guard here is what stops a double-tap (or several
  // quick taps across different buttons/rows) from recording more than one
  // ball. Most callers already have their own belt-and-suspenders guard too
  // (the main keypad's whole panel goes pointerEvents="none" while pending,
  // RunOutPanel's DONE button and the "Confirm Wicket" buttons disable
  // themselves), but those only cover the specific control they're attached
  // to — this is the one place that protects every path at once, including
  // ones with no such guard of their own (e.g. tapping two different names
  // in a row in the Stumped "select wicket keeper" list, which submits
  // straight from onSelect with nothing else in between).
  const submitBall = (partial: Omit<BallEvent, "seq" | "strikerName" | "nonStrikerName" | "bowlerName">) => {
    if (addBall.isPending) return;
    // A Last Man Stand innings legitimately has no non-striker once it's
    // down to the lone survivor — everywhere else, a missing non-striker
    // means a replacement genuinely hasn't been picked yet and the ball
    // can't be scored.
    if (!currentInnings || !effectiveStriker || (!effectiveNonStriker && !isLastManBatting) || !effectiveBowler) return;
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
          setManualStrikeSwapped(false);
          setPanel(null);
          setWicketType(null);
          setWicketEnd(null);
          setFielderName("");
          setStumpedWide(false);
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

  // Run Out itself is handled separately by handleRunOutSubmit/RunOutPanel —
  // this now only ever fires for Mankad (dismisses whichever end the scorer
  // picked, conventionally the non-striker, but the picker stays open in
  // case the scorer needs the other end) and every other non-run-out type
  // (always the striker).
  const handleWicket = () => {
    if (!wicketType) return;
    const dismissed =
      wicketType === "MANKAD" ? (wicketEnd === "nonStriker" ? effectiveNonStriker : effectiveStriker) : effectiveStriker;
    submitBall({
      runsBatted: 0,
      extraType: null,
      extraRuns: 0,
      isWicket: true,
      wicketType,
      dismissedName: dismissed,
      fielderName: fielderName.trim() || null,
    });
  };

  // A run out can land on a normal delivery, or on the same ball as a bye/
  // leg-bye/no-ball/wide — extraType only ever holds one of those at a time
  // (see RunOutPanel's `extra` state comment), so the completed-runs count
  // flows into whichever field that delivery type actually uses, exactly
  // matching handleWide/handleNoBall/handleByeLegBye's own conventions.
  const handleRunOutSubmit = (result: {
    dismissedName: string;
    fielderName: string;
    fielderName2: string | null;
    runsCompleted: number;
    extraType: ExtraType;
  }) => {
    const { dismissedName, fielderName: f1, fielderName2: f2, runsCompleted, extraType } = result;
    const runsBatted = extraType === "BYE" || extraType === "LEGBYE" || extraType === "WIDE" ? 0 : runsCompleted;
    const extraRuns =
      extraType === "BYE" || extraType === "LEGBYE"
        ? runsCompleted
        : extraType === "NOBALL"
          ? 1
          : extraType === "WIDE"
            ? runsCompleted + 1
            : 0;
    submitBall({
      runsBatted,
      extraType,
      extraRuns,
      isWicket: true,
      wicketType: "RUN_OUT",
      dismissedName,
      fielderName: f1,
      fielderName2: f2,
    });
  };

  // A stumping can happen on a wide (the mandatory 1 extra run, same as any
  // bare wide — a batsman doesn't run on a stumping) but never a no-ball, so
  // there's only the one combo to handle, unlike Run Out's four.
  const handleStumpedSubmit = (result: { fielderName: string; wide: boolean }) => {
    if (!effectiveStriker) return;
    submitBall({
      runsBatted: 0,
      extraType: result.wide ? "WIDE" : null,
      extraRuns: result.wide ? 1 : 0,
      isWicket: true,
      wicketType: "STUMPED",
      dismissedName: effectiveStriker,
      fielderName: result.fielderName,
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
              // This screen is the permanent destination for this match now
              // (live or finished) — no more navigating away on completion.
            },
            onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not complete match.")),
          }
        );
      },
      onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not finish the innings.")),
    });
  };

  const handleConfirmAbandon = () => {
    abandonMatch.mutate(undefined, {
      onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not abandon the match.")),
    });
    setDialog(null);
  };

  const handleConfirmEndInnings = () => {
    setDialog(null);
    if (currentInnings?.innings_number === 1) handleStartSecondInnings();
    else handleFinishMatch();
  };

  // Change Target only makes sense once there's a target to change — i.e.
  // during the chase, not the first innings.
  const handleOpenChangeTarget = () => {
    if (currentInnings?.innings_number !== 2) {
      setDialog("TARGET_BLOCKED");
      return;
    }
    setPanel("CHANGE_TARGET");
  };

  // D/L means rain has already stopped play right now — nothing to type
  // in, it resolves automatically from the current state:
  // - 1st innings: the overs actually bowled so far become the new
  //   (reduced) overs limit, and the innings ends immediately with the
  //   score as it stands.
  // - 2nd innings (chasing): no further ball can be bowled, so the match
  //   is decided right now by comparing team 2's score to the D/L par
  //   score at this exact point.
  // "Change Target" (a separate button) stays for when play will resume
  // later with fewer overs and the host just needs to manually set a new
  // target — that one still needs the chase to already be live.
  const handleOpenDL = () => {
    setDialog(currentInnings?.innings_number === 2 ? "RAIN_DL_CHASE" : "RAIN_DL");
  };

  const rainDLOvers = Math.floor((inningsState?.legalBalls ?? 0) / 6);

  const handleToggleLastManStand = () => {
    setPanel(null);
    updateSettings.mutate(
      { lastManStand: !match.last_man_stand },
      { onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not change the Last Man Stand setting.")) }
    );
  };

  const handleConfirmRainDL = () => {
    setDialog(null);
    if (rainDLOvers < 1) {
      Alert.alert("Not Enough Overs Bowled", "At least one full over must be bowled before D/L can set a reduced overs count.");
      return;
    }
    updateSettings.mutate(
      { oversLimit: rainDLOvers },
      { onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not apply the D/L revision.")) }
    );
  };

  const handleConfirmRainDLChase = () => {
    setDialog(null);
    if (!currentInnings || !rainDLChaseVerdict) return;
    markInningsComplete.mutate(currentInnings.id, {
      onSuccess: () => {
        completeMatch.mutate(
          { matchId: match.id, resultSummary: rainDLChaseVerdict.summary },
          {
            onSuccess: () => {
              syncTournamentResult.mutate({ cricketMatchId: match.id, teamAWon: rainDLChaseVerdict.teamAWon });
            },
            onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not complete match.")),
          }
        );
      },
      onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not finish the innings.")),
    });
  };

  const PENALTY_RUNS = 5;

  // Awarding the currently-batting side goes straight into their live score
  // (a PENALTY ball). Awarding the other side — who haven't batted yet —
  // can't touch a score that doesn't exist yet, so it's banked on the match
  // row and applied as a starting-runs credit the moment their innings
  // begins (see replayInnings' startingRuns param above).
  const handleAwardPenalty = (team: "A" | "B") => {
    if (!battingTeam) return;
    if (team === battingTeam) {
      submitBall({ runsBatted: 0, extraType: "PENALTY", extraRuns: PENALTY_RUNS, isWicket: false, wicketType: null, dismissedName: null, fielderName: null });
      return;
    }
    const current = team === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs;
    updateSettings.mutate(
      team === "A" ? { teamAPenaltyRuns: current + PENALTY_RUNS } : { teamBPenaltyRuns: current + PENALTY_RUNS },
      { onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not award penalty runs.")) }
    );
    setPanel(null);
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
          setRevisedOversDraft("");
          setPanel(null);
        },
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not update the target.")),
      }
    );
  };

  // Team 1's resources used comes straight from their already-recorded
  // innings (how many overs they actually got vs match.overs_limit, and how
  // many wickets they lost) — no extra input needed, it's already real data.
  // Team 2's resources available needs one new piece of information: the
  // revised total overs for their (interrupted) innings, entered by the host.
  const revisedOvers = parseFloat(revisedOversDraft);
  const dlPreview =
    firstInnings && inningsState && match && revisedOvers > 0
      ? (() => {
          const team1OversRemainingAtEnd = match.overs_limit - firstInnings.legalBalls / 6;
          const r1 = 100 - resourcePercent(team1OversRemainingAtEnd, firstInnings.wickets, match.overs_limit, firstInnings.totalPlayers);
          const team2OversRemaining = revisedOvers - inningsState.legalBalls / 6;
          const r2 = resourcePercent(team2OversRemaining, inningsState.wickets, revisedOvers, inningsState.totalPlayers);
          return computeDuckworthLewis(firstInnings.runs, r1, r2);
        })()
      : null;

  const handleApplyDLTarget = () => {
    if (!dlPreview) return;
    setChangeTargetDraft(String(dlPreview.target));
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

  // Plain-text version of the Summary tab (final scores, result, Player of
  // the Match) — same Share.share mechanism as handleShare above, just a
  // richer composed message instead of the scoring-code invite.
  const handleShareMatchSummary = () => {
    const potm = computePlayerOfTheMatch(scorecardInnings);
    const lines = [
      `${match.team_a_name} vs ${match.team_b_name}`,
      ...scorecardInnings.map((si) => `${si.teamName}: ${si.state.runs}/${si.state.wickets} (${formatOvers(si.state.legalBalls)} ov)`),
      match.result_summary ?? "",
      potm ? `Player of the Match: ${potm}` : "",
    ].filter(Boolean);
    Share.share({ message: lines.join("\n") }).catch(() => {});
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
  // The "Overs so far" strip below groups by recorded balls alone, so a
  // just-completed over's 6th ball leaves nothing to show the new one until
  // its own first ball is recorded — the scorer picks the new over's bowler
  // in the meantime and sees the old, finished over sitting there instead.
  // Once everything needed to start the new over is in place (readyToScore)
  // and the last recorded over is actually full, add its own empty page so
  // the new over shows instantly instead of waiting on its first ball.
  const lastOverLegalBalls = (ballsByOver[ballsByOver.length - 1] ?? []).filter(
    (b) => b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY"
  ).length;
  const displayOvers =
    readyToScore && lastOverLegalBalls >= 6 ? [...ballsByOver, []] : ballsByOver;

  const runsNeeded = target && inningsState ? Math.max(target - inningsState.runs, 0) : null;
  const ballsLeft = target && inningsState ? Math.max(match.overs_limit * 6 - inningsState.legalBalls, 0) : null;

  const closePanel = () => {
    setPanel(null);
    setWicketType(null);
    setWicketEnd(null);
    setFielderName("");
    setStumpedWide(false);
    setChangeTargetDraft("");
    setRevisedOversDraft("");
  };

  const cancelRow = (
    <Pressable onPress={closePanel} className="items-center py-2 mt-1">
      <Text className="text-white text-center text-sm" style={{ opacity: 0.85 }}>Cancel</Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-white">
      <GradientFill
        className="overflow-hidden"
        style={{ paddingTop: insets.top + 12, paddingBottom: 4 }}
      >
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
            ) : isMatchCompleted ? (
              <View className="flex-row items-center bg-white/20 rounded-full px-2 py-0.5">
                <Text className="text-white text-[10px] font-bold">MATCH COMPLETED</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Match Centre tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 22 }}>
          {(isMatchCompleted ? COMPLETED_TABS : LIVE_TABS).map((t) => (
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
      </GradientFill>

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
              <Text className="text-muted text-sm font-bold mt-0.5">
                {currentInnings?.innings_number === 2 ? "2nd Innings" : "1st Innings"}
              </Text>
              <Text style={{ fontSize: 52, fontWeight: "800", color: colors.primary, marginTop: 2 }}>
                {inningsState?.runs ?? 0}-{inningsState?.wickets ?? 0}
              </Text>
            </View>

            <View className="flex-row items-center justify-center flex-wrap mt-0.5" style={{ gap: 18 }}>
              <Text className="text-muted text-sm font-bold">Extras - {extrasTotal}</Text>
              <Text className="text-muted text-sm font-bold">
                Overs - {formatOvers(inningsState?.legalBalls ?? 0)} / {match.overs_limit}
              </Text>
              <Text className="text-muted text-sm font-bold">CRR - {runRate.toFixed(1)}</Text>
            </View>
            <Text className="text-muted text-sm font-bold text-center mt-1">
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

            {(inningsOver || !hasActiveInnings) && !isMatchCompleted ? (
              <View className="items-center py-6">
                <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
                <Text className="text-ink font-bold text-lg mt-2">
                  {currentInnings?.innings_number === 1 || isBetweenInnings ? "Innings Complete" : "Match Complete"}
                </Text>
                {/* Finishing the innings/match is a scoring action, so it's
                    scorer-only — everyone else just sees the status text
                    (and, once the match is actually done, a link to this
                    same screen's own Scorecard tab instead of navigating
                    anywhere else). Once match.status is actually COMPLETED,
                    this whole block is skipped below in favor of the normal
                    batting/bowling view with its final, frozen figures — see
                    the hero banner's "Match Completed" tag for that state
                    instead. */}
                {currentInnings?.innings_number === 1 || isBetweenInnings ? (
                  isScorer && (
                    <Pressable
                      onPress={handleStartSecondInnings}
                      disabled={markInningsComplete.isPending || startSecondInnings.isPending}
                      style={primaryButtonShadow}
                    >
                      <GradientFill className="rounded-xl px-5 py-3 mt-4">
                        <Text className="text-white font-semibold">Start 2nd Innings</Text>
                      </GradientFill>
                    </Pressable>
                  )
                ) : hasActiveInnings ? (
                  isScorer && (
                    <Pressable
                      onPress={handleFinishMatch}
                      disabled={markInningsComplete.isPending || completeMatch.isPending}
                      style={primaryButtonShadow}
                    >
                      <GradientFill className="rounded-xl px-5 py-3 mt-4">
                        <Text className="text-white font-semibold">Finish Match</Text>
                      </GradientFill>
                    </Pressable>
                  )
                ) : (
                  <Pressable onPress={() => setMatchCentreTab("scorecard")} className="mt-4">
                    <Text className="font-semibold text-sm" style={{ color: colors.primary }}>
                      View Scorecard
                    </Text>
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
                      <Text key={h} className="text-muted text-sm font-bold" style={{ width: 26, textAlign: "center" }}>
                        {h}
                      </Text>
                    ))}
                  </View>
                </View>
                {[{ name: effectiveStriker, stat: strikerStat, isStriker: true }, { name: effectiveNonStriker, stat: nonStrikerStat, isStriker: false }].map(
                  (row) => {
                    const name = row.name;
                    if (!name) return null;
                    // Only the scorer can tap a batsman's name to make them
                    // the one on strike, and only once both ends are
                    // actually filled — see setCurrentFacer/manualStrikeSwapped.
                    const canTapToSwap = isScorer && canSwapStrike && hasActiveInnings && !inningsOver;
                    return (
                      <View
                        key={name}
                        className="flex-row items-center justify-between py-1.5"
                        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                      >
                        <Pressable
                          className="flex-1 items-start"
                          disabled={!canTapToSwap}
                          onPress={() => setCurrentFacer(name)}
                        >
                          {row.isStriker ? (
                            <GradientFill className="rounded-lg px-2.5 py-1">
                              <Text className="text-white text-sm font-bold" numberOfLines={1}>
                                {name} *
                              </Text>
                            </GradientFill>
                          ) : (
                            <Text className="text-ink text-sm font-semibold" numberOfLines={1}>
                              {name}
                            </Text>
                          )}
                        </Pressable>
                        <View className="flex-row" style={{ gap: 14 }}>
                          <Text className="font-semibold text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{row.stat?.runs ?? 0}</Text>
                          <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{row.stat?.balls ?? 0}</Text>
                          <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{row.stat?.fours ?? 0}</Text>
                          <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{row.stat?.sixes ?? 0}</Text>
                          <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>
                            {row.stat && row.stat.balls > 0 ? ((row.stat.runs / row.stat.balls) * 100).toFixed(1) : "0.0"}
                          </Text>
                        </View>
                      </View>
                    );
                  }
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
                      <Text key={h} className="text-muted text-sm font-bold" style={{ width: 26, textAlign: "center" }}>
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
                      <Text className="font-semibold text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{formatOvers(bowlerStat?.legalBalls ?? 0)}</Text>
                      <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{bowlerStat?.maidens ?? 0}</Text>
                      <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{bowlerStat?.runsConceded ?? 0}</Text>
                      <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>{bowlerStat?.wickets ?? 0}</Text>
                      <Text className="text-sm" style={{ width: 26, textAlign: "center", color: colors.muted }}>
                        {bowlerStat && bowlerStat.legalBalls > 0 ? ((bowlerStat.runsConceded / bowlerStat.legalBalls) * 6).toFixed(1) : "0.0"}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Overs so far — same one-over-per-page swipe as the Balls
                    tab: exactly one over visible at a time, no balls from
                    the previous or next over peeking in. Starts on the
                    current over, with its most recent ball highlighted. */}
                {displayOvers.length > 0 && (
                  <ScrollView
                    ref={mainOverScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    className="mt-4"
                    onContentSizeChange={() =>
                      mainOverScrollRef.current?.scrollTo({ x: (displayOvers.length - 1) * (screenWidth - 32), animated: true })
                    }
                  >
                    {displayOvers.map((over, overIndex) => (
                      <View key={overIndex} style={{ width: screenWidth - 32 }}>
                        <Text className="text-muted text-xs font-semibold mb-2">Over {overIndex + 1}</Text>
                        <View className="flex-row" style={{ gap: 8 }}>
                          {over.map((b, i) => {
                            const isLast = i === over.length - 1;
                            const label = ballLabel(b);
                            // A wicket always stands out in red, whether or
                            // not it's also the most recent ball — a run out
                            // combined with an extra (e.g. "3+Wd W") runs
                            // longer than this circle's usual single
                            // character, so it gets a bit more room and
                            // shrinks to fit on two lines instead of
                            // truncating.
                            const size = b.isWicket ? 44 : 32;
                            return (
                              <View
                                key={i}
                                className="items-center justify-center rounded-full"
                                style={{
                                  width: size,
                                  height: size,
                                  backgroundColor: b.isWicket ? colors.danger : isLast ? "#2563EB" : "#E5E7EB",
                                }}
                              >
                                <Text
                                  className="font-bold text-center"
                                  numberOfLines={2}
                                  style={{
                                    color: b.isWicket || isLast ? "white" : colors.ink,
                                    fontSize: label.length > 2 ? 10 : 12,
                                  }}
                                >
                                  {label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </ScrollView>

          {/* Fixed bottom panel — Select Players, the main keypad, or
              whichever sub-panel is active. Scorer-only (every scoring
              mutation would be rejected by RLS for anyone else anyway — see
              isScorer above); everyone else just watches the score update
              above via realtime, with no controls shown at all. Locked
              while a ball is being saved so a slow network or a fast
              double-tap can never fire two deliveries for the same ball.
              Also hidden once the match is actually COMPLETED — "End
              Innings"/the D-L chase dialog can both mark the match complete
              while the ball-by-ball replay itself hasn't naturally finished
              (inningsOver stays false), so isMatchCompleted is checked
              explicitly rather than relying on inningsOver/hasActiveInnings
              alone. */}
          {isScorer && hasActiveInnings && !inningsOver && !isMatchCompleted && (
            <GradientFill
              pointerEvents={addBall.isPending ? "none" : "auto"}
              style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 18 }}
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
                      { label: "Abandon", onPress: () => setDialog("ABANDON") },
                      { label: "End Innings", onPress: () => setDialog("END_INNINGS") },
                      { label: "Penalty", onPress: () => setPanel("PENALTY_TEAM") },
                      { label: "Retired Hurt", onPress: () => setPanel("RETIRED_HURT") },
                      { label: "D / L", onPress: handleOpenDL },
                      { label: "Change Target", onPress: handleOpenChangeTarget },
                      {
                        label: `Last Man Stand: ${match.last_man_stand ? "On" : "Off"}`,
                        onPress: handleToggleLastManStand,
                      },
                      { label: "Share Match", onPress: handleShare },
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
                  <Text className="text-white font-bold text-lg mb-4">Retired Hurt</Text>
                  <View className="flex-row justify-center" style={{ gap: 28 }}>
                    {effectiveStriker && (
                      <Pressable onPress={() => handleRetiredHurt("striker")} className="items-center" style={{ gap: 6 }}>
                        <PlayerAvatar name={effectiveStriker} />
                        <Text className="text-white font-semibold text-sm">{effectiveStriker}</Text>
                      </Pressable>
                    )}
                    {effectiveNonStriker && (
                      <Pressable onPress={() => handleRetiredHurt("nonStriker")} className="items-center" style={{ gap: 6 }}>
                        <PlayerAvatar name={effectiveNonStriker} />
                        <Text className="text-white font-semibold text-sm">{effectiveNonStriker}</Text>
                      </Pressable>
                    )}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "PENALTY_TEAM" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">Award +{PENALTY_RUNS} Penalty runs to?</Text>
                  <View className="flex-row justify-center" style={{ gap: 28 }}>
                    {(["A", "B"] as const).map((team) => {
                      const name = team === "A" ? match.team_a_name : match.team_b_name;
                      return (
                        <Pressable key={team} onPress={() => handleAwardPenalty(team)} className="items-center" style={{ gap: 6 }}>
                          <View
                            className="items-center justify-center rounded-full"
                            style={{ width: 48, height: 48, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                          >
                            <MaterialCommunityIcons name="shield-account" size={24} color="white" />
                          </View>
                          <Text className="text-white font-semibold text-sm" numberOfLines={1}>{name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {cancelRow}
                </>
              ) : panel === "CHANGE_TARGET" ? (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  <Text className="text-white font-bold text-lg mb-1">Change Target</Text>
                  <Text className="text-white text-xs mb-4" style={{ opacity: 0.8 }}>
                    Enter a revised overs count to compute a Duckworth-Lewis
                    estimate, or type a target directly — this app's D/L curve
                    is fitted to published reference points, not the
                    official (commercially confidential) ICC table, so treat
                    it as an estimate.
                  </Text>

                  <Text className="text-white text-xs font-semibold mb-1.5" style={{ opacity: 0.85 }}>
                    Revised overs for this innings
                  </Text>
                  <TextInput
                    value={revisedOversDraft}
                    onChangeText={(t) => setRevisedOversDraft(t.replace(/[^0-9.]/g, ""))}
                    placeholder={String(match.overs_limit)}
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    keyboardType="decimal-pad"
                    className="rounded-xl px-4 py-2.5 text-white font-semibold"
                    style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                  />

                  {dlPreview ? (
                    <View className="rounded-xl mt-3 p-3" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                      <Text className="text-white text-xs" style={{ opacity: 0.85 }}>
                        Team 1 used {dlPreview.team1ResourcesUsed.toFixed(1)}% of resources · Team 2 has{" "}
                        {dlPreview.team2ResourcesAvailable.toFixed(1)}% available
                      </Text>
                      <Text className="text-white font-extrabold text-xl mt-1">D/L Target: {dlPreview.target}</Text>
                      <Pressable onPress={handleApplyDLTarget} className="bg-white rounded-lg py-2 items-center mt-2">
                        <Text className="font-bold text-sm" style={{ color: colors.primaryDark }}>Use This Target</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Text className="text-white text-xs font-semibold mt-4 mb-1.5" style={{ opacity: 0.85 }}>
                    Or set the target directly
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
                </ScrollView>
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
              ) : panel === "WICKET" && wicketType && wicketType !== "RUN_OUT" && wicketType !== "STUMPED" ? (
                <>
                  <Text className="text-white font-bold text-lg mb-4">{WICKET_TYPES.find((w) => w.value === wicketType)?.label}</Text>
                  {wicketType === "MANKAD" && (
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
                  {(wicketType === "CAUGHT" || wicketType === "ONE_HAND_ONE_BOUNCE") && (
                    <View className="mb-3">
                      <Text className="text-white text-xs font-semibold mb-2" style={{ opacity: 0.85 }}>Fielder (optional)</Text>
                      <Pressable
                        onPress={() => setSelectFielderOpen(true)}
                        className="flex-row items-center justify-between rounded-xl px-4 py-2.5"
                        style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
                      >
                        <Text className="text-white" style={{ opacity: fielderName ? 1 : 0.5 }} numberOfLines={1}>
                          {fielderName || "Select fielder"}
                        </Text>
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                          {fielderName ? (
                            <Pressable onPress={() => setFielderName("")} hitSlop={8}>
                              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
                            </Pressable>
                          ) : null}
                          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
                        </View>
                      </Pressable>
                    </View>
                  )}
                  {wicketType === "MANKAD" ? (
                    wicketEnd && (
                      <Pressable onPress={handleWicket} disabled={addBall.isPending} className="bg-white rounded-xl py-3 items-center">
                        <Text className="font-bold" style={{ color: colors.primaryDark }}>Confirm Wicket</Text>
                      </Pressable>
                    )
                  ) : (
                    <Pressable onPress={handleWicket} disabled={addBall.isPending} className="bg-white rounded-xl py-3 items-center">
                      <Text className="font-bold" style={{ color: colors.primaryDark }}>Confirm Wicket</Text>
                    </Pressable>
                  )}
                  {cancelRow}
                </>
              ) : null}
            </GradientFill>
          )}
        </>
      ) : matchCentreTab === "scorecard" ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Team crests + result, with a winner ribbon — same layout the
              old standalone FullScorecardScreen used. */}
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
              {match.result_summary && (
                <View
                  className="flex-row items-center rounded-full mb-4"
                  style={{ gap: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.primaryLight }}
                >
                  <Ionicons name="trophy" size={15} color={colors.primaryDark} />
                  <Text className="font-extrabold text-xs text-center" style={{ color: colors.primaryDark, letterSpacing: 0.5 }}>
                    {match.result_summary.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ position: "relative" }}>
                <View className="flex-row items-center justify-between w-full">
                  <View className="items-center" style={{ width: 92 }}>
                    <TeamCrest color={colors.primary} icon="cricket" />
                    <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_a_name}</Text>
                  </View>
                  <View style={{ width: 92 }} />
                  <View className="items-center" style={{ width: 92 }}>
                    <TeamCrest color="#1D4ED8" icon="cricket" />
                    <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_b_name}</Text>
                  </View>
                </View>
                <View
                  className="items-center justify-center rounded-full bg-white"
                  style={{ position: "absolute", width: 40, height: 40, left: "50%", top: 8, marginLeft: -20, ...cardShadow }}
                >
                  <Text className="text-ink font-extrabold" style={{ fontSize: 12 }}>VS</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Available to every tournament player, not just the scorer —
              RLS already lets any signed-in user read this match, and
              generating the PDF only reads, it never writes. Hidden once
              the match is completed — the Summary tab has its own copy of
              this same button, so it'd otherwise be offered twice. */}
          {scorecardInnings.length > 0 && !isMatchCompleted && (
            <Pressable onPress={handleGenerateMatchReport} disabled={generatingReport} className="mb-4">
              <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 8 }}>
                {generatingReport ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={18} color="white" />
                    <Text className="text-white font-bold text-sm">Generate Match Report</Text>
                  </>
                )}
              </GradientFill>
            </Pressable>
          )}

          {scorecardInnings.length === 0 ? (
            <Text className="text-muted text-sm text-center mt-10">No balls bowled yet.</Text>
          ) : (
            (() => {
              const selectedId = scorecardInningsId ?? scorecardInnings[0].inn.id;
              const selected = scorecardInnings.find((si) => si.inn.id === selectedId) ?? scorecardInnings[0];
              const isTeamA = selected.inn.batting_team === "A";
              const balls = [...selected.inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
              const allPlayers = isTeamA ? match.team_a_players : match.team_b_players;
              return (
                <>
                  {scorecardInnings.length > 1 && (
                    <SegmentedPill
                      options={scorecardInnings.map((si) => ({ key: si.inn.id, label: si.teamName.toUpperCase() }))}
                      selected={selectedId}
                      onSelect={setScorecardInningsId}
                    />
                  )}
                  <InningsCard
                    key={selected.inn.id}
                    teamName={selected.teamName}
                    inningsNumber={selected.inn.innings_number}
                    color={isTeamA ? colors.primary : "#1D4ED8"}
                    state={selected.state}
                    balls={balls}
                    allPlayers={allPlayers}
                  />
                </>
              );
            })()
          )}
        </ScrollView>
      ) : matchCentreTab === "summary" ? (
        <SummaryTab match={match} scorecardInnings={scorecardInnings} onShareReport={handleGenerateMatchReport} generatingReport={generatingReport} onShareSummary={handleShareMatchSummary} />
      ) : matchCentreTab === "balls" ? (
        <BallsTab
          match={match}
          scorecardInnings={scorecardInnings}
          selectedInningsNumber={ballsInningsNumber ?? scorecardInnings[scorecardInnings.length - 1]?.inn.innings_number ?? 1}
          onSelectInnings={setBallsInningsNumber}
        />
      ) : matchCentreTab === "info" ? (
        <InfoTab match={match} />
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
      ) : null}

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
              // Fresh start (innings not yet underway) — both ends are
              // still empty, so stay open for the very next tap to pick
              // the non-striker instead of requiring the panel to be
              // reopened. A mid-innings replacement (only one end empty)
              // still closes immediately below.
              if (!effectiveNonStriker) return;
            } else {
              setPendingNonStriker(name);
            }
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
          onSelect={(name) => {
            setPendingBowler(name);
            setSelectBowlerOpen(false);
          }}
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
          onSelect={(name) => {
            setFielderName(name);
            setSelectFielderOpen(false);
          }}
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
          onSelect={(name) => handleStumpedSubmit({ fielderName: name, wide: stumpedWide })}
          onAddPlayer={(name) => handleAddPlayer("bowling", name)}
          addPlayerPending={addRosterPlayer.isPending}
          submitting={addBall.isPending}
          listLabel="Select the wicket keeper :"
          headerExtra={
            <View className="mb-6">
              <Text className="text-ink font-bold text-sm mb-3">Is that a wide ball? (Optional)</Text>
              <Pressable
                onPress={() => setStumpedWide((w) => !w)}
                className="self-start rounded-xl px-5 py-3"
                style={{
                  borderWidth: 1.5,
                  borderColor: stumpedWide ? colors.primary : colors.border,
                  backgroundColor: stumpedWide ? colors.primary : "white",
                }}
              >
                <Text className="font-bold text-sm" style={{ color: stumpedWide ? "white" : colors.ink }}>
                  Wide
                </Text>
              </Pressable>
            </View>
          }
        />
      )}

      {dialog === "ABANDON" && (
        <ConfirmDialog
          title="Abandon Match"
          message="Do you want to abandon the match?"
          confirmLabel="Abandon"
          disabledLabel={`Wait : ${abandonCountdown}`}
          confirmDisabled={abandonCountdown > 0}
          onConfirm={handleConfirmAbandon}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "END_INNINGS" && (
        <ConfirmDialog
          title="End Innings"
          message="Are you sure you want to end this innings?"
          confirmLabel="End Innings"
          onConfirm={handleConfirmEndInnings}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "TARGET_BLOCKED" && (
        <ConfirmDialog
          title="Not Allowed"
          message="Target can be changed only after the first innings."
          singleButton
          onCancel={() => setDialog(null)}
        />
      )}
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
    </View>
  );
}
