import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useGameDetail } from "../../hooks/useGames";
import { useTournamentTeams } from "../../hooks/useTournamentTeams";
import {
  useTournamentMatches,
  useGenerateMatches,
  useGenerateNextRound,
  useGeneratePoolMatches,
  useSetMatchScorer,
} from "../../hooks/useTournamentMatches";
import { useTournamentPools, useAssignTeamToPool } from "../../hooks/useTournamentPools";
import { useCricketMatch } from "../../hooks/useCricket";
import { ballRowToEvent } from "../../lib/api/cricket";
import { computeRunRate } from "../../lib/cricketScoring";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow } from "../../constants/theme";
import { manualSportForName } from "../../lib/manualScore";
import { isCricketFamily } from "../../lib/api/sports";
import { LinkedMatchScoreDetails } from "../../components/MatchScoreDetails";
import SelectScorerModal, { type ScorerCandidate } from "../../components/SelectScorerModal";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";
import { soloAwareTeamName, type TournamentMatch, type ScorecardPrefill } from "../../lib/api/tournamentMatches";
import type { TournamentPool } from "../../lib/api/tournamentPools";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { getSportIcon } from "../../lib/sportIcons";
import {
  computeFixtures,
  computeStandings,
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
    <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
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

function MatchRow({
  match,
  matchNumber,
  isEligible,
  isHost,
  isAssignedScorer,
  scorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
}: {
  match: TournamentMatch;
  matchNumber: number;
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
}) {
  const teamAName = match.team_a?.name ?? "TBD";
  const teamBName = match.team_b?.name ?? "Bye";
  const showScoringButtons = isEligible && isAssignedScorer;
  const showSelectScorer = isEligible && isHost;
  const isReady = isEligible && (isAssignedScorer || isHost);

  if (match.status === "COMPLETED") {
    const resultLabel = match.is_draw
      ? "Draw"
      : match.winner_team
        ? `${match.winner_team.name} won`
        : match.team_b
          ? "—"
          : `${teamAName} advances`; // a bye, auto-completed at generation
    return (
      <View className="bg-gray-50 rounded-2xl px-3 py-2.5">
        <Text className="text-muted text-xs font-bold mb-1.5">Match {matchNumber}</Text>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <TeamStatusIcon status={match.team_a?.id ? "APPROVED" : undefined} />
          <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{teamAName}</Text>
          <View className="items-center justify-center rounded-full bg-gray-200" style={{ width: 32, height: 32 }}>
            <Text className="text-muted text-xs font-bold">VS</Text>
          </View>
          <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
          {match.team_b ? (
            <TeamStatusIcon status={match.team_b?.id ? "APPROVED" : undefined} />
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
        <Text className="text-primary text-xs font-semibold mt-1.5">{resultLabel}</Text>
        {match.cricket_match_id && !match.manual_score && <MatchRunRates cricketMatchId={match.cricket_match_id} />}
        <LinkedMatchScoreDetails match={match} />
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl px-3 py-2.5"
      style={{ backgroundColor: isReady ? colors.primaryLight : "#F9FAFB" }}
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <Text
          className="text-xs font-bold"
          style={{ color: isReady ? colors.primaryDark : colors.muted }}
        >
          Match {matchNumber}
        </Text>
        {isReady && (
          <View className="bg-white px-2.5 py-1 rounded-full">
            <Text className="text-primary text-xs font-bold">
              {showScoringButtons ? "Ready to Enter Score" : "Select a Scorer"}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <TeamStatusIcon status={match.team_a ? "APPROVED" : undefined} />
        <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{teamAName}</Text>
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 32, height: 32, backgroundColor: isReady ? "white" : "#E5E7EB" }}
        >
          <Text className="text-muted text-xs font-bold">VS</Text>
        </View>
        <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
        {match.team_b ? <TeamStatusIcon status="APPROVED" /> : <View style={{ width: 28 }} />}
      </View>
      {match.cricket_match_id && !match.manual_score && <MatchRunRates cricketMatchId={match.cricket_match_id} />}
      <LinkedMatchScoreDetails match={match} />
      {isReady && (
        <View style={{ gap: 8, marginTop: 12 }}>
          {showScoringButtons && (
            <>
              <Pressable
                onPress={onGoToScorecard}
                className="flex-row items-center justify-between bg-primary rounded-2xl px-4"
                style={{ paddingVertical: 14, ...cardShadow }}
              >
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Ionicons name="clipboard-outline" size={17} color="white" />
                  <Text className="text-white font-bold text-sm">Go To Scorecard</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="white" />
              </Pressable>
              <Pressable
                onPress={onEnterScoreManually}
                className="flex-row items-center justify-between bg-white border border-primary rounded-2xl px-4"
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
              className="flex-row items-center justify-between bg-white border border-primary rounded-2xl px-4"
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
        </View>
      )}
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
  const teamIds = new Set<string>();
  for (const m of roundMatches) {
    if (m.team_a_id) teamIds.add(m.team_a_id);
    if (m.team_b_id) teamIds.add(m.team_b_id);
  }
  return knockoutRoundLabel(teamIds.size);
}

function MatchesPanel({
  gameId,
  format,
  approvedTeams,
  requiredTeams,
  isHost,
  isVenueBooked,
  currentUserId,
  getScorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
}: {
  gameId: string;
  format: Database["public"]["Enums"]["tournament_format_type"];
  approvedTeams: { id: string; name: string }[];
  requiredTeams: number;
  isHost: boolean;
  isVenueBooked: boolean;
  currentUserId?: string;
  getScorerName: (match: TournamentMatch) => string | null;
  onGoToScorecard: (match: TournamentMatch) => void;
  onEnterScoreManually: (match: TournamentMatch) => void;
  onSelectScorer: (match: TournamentMatch) => void;
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
      <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
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
            onPress={() => generateMatches.mutate({ format, teams: approvedTeams })}
            disabled={generateMatches.isPending}
            className="flex-row items-center justify-center bg-primary rounded-full py-3"
            style={{ gap: 8 }}
          >
            {generateMatches.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="git-network-outline" size={16} color="white" />
                <Text className="text-white text-sm font-bold">Generate Matches</Text>
              </>
            )}
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
  const standings = isGroupStageComplete ? computeStandings(approvedTeams, allMatches) : [];
  const playoffSize = approvedTeams.length >= 4 ? 4 : Math.min(2, approvedTeams.length);
  const playoffTeams = standings.slice(0, playoffSize).map((s) => ({ id: s.teamId, name: s.name }));


  return (
    <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
      <CardHeader icon="git-network-outline" title="Matches" badge={TOURNAMENT_FORMAT_LABEL[format]} />

      {rounds.map((round, idx) => {
        const roundMatches = allMatches.filter((m) => m.round === round);
        return (
          <View key={round} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">
              {roundLabel(format, round, roundMatches)}
            </Text>
            <View style={{ gap: 8 }}>
              {roundMatches.map((m, mi) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  matchNumber={mi + 1}
                  isEligible={isVenueBooked && !!m.team_a && !!m.team_b}
                  isHost={isHost}
                  isAssignedScorer={!!currentUserId && m.scorer_user_id === currentUserId}
                  scorerName={getScorerName(m)}
                  onGoToScorecard={() => onGoToScorecard(m)}
                  onEnterScoreManually={() => onEnterScoreManually(m)}
                  onSelectScorer={() => onSelectScorer(m)}
                />
              ))}
            </View>
          </View>
        );
      })}

      {isHost && canAdvanceBracket && bracketWinners && (
        <Pressable
          onPress={() => generateNextRound.mutate({ round: latestRound + 1, teams: bracketWinners })}
          disabled={generateNextRound.isPending}
          className="flex-row items-center justify-center bg-primary rounded-full py-3 mt-4"
          style={{ gap: 8 }}
        >
          {generateNextRound.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="git-network-outline" size={16} color="white" />
              <Text className="text-white text-sm font-bold">
                Generate {knockoutRoundLabel(bracketWinners.length)} Matches
              </Text>
            </>
          )}
        </Pressable>
      )}

      {isHost && isGroupStageComplete && playoffTeams.length >= 2 && (
        <Pressable
          onPress={() => generateNextRound.mutate({ round: 2, teams: playoffTeams })}
          disabled={generateNextRound.isPending}
          className="flex-row items-center justify-center bg-primary rounded-full py-3 mt-4"
          style={{ gap: 8 }}
        >
          {generateNextRound.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="trophy-outline" size={16} color="white" />
              <Text className="text-white text-sm font-bold">
                Generate {knockoutRoundLabel(playoffTeams.length)} Playoffs (Top {playoffTeams.length})
              </Text>
            </>
          )}
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

function StandingsPanel({
  teams,
  matches,
  label = "Standings",
}: {
  teams: { id: string; name: string }[];
  matches: TournamentMatch[];
  label?: string;
}) {
  const standings = computeStandings(teams, matches);
  if (standings.length === 0 || standings.every((s) => s.played === 0)) return null;

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
      <CardHeader icon="stats-chart-outline" title={label} />
      <View className="flex-row items-center pb-2 border-b border-border">
        <Text className="text-muted text-xs font-semibold flex-1">Team</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>P</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>W</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>D</Text>
        <Text className="text-muted text-xs font-semibold" style={{ width: 28, textAlign: "center" }}>L</Text>
      </View>
      {standings.map((s) => (
        <View key={s.teamId} className="flex-row items-center py-2 border-b border-border">
          <Text className="text-ink text-sm flex-1" numberOfLines={1}>{s.name}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.played}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.won}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.drawn}</Text>
          <Text className="text-ink text-sm" style={{ width: 28, textAlign: "center" }}>{s.lost}</Text>
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
    <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
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
  getScorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
}: {
  gameId: string;
  pools: TournamentPool[];
  approvedTeams: TournamentTeam[];
  requiredTeams: number;
  isHost: boolean;
  isVenueBooked: boolean;
  currentUserId?: string;
  getScorerName: (match: TournamentMatch) => string | null;
  onGoToScorecard: (match: TournamentMatch) => void;
  onEnterScoreManually: (match: TournamentMatch) => void;
  onSelectScorer: (match: TournamentMatch) => void;
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
      <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
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
                }))
              )
            }
            disabled={generatePoolMatches.isPending}
            className="flex-row items-center justify-center bg-primary rounded-full py-3"
            style={{ gap: 8 }}
          >
            {generatePoolMatches.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="git-network-outline" size={16} color="white" />
                <Text className="text-white text-sm font-bold">Generate Group Matches</Text>
              </>
            )}
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
    <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
      <CardHeader icon="git-network-outline" title="Matches" badge="Pool" />
      {pools.map((pool, idx) => {
        const poolMatches = allMatches.filter((m) => m.pool_id === pool.id);
        if (poolMatches.length === 0) return null;
        return (
          <View key={pool.id} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">{pool.name}</Text>
            <View style={{ gap: 8 }}>
              {poolMatches.map((m, mi) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  matchNumber={mi + 1}
                  isEligible={isVenueBooked && !!m.team_a && !!m.team_b}
                  isHost={isHost}
                  isAssignedScorer={!!currentUserId && m.scorer_user_id === currentUserId}
                  scorerName={getScorerName(m)}
                  onGoToScorecard={() => onGoToScorecard(m)}
                  onEnterScoreManually={() => onEnterScoreManually(m)}
                  onSelectScorer={() => onSelectScorer(m)}
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
  getScorerName,
  onGoToScorecard,
  onEnterScoreManually,
  onSelectScorer,
}: {
  gameId: string;
  pools: TournamentPool[];
  approvedTeams: TournamentTeam[];
  requiredTeams: number;
  isHost: boolean;
  isVenueBooked: boolean;
  currentUserId?: string;
  getScorerName: (match: TournamentMatch) => string | null;
  onGoToScorecard: (match: TournamentMatch) => void;
  onEnterScoreManually: (match: TournamentMatch) => void;
  onSelectScorer: (match: TournamentMatch) => void;
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
      computeStandings(
        approvedTeams.filter((t) => t.pool_id === poolId).map((t) => ({ id: t.id, name: t.name })),
        groupMatches.filter((m) => m.pool_id === poolId)
      );

    let qualifiers: { id: string; name: string }[];
    if (pools.length === 2) {
      const standingsA = poolStandings(pools[0].id);
      const standingsB = poolStandings(pools[1].id);
      qualifiers =
        standingsA.length >= 2 && standingsB.length >= 2
          ? [
              { id: standingsA[0].teamId, name: standingsA[0].name },
              { id: standingsB[1].teamId, name: standingsB[1].name },
              { id: standingsB[0].teamId, name: standingsB[0].name },
              { id: standingsA[1].teamId, name: standingsA[1].name },
            ]
          : [];
    } else {
      qualifiers = pools
        .map((p) => poolStandings(p.id)[0])
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({ id: s.teamId, name: s.name }));
    }

    if (qualifiers.length < 2) return null;

    return (
      <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
        <CardHeader
          icon="trophy-outline"
          title="Playoffs"
          subtitle={`Every group is done — generate the ${knockoutRoundLabel(qualifiers.length).toLowerCase()}${qualifiers.length > 2 ? "s" : ""} from the group standings`}
        />
        {isHost && (
          <Pressable
            onPress={() => generateNextRound.mutate({ round: 2, teams: qualifiers })}
            disabled={generateNextRound.isPending}
            className="flex-row items-center justify-center bg-primary rounded-full py-3"
            style={{ gap: 8 }}
          >
            {generateNextRound.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="trophy-outline" size={16} color="white" />
                <Text className="text-white text-sm font-bold">
                  Generate {knockoutRoundLabel(qualifiers.length)}{qualifiers.length > 2 ? "s" : ""}
                </Text>
              </>
            )}
          </Pressable>
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

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-white p-4" style={cardShadow}>
      <CardHeader icon="trophy-outline" title="Playoffs" />
      {rounds.map((round, idx) => {
        const roundMatches = playoffMatches.filter((m) => m.round === round);
        return (
          <View key={round} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">
              {roundLabel("KNOCKOUT", round, roundMatches)}
            </Text>
            <View style={{ gap: 8 }}>
              {roundMatches.map((m, mi) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  matchNumber={mi + 1}
                  isEligible={isVenueBooked && !!m.team_a && !!m.team_b}
                  isHost={isHost}
                  isAssignedScorer={!!currentUserId && m.scorer_user_id === currentUserId}
                  scorerName={getScorerName(m)}
                  onGoToScorecard={() => onGoToScorecard(m)}
                  onEnterScoreManually={() => onEnterScoreManually(m)}
                  onSelectScorer={() => onSelectScorer(m)}
                />
              ))}
            </View>
          </View>
        );
      })}

      {isHost && canAdvanceBracket && bracketWinners && (
        <Pressable
          onPress={() => generateNextRound.mutate({ round: latestRound + 1, teams: bracketWinners })}
          disabled={generateNextRound.isPending}
          className="flex-row items-center justify-center bg-primary rounded-full py-3 mt-4"
          style={{ gap: 8 }}
        >
          {generateNextRound.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="git-network-outline" size={16} color="white" />
              <Text className="text-white text-sm font-bold">
                Generate {knockoutRoundLabel(bracketWinners.length)} Matches
              </Text>
            </>
          )}
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

  const { data: game, isLoading: gameLoading } = useGameDetail(params.gameId);
  const { data: teamsData, isLoading: teamsLoading } = useTournamentTeams(params.gameId);
  const { data: matches } = useTournamentMatches(params.gameId);
  const { data: pools } = useTournamentPools(params.gameId);
  const setMatchScorer = useSetMatchScorer(params.gameId);
  const [scorerModalMatchId, setScorerModalMatchId] = useState<string | null>(null);

  if (gameLoading || teamsLoading || !game) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isHost = game.creator_id === userId;
  const sportIconInfo = game.sports?.name ? getSportIcon(game.sports.name) : null;
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
  const isVenueBooked = game.venue_id ? !!game.booking_id : !!game.custom_venue_name;

  const rosterByTeamId = new Map<string, string[]>();
  for (const t of teams) {
    rosterByTeamId.set(
      t.id,
      t.tournament_team_members
        .filter((m) => m.status === "JOINED")
        .map((m) => m.profiles?.full_name ?? "Player")
    );
  }

  // Every joined member across every active team — the pool the host picks
  // a match's scorer from (not just the two teams playing that match, per
  // spec: "all the members of tournament will show in drop down list").
  const scorerCandidates: ScorerCandidate[] = activeTeams.flatMap((t) =>
    t.tournament_team_members
      .filter((m) => m.status === "JOINED" && m.user_id)
      .map((m) => ({ id: m.user_id, name: m.profiles?.full_name ?? "Player", teamName: t.name }))
  );
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
    return {
      tournamentMatchId: match.id,
      gameId: params.gameId,
      teamAName: match.team_a.name,
      teamBName: match.team_b.name,
      teamAPlayers: rosterByTeamId.get(match.team_a.id) ?? [],
      teamBPlayers: rosterByTeamId.get(match.team_b.id) ?? [],
      venue: game.venues?.name ?? game.custom_venue_name ?? undefined,
    };
  };

  // A draw is only a valid result in a league's group stage / a pool's group
  // matches — every bracket match needs a winner.
  const handleEnterScoreManually = (match: TournamentMatch) => {
    const prefill = buildPrefill(match);
    const manualSport = manualSportForName(sportName);
    if (!prefill || !manualSport) return;
    const allowDraw = !!match.pool_id || (game.tournament_format === "LEAGUE" && match.round === 1);
    navigation.navigate("ManualScore", { sport: manualSport, allowDraw, prefill });
  };

  const handleGoToScorecard = (match: TournamentMatch) => {
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
      {/* Decorative sport watermark, behind everything on the page. */}
      {sportIconInfo && (
        <>
          <MaterialCommunityIcons
            name={sportIconInfo.icon}
            size={220}
            color={colors.primary}
            style={{ position: "absolute", right: -50, top: -10, opacity: 0.1, transform: [{ rotate: "12deg" }] }}
            pointerEvents="none"
          />
          <MaterialCommunityIcons
            name={sportIconInfo.icon}
            size={170}
            color={colors.primary}
            style={{ position: "absolute", right: 20, bottom: 90, opacity: 0.08, transform: [{ rotate: "-18deg" }] }}
            pointerEvents="none"
          />
        </>
      )}

      <View className="flex-row items-center px-4" style={{ paddingTop: insets.top + 16, paddingBottom: 16, gap: 12 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          className="items-center justify-center bg-white rounded-full"
          style={{ width: 44, height: 44, ...cardShadow }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 21 }} numberOfLines={1}>
          Matches · {game.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {isPoolFormat ? (
          <>
            <GroupsPanel
              gameId={game.id}
              pools={pools ?? []}
              approvedTeams={approvedTeamsFull}
              requiredTeams={requiredTeams}
              isHost={isHost}
            />
            <PoolMatchesPanel
              gameId={game.id}
              pools={pools ?? []}
              approvedTeams={approvedTeamsFull}
              requiredTeams={requiredTeams}
              isHost={isHost}
              isVenueBooked={isVenueBooked}
              currentUserId={userId}
              getScorerName={getScorerName}
              onGoToScorecard={handleGoToScorecard}
              onEnterScoreManually={handleEnterScoreManually}
              onSelectScorer={(match) => setScorerModalMatchId(match.id)}
            />
            {matches &&
              (pools ?? []).map((pool) => {
                const teamsInPool = approvedTeamsFull
                  .filter((t) => t.pool_id === pool.id)
                  .map((t) => ({ id: t.id, name: t.name }));
                const poolMatches = matches.filter((m) => m.pool_id === pool.id);
                return (
                  <StandingsPanel
                    key={pool.id}
                    teams={teamsInPool}
                    matches={poolMatches}
                    label={`${pool.name} Standings`}
                  />
                );
              })}
            <PoolPlayoffPanel
              gameId={game.id}
              pools={pools ?? []}
              approvedTeams={approvedTeamsFull}
              requiredTeams={requiredTeams}
              isHost={isHost}
              isVenueBooked={isVenueBooked}
              currentUserId={userId}
              getScorerName={getScorerName}
              onGoToScorecard={handleGoToScorecard}
              onEnterScoreManually={handleEnterScoreManually}
              onSelectScorer={(match) => setScorerModalMatchId(match.id)}
            />
          </>
        ) : (
          <>
            {/* Before matches exist: a computed preview of who plays whom, from
                whichever teams are currently active. Once the host generates real
                matches (only possible once every team slot is APPROVED), that
                preview is replaced by the persisted, result-entry version below —
                so there's never a redundant/conflicting fixtures list on screen. */}
            {game.tournament_format && !hasMatches && (
              <FixturesPanel format={game.tournament_format} teams={activeTeams.map((t) => ({ name: t.name, status: t.status }))} />
            )}
            {game.tournament_format && (
              <MatchesPanel
                gameId={game.id}
                format={game.tournament_format}
                approvedTeams={approvedTeams}
                requiredTeams={requiredTeams}
                isHost={isHost}
                isVenueBooked={isVenueBooked}
                currentUserId={userId}
                getScorerName={getScorerName}
                onGoToScorecard={handleGoToScorecard}
                onEnterScoreManually={handleEnterScoreManually}
                onSelectScorer={(match) => setScorerModalMatchId(match.id)}
              />
            )}
            {game.tournament_format === "LEAGUE" && matches && (
              <StandingsPanel teams={approvedTeams} matches={matches} />
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
    </View>
  );
}
