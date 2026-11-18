import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView, RefreshControl, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useGameDetail } from "../../hooks/useGames";
import { useTournamentTeams } from "../../hooks/useTournamentTeams";
import {
  useTournamentMatches,
  useTournamentNRR,
  useLiveCricketMatches,
  useGenerateMatches,
  useGenerateNextRound,
  useGeneratePoolMatches,
  useAddManualMatch,
  useUpdateManualMatchTeams,
  useDeleteManualMatch,
  useSetMatchScorer,
  useUpdateMatchSchedule,
} from "../../hooks/useTournamentMatches";
import { useTournamentPools, useAssignTeamToPool } from "../../hooks/useTournamentPools";
import { useSetTeamManualStatus } from "../../hooks/useTournamentTeams";
import type { ManualTeamStatus } from "../../lib/api/tournamentTeams";
import FieldInput from "../../components/FieldInput";
import { useCricketMatch } from "../../hooks/useCricket";
import { ballRowToEvent } from "../../lib/api/cricket";
import { computeRunRate } from "../../lib/cricketScoring";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow, heroShadow } from "../../constants/theme";
import { manualSportForName } from "../../lib/manualScore";
import { isCricketFamily } from "../../lib/api/sports";
import { LinkedMatchScoreDetails } from "../../components/MatchScoreDetails";
import SelectScorerModal, { type ScorerCandidate } from "../../components/SelectScorerModal";
import SetMatchTimeModal from "../../components/SetMatchTimeModal";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";
import { soloAwareTeamName, type TournamentMatch, type ScorecardPrefill, type ScorecardPrefillPlayer } from "../../lib/api/tournamentMatches";
import { disambiguateRoster } from "../../lib/matchNameValidation";
import type { TournamentPool } from "../../lib/api/tournamentPools";
import GradientFill from "../../components/GradientFill";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import {
  computeFixtures,
  computeStandings,
  applyHeadToHeadTiebreak,
  knockoutRoundLabel,
  getRoundWinners,
  TOURNAMENT_FORMAT_LABEL,
} from "../../lib/tournamentFixtures";

type Route = RouteProp<GamesStackParamList, "TournamentMatches">;
type Nav = NativeStackNavigationProp<GamesStackParamList, "TournamentMatches">;

// ── panels — moved here wholesale from TournamentTeamsSection so the
// Tournament Details page just links to this screen instead of rendering
// all of this inline. ─────────────────────────────────────────────────────

// Shared card header — icon-in-a-circle + title/subtitle, with an optional
// pill badge on the right. Used at the top of every card on this screen so
// they all read as the same family (Fixtures, Matches, Groups, Standings…).
function CardHeader({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}
      >
        <Ionicons name={icon} size={19} color={colors.primaryDark} />
      </View>
      <View className="flex-1">
        <Text className="text-ink font-bold text-base">{title}</Text>
        {subtitle && <Text className="text-muted text-xs mt-0.5">{subtitle}</Text>}
      </View>
      {badge && (
        <View className="bg-indigo-50 px-2.5 py-1 rounded-full">
          <Text className="text-indigo-700 text-xs font-semibold">{badge}</Text>
        </View>
      )}
    </View>
  );
}

// A team's real approval status, shown as a small colored icon — blue
// person for an approved team, orange hourglass for one still pending.
function TeamStatusIcon({ status }: { status: Database["public"]["Enums"]["tournament_team_status_type"] | undefined }) {
  const pending = status !== "APPROVED";
  return (
    <View
      className="items-center justify-center rounded-lg"
      style={{ width: 28, height: 28, backgroundColor: pending ? "#FFEDD5" : "#DBEAFE" }}
    >
      <Ionicons name={pending ? "hourglass" : "person"} size={14} color={pending ? "#C2410C" : "#2563EB"} />
    </View>
  );
}

function FixturesPanel({
  format,
  teams,
}: {
  format: Database["public"]["Enums"]["tournament_format_type"];
  teams: { name: string; status: Database["public"]["Enums"]["tournament_team_status_type"] }[];
}) {
  const fixtures = computeFixtures(format, teams.map((t) => t.name));
  if (fixtures.length === 0) return null;
  const statusByName = new Map(teams.map((t) => [t.name, t.status]));

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader
        icon="calendar-outline"
        title="Fixtures"
        subtitle="Tournament matchups"
        badge={TOURNAMENT_FORMAT_LABEL[format]}
      />
      <View style={{ gap: 8 }}>
        {fixtures.map((f, i) => (
          <View
            key={i}
            className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2.5"
            style={{ gap: 10 }}
          >
            <TeamStatusIcon status={statusByName.get(f.teamA)} />
            <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{f.teamA}</Text>
            <View
              className="items-center justify-center rounded-full bg-gray-200"
              style={{ width: 32, height: 32 }}
            >
              <Text className="text-muted text-xs font-bold">VS</Text>
            </View>
            <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>
              {f.teamB ?? "Bye"}
            </Text>
            {f.teamB ? <TeamStatusIcon status={statusByName.get(f.teamB)} /> : <View style={{ width: 28 }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// Only rendered once a match actually has a linked scorecard — reads the
// same ball-by-ball log Live Scoring does and sums it directly (just total
// runs/legal balls, not the full batting/bowling breakdown) since that's
// all a run rate needs.
function MatchRunRates({ cricketMatchId }: { cricketMatchId: string }) {
  const { data: cricketMatch } = useCricketMatch(cricketMatchId);
  if (!cricketMatch) return null;

  const rates = cricketMatch.cricket_innings.map((inn) => {
    const balls = inn.cricket_balls.map(ballRowToEvent);
    const runs = balls.reduce((sum, b) => sum + b.runsBatted + b.extraRuns, 0);
    const legalBalls = balls.filter((b) => b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY").length;
    return {
      battingTeam: inn.batting_team as "A" | "B",
      runRate: computeRunRate(runs, legalBalls),
      hasBalls: legalBalls > 0,
    };
  });
  const rateFor = (side: "A" | "B") => rates.find((r) => r.battingTeam === side && r.hasBalls);
  const a = rateFor("A");
  const b = rateFor("B");
  if (!a && !b) return null;

  return (
    <View className="flex-row items-center justify-between mt-1">
      <Text className="text-muted text-xs" numberOfLines={1}>
        {a ? `${cricketMatch.team_a_name} RR: ${a.runRate.toFixed(2)}` : ""}
      </Text>
      <Text className="text-muted text-xs" numberOfLines={1}>
        {b ? `${cricketMatch.team_b_name} RR: ${b.runRate.toFixed(2)}` : ""}
      </Text>
    </View>
  );
}

// Once a match is completed, the single-match "current run rate" it was
// showing while live isn't the useful number anymore — what actually
// matters at that point is each team's NET run rate across the whole
// tournament stage (the same figure already shown in Standings), reusing
// the already-computed nrrByTeam map rather than deriving anything new.
function MatchNetRunRates({
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  nrrByTeam,
}: {
  teamAId?: string | null;
  teamBId?: string | null;
  teamAName: string;
  teamBName: string;
  nrrByTeam: Map<string, number> | undefined;
}) {
  const a = teamAId ? nrrByTeam?.get(teamAId) : undefined;
  const b = teamBId ? nrrByTeam?.get(teamBId) : undefined;
  if (a === undefined && b === undefined) return null;

  const formatNrr = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(3)}`;

  return (
    <View className="flex-row items-center justify-between mt-1">
      <Text className="text-muted text-xs" numberOfLines={1}>
        {a !== undefined ? `${teamAName} NRR: ${formatNrr(a)}` : ""}
      </Text>
      <Text className="text-muted text-xs" numberOfLines={1}>
        {b !== undefined ? `${teamBName} NRR: ${formatNrr(b)}` : ""}
      </Text>
    </View>
  );
}

// "Oct 15 · 9:00 AM" — same short style used for chat timestamps elsewhere
// in the app, just date+time together since a match card needs both.
function formatMatchSchedule(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}

// Small top-right status pill every card carries — Completed (settled,
// green-tinted), Live (red, once its linked cricket scorecard is actually
// IN_PROGRESS — see liveCricketMatchIds), or Upcoming (muted) — independent
// of the ready-to-score pill, which is about who can act on the match right
// now, not its status.
function StatusPill({ completed, live }: { completed: boolean; live?: boolean }) {
  const label = completed ? "Completed" : live ? "Live" : "Upcoming";
  const color = completed ? colors.primaryDark : live ? "#DC2626" : "#2563EB";
  const bg = completed ? colors.primaryLight : live ? colors.dangerLight : colors.infoLight;
  return (
    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: bg }}>
      <Text className="text-xs font-bold" style={{ color }}>{label}</Text>
    </View>
  );
}

// A not-yet-generated future bracket round's match, shown as a "TBD vs TBD"
// placeholder — same card shape as a real MatchRow's upcoming state, just
// with no team names/actions yet, since who plays it depends on winners
// that aren't decided until earlier rounds finish. Nothing in the database
// backs this; it's pure display math (see the preview computation in
// MatchesPanel) and disappears the instant the host actually generates that
// round for real.
function TbdMatchRow({ matchNumber }: { matchNumber: number }) {
  return (
    <View
      className="rounded-2xl px-3 py-2.5"
      style={{ backgroundColor: colors.surface, ...cardShadow, opacity: 0.65 }}
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-muted text-xs font-bold">Match {matchNumber}</Text>
        <StatusPill completed={false} />
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View style={{ width: 28 }} />
        <Text className="text-muted text-sm font-medium flex-1" numberOfLines={1}>
          TBD
        </Text>
        <View className="items-center justify-center rounded-full bg-gray-200" style={{ width: 32, height: 32 }}>
          <Text className="text-muted text-xs font-bold">VS</Text>
        </View>
        <Text className="text-muted text-sm font-medium flex-1 text-right" numberOfLines={1}>
          TBD
        </Text>
        <View style={{ width: 28 }} />
      </View>
    </View>
  );
}

// Every future bracket round from here to the Final, as TBD placeholder
// rows — teamsEnteringNextRound is how many winners the current round will
// produce (= its match count, since byes only ever happen in round 1, long
// past by the time there's a "next round" to preview). Pure display math,
// nothing persisted.
function computeBracketPreviewRounds(teamsEnteringNextRound: number): { label: string; matchCount: number }[] {
  const rounds: { label: string; matchCount: number }[] = [];
  let teams = teamsEnteringNextRound;
  while (teams >= 2) {
    const matchCount = Math.floor(teams / 2);
    rounds.push({ label: knockoutRoundLabel(teams), matchCount });
    teams = matchCount;
  }
  return rounds;
}

function BracketPreviewRounds({ rounds }: { rounds: { label: string; matchCount: number }[] }) {
  return (
    <>
      {rounds.map((r) => (
        <View key={r.label} className="mt-4">
          <Text className="text-muted text-xs font-semibold mb-2">{r.label} · Upcoming</Text>
          <View style={{ gap: 8 }}>
            {Array.from({ length: r.matchCount }, (_, i) => (
              <TbdMatchRow key={i} matchNumber={i + 1} />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function MatchRow({
  match,
  matchNumber,
  isEligible,
  isHost,
  isAssignedScorer,
  scorerName,
  teamAStatus,
  teamBStatus,
  nrrByTeam,
  liveCricketMatchIds,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
  onSetTime,
  onViewDetails,
  onWatchScorecard,
}: {
  match: TournamentMatch;
  matchNumber: number;
  // Each team's real roster status — drives the blue (approved) vs. yellow
  // (still FORMING/PENDING) TeamStatusIcon next to its name.
  teamAStatus?: Database["public"]["Enums"]["tournament_team_status_type"];
  teamBStatus?: Database["public"]["Enums"]["tournament_team_status_type"];
  nrrByTeam?: Map<string, number>;
  // Cricket scorecards currently IN_PROGRESS — same set the "Live Now"
  // section is built from — so this card's own status pill can show "Live"
  // instead of "Upcoming" while it's actually being scored.
  liveCricketMatchIds?: Set<string>;
  // True once the venue is booked and both teams are set — the same bar
  // "Go To Scorecard"/"Enter Score Manually" always required, now checked
  // per match instead of only the single earliest one.
  isEligible: boolean;
  // The host never scores directly from here — they assign a scorer
  // instead (see onSelectScorer) — unless they've assigned themselves, in
  // which case they also get the two scoring buttons below their own
  // "Select Scorer" row.
  isHost: boolean;
  isAssignedScorer: boolean;
  scorerName?: string | null;
  onGoToScorecard?: () => void;
  onEnterScoreManually?: () => void;
  onSelectScorer?: () => void;
  // Host-only manual scheduling — opens SetMatchTimeModal for this match.
  onSetTime?: () => void;
  // Shown instead of the scoring buttons while the match isn't ready yet
  // (venue not booked, or no scorer assigned) — explains why in an alert
  // rather than leaving dead space where the mockup shows "View match
  // details".
  onViewDetails?: () => void;
  // Any tournament player (not just the scorer/host) can open the cricket
  // scorecard once one exists (match.cricket_match_id) — read-only for
  // everyone but the assigned scorer, enforced inside LiveScoringScreen
  // itself. Separate from onGoToScorecard, which also handles the "no
  // scorecard yet" case by routing into match CREATION — a viewer must
  // never land there.
  onWatchScorecard?: () => void;
}) {
  const teamAName = match.team_a?.name ?? "TBD";
  const teamBName = match.team_b?.name ?? "Bye";
  const showScoringButtons = isEligible && isAssignedScorer;
  const showSelectScorer = isEligible && isHost;
  const isReady = isEligible && (isAssignedScorer || isHost);
  const canWatch = !!match.cricket_match_id && !!onWatchScorecard;
  const isLive = !!match.cricket_match_id && !!liveCricketMatchIds?.has(match.cricket_match_id);

  if (match.status === "COMPLETED") {
    const resultLabel = match.is_draw
      ? "Draw"
      : match.winner_team
        ? `${match.winner_team.name} won`
        : match.team_b
          ? "—"
          : `${teamAName} advances`; // a bye, auto-completed at generation
    return (
      <View
        className="rounded-2xl px-3 py-2.5"
        style={{ backgroundColor: colors.surface, ...cardShadow }}
      >
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-muted text-xs font-bold">
            Match {matchNumber}
            {match.scheduled_at ? ` · ${formatMatchSchedule(match.scheduled_at)}` : ""}
          </Text>
          <StatusPill completed />
        </View>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <TeamStatusIcon status={match.team_a?.id ? teamAStatus : undefined} />
          <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{teamAName}</Text>
          <View className="items-center justify-center rounded-full bg-gray-200" style={{ width: 32, height: 32 }}>
            <Text className="text-muted text-xs font-bold">VS</Text>
          </View>
          <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
          {match.team_b ? (
            <TeamStatusIcon status={match.team_b?.id ? teamBStatus : undefined} />
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
        <Text className="text-primary text-xs font-semibold mt-1.5">{resultLabel}</Text>
        {match.cricket_match_id && !match.manual_score && (
          <MatchNetRunRates
            teamAId={match.team_a?.id}
            teamBId={match.team_b?.id}
            teamAName={teamAName}
            teamBName={teamBName}
            nrrByTeam={nrrByTeam}
          />
        )}
        <LinkedMatchScoreDetails match={match} />
        {canWatch && (
          <Pressable
            onPress={onWatchScorecard}
            className="items-center rounded-2xl mt-2"
            style={{ paddingVertical: 10, borderWidth: 1.5, borderColor: colors.border }}
          >
            <Text className="text-ink text-xs font-semibold">View Scorecard</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl px-3 py-2.5"
      style={{ backgroundColor: colors.surface, ...cardShadow }}
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <Text
          className="text-xs font-bold"
          style={{ color: isReady ? colors.primaryDark : colors.muted }}
        >
          Match {matchNumber}
        </Text>
        <StatusPill completed={false} live={isLive} />
      </View>
      {match.scheduled_at ? (
        <Text className="text-muted text-xs mb-1.5">{formatMatchSchedule(match.scheduled_at)}</Text>
      ) : onSetTime ? (
        <Pressable onPress={onSetTime} hitSlop={6} className="flex-row items-center mb-1.5" style={{ gap: 4 }}>
          <Ionicons name="calendar-outline" size={12} color={colors.primary} />
          <Text className="text-primary text-xs font-semibold">Set time</Text>
        </Pressable>
      ) : (
        <Text className="text-muted text-xs mb-1.5">Not scheduled yet</Text>
      )}
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <TeamStatusIcon status={match.team_a ? teamAStatus : undefined} />
        <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{teamAName}</Text>
        <View
          className="items-center justify-center rounded-full bg-gray-200"
          style={{ width: 32, height: 32 }}
        >
          <Text className="text-muted text-xs font-bold">VS</Text>
        </View>
        <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
        {match.team_b ? <TeamStatusIcon status={teamBStatus} /> : <View style={{ width: 28 }} />}
      </View>
      {match.cricket_match_id && !match.manual_score && <MatchRunRates cricketMatchId={match.cricket_match_id} />}
      <LinkedMatchScoreDetails match={match} />
      {isReady ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          {showScoringButtons && (
            <>
              <Pressable onPress={onGoToScorecard} style={cardShadow}>
                <GradientFill className="flex-row items-center justify-between rounded-2xl px-4" style={{ paddingVertical: 14 }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Ionicons name="clipboard-outline" size={17} color="white" />
                    <Text className="text-jazba-white font-bold text-sm">Go To Scorecard</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="white" />
                </GradientFill>
              </Pressable>
              <Pressable
                onPress={onEnterScoreManually}
                className="flex-row items-center justify-between bg-surface border border-primary rounded-2xl px-4"
                style={{ paddingVertical: 14 }}
              >
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Ionicons name="pencil-outline" size={17} color={colors.primary} />
                  <Text className="text-primary font-bold text-sm">Enter Score Manually</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </>
          )}
          {showSelectScorer && (
            <Pressable
              onPress={onSelectScorer}
              className="flex-row items-center justify-between bg-surface border border-primary rounded-2xl px-4"
              style={{ paddingVertical: 14 }}
            >
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Ionicons name="person-add-outline" size={17} color={colors.primary} />
                <Text className="text-primary font-bold text-sm">
                  {scorerName ? `Scorer: ${scorerName}` : "Select Scorer"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          )}
          {/* The host/scorer's own buttons above already open LiveScoring
              for them — this is for anyone else who's ready (e.g. the host
              when they're not the one scoring) to watch once scoring has
              actually started. */}
          {!showScoringButtons && canWatch && (
            <Pressable
              onPress={onWatchScorecard}
              className="items-center rounded-2xl"
              style={{ paddingVertical: 12, borderWidth: 1.5, borderColor: colors.primary }}
            >
              <Text className="text-primary text-sm font-semibold">Watch Live</Text>
            </Pressable>
          )}
        </View>
      ) : canWatch ? (
        <Pressable
          onPress={onWatchScorecard}
          className="items-center rounded-2xl mt-3"
          style={{ paddingVertical: 12, borderWidth: 1.5, borderColor: colors.primary }}
        >
          <Text className="text-primary text-sm font-semibold">Watch Live</Text>
        </Pressable>
      ) : onViewDetails ? (
        <Pressable
          onPress={onViewDetails}
          className="items-center rounded-2xl mt-3"
          style={{ paddingVertical: 12, borderWidth: 1.5, borderColor: colors.border }}
        >
          <Text className="text-ink text-sm font-semibold">View match details</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// A round's teams-in-round count (for the label) and label — league round 1
// is the round-robin group stage, not a bracket round; everything else
// (knockout's own round 1, and every round 2+ in either format, since
// playoffs are always single-elimination) uses the bracket label derived
// from how many distinct teams entered that round.
function roundLabel(format: Database["public"]["Enums"]["tournament_format_type"], round: number, roundMatches: TournamentMatch[]): string {
  if (format === "LEAGUE" && round === 1) return "League Stage";
  // Manual stages are named by the host (e.g. "Quarter-Final", "Semi-Final",
  // a custom name) rather than derived from bracket size — every match in a
  // round carries that same name (see addManualMatch), so any one of them
  // has it; "Round N" is only a fallback for a round that somehow has none.
  if (format === "MANUAL") return roundMatches[0]?.manual_stage_name || `Round ${round}`;
  const teamIds = new Set<string>();
  for (const m of roundMatches) {
    if (m.team_a_id) teamIds.add(m.team_a_id);
    if (m.team_b_id) teamIds.add(m.team_b_id);
  }
  return knockoutRoundLabel(teamIds.size);
}

// The All/Upcoming/Completed filter and the tournament-stage pills are
// purely a display filter over whichever matches a round/pool/playoff
// section would already render — they never touch the round-completion,
// qualification or standings computations above (those always see every
// match, unfiltered), so there's no risk of the filter UI silently
// breaking bracket advancement.
export type MatchStatusFilter = "ALL" | "UPCOMING" | "COMPLETED";

function matchPassesStatusFilter(match: TournamentMatch, filter: MatchStatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "COMPLETED") return match.status === "COMPLETED";
  return match.status !== "COMPLETED";
}

// The full ranking used everywhere standings decide something (the points
// table display, a round-robin's own playoff seeding, a group's
// qualifiers) — points → wins → NRR (computeStandings), then a 2-team
// head-to-head swap on anything still tied (applyHeadToHeadTiebreak).
function rankStandings(
  teams: { id: string; name: string }[],
  matches: TournamentMatch[],
  nrrByTeam: Map<string, number> | undefined
) {
  return applyHeadToHeadTiebreak(computeStandings(teams, matches, nrrByTeam), matches);
}

function MatchesPanel({
  gameId,
  format,
  approvedTeams,
  requiredTeams,
  isHost,
  isVenueBooked,
  currentUserId,
  statusFilter,
  stageFilter,
  nrrByTeam,
  teamStatusById,
  liveCricketMatchIds,
  getScorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
  onSetTime,
  onViewDetails,
  onWatchScorecard,
}: {
  gameId: string;
  format: Database["public"]["Enums"]["tournament_format_type"];
  approvedTeams: { id: string; name: string }[];
  requiredTeams: number;
  isHost: boolean;
  isVenueBooked: boolean;
  currentUserId?: string;
  statusFilter: MatchStatusFilter;
  stageFilter: string | null;
  nrrByTeam: Map<string, number> | undefined;
  teamStatusById: Map<string, Database["public"]["Enums"]["tournament_team_status_type"]>;
  liveCricketMatchIds: Set<string>;
  getScorerName: (match: TournamentMatch) => string | null;
  onGoToScorecard: (match: TournamentMatch) => void;
  onEnterScoreManually: (match: TournamentMatch) => void;
  onSelectScorer: (match: TournamentMatch) => void;
  onSetTime: (match: TournamentMatch) => void;
  onViewDetails: (match: TournamentMatch) => void;
  onWatchScorecard: (match: TournamentMatch) => void;
}) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generateMatches = useGenerateMatches(gameId);
  const generateNextRound = useGenerateNextRound(gameId);

  if (isLoading) return null;

  const hasMatches = (matches?.length ?? 0) > 0;
  const canGenerate = requiredTeams > 0 && approvedTeams.length === requiredTeams;

  if (!hasMatches) {
    if (!isHost) return null;
    return (
      <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
        <CardHeader
          icon="git-network-outline"
          title="Matches"
          subtitle={
            canGenerate
              ? "All teams are approved — generate the matchups"
              : `Waiting on team approvals (${approvedTeams.length}/${requiredTeams || "—"})`
          }
        />
        {canGenerate ? (
          <Pressable
            onPress={() =>
              generateMatches.mutate(
                { format, teams: approvedTeams },
                { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate matches.")) }
              )
            }
            disabled={generateMatches.isPending}
          >
            <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 8 }}>
              {generateMatches.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="git-network-outline" size={16} color="white" />
                  <Text className="text-jazba-white text-sm font-bold">Generate Matches</Text>
                </>
              )}
            </GradientFill>
          </Pressable>
        ) : (
          <Text className="text-muted text-xs">
            Matches will be available once all {requiredTeams || "—"} teams are approved ({approvedTeams.length}/
            {requiredTeams || "—"} so far).
          </Text>
        )}
      </View>
    );
  }

  const allMatches = matches ?? [];
  const rounds = Array.from(new Set(allMatches.map((m) => m.round))).sort((a, b) => a - b);
  const latestRound = rounds[rounds.length - 1];
  const latestRoundMatches = allMatches.filter((m) => m.round === latestRound);
  const isLatestLeagueGroupStage = format === "LEAGUE" && latestRound === 1;

  // Bracket rounds (knockout's own round 1, or any playoff round) advance
  // from the round's actual winners. A league's round-1 group stage instead
  // seeds its first playoff round from the standings' top finishers, once
  // every group-stage match is done.
  const bracketWinners = !isLatestLeagueGroupStage ? getRoundWinners(latestRoundMatches) : null;
  const isChampionDecided = bracketWinners !== null && bracketWinners.length === 1;
  const canAdvanceBracket = bracketWinners !== null && bracketWinners.length > 1;

  const isGroupStageComplete = isLatestLeagueGroupStage && latestRoundMatches.every((m) => m.status === "COMPLETED");
  const standings = isGroupStageComplete ? rankStandings(approvedTeams, allMatches, nrrByTeam) : [];
  const playoffSize = approvedTeams.length >= 4 ? 4 : Math.min(2, approvedTeams.length);
  const playoffTeams = standings.slice(0, playoffSize).map((s) => ({ id: s.teamId, name: s.name }));

  // Knockout only (a league round-robin already lists its whole fixture set
  // in one round, nothing left to preview) — every future round all the way
  // to the Final, shown as TBD placeholders until the host actually
  // generates each one for real.
  const previewRounds =
    !isLatestLeagueGroupStage && statusFilter !== "COMPLETED"
      ? computeBracketPreviewRounds(latestRoundMatches.length)
      : [];

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader icon="git-network-outline" title="Matches" badge={TOURNAMENT_FORMAT_LABEL[format]} />

      {rounds.map((round, idx) => {
        const roundMatches = allMatches.filter((m) => m.round === round);
        const stageKey = roundLabel(format, round, roundMatches);
        if (stageFilter !== null && stageFilter !== stageKey) return null;
        const visibleMatches = roundMatches.filter((m) => matchPassesStatusFilter(m, statusFilter));
        if (visibleMatches.length === 0) return null;
        return (
          <View key={round} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">{stageKey}</Text>
            <View style={{ gap: 8 }}>
              {visibleMatches.map((m, mi) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  matchNumber={mi + 1}
                  isEligible={!!m.team_a && !!m.team_b}
                  isHost={isHost}
                  isAssignedScorer={!!currentUserId && m.scorer_user_id === currentUserId}
                  scorerName={getScorerName(m)}
                  teamAStatus={m.team_a ? teamStatusById.get(m.team_a.id) : undefined}
                  teamBStatus={m.team_b ? teamStatusById.get(m.team_b.id) : undefined}
                  nrrByTeam={nrrByTeam}
                  liveCricketMatchIds={liveCricketMatchIds}
                  onGoToScorecard={() => onGoToScorecard(m)}
                  onEnterScoreManually={() => onEnterScoreManually(m)}
                  onSelectScorer={() => onSelectScorer(m)}
                  onSetTime={isHost ? () => onSetTime(m) : undefined}
                  onViewDetails={() => onViewDetails(m)}
                  onWatchScorecard={() => onWatchScorecard(m)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <BracketPreviewRounds rounds={previewRounds} />

      {isHost && canAdvanceBracket && bracketWinners && (
        <Pressable
          onPress={() =>
            generateNextRound.mutate(
              { round: latestRound + 1, teams: bracketWinners },
              { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the next round.")) }
            )
          }
          disabled={generateNextRound.isPending}
          className="mt-4"
        >
          <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 8 }}>
            {generateNextRound.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="git-network-outline" size={16} color="white" />
                <Text className="text-jazba-white text-sm font-bold">
                  Generate {knockoutRoundLabel(bracketWinners.length)} Matches
                </Text>
              </>
            )}
          </GradientFill>
        </Pressable>
      )}

      {isHost && isGroupStageComplete && playoffTeams.length >= 2 && (
        <Pressable
          onPress={() =>
            generateNextRound.mutate(
              { round: 2, teams: playoffTeams },
              { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the playoffs.")) }
            )
          }
          disabled={generateNextRound.isPending}
          className="mt-4"
        >
          <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 8 }}>
            {generateNextRound.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="trophy-outline" size={16} color="white" />
                <Text className="text-jazba-white text-sm font-bold">
                  Generate {knockoutRoundLabel(playoffTeams.length)} Playoffs (Top {playoffTeams.length})
                </Text>
              </>
            )}
          </GradientFill>
        </Pressable>
      )}

      {isChampionDecided && bracketWinners && (
        <View className="bg-primary-light rounded-xl py-3 items-center mt-4">
          <Text className="text-primary-dark text-xs font-semibold">🏆 Champion: {bracketWinners[0].name}</Text>
        </View>
      )}
    </View>
  );
}

// Display metadata for a Manual-format team's tournament-progression status
// — entirely separate from TeamStatusIcon/tournament_team_status_type above,
// which is about roster formation (FORMING/APPROVED/etc.), not progression.
const MANUAL_STATUS_META: Record<
  ManualTeamStatus,
  { label: string; pillClassName: string; textClassName: string; icon: React.ComponentProps<typeof Ionicons>["name"]; iconColor: string }
> = {
  PENDING: { label: "Pending", pillClassName: "bg-gray-100", textClassName: "text-muted", icon: "time-outline", iconColor: colors.muted },
  QUALIFIED: { label: "Qualified", pillClassName: "bg-green-50", textClassName: "text-primary", icon: "checkmark-circle", iconColor: colors.primary },
  KNOCKED_OUT: { label: "Knocked Out", pillClassName: "bg-red-50", textClassName: "text-red-600", icon: "close-circle", iconColor: "#DC2626" },
  CHAMPION: { label: "Champion", pillClassName: "bg-amber-50", textClassName: "text-amber-700", icon: "trophy", iconColor: colors.warning },
};

// Bottom sheet the host uses to pick one team for one side of a manual
// pairing — same shell/pattern as SelectScorerModal, scoped to this screen
// since it's only ever used by Manual format's match builder/editor. The
// caller is responsible for excluding Knocked Out teams from `teams` —
// this modal just lists whatever it's given.
function SelectMatchTeamModal({
  visible,
  onClose,
  teams,
  excludeId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  teams: { id: string; name: string }[];
  // The team already picked for this pairing's other side — excluded so a
  // team can't be set to play itself.
  excludeId?: string | null;
  onSelect: (team: { id: string; name: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const selectable = teams.filter((t) => t.id !== excludeId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "75%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
              Select Team
            </Text>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 34, height: 34, backgroundColor: colors.surfaceOverlay }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }} bounces={false}>
            {selectable.length === 0 ? (
              <Text className="text-muted text-sm text-center py-6">No eligible teams available.</Text>
            ) : (
              selectable.map((team) => (
                <Pressable
                  key={team.id}
                  onPress={() => onSelect(team)}
                  className="flex-row items-center rounded-2xl px-4 py-3 mb-2"
                  style={{ gap: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface }}
                >
                  <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>
                    {team.name}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// A single Team A / Team B picker pair, shared by the "Add Match" inline
// form and the "Edit Match" sheet below — each box opens SelectMatchTeamModal
// for its own side. `teams` should already exclude Knocked Out teams.
function TeamVsTeamPicker({
  teams,
  teamA,
  teamB,
  onPickA,
  onPickB,
}: {
  teams: { id: string; name: string }[];
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
  onPickA: (team: { id: string; name: string }) => void;
  onPickB: (team: { id: string; name: string }) => void;
}) {
  const [pickingSide, setPickingSide] = useState<"A" | "B" | null>(null);
  return (
    <>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Pressable
          onPress={() => setPickingSide("A")}
          className="flex-1 rounded-xl px-3 py-2.5"
          style={{ borderWidth: 1.5, borderColor: teamA ? colors.primary : colors.border, backgroundColor: colors.surface }}
        >
          <Text className="text-xs text-muted">Team A</Text>
          <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{teamA?.name ?? "Pick a team"}</Text>
        </Pressable>
        <Text className="text-muted text-xs font-bold">VS</Text>
        <Pressable
          onPress={() => setPickingSide("B")}
          className="flex-1 rounded-xl px-3 py-2.5"
          style={{ borderWidth: 1.5, borderColor: teamB ? colors.primary : colors.border, backgroundColor: colors.surface }}
        >
          <Text className="text-xs text-muted">Team B</Text>
          <Text className="text-ink text-sm font-semibold" numberOfLines={1}>{teamB?.name ?? "Pick a team"}</Text>
        </Pressable>
      </View>
      <SelectMatchTeamModal
        visible={pickingSide !== null}
        onClose={() => setPickingSide(null)}
        teams={teams}
        excludeId={pickingSide === "A" ? teamB?.id : teamA?.id}
        onSelect={(team) => {
          if (pickingSide === "A") onPickA(team);
          else onPickB(team);
          setPickingSide(null);
        }}
      />
    </>
  );
}

// Bottom sheet for re-picking an existing manual match's two teams — opened
// from the pencil icon on a match's card. Remounted fresh per match (keyed
// by match id at the call site) so its draft always starts from that
// match's current teams.
function ManualMatchEditorModal({
  visible,
  onClose,
  teams,
  initialTeamA,
  initialTeamB,
  onSave,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  teams: { id: string; name: string }[];
  initialTeamA: { id: string; name: string } | null;
  initialTeamB: { id: string; name: string } | null;
  onSave: (teamA: { id: string; name: string }, teamB: { id: string; name: string }) => void;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [teamA, setTeamA] = useState(initialTeamA);
  const [teamB, setTeamB] = useState(initialTeamB);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl px-5 pt-5"
          style={{ paddingBottom: 24 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-ink">Edit Match</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <TeamVsTeamPicker teams={teams} teamA={teamA} teamB={teamB} onPickA={setTeamA} onPickB={setTeamB} />
          <Pressable
            onPress={() => teamA && teamB && onSave(teamA, teamB)}
            disabled={!teamA || !teamB || submitting}
            className="mt-4"
          >
            <GradientFill
              className="flex-row items-center justify-center rounded-full py-3"
              style={{ gap: 8, opacity: !teamA || !teamB ? 0.5 : 1 }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-jazba-white text-sm font-bold">Save Changes</Text>
              )}
            </GradientFill>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Bottom sheet listing Pending/Qualified/Knocked Out/Champion — tapping an
// option reports it straight to the caller, which decides whether that
// particular transition needs a confirmation (see ManualTeamsPanel).
function ManualTeamStatusModal({
  visible,
  onClose,
  teamName,
  currentStatus,
  onSelect,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  teamName: string;
  currentStatus: ManualTeamStatus;
  onSelect: (status: ManualTeamStatus) => void;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const options: ManualTeamStatus[] = ["PENDING", "QUALIFIED", "KNOCKED_OUT", "CHAMPION"];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 20 }} numberOfLines={1}>
                {teamName}
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Set this team's tournament status
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 34, height: 34, backgroundColor: colors.surfaceOverlay }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 4, gap: 8 }}>
            {options.map((opt) => {
              const meta = MANUAL_STATUS_META[opt];
              const isCurrent = opt === currentStatus;
              return (
                <Pressable
                  key={opt}
                  onPress={() => onSelect(opt)}
                  disabled={submitting}
                  className="flex-row items-center rounded-2xl px-4 py-3"
                  style={{
                    gap: 10,
                    borderWidth: 1.5,
                    borderColor: isCurrent ? colors.primary : colors.border,
                    backgroundColor: isCurrent ? colors.primaryLight : colors.surface,
                  }}
                >
                  <Ionicons name={meta.icon} size={18} color={isCurrent ? colors.primaryDark : meta.iconColor} />
                  <Text
                    className="flex-1 font-semibold text-sm"
                    style={{ color: isCurrent ? colors.primaryDark : colors.ink }}
                  >
                    {meta.label}
                  </Text>
                  {isCurrent && <Ionicons name="checkmark" size={16} color={colors.primaryDark} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Manual format's "Teams" card — every active team's current tournament
// status (Pending/Qualified/Knocked Out/Champion), with a host-only tap
// target to change it. Entirely host-driven: nothing here is ever set by a
// match result automatically (see the "Important Rules" this implements —
// no auto-assigning winners/eliminating teams). Knocked Out and Champion
// ask for confirmation first since they're the most consequential; Pending
// and Qualified apply immediately, since both are easily reversible.
function ManualTeamsPanel({
  gameId,
  teams,
  isHost,
}: {
  gameId: string;
  teams: { id: string; name: string; manualStatus: ManualTeamStatus }[];
  isHost: boolean;
}) {
  const setStatus = useSetTeamManualStatus(gameId);
  const [statusModalTeam, setStatusModalTeam] = useState<{ id: string; name: string; manualStatus: ManualTeamStatus } | null>(null);

  if (teams.length === 0) return null;
  const champion = teams.find((t) => t.manualStatus === "CHAMPION");

  const handleSelectStatus = (status: ManualTeamStatus) => {
    if (!statusModalTeam) return;
    const proceed = () =>
      setStatus.mutate(
        { teamId: statusModalTeam.id, manualStatus: status },
        {
          onSuccess: () => setStatusModalTeam(null),
          onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update the team's status.")),
        }
      );
    if (status === "KNOCKED_OUT" || status === "CHAMPION") {
      Alert.alert(
        status === "CHAMPION" ? "Mark as Champion?" : "Knock Out This Team?",
        status === "CHAMPION"
          ? `${statusModalTeam.name} will be shown as the Tournament Champion.`
          : `${statusModalTeam.name} won't be selectable for future matches, unless you reverse this later.`,
        [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: proceed }]
      );
    } else {
      proceed();
    }
  };

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader icon="people-outline" title="Teams" subtitle={isHost ? "Tap a team to set its status" : undefined} />
      {champion && (
        <View className="bg-primary-light rounded-xl py-3 items-center mb-3">
          <Text className="text-primary-dark text-xs font-semibold">🏆 Tournament Champion: {champion.name}</Text>
        </View>
      )}
      <View style={{ gap: 8 }}>
        {teams.map((t) => {
          const meta = MANUAL_STATUS_META[t.manualStatus];
          return (
            <Pressable
              key={t.id}
              onPress={() => isHost && setStatusModalTeam(t)}
              disabled={!isHost}
              className="flex-row items-center justify-between rounded-2xl px-3 py-2.5"
              style={{ gap: 10, backgroundColor: colors.surface }}
            >
              <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
                {t.name}
              </Text>
              <View className={`flex-row items-center rounded-full px-2.5 py-1 ${meta.pillClassName}`} style={{ gap: 4 }}>
                <Ionicons name={meta.icon} size={12} color={meta.iconColor} />
                <Text className={`text-xs font-bold ${meta.textClassName}`}>{meta.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {statusModalTeam && (
        <ManualTeamStatusModal
          visible
          onClose={() => setStatusModalTeam(null)}
          teamName={statusModalTeam.name}
          currentStatus={statusModalTeam.manualStatus}
          onSelect={handleSelectStatus}
          submitting={setStatus.isPending}
        />
      )}
    </View>
  );
}

// Preset stage names the host can quickly pick from when starting a brand
// new round/stage, plus a free-text option — "Flexible Stage Management"
// requires custom names too, so this is a starting point, not a fixed list.
const MANUAL_STAGE_PRESETS = ["Round of 16", "Quarter-Final", "Semi-Final", "Final", "Third Place"];

// Manual format's Matches panel — a drop-in replacement for MatchesPanel
// (same prop shape, minus `format` since it's always "MANUAL") used only
// when the tournament's format is Manual. Unlike every other format, no
// pairing or qualification is ever computed: the host adds every match by
// hand, into any stage he names (any of the presets above, or a custom
// name), and can edit or remove a match afterward. Which teams "qualify"
// for a stage is simply whichever teams the host pairs there — see
// ManualTeamsPanel for the separate, explicit Pending/Qualified/Knocked
// Out/Champion status every team also carries. MatchRow itself (shared
// with every other format) stays completely unchanged — the Edit/Remove
// controls are rendered around it here instead.
function ManualMatchesPanel({
  gameId,
  teams,
  isHost,
  currentUserId,
  statusFilter,
  stageFilter,
  nrrByTeam,
  teamStatusById,
  liveCricketMatchIds,
  getScorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
  onSetTime,
  onViewDetails,
  onWatchScorecard,
}: {
  gameId: string;
  teams: { id: string; name: string; manualStatus: ManualTeamStatus }[];
  isHost: boolean;
  currentUserId?: string;
  statusFilter: MatchStatusFilter;
  stageFilter: string | null;
  nrrByTeam: Map<string, number> | undefined;
  teamStatusById: Map<string, Database["public"]["Enums"]["tournament_team_status_type"]>;
  liveCricketMatchIds: Set<string>;
  getScorerName: (match: TournamentMatch) => string | null;
  onGoToScorecard: (match: TournamentMatch) => void;
  onEnterScoreManually: (match: TournamentMatch) => void;
  onSelectScorer: (match: TournamentMatch) => void;
  onSetTime: (match: TournamentMatch) => void;
  onViewDetails: (match: TournamentMatch) => void;
  onWatchScorecard: (match: TournamentMatch) => void;
}) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const addManualMatch = useAddManualMatch(gameId);
  const updateManualMatchTeams = useUpdateManualMatchTeams(gameId);
  const deleteManualMatch = useDeleteManualMatch(gameId);
  const [draftTeamA, setDraftTeamA] = useState<{ id: string; name: string } | null>(null);
  const [draftTeamB, setDraftTeamB] = useState<{ id: string; name: string } | null>(null);
  const [targetRound, setTargetRound] = useState<number | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);

  if (isLoading) return null;

  // Prevents a knocked-out team from being selected for future matches by
  // default — the host can only get one back into the picker by reversing
  // its status first (see ManualTeamsPanel), not via any override here.
  const pickableTeams = teams.filter((t) => t.manualStatus !== "KNOCKED_OUT").map((t) => ({ id: t.id, name: t.name }));

  // Once a Final-stage match has crowned a champion (see
  // crownFinalWinnerIfApplicable), the tournament is over — no further
  // matches can be added, regardless of how many teams would otherwise be
  // eligible.
  const champion = teams.find((t) => t.manualStatus === "CHAMPION") ?? null;

  const allMatches = matches ?? [];
  const hasMatches = allMatches.length > 0;
  const canAddMatches = isHost && !champion && pickableTeams.length >= 2;
  const rounds = Array.from(new Set(allMatches.map((m) => m.round))).sort((a, b) => a - b);
  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : 0;
  const effectiveRound = targetRound ?? (latestRound || 1);
  const newRoundNumber = latestRound + 1;
  const isNewStage = effectiveRound === newRoundNumber;
  const existingStageName = allMatches.find((m) => m.round === effectiveRound)?.manual_stage_name ?? null;
  // The Final stage (any case, preset or custom-typed) is capped at exactly
  // one match tournament-wide — this checks across every round, not just
  // the one currently targeted, so a host can't work around the cap by
  // naming a second, different round "Final" too.
  const finalStageHasMatch = allMatches.some((m) => (m.manual_stage_name ?? "").trim().toLowerCase() === "final");
  const targetStageName = (isNewStage ? newStageName : existingStageName ?? "").trim();
  const finalStageLimitReached = targetStageName.toLowerCase() === "final" && finalStageHasMatch;

  const handleAddMatch = () => {
    if (!draftTeamA || !draftTeamB) return;
    const stageName = isNewStage ? newStageName.trim() : existingStageName || `Round ${effectiveRound}`;
    if (isNewStage && !stageName) return;
    if (stageName.toLowerCase() === "final" && finalStageHasMatch) {
      Alert.alert("Final Stage Full", "Only one match can be added to the Final stage.");
      return;
    }
    const sortOrder = allMatches.filter((m) => m.round === effectiveRound).length;
    addManualMatch.mutate(
      { round: effectiveRound, stageName, sortOrder, teamAId: draftTeamA.id, teamBId: draftTeamB.id },
      {
        onSuccess: () => {
          setDraftTeamA(null);
          setDraftTeamB(null);
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add the match.")),
      }
    );
  };

  const handleSaveEdit = (teamA: { id: string; name: string }, teamB: { id: string; name: string }) => {
    if (!editingMatch) return;
    updateManualMatchTeams.mutate(
      { matchId: editingMatch.id, teamAId: teamA.id, teamBId: teamB.id },
      {
        onSuccess: () => setEditingMatch(null),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update the match.")),
      }
    );
  };

  const handleDeleteMatch = (match: TournamentMatch) => {
    Alert.alert("Remove Match", "Remove this match? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          deleteManualMatch.mutate(match.id, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove the match.")),
          }),
      },
    ]);
  };

  const addMatchForm = canAddMatches ? (
    <View>
      {rounds.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
          {rounds.map((r) => {
            const label = allMatches.find((m) => m.round === r)?.manual_stage_name || `Round ${r}`;
            return (
              <Pressable
                key={r}
                onPress={() => setTargetRound(r)}
                className="rounded-full px-3.5 py-2"
                style={{
                  borderWidth: 1.5,
                  borderColor: effectiveRound === r ? colors.primary : colors.border,
                  backgroundColor: effectiveRound === r ? colors.primaryLight : colors.surface,
                }}
              >
                <Text className="text-xs font-bold" style={{ color: effectiveRound === r ? colors.primaryDark : colors.muted }} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setTargetRound(newRoundNumber)}
            className="flex-row items-center rounded-full px-3.5 py-2"
            style={{
              gap: 4,
              borderWidth: 1.5,
              borderColor: effectiveRound === newRoundNumber ? colors.primary : colors.border,
              backgroundColor: effectiveRound === newRoundNumber ? colors.primaryLight : colors.surface,
            }}
          >
            <Ionicons name="add" size={14} color={effectiveRound === newRoundNumber ? colors.primaryDark : colors.muted} />
            <Text className="text-xs font-bold" style={{ color: effectiveRound === newRoundNumber ? colors.primaryDark : colors.muted }}>
              New Stage
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {isNewStage && (
        <View className="mb-3">
          <Text className="text-ink text-xs font-semibold mb-2">Name this stage</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
            {MANUAL_STAGE_PRESETS.map((preset) => {
              // The Final preset is greyed out (not hidden) once a Final
              // match already exists anywhere in the tournament — selecting
              // it anyway would just show the same "already full" message.
              const presetBlocked = preset.toLowerCase() === "final" && finalStageHasMatch;
              return (
                <Pressable
                  key={preset}
                  onPress={() => setNewStageName(preset)}
                  disabled={presetBlocked}
                  className="rounded-full px-3.5 py-2"
                  style={{
                    borderWidth: 1.5,
                    borderColor: newStageName === preset ? colors.primary : colors.border,
                    backgroundColor: newStageName === preset ? colors.primaryLight : colors.surface,
                    opacity: presetBlocked ? 0.4 : 1,
                  }}
                >
                  <Text className="text-xs font-bold" style={{ color: newStageName === preset ? colors.primaryDark : colors.muted }}>
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <FieldInput
            value={newStageName}
            onChangeText={setNewStageName}
            placeholder="Or type a custom stage name"
            compact
          />
        </View>
      )}

      {finalStageLimitReached ? (
        <View className="rounded-xl px-3.5 py-3" style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border }}>
          <Text className="text-muted text-xs">
            Only one match is allowed in the Final stage, and it's already been added. Pick a different stage to add more matches.
          </Text>
        </View>
      ) : (
        <>
          <TeamVsTeamPicker teams={pickableTeams} teamA={draftTeamA} teamB={draftTeamB} onPickA={setDraftTeamA} onPickB={setDraftTeamB} />

          <Pressable
            onPress={handleAddMatch}
            disabled={!draftTeamA || !draftTeamB || (isNewStage && !newStageName.trim()) || addManualMatch.isPending}
            className="mt-3"
          >
            <GradientFill
              className="flex-row items-center justify-center rounded-full py-3"
              style={{ gap: 8, opacity: !draftTeamA || !draftTeamB || (isNewStage && !newStageName.trim()) ? 0.5 : 1 }}
            >
              {addManualMatch.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={16} color="white" />
                  <Text className="text-jazba-white text-sm font-bold">
                    Add to {isNewStage ? newStageName.trim() || "New Stage" : existingStageName || `Round ${effectiveRound}`}
                  </Text>
                </>
              )}
            </GradientFill>
          </Pressable>
        </>
      )}
    </View>
  ) : null;

  if (!hasMatches) {
    if (!isHost) return null;
    return (
      <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
        <CardHeader icon="git-network-outline" title="Matches" subtitle="Add this tournament's first match by hand" />
        {canAddMatches ? (
          addMatchForm
        ) : (
          <Text className="text-muted text-xs">Add at least 2 eligible teams to this tournament before creating matches.</Text>
        )}
      </View>
    );
  }

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader icon="git-network-outline" title="Matches" badge={TOURNAMENT_FORMAT_LABEL.MANUAL} />

      {rounds.map((round, idx) => {
        const roundMatches = allMatches.filter((m) => m.round === round);
        const stageKey = roundLabel("MANUAL", round, roundMatches);
        if (stageFilter !== null && stageFilter !== stageKey) return null;
        const visibleMatches = roundMatches.filter((m) => matchPassesStatusFilter(m, statusFilter));
        if (visibleMatches.length === 0) return null;
        return (
          <View key={round} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">{stageKey}</Text>
            <View style={{ gap: 8 }}>
              {visibleMatches.map((m, mi) => (
                <View key={m.id}>
                  {isHost && m.status !== "COMPLETED" && (
                    <View className="flex-row justify-end mb-1" style={{ gap: 14 }}>
                      <Pressable onPress={() => setEditingMatch(m)} hitSlop={8} className="flex-row items-center" style={{ gap: 4 }}>
                        <Ionicons name="pencil-outline" size={14} color={colors.muted} />
                        <Text className="text-muted text-xs font-semibold">Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeleteMatch(m)} hitSlop={8} className="flex-row items-center" style={{ gap: 4 }}>
                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        <Text className="text-xs font-semibold" style={{ color: "#DC2626" }}>Remove</Text>
                      </Pressable>
                    </View>
                  )}
                  <MatchRow
                    match={m}
                    matchNumber={mi + 1}
                    isEligible={!!m.team_a && !!m.team_b}
                    isHost={isHost}
                    isAssignedScorer={!!currentUserId && m.scorer_user_id === currentUserId}
                    scorerName={getScorerName(m)}
                    teamAStatus={m.team_a ? teamStatusById.get(m.team_a.id) : undefined}
                    teamBStatus={m.team_b ? teamStatusById.get(m.team_b.id) : undefined}
                    nrrByTeam={nrrByTeam}
                    liveCricketMatchIds={liveCricketMatchIds}
                    onGoToScorecard={() => onGoToScorecard(m)}
                    onEnterScoreManually={() => onEnterScoreManually(m)}
                    onSelectScorer={() => onSelectScorer(m)}
                    onSetTime={isHost ? () => onSetTime(m) : undefined}
                    onViewDetails={() => onViewDetails(m)}
                    onWatchScorecard={() => onWatchScorecard(m)}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {champion ? (
        <View className="bg-primary-light rounded-xl py-3 items-center mt-4">
          <Text className="text-primary-dark text-xs font-semibold">
            🏆 {champion.name} won the Final — tournament complete, no further matches can be added
          </Text>
        </View>
      ) : (
        canAddMatches && (
          <View className="mt-4">
            <Text className="text-ink text-xs font-semibold mb-2">Add a Match</Text>
            {addMatchForm}
          </View>
        )
      )}

      {editingMatch && (
        <ManualMatchEditorModal
          key={editingMatch.id}
          visible
          onClose={() => setEditingMatch(null)}
          teams={pickableTeams}
          initialTeamA={editingMatch.team_a}
          initialTeamB={editingMatch.team_b}
          onSave={handleSaveEdit}
          submitting={updateManualMatchTeams.isPending}
        />
      )}
    </View>
  );
}

function StandingsPanel({
  teams,
  matches,
  label = "Standings",
  nrrByTeam,
  showNRR,
}: {
  teams: { id: string; name: string }[];
  matches: TournamentMatch[];
  label?: string;
  nrrByTeam?: Map<string, number>;
  // NRR only exists for cricket (see useTournamentNRR) — other sports just
  // show Team/P/W/D/L/Pts, same as before.
  showNRR?: boolean;
}) {
  const standings = rankStandings(teams, matches, nrrByTeam);
  if (standings.length === 0 || standings.every((s) => s.played === 0)) return null;

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader icon="stats-chart-outline" title={label} />
      <View className="flex-row items-center pb-2 border-b border-border">
        <Text className="text-muted text-xs font-semibold flex-1">Team</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>P</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>W</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>D</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>L</Text>
        <Text className="text-muted text-xs font-bold" style={{ width: 32, textAlign: "center" }}>Pts</Text>
        {showNRR && (
          <Text className="text-muted text-xs font-semibold" style={{ width: 50, textAlign: "center" }}>NRR</Text>
        )}
      </View>
      {standings.map((s) => (
        <View key={s.teamId} className="flex-row items-center py-2 border-b border-border">
          <Text className="text-ink text-sm flex-1" numberOfLines={1}>{s.name}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.played}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.won}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.drawn}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.lost}</Text>
          <Text className="text-ink text-sm font-bold" style={{ width: 32, textAlign: "center" }}>{s.points}</Text>
          {showNRR && (
            <Text className="text-ink text-sm" style={{ width: 50, textAlign: "center" }}>
              {s.nrr === null ? "—" : `${s.nrr > 0 ? "+" : ""}${s.nrr.toFixed(3)}`}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// Pool format: shows each group and which approved teams are in it, plus
// (host-only) a way to assign any approved-but-unassigned team to one.
// Assignment is host-only server-side too (enforce_pool_assignment trigger)
// — this UI just doesn't offer the control to anyone else.
function GroupsPanel({
  gameId,
  pools,
  approvedTeams,
  requiredTeams,
  isHost,
}: {
  gameId: string;
  pools: TournamentPool[];
  approvedTeams: TournamentTeam[];
  requiredTeams: number;
  isHost: boolean;
}) {
  const assignTeam = useAssignTeamToPool(gameId);
  const unassigned = approvedTeams.filter((t) => !t.pool_id);
  // Every group's fair share of the tournament's total team count — capped
  // here so the host can't overfill one group while leaving another short
  // (CreateGameScreen already only lets group count/team count combos that
  // divide evenly, so this is always a whole number).
  const expectedPerGroup = pools.length > 0 ? requiredTeams / pools.length : 0;

  const handleAssign = (teamId: string, teamName: string, poolId: string, poolName: string) => {
    Alert.alert("Assign to Group", `Add "${teamName}" to ${poolName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Assign",
        onPress: () =>
          assignTeam.mutate(
            { teamId, poolId },
            { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not assign team.")) }
          ),
      },
    ]);
  };

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader icon="people-outline" title="Groups" />
      {pools.map((pool) => {
        const teamsInPool = approvedTeams.filter((t) => t.pool_id === pool.id);
        return (
          <View key={pool.id} className="mb-3">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-ink text-xs font-semibold">{pool.name}</Text>
              {expectedPerGroup > 0 && (
                <Text className="text-muted text-xs">
                  {teamsInPool.length}/{expectedPerGroup}
                </Text>
              )}
            </View>
            {teamsInPool.length === 0 ? (
              <Text className="text-muted text-xs">No teams assigned yet.</Text>
            ) : (
              <View style={{ gap: 4 }}>
                {teamsInPool.map((t) => (
                  <Text key={t.id} className="text-ink text-sm">{t.name}</Text>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {isHost && unassigned.length > 0 && (
        <View className="mt-2 pt-3 border-t border-border">
          <Text className="text-ink text-xs font-semibold mb-3">Assign Teams to a Group</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingRight: 4 }}
          >
            {unassigned.map((t) => (
              <View key={t.id} className="border border-border rounded-2xl bg-gray-50 p-4" style={{ width: 220 }}>
                <Text className="text-ink text-base font-bold mb-3" numberOfLines={1}>
                  {t.name}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {pools.map((pool) => {
                    const teamsInPool = approvedTeams.filter((tt) => tt.pool_id === pool.id);
                    const isFull = expectedPerGroup > 0 && teamsInPool.length >= expectedPerGroup;
                    return (
                      <Pressable
                        key={pool.id}
                        onPress={() => handleAssign(t.id, t.name, pool.id, pool.name)}
                        disabled={assignTeam.isPending || isFull}
                        className={`rounded-lg px-3 py-2 ${
                          isFull ? "border border-border bg-gray-100" : "border border-primary"
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${isFull ? "text-muted" : "text-primary"}`}>
                          {pool.name}
                          {isFull ? " · Full" : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// Pool format's group-stage matches — round-robin *within* each group
// separately, generated once every approved team has a group. Draws are
// always allowed here (every pool match is inherently round-robin-style,
// there's no knockout stage in this format), unlike knockout/playoff
// rounds in MatchesPanel.
function PoolMatchesPanel({
  gameId,
  pools,
  approvedTeams,
  requiredTeams,
  isHost,
  isVenueBooked,
  currentUserId,
  statusFilter,
  stageFilter,
  nrrByTeam,
  teamStatusById,
  liveCricketMatchIds,
  getScorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
  onSetTime,
  onViewDetails,
  onWatchScorecard,
}: {
  gameId: string;
  pools: TournamentPool[];
  approvedTeams: TournamentTeam[];
  requiredTeams: number;
  isHost: boolean;
  isVenueBooked: boolean;
  currentUserId?: string;
  statusFilter: MatchStatusFilter;
  stageFilter: string | null;
  nrrByTeam: Map<string, number> | undefined;
  teamStatusById: Map<string, Database["public"]["Enums"]["tournament_team_status_type"]>;
  liveCricketMatchIds: Set<string>;
  getScorerName: (match: TournamentMatch) => string | null;
  onGoToScorecard: (match: TournamentMatch) => void;
  onEnterScoreManually: (match: TournamentMatch) => void;
  onSelectScorer: (match: TournamentMatch) => void;
  onSetTime: (match: TournamentMatch) => void;
  onViewDetails: (match: TournamentMatch) => void;
  onWatchScorecard: (match: TournamentMatch) => void;
}) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generatePoolMatches = useGeneratePoolMatches(gameId);

  if (isLoading) return null;

  const allMatches = matches ?? [];
  const hasMatches = allMatches.length > 0;
  const unassigned = approvedTeams.filter((t) => !t.pool_id);
  // Full roster required, not just "no unassigned" — otherwise matches
  // could be generated while teams are still joining, leaving a group
  // permanently short once the rest of the roster fills in.
  const canGenerate =
    pools.length > 0 && requiredTeams > 0 && approvedTeams.length === requiredTeams && unassigned.length === 0;

  if (!hasMatches) {
    if (!isHost) return null;
    return (
      <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
        <CardHeader
          icon="git-network-outline"
          title="Matches"
          subtitle={canGenerate ? "Every approved team has a group — generate the group-stage matchups" : undefined}
        />
        {canGenerate ? (
          <Pressable
            onPress={() =>
              generatePoolMatches.mutate(
                pools.map((pool) => ({
                  poolId: pool.id,
                  teams: approvedTeams
                    .filter((t) => t.pool_id === pool.id)
                    .map((t) => ({ id: t.id, name: t.name })),
                })),
                { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the group matches.")) }
              )
            }
            disabled={generatePoolMatches.isPending}
          >
            <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 8 }}>
              {generatePoolMatches.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="git-network-outline" size={16} color="white" />
                  <Text className="text-jazba-white text-sm font-bold">Generate Group Matches</Text>
                </>
              )}
            </GradientFill>
          </Pressable>
        ) : (
          <Text className="text-muted text-xs">
            {approvedTeams.length < requiredTeams
              ? `Matches will be available once all ${requiredTeams} teams are approved (${approvedTeams.length}/${requiredTeams} so far).`
              : unassigned.length > 0
                ? `Assign all approved teams to a group first (${unassigned.length} left).`
                : "Matches will be available once teams are approved and assigned to groups."}
          </Text>
        )}
      </View>
    );
  }


  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader icon="git-network-outline" title="Matches" badge="Pool" />
      {pools.map((pool, idx) => {
        if (stageFilter !== null && stageFilter !== pool.name) return null;
        const poolMatches = allMatches.filter((m) => m.pool_id === pool.id);
        const visibleMatches = poolMatches.filter((m) => matchPassesStatusFilter(m, statusFilter));
        if (visibleMatches.length === 0) return null;
        return (
          <View key={pool.id} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">{pool.name}</Text>
            <View style={{ gap: 8 }}>
              {visibleMatches.map((m, mi) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  matchNumber={mi + 1}
                  isEligible={!!m.team_a && !!m.team_b}
                  isHost={isHost}
                  isAssignedScorer={!!currentUserId && m.scorer_user_id === currentUserId}
                  scorerName={getScorerName(m)}
                  teamAStatus={m.team_a ? teamStatusById.get(m.team_a.id) : undefined}
                  teamBStatus={m.team_b ? teamStatusById.get(m.team_b.id) : undefined}
                  nrrByTeam={nrrByTeam}
                  liveCricketMatchIds={liveCricketMatchIds}
                  onGoToScorecard={() => onGoToScorecard(m)}
                  onEnterScoreManually={() => onEnterScoreManually(m)}
                  onSelectScorer={() => onSelectScorer(m)}
                  onSetTime={isHost ? () => onSetTime(m) : undefined}
                  onViewDetails={() => onViewDetails(m)}
                  onWatchScorecard={() => onWatchScorecard(m)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Pool format's knockout stage — every real multi-group tournament needs a
// way to actually crown a winner once the round-robin groups are done, which
// nothing above provides (PoolMatchesPanel only ever plays the group stage).
// Qualifiers come straight from each pool's standings: with exactly two
// pools, the top two from each cross-pair into a semifinal (1st-of-A vs
// 2nd-of-B, 1st-of-B vs 2nd-of-A) so pool-mates don't meet again
// immediately; with any other pool count, each pool's own winner goes
// straight into a knockout bracket sized to the number of pools. From there
// it's the exact same bracket-advancement machinery Knockout/League already
// use (generateNextRound + pairTeamsForFixtures("KNOCKOUT", ...)) — these
// rounds are just persisted with pool_id null, same as any other playoff.
function PoolPlayoffPanel({
  gameId,
  pools,
  approvedTeams,
  requiredTeams,
  isHost,
  isVenueBooked,
  currentUserId,
  statusFilter,
  stageFilter,
  nrrByTeam,
  teamStatusById,
  liveCricketMatchIds,
  qualifiersPerGroup,
  getScorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
  onSetTime,
  onViewDetails,
  onWatchScorecard,
}: {
  gameId: string;
  pools: TournamentPool[];
  approvedTeams: TournamentTeam[];
  requiredTeams: number;
  isHost: boolean;
  isVenueBooked: boolean;
  currentUserId?: string;
  statusFilter: MatchStatusFilter;
  stageFilter: string | null;
  nrrByTeam: Map<string, number> | undefined;
  teamStatusById: Map<string, Database["public"]["Enums"]["tournament_team_status_type"]>;
  liveCricketMatchIds: Set<string>;
  // Uniform across every group — host-set at creation time
  // (games.pool_qualifiers_per_group); falls back to the pre-existing
  // default (2 when there are exactly 2 groups, else 1) for tournaments
  // created before that setting existed.
  qualifiersPerGroup: number;
  getScorerName: (match: TournamentMatch) => string | null;
  onGoToScorecard: (match: TournamentMatch) => void;
  onEnterScoreManually: (match: TournamentMatch) => void;
  onSelectScorer: (match: TournamentMatch) => void;
  onSetTime: (match: TournamentMatch) => void;
  onViewDetails: (match: TournamentMatch) => void;
  onWatchScorecard: (match: TournamentMatch) => void;
}) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generateNextRound = useGenerateNextRound(gameId);

  if (isLoading) return null;

  const allMatches = matches ?? [];
  const groupMatches = allMatches.filter((m) => m.pool_id !== null);
  const playoffMatches = allMatches.filter((m) => m.pool_id === null);
  const unassigned = approvedTeams.filter((t) => !t.pool_id);

  const groupStageComplete =
    pools.length > 0 &&
    requiredTeams > 0 &&
    approvedTeams.length === requiredTeams &&
    unassigned.length === 0 &&
    pools.every((p) => {
      const ms = groupMatches.filter((m) => m.pool_id === p.id);
      return ms.length > 0 && ms.every((m) => m.status === "COMPLETED");
    });

  if (!groupStageComplete) return null;

  if (playoffMatches.length === 0) {
    const poolStandings = (poolId: string) =>
      rankStandings(
        approvedTeams.filter((t) => t.pool_id === poolId).map((t) => ({ id: t.id, name: t.name })),
        groupMatches.filter((m) => m.pool_id === poolId),
        nrrByTeam
      );

    // The same number of qualifiers from every group, interleaved by rank
    // (every group's winner, then every group's runner-up, ...) rather than
    // grouped together — spreads same-group teams apart in the seed order,
    // reducing (not guaranteeing — a real draw would need bracket-position
    // awareness) the chance of an immediate same-group rematch. Seeded into
    // the same bye-aware bracket generator Knockout uses, so a qualifier
    // count that isn't a power of 2 (5 groups × 1, 3 groups × 2, ...) just
    // works via byes instead of needing pools.length === 2 as a special case.
    const allPoolStandings = pools.map((p) => poolStandings(p.id));
    const qualifiers: { id: string; name: string }[] = [];
    for (let rank = 0; rank < qualifiersPerGroup; rank++) {
      for (const standings of allPoolStandings) {
        const s = standings[rank];
        if (s) qualifiers.push({ id: s.teamId, name: s.name });
      }
    }

    if (qualifiers.length < 2) return null;

    return (
      <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
        <CardHeader
          icon="trophy-outline"
          title="Playoffs"
          subtitle={`Every group is done — generate the ${knockoutRoundLabel(qualifiers.length).toLowerCase()}${qualifiers.length > 2 ? "s" : ""} from the group standings`}
        />
        {isHost && (
          <Pressable
            onPress={() =>
              generateNextRound.mutate(
                { round: 2, teams: qualifiers },
                { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the playoffs.")) }
              )
            }
            disabled={generateNextRound.isPending}
          >
            <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 8 }}>
              {generateNextRound.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="trophy-outline" size={16} color="white" />
                  <Text className="text-jazba-white text-sm font-bold">
                    Generate {knockoutRoundLabel(qualifiers.length)}{qualifiers.length > 2 ? "s" : ""}
                  </Text>
                </>
              )}
            </GradientFill>
          </Pressable>
        )}
        {statusFilter !== "COMPLETED" && (
          <BracketPreviewRounds rounds={computeBracketPreviewRounds(qualifiers.length)} />
        )}
      </View>
    );
  }

  const rounds = Array.from(new Set(playoffMatches.map((m) => m.round))).sort((a, b) => a - b);
  const latestRound = rounds[rounds.length - 1];
  const latestRoundMatches = playoffMatches.filter((m) => m.round === latestRound);
  const bracketWinners = getRoundWinners(latestRoundMatches);
  const isChampionDecided = bracketWinners !== null && bracketWinners.length === 1;
  const canAdvanceBracket = bracketWinners !== null && bracketWinners.length > 1;
  const previewRounds = statusFilter !== "COMPLETED" ? computeBracketPreviewRounds(latestRoundMatches.length) : [];

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-surface p-4" style={cardShadow}>
      <CardHeader icon="trophy-outline" title="Playoffs" />
      {rounds.map((round, idx) => {
        const roundMatches = playoffMatches.filter((m) => m.round === round);
        const stageKey = roundLabel("KNOCKOUT", round, roundMatches);
        if (stageFilter !== null && stageFilter !== stageKey) return null;
        const visibleMatches = roundMatches.filter((m) => matchPassesStatusFilter(m, statusFilter));
        if (visibleMatches.length === 0) return null;
        return (
          <View key={round} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">{stageKey}</Text>
            <View style={{ gap: 8 }}>
              {visibleMatches.map((m, mi) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  matchNumber={mi + 1}
                  isEligible={!!m.team_a && !!m.team_b}
                  isHost={isHost}
                  isAssignedScorer={!!currentUserId && m.scorer_user_id === currentUserId}
                  scorerName={getScorerName(m)}
                  teamAStatus={m.team_a ? teamStatusById.get(m.team_a.id) : undefined}
                  teamBStatus={m.team_b ? teamStatusById.get(m.team_b.id) : undefined}
                  nrrByTeam={nrrByTeam}
                  liveCricketMatchIds={liveCricketMatchIds}
                  onGoToScorecard={() => onGoToScorecard(m)}
                  onEnterScoreManually={() => onEnterScoreManually(m)}
                  onSelectScorer={() => onSelectScorer(m)}
                  onSetTime={isHost ? () => onSetTime(m) : undefined}
                  onViewDetails={() => onViewDetails(m)}
                  onWatchScorecard={() => onWatchScorecard(m)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <BracketPreviewRounds rounds={previewRounds} />

      {isHost && canAdvanceBracket && bracketWinners && (
        <Pressable
          onPress={() =>
            generateNextRound.mutate(
              { round: latestRound + 1, teams: bracketWinners },
              { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the next round.")) }
            )
          }
          disabled={generateNextRound.isPending}
          className="mt-4"
        >
          <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 8 }}>
            {generateNextRound.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="git-network-outline" size={16} color="white" />
                <Text className="text-jazba-white text-sm font-bold">
                  Generate {knockoutRoundLabel(bracketWinners.length)} Matches
                </Text>
              </>
            )}
          </GradientFill>
        </Pressable>
      )}

      {isChampionDecided && bracketWinners && (
        <View className="bg-primary-light rounded-xl py-3 items-center mt-4">
          <Text className="text-primary-dark text-xs font-semibold">🏆 Champion: {bracketWinners[0].name}</Text>
        </View>
      )}
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function TournamentMatchesScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: game, isLoading: gameLoading, refetch: refetchGame, isRefetching: gameRefetching } = useGameDetail(params.gameId);
  const { data: teamsData, isLoading: teamsLoading, refetch: refetchTeams, isRefetching: teamsRefetching } = useTournamentTeams(params.gameId);
  const { data: matches, refetch: refetchMatches, isRefetching: matchesRefetching } = useTournamentMatches(params.gameId);
  const { data: nrrByTeam } = useTournamentNRR(params.gameId, matches);
  const linkedCricketMatchIds = (matches ?? []).filter((m) => m.cricket_match_id).map((m) => m.cricket_match_id as string);
  const { data: liveCricketMatchesRaw } = useLiveCricketMatches(linkedCricketMatchIds);
  // Safety net on top of useLiveCricketMatches' own cricket_matches realtime
  // channel: tournament_matches has its own separate, game_id-filtered
  // realtime subscription (useTournamentMatches above) that's already proven
  // reliable elsewhere on this screen, and gets flipped to COMPLETED the
  // moment a linked scorecard finishes (syncCricketMatchResult). Cross-
  // checking against it means a just-finished match can never keep showing
  // under Live Now even in the rare case the other channel's event is
  // delayed or dropped.
  const completedCricketMatchIds = new Set(
    (matches ?? [])
      .filter((m) => m.status === "COMPLETED" && m.cricket_match_id)
      .map((m) => m.cricket_match_id as string)
  );
  const liveCricketMatches = (liveCricketMatchesRaw ?? []).filter((lm) => !completedCricketMatchIds.has(lm.id));
  // Same set, as cricket_match_ids only — lets each match card's own
  // StatusPill show "Live" without every MatchRow needing the full
  // LiveCricketMatchSummary objects.
  const liveCricketMatchIds = new Set(liveCricketMatches.map((lm) => lm.id));
  const { data: pools, refetch: refetchPools, isRefetching: poolsRefetching } = useTournamentPools(params.gameId);
  // Every query here already has its own realtime subscription, so this is
  // a manual "just in case" fallback more than something load-bearing.
  const isRefreshing = gameRefetching || teamsRefetching || matchesRefetching || poolsRefetching;
  const handleRefresh = () => {
    refetchGame();
    refetchTeams();
    refetchMatches();
    refetchPools();
  };
  const setMatchScorer = useSetMatchScorer(params.gameId);
  const updateMatchSchedule = useUpdateMatchSchedule(params.gameId);
  const [scorerModalMatchId, setScorerModalMatchId] = useState<string | null>(null);
  const [scheduleModalMatchId, setScheduleModalMatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"MATCHES" | "POINTS">("MATCHES");
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  if (gameLoading || teamsLoading || !game) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isHost = game.creator_id === userId || (!!userId && (game.co_host_ids ?? []).includes(userId));
  // A team with just one joined player is shown by that player's name.
  const teams = (teamsData ?? []).map((t) => ({
    ...t,
    name: soloAwareTeamName(
      t.name,
      t.tournament_team_members.map((m) => ({ status: m.status, full_name: m.profiles?.full_name }))
    ),
  }));
  const approvedTeamsFull = teams.filter((t) => t.status === "APPROVED");
  const approvedTeams = approvedTeamsFull.map((t) => ({ id: t.id, name: t.name }));
  const activeTeams = teams.filter((t) => t.status !== "REJECTED");
  // Every team *slot* (placeholder "Team A"/"Team B"/...) already exists from
  // the moment the tournament is created — see createTournamentTeamPlaceholders
  // — only each slot's roster fills in over time. So match *generation* (who
  // plays whom) only needs every slot to exist, not every slot to be fully
  // filled/approved yet: the pairing is by team id, which never changes as
  // members join. Whether a given match can actually be *scored* is a
  // separate, per-match check at the moment the host taps in (see
  // teamIsReadyToScore / handleGoToScorecard below).
  const teamsForGeneration = activeTeams.map((t) => ({ id: t.id, name: t.name }));
  // Manual format only — every active team's progression status, read
  // straight off tournament_teams.manual_status (defaults to Pending for
  // every team, including in every other format, where it's just unused).
  const manualTeams = activeTeams.map((t) => ({ id: t.id, name: t.name, manualStatus: t.manual_status }));
  const teamStatusById = new Map(teams.map((t) => [t.id, t.status]));
  const requiredTeams = game.number_of_teams ?? 0;
  const hasMatches = (matches?.length ?? 0) > 0;
  const isPoolFormat = game.tournament_format === "POOL";

  // "Go To Scorecard" exists for every sport, and only once the venue is
  // settled — a real booking for a dropdown-picked venue, or immediately
  // for a manually typed one (see the identical rule on GameDetailScreen's
  // "Book Venue"). It opens that sport's own New Match screen with team
  // names/rosters/venue pre-filled and locked, letting the host pick the
  // rest of the match rules there (see handleGoToScorecard below).
  const sportName = (game.sports?.name ?? "").trim().toLowerCase();
  const isCricketSport = isCricketFamily(sportName);
  const isVenueBooked = game.venue_id ? !!game.booking_id || game.venue_contacted : !!game.custom_venue_name;

  // Header stat row + stage pills — derived straight from `matches`/`pools`,
  // the same source every panel below already reads, so they can never
  // drift from what's actually rendered.
  const allMatchesFlat = matches ?? [];
  const playedCount = allMatchesFlat.filter((m) => m.status === "COMPLETED").length;
  const totalMatchesCount = allMatchesFlat.length;
  const remainingCount = totalMatchesCount - playedCount;
  const nonPoolRoundMatches = allMatchesFlat.filter((m) => !isPoolFormat || m.pool_id === null);
  const nonPoolRounds = Array.from(new Set(nonPoolRoundMatches.map((m) => m.round))).sort((a, b) => a - b);
  const stageOptions: string[] = isPoolFormat
    ? [
        ...(pools ?? []).map((p) => p.name),
        ...nonPoolRounds.map((r) => roundLabel("KNOCKOUT", r, nonPoolRoundMatches.filter((m) => m.round === r))),
      ]
    : nonPoolRounds.map((r) =>
        roundLabel(game.tournament_format ?? "KNOCKOUT", r, nonPoolRoundMatches.filter((m) => m.round === r))
      );

  const scheduleModalMatch = allMatchesFlat.find((m) => m.id === scheduleModalMatchId) ?? null;
  const handleConfirmSchedule = (iso: string) => {
    if (!scheduleModalMatchId) return;
    updateMatchSchedule.mutate(
      { matchId: scheduleModalMatchId, scheduledAt: iso },
      {
        onSuccess: () => setScheduleModalMatchId(null),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not set match time.")),
      }
    );
  };

  // Stands in for the mockup's "View match details" — rather than a
  // separate screen, a quick summary of why it isn't ready to score yet.
  // Any tournament player can watch a cricket match's live/finished
  // scorecard once one exists — unlike handleGoToScorecard, this never
  // falls back to match creation, since a viewer must never land there.
  // Cricket-only for now (see LiveScoringScreen's own isScorer gate, which
  // is what actually makes this read-only for everyone but the scorer).
  const handleWatchScorecard = (match: TournamentMatch) => {
    if (isCricketSport && match.cricket_match_id) {
      navigation.navigate("LiveScoring", { matchId: match.cricket_match_id });
    }
  };

  const handleViewMatchDetails = (match: TournamentMatch) => {
    const bothTeamsReady =
      !!match.team_a &&
      !!match.team_b &&
      teamStatusById.get(match.team_a.id) === "APPROVED" &&
      teamStatusById.get(match.team_b.id) === "APPROVED";
    const reason = !match.team_a || !match.team_b
      ? "Waiting for both teams to be decided."
      : !bothTeamsReady
        ? "Waiting for both teams' rosters to be filled and approved."
        : "Waiting for a scorer to be assigned.";
    Alert.alert(
      `${match.team_a?.name ?? "TBD"} vs ${match.team_b?.name ?? "Bye"}`,
      [match.scheduled_at ? formatMatchSchedule(match.scheduled_at) : "Not scheduled yet", reason].join("\n")
    );
  };

  const rosterByTeamId = new Map<string, ScorecardPrefillPlayer[]>();
  for (const t of teams) {
    rosterByTeamId.set(
      t.id,
      t.tournament_team_members
        .filter((m) => m.status === "JOINED")
        .map((m) => ({ name: m.profiles?.full_name ?? m.manual_name ?? "Player", userId: m.user_id }))
    );
  }

  // Every joined member across every active team — the pool the host picks
  // a match's scorer from (not just the two teams playing that match, per
  // spec: "all the members of tournament will show in drop down list").
  // Manually-added players (no real account) can never be picked — there's
  // no one to assign — so when a team is filled entirely with them, this
  // list would otherwise be completely empty with no way to assign anyone.
  // The host is always added as a fallback candidate (deduped below in case
  // they're also a joined team member) so there's always at least one
  // person who can score. Every candidate who IS the host (whichever way
  // they ended up in the list) is labeled "(Host)" on their name, so it's
  // always clear in the picker which entry that is.
  const rawScorerCandidates: ScorerCandidate[] = activeTeams.flatMap((t) =>
    t.tournament_team_members
      .filter((m) => m.status === "JOINED" && m.user_id)
      .map((m) => ({ id: m.user_id as string, name: m.profiles?.full_name ?? "Player", teamName: t.name }))
  );
  if (game.creator_id) {
    rawScorerCandidates.push({
      id: game.creator_id,
      name: game.profiles?.full_name ?? "Host",
      teamName: "Tournament Host",
    });
  }
  for (const host of game.hosts ?? []) {
    if (host.id !== game.creator_id) {
      rawScorerCandidates.push({ id: host.id, name: host.full_name ?? "Host", teamName: "Game Host" });
    }
  }
  const scorerCandidates: ScorerCandidate[] = Array.from(
    new Map(rawScorerCandidates.map((c) => [c.id, c])).values()
  ).map((c) => ((c.id === game.creator_id || (game.co_host_ids ?? []).includes(c.id)) ? { ...c, name: `${c.name} (Host)` } : c));
  const scorerNameById = new Map(scorerCandidates.map((c) => [c.id, c.name]));
  const getScorerName = (match: TournamentMatch): string | null =>
    match.scorer_user_id ? scorerNameById.get(match.scorer_user_id) ?? null : null;

  const scorerModalMatch = (matches ?? []).find((m) => m.id === scorerModalMatchId) ?? null;
  const handleSelectScorer = (userId: string) => {
    if (!scorerModalMatchId) return;
    setMatchScorer.mutate(
      { matchId: scorerModalMatchId, scorerUserId: userId },
      {
        onSuccess: () => setScorerModalMatchId(null),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not assign scorer.")),
      }
    );
  };

  const buildPrefill = (match: TournamentMatch): ScorecardPrefill | null => {
    if (!match.team_a || !match.team_b) return null;
    const rawTeamAPlayers = rosterByTeamId.get(match.team_a.id) ?? [];
    const rawTeamBPlayers = rosterByTeamId.get(match.team_b.id) ?? [];
    // Manually-typed names (no account to tell them apart) can collide —
    // two different players both entered as "Ali" — and since the New Match
    // screen locks a prefilled roster's names, that collision would
    // otherwise leave the Start button permanently disabled with no way to
    // fix it. Suffix duplicates ("Ali (2)") here, before the roster ever
    // reaches that screen.
    const { teamANames, teamBNames } = disambiguateRoster(
      rawTeamAPlayers.map((p) => ({ name: p.name, sourceId: p.userId })),
      rawTeamBPlayers.map((p) => ({ name: p.name, sourceId: p.userId }))
    );
    return {
      tournamentMatchId: match.id,
      gameId: params.gameId,
      teamAName: match.team_a.name,
      teamBName: match.team_b.name,
      teamAPlayers: rawTeamAPlayers.map((p, i) => ({ ...p, name: teamANames[i] })),
      teamBPlayers: rawTeamBPlayers.map((p, i) => ({ ...p, name: teamBNames[i] })),
      venue: game.venues?.name ?? game.custom_venue_name ?? undefined,
      sportId: game.sports?.id,
    };
  };

  // Match cards (and their scoring buttons) show immediately once a match
  // exists — team slots are created up front at tournament creation (see
  // teamsForGeneration above), so there's no need to wait on roster fill
  // status to see the card. Whether a *specific* match can actually be
  // scored still depends on both its own teams having a full, approved
  // roster (auto_approve_full_team flips a team to APPROVED once its
  // roster is complete) — checked here, at the moment the host taps in,
  // rather than hiding the buttons in advance.
  const teamsReadyToScore = (match: TournamentMatch): boolean =>
    !!match.team_a &&
    !!match.team_b &&
    teamStatusById.get(match.team_a.id) === "APPROVED" &&
    teamStatusById.get(match.team_b.id) === "APPROVED";

  const requireTeamsReady = (match: TournamentMatch): boolean => {
    if (teamsReadyToScore(match)) return true;
    Alert.alert(
      "Complete the team members",
      "Both teams in this match need their full roster filled and approved before you can start scoring it."
    );
    return false;
  };

  // A draw is only a valid result in a league's group stage / a pool's group
  // matches — every bracket match needs a winner.
  const handleEnterScoreManually = (match: TournamentMatch) => {
    if (!requireTeamsReady(match)) return;
    const prefill = buildPrefill(match);
    const manualSport = manualSportForName(sportName);
    if (!prefill || !manualSport) return;
    const allowDraw = !!match.pool_id || (game.tournament_format === "LEAGUE" && match.round === 1);
    navigation.navigate("ManualScore", { sport: manualSport, allowDraw, prefill });
  };

  const handleGoToScorecard = (match: TournamentMatch) => {
    if (!requireTeamsReady(match)) return;
    const prefill = buildPrefill(match);
    if (!prefill) return;

    if (isCricketSport) {
      if (match.cricket_match_id) navigation.navigate("LiveScoring", { matchId: match.cricket_match_id });
      else navigation.navigate("NewMatch", { prefill });
      return;
    }

    switch (sportName) {
      case "padel":
        if (match.padel_match_id) navigation.navigate("PadelLiveScoring", { matchId: match.padel_match_id });
        else navigation.navigate("PadelNewMatch", { prefill });
        return;
      case "tennis":
        if (match.tennis_match_id) navigation.navigate("TennisLiveScoring", { matchId: match.tennis_match_id });
        else navigation.navigate("TennisNewMatch", { prefill });
        return;
      case "badminton":
        if (match.badminton_match_id) navigation.navigate("BadmintonLiveScoring", { matchId: match.badminton_match_id });
        else navigation.navigate("BadmintonNewMatch", { prefill });
        return;
      case "pickleball":
        if (match.pickleball_match_id) navigation.navigate("PickleballLiveScoring", { matchId: match.pickleball_match_id });
        else navigation.navigate("PickleballNewMatch", { prefill });
        return;
      case "table tennis":
        if (match.table_tennis_match_id) navigation.navigate("TableTennisLiveScoring", { matchId: match.table_tennis_match_id });
        else navigation.navigate("TableTennisNewMatch", { prefill });
        return;
      case "football":
        if (match.football_match_id) navigation.navigate("FootballLiveScoring", { matchId: match.football_match_id });
        else navigation.navigate("FootballNewMatch", { prefill });
        return;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background, position: "relative" }}>
      {/* Compact tournament header with the existing back action and summary. */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: colors.background,
        }}
      >
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-muted" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
              TOURNAMENT DASHBOARD
            </Text>
            <Text className="text-ink font-extrabold" style={{ fontSize: 22 }} numberOfLines={1}>
              {game.title}
            </Text>
            <View className="flex-row items-center mt-1.5 flex-wrap" style={{ gap: 8 }}>
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.surfaceOverlay }}>
                <Text className="text-ink text-xs font-semibold">
                  {game.tournament_format ? TOURNAMENT_FORMAT_LABEL[game.tournament_format] : "—"}
                </Text>
              </View>
              <Text className="text-muted text-xs">
                {approvedTeamsFull.length} teams · {totalMatchesCount} matches
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stat row */}
      <View className="flex-row items-center px-4 py-4" style={{ gap: 12 }}>
        <View className="flex-1 items-center">
          <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>{approvedTeamsFull.length}</Text>
          <Text className="text-muted text-xs mt-0.5">Teams</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>{playedCount}/{totalMatchesCount}</Text>
          <Text className="text-muted text-xs mt-0.5">Played</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>{remainingCount}</Text>
          <Text className="text-muted text-xs mt-0.5">Remaining</Text>
        </View>
      </View>

      {/* Matches / Points Table */}
      <View className="flex-row px-4" style={{ gap: 24 }}>
        {(
          [
            { key: "MATCHES", label: "Matches" },
            { key: "POINTS", label: "Points Table" },
          ] as const
        ).map((t) => (
          <Pressable key={t.key} onPress={() => setActiveTab(t.key)} className="pb-3">
            <Text
              className="font-semibold text-sm"
              style={{ color: activeTab === t.key ? colors.primaryDark : colors.muted }}
            >
              {t.label}
            </Text>
            {activeTab === t.key && (
              <View style={{ height: 2.5, width: "100%", backgroundColor: colors.primary, borderRadius: 2, marginTop: 6 }} />
            )}
          </Pressable>
        ))}
      </View>
      <View className="h-px bg-border" />

      {activeTab === "MATCHES" && (
        <>
          {/* Live Now — any match a scorer has actually started, surfaced
              immediately to every tournament player via useLiveCricketMatches'
              realtime subscription (no refresh needed the instant one
              starts or finishes). */}
          {!!liveCricketMatches && liveCricketMatches.length > 0 && (
            <View className="mx-4 mt-3 rounded-2xl p-4" style={{ backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: "#FCA5A5" }}>
              <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                <View className="flex-row items-center bg-red-500 rounded-full px-2 py-0.5" style={{ gap: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.ink }} />
                  <Text className="text-jazba-white text-[10px] font-bold">LIVE</Text>
                </View>
                <Text className="font-bold text-sm" style={{ color: "#991B1B" }}>Live Now</Text>
              </View>
              <View style={{ gap: 8 }}>
                {liveCricketMatches.map((lm) => (
                  <Pressable
                    key={lm.id}
                    onPress={() => navigation.navigate("LiveScoring", { matchId: lm.id })}
                    className="flex-row items-center justify-between bg-surface rounded-xl px-3.5 py-3"
                    style={cardShadow}
                  >
                    <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={1}>
                      {lm.team_a_name} vs {lm.team_b_name}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View className="flex-row px-4 py-3" style={{ gap: 8 }}>
            {(
              [
                { key: "ALL", label: "All" },
                { key: "UPCOMING", label: "Upcoming" },
                { key: "COMPLETED", label: "Completed" },
              ] as const
            ).map((f) => {
              const selected = statusFilter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() =>
                    // Tapping the already-active pill again clears it back
                    // to "All" instead of re-selecting itself.
                    setStatusFilter(selected && f.key !== "ALL" ? "ALL" : f.key)
                  }
                >
                  {selected ? (
                    <GradientFill className="rounded-full px-4 py-2">
                      <Text className="text-jazba-white text-xs font-bold">{f.label}</Text>
                    </GradientFill>
                  ) : (
                    <View className="rounded-full px-4 py-2" style={{ backgroundColor: colors.surfaceOverlay }}>
                      <Text className="text-muted text-xs font-bold">{f.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {stageOptions.length > 0 && (
            <>
              <Text className="text-ink font-bold text-sm px-4 mb-2">Tournament stages</Text>
              {/* A plain wrapping row instead of a horizontal ScrollView —
                  there are only ever a handful of stages, so there's
                  nothing to scroll, and a ScrollView here was prone to
                  native measurement glitches (seen as missing/blank pills
                  depending on the status filter selected above it). */}
              <View className="flex-row flex-wrap px-4" style={{ gap: 8, paddingBottom: 8 }}>
                {stageOptions.map((stage) => {
                  const selected = stageFilter === stage;
                  return (
                    <Pressable key={stage} onPress={() => setStageFilter(selected ? null : stage)}>
                      <View
                        className="rounded-full px-4 py-2"
                        style={{
                          backgroundColor: selected ? colors.primaryLight : colors.surfaceOverlay,
                          borderWidth: selected ? 1.5 : 0,
                          borderColor: colors.primary,
                        }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: selected ? colors.primaryDark : colors.muted }}
                        >
                          {stage}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {activeTab === "POINTS" ? (
          isPoolFormat ? (
            (pools ?? []).map((pool) => {
              const teamsInPool = approvedTeamsFull
                .filter((t) => t.pool_id === pool.id)
                .map((t) => ({ id: t.id, name: t.name }));
              const poolMatches = allMatchesFlat.filter((m) => m.pool_id === pool.id);
              return (
                <StandingsPanel
                  key={pool.id}
                  teams={teamsInPool}
                  matches={poolMatches}
                  label={`${pool.name} Standings`}
                  nrrByTeam={nrrByTeam}
                  showNRR={isCricketSport}
                />
              );
            })
          ) : game.tournament_format === "LEAGUE" || game.tournament_format === "MANUAL" ? (
            <StandingsPanel teams={approvedTeams} matches={allMatchesFlat} nrrByTeam={nrrByTeam} showNRR={isCricketSport} />
          ) : (
            <View className="items-center mt-16 px-6">
              <Text className="text-muted text-sm text-center">
                A points table only applies to a league or group stage — Knockout advances by result alone.
              </Text>
            </View>
          )
        ) : isPoolFormat ? (
          <>
            <GroupsPanel
              gameId={game.id}
              pools={pools ?? []}
              approvedTeams={activeTeams}
              requiredTeams={requiredTeams}
              isHost={isHost}
            />
            <PoolMatchesPanel
              gameId={game.id}
              pools={pools ?? []}
              approvedTeams={activeTeams}
              requiredTeams={requiredTeams}
              isHost={isHost}
              isVenueBooked={isVenueBooked}
              currentUserId={userId}
              statusFilter={statusFilter}
              stageFilter={stageFilter}
              nrrByTeam={nrrByTeam}
              teamStatusById={teamStatusById}
              liveCricketMatchIds={liveCricketMatchIds}
              getScorerName={getScorerName}
              onGoToScorecard={handleGoToScorecard}
              onEnterScoreManually={handleEnterScoreManually}
              onSelectScorer={(match) => setScorerModalMatchId(match.id)}
              onSetTime={(match) => setScheduleModalMatchId(match.id)}
              onViewDetails={handleViewMatchDetails}
              onWatchScorecard={handleWatchScorecard}
            />
            <PoolPlayoffPanel
              gameId={game.id}
              pools={pools ?? []}
              approvedTeams={activeTeams}
              requiredTeams={requiredTeams}
              isHost={isHost}
              isVenueBooked={isVenueBooked}
              currentUserId={userId}
              statusFilter={statusFilter}
              stageFilter={stageFilter}
              nrrByTeam={nrrByTeam}
              teamStatusById={teamStatusById}
              liveCricketMatchIds={liveCricketMatchIds}
              qualifiersPerGroup={game.pool_qualifiers_per_group ?? ((pools ?? []).length === 2 ? 2 : 1)}
              getScorerName={getScorerName}
              onGoToScorecard={handleGoToScorecard}
              onEnterScoreManually={handleEnterScoreManually}
              onSelectScorer={(match) => setScorerModalMatchId(match.id)}
              onSetTime={(match) => setScheduleModalMatchId(match.id)}
              onViewDetails={handleViewMatchDetails}
              onWatchScorecard={handleWatchScorecard}
            />
          </>
        ) : (
          <>
            {/* Before matches exist: a computed preview of who plays whom, from
                whichever teams are currently active. Once the host generates real
                matches (only possible once every team slot is APPROVED), that
                preview is replaced by the persisted, result-entry version below —
                so there's never a redundant/conflicting fixtures list on screen. */}
            {game.tournament_format && game.tournament_format !== "MANUAL" && !hasMatches && (
              <FixturesPanel format={game.tournament_format} teams={activeTeams.map((t) => ({ name: t.name, status: t.status }))} />
            )}
            {game.tournament_format === "MANUAL" ? (
              <>
                <ManualTeamsPanel gameId={game.id} teams={manualTeams} isHost={isHost} />
                <ManualMatchesPanel
                  gameId={game.id}
                  teams={manualTeams}
                  isHost={isHost}
                  currentUserId={userId}
                  statusFilter={statusFilter}
                  stageFilter={stageFilter}
                  nrrByTeam={nrrByTeam}
                  teamStatusById={teamStatusById}
                  liveCricketMatchIds={liveCricketMatchIds}
                  getScorerName={getScorerName}
                  onGoToScorecard={handleGoToScorecard}
                  onEnterScoreManually={handleEnterScoreManually}
                  onSelectScorer={(match) => setScorerModalMatchId(match.id)}
                  onSetTime={(match) => setScheduleModalMatchId(match.id)}
                  onViewDetails={handleViewMatchDetails}
                  onWatchScorecard={handleWatchScorecard}
                />
              </>
            ) : game.tournament_format && (
              <MatchesPanel
                gameId={game.id}
                format={game.tournament_format}
                approvedTeams={teamsForGeneration}
                requiredTeams={requiredTeams}
                isHost={isHost}
                isVenueBooked={isVenueBooked}
                currentUserId={userId}
                statusFilter={statusFilter}
                stageFilter={stageFilter}
                nrrByTeam={nrrByTeam}
                teamStatusById={teamStatusById}
                liveCricketMatchIds={liveCricketMatchIds}
                getScorerName={getScorerName}
                onGoToScorecard={handleGoToScorecard}
                onEnterScoreManually={handleEnterScoreManually}
                onSelectScorer={(match) => setScorerModalMatchId(match.id)}
                onSetTime={(match) => setScheduleModalMatchId(match.id)}
                onViewDetails={handleViewMatchDetails}
              onWatchScorecard={handleWatchScorecard}
              />
            )}
          </>
        )}
      </ScrollView>

      <SelectScorerModal
        visible={!!scorerModalMatchId}
        onClose={() => setScorerModalMatchId(null)}
        members={scorerCandidates}
        currentScorerId={scorerModalMatch?.scorer_user_id ?? null}
        onSelect={handleSelectScorer}
        submitting={setMatchScorer.isPending}
      />

      <SetMatchTimeModal
        visible={!!scheduleModalMatchId}
        onClose={() => setScheduleModalMatchId(null)}
        initialIso={scheduleModalMatch?.scheduled_at ?? null}
        onConfirm={handleConfirmSchedule}
        submitting={updateMatchSchedule.isPending}
      />
    </View>
  );
}
