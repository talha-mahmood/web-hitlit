import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useGameDetail } from "../../hooks/useGames";
import { useTournamentTeams } from "../../hooks/useTournamentTeams";
import {
  useTournamentMatches,
  useGenerateMatches,
  useGenerateNextRound,
  useGeneratePoolMatches,
  useEnterMatchResult,
  useResetMatchResult,
} from "../../hooks/useTournamentMatches";
import { useTournamentPools, useAssignTeamToPool } from "../../hooks/useTournamentPools";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";
import type { TournamentMatch } from "../../lib/api/tournamentMatches";
import type { TournamentPool } from "../../lib/api/tournamentPools";
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

function FixturesPanel({
  format,
  teamNames,
}: {
  format: Database["public"]["Enums"]["tournament_format_type"];
  teamNames: string[];
}) {
  const fixtures = computeFixtures(format, teamNames);
  if (fixtures.length === 0) return null;
  return (
    <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-ink font-semibold text-sm">Fixtures</Text>
        <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
          <Text className="text-indigo-700 text-xs font-medium">{TOURNAMENT_FORMAT_LABEL[format]}</Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {fixtures.map((f, i) => (
          <View key={i} className="flex-row items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
            <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{f.teamA}</Text>
            <Text className="text-muted text-xs mx-2">vs</Text>
            <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>
              {f.teamB ?? "Bye"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MatchRow({
  match,
  allowDraw,
  isHost,
  disabled,
  onEnterResult,
  onReset,
}: {
  match: TournamentMatch;
  allowDraw: boolean;
  isHost: boolean;
  disabled: boolean;
  onEnterResult: (matchId: string, winnerTeamId: string | null, isDraw: boolean, label: string) => void;
  onReset: (matchId: string) => void;
}) {
  const teamAName = match.team_a?.name ?? "TBD";
  const teamBName = match.team_b?.name ?? "Bye";

  if (match.status === "COMPLETED") {
    const resultLabel = match.is_draw
      ? "Draw"
      : match.winner_team
        ? `${match.winner_team.name} won`
        : match.team_b
          ? "—"
          : `${teamAName} advances`; // a bye, auto-completed at generation
    return (
      <View className="bg-gray-50 rounded-xl px-3 py-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{teamAName}</Text>
          <Text className="text-muted text-xs mx-2">vs</Text>
          <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
        </View>
        <View className="flex-row items-center justify-between mt-1.5">
          <Text className="text-primary text-xs font-semibold">{resultLabel}</Text>
          {isHost && match.team_b && (
            <Pressable onPress={() => onReset(match.id)} disabled={disabled} hitSlop={8}>
              <Text className="text-muted text-xs font-medium">Edit</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="bg-gray-50 rounded-xl px-3 py-2.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{teamAName}</Text>
        <Text className="text-muted text-xs mx-2">vs</Text>
        <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
      </View>
      {isHost && match.team_a && match.team_b && (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
          <Pressable
            onPress={() => onEnterResult(match.id, match.team_a!.id, false, `${teamAName} won`)}
            disabled={disabled}
            className="border border-primary rounded-lg px-2.5 py-1.5"
          >
            <Text className="text-primary text-xs font-semibold" numberOfLines={1}>{teamAName} Won</Text>
          </Pressable>
          <Pressable
            onPress={() => onEnterResult(match.id, match.team_b!.id, false, `${teamBName} won`)}
            disabled={disabled}
            className="border border-primary rounded-lg px-2.5 py-1.5"
          >
            <Text className="text-primary text-xs font-semibold" numberOfLines={1}>{teamBName} Won</Text>
          </Pressable>
          {allowDraw && (
            <Pressable
              onPress={() => onEnterResult(match.id, null, true, "Draw")}
              disabled={disabled}
              className="border border-border rounded-lg px-2.5 py-1.5"
            >
              <Text className="text-muted text-xs font-semibold">Draw</Text>
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
}: {
  gameId: string;
  format: Database["public"]["Enums"]["tournament_format_type"];
  approvedTeams: { id: string; name: string }[];
  requiredTeams: number;
  isHost: boolean;
}) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generateMatches = useGenerateMatches(gameId);
  const generateNextRound = useGenerateNextRound(gameId);
  const enterResult = useEnterMatchResult(gameId);
  const resetResult = useResetMatchResult(gameId);

  if (isLoading) return null;

  const hasMatches = (matches?.length ?? 0) > 0;
  const canGenerate = requiredTeams > 0 && approvedTeams.length === requiredTeams;

  const handleEnterResult = (matchId: string, winnerTeamId: string | null, isDraw: boolean, label: string) => {
    Alert.alert("Enter Result", `Record "${label}"? You can edit this later if needed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () =>
          enterResult.mutate(
            { matchId, winnerTeamId, isDraw },
            { onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not save result.") }
          ),
      },
    ]);
  };

  const handleReset = (matchId: string) => {
    Alert.alert("Edit Result", "Clear this result so you can re-enter it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () =>
          resetResult.mutate(matchId, {
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not clear result."),
          }),
      },
    ]);
  };

  if (!hasMatches) {
    if (!isHost) return null;
    return (
      <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
        <Text className="text-ink font-semibold text-sm mb-1">Matches</Text>
        {canGenerate ? (
          <>
            <Text className="text-muted text-xs mb-3">
              All {requiredTeams} teams are approved — generate the matchups so you can start entering results.
            </Text>
            <Pressable
              onPress={() => generateMatches.mutate({ format, teams: approvedTeams })}
              disabled={generateMatches.isPending}
              className="bg-primary rounded-lg py-2.5 items-center"
            >
              {generateMatches.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-xs font-semibold">Generate Matches</Text>
              )}
            </Pressable>
          </>
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

  const disabled = enterResult.isPending || resetResult.isPending || generateNextRound.isPending;

  return (
    <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-ink font-semibold text-sm">Matches</Text>
        <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
          <Text className="text-indigo-700 text-xs font-medium">{TOURNAMENT_FORMAT_LABEL[format]}</Text>
        </View>
      </View>

      {rounds.map((round, idx) => {
        const roundMatches = allMatches.filter((m) => m.round === round);
        const allowDraw = format === "LEAGUE" && round === 1;
        return (
          <View key={round} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">
              {roundLabel(format, round, roundMatches)}
            </Text>
            <View style={{ gap: 8 }}>
              {roundMatches.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  allowDraw={allowDraw}
                  isHost={isHost}
                  disabled={disabled}
                  onEnterResult={handleEnterResult}
                  onReset={handleReset}
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
          className="bg-primary rounded-lg py-2.5 items-center mt-4"
        >
          {generateNextRound.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white text-xs font-semibold">
              Generate {knockoutRoundLabel(bracketWinners.length)} Matches
            </Text>
          )}
        </Pressable>
      )}

      {isHost && isGroupStageComplete && playoffTeams.length >= 2 && (
        <Pressable
          onPress={() => generateNextRound.mutate({ round: 2, teams: playoffTeams })}
          disabled={generateNextRound.isPending}
          className="bg-primary rounded-lg py-2.5 items-center mt-4"
        >
          {generateNextRound.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white text-xs font-semibold">
              Generate {knockoutRoundLabel(playoffTeams.length)} Playoffs (Top {playoffTeams.length})
            </Text>
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
    <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
      <Text className="text-ink font-semibold text-sm mb-3">{label}</Text>
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
            { onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not assign team.") }
          ),
      },
    ]);
  };

  return (
    <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
      <Text className="text-ink font-semibold text-sm mb-3">Groups</Text>
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
}: {
  gameId: string;
  pools: TournamentPool[];
  approvedTeams: TournamentTeam[];
  requiredTeams: number;
  isHost: boolean;
}) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generatePoolMatches = useGeneratePoolMatches(gameId);
  const enterResult = useEnterMatchResult(gameId);
  const resetResult = useResetMatchResult(gameId);

  if (isLoading) return null;

  const allMatches = matches ?? [];
  const hasMatches = allMatches.length > 0;
  const unassigned = approvedTeams.filter((t) => !t.pool_id);
  // Full roster required, not just "no unassigned" — otherwise matches
  // could be generated while teams are still joining, leaving a group
  // permanently short once the rest of the roster fills in.
  const canGenerate =
    pools.length > 0 && requiredTeams > 0 && approvedTeams.length === requiredTeams && unassigned.length === 0;

  const handleEnterResult = (matchId: string, winnerTeamId: string | null, isDraw: boolean, label: string) => {
    Alert.alert("Enter Result", `Record "${label}"? You can edit this later if needed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () =>
          enterResult.mutate(
            { matchId, winnerTeamId, isDraw },
            { onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not save result.") }
          ),
      },
    ]);
  };

  const handleReset = (matchId: string) => {
    Alert.alert("Edit Result", "Clear this result so you can re-enter it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () =>
          resetResult.mutate(matchId, {
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not clear result."),
          }),
      },
    ]);
  };

  if (!hasMatches) {
    if (!isHost) return null;
    return (
      <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
        <Text className="text-ink font-semibold text-sm mb-1">Matches</Text>
        {canGenerate ? (
          <>
            <Text className="text-muted text-xs mb-3">
              Every approved team has a group — generate the group-stage matchups.
            </Text>
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
              className="bg-primary rounded-lg py-2.5 items-center"
            >
              {generatePoolMatches.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-xs font-semibold">Generate Group Matches</Text>
              )}
            </Pressable>
          </>
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

  const disabled = enterResult.isPending || resetResult.isPending;

  return (
    <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-ink font-semibold text-sm">Matches</Text>
        <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
          <Text className="text-indigo-700 text-xs font-medium">Pool</Text>
        </View>
      </View>
      {pools.map((pool, idx) => {
        const poolMatches = allMatches.filter((m) => m.pool_id === pool.id);
        if (poolMatches.length === 0) return null;
        return (
          <View key={pool.id} className={idx > 0 ? "mt-4" : undefined}>
            <Text className="text-ink text-xs font-semibold mb-2">{pool.name}</Text>
            <View style={{ gap: 8 }}>
              {poolMatches.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  allowDraw
                  isHost={isHost}
                  disabled={disabled}
                  onEnterResult={handleEnterResult}
                  onReset={handleReset}
                />
              ))}
            </View>
          </View>
        );
      })}
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

  if (gameLoading || teamsLoading || !game) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isHost = game.creator_id === userId;
  const teams = teamsData ?? [];
  const approvedTeamsFull = teams.filter((t) => t.status === "APPROVED");
  const approvedTeams = approvedTeamsFull.map((t) => ({ id: t.id, name: t.name }));
  const activeTeams = teams.filter((t) => t.status !== "REJECTED");
  const requiredTeams = game.number_of_teams ?? 0;
  const hasMatches = (matches?.length ?? 0) > 0;
  const isPoolFormat = game.tournament_format === "POOL";

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border bg-white"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
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
          </>
        ) : (
          <>
            {/* Before matches exist: a computed preview of who plays whom, from
                whichever teams are currently active. Once the host generates real
                matches (only possible once every team slot is APPROVED), that
                preview is replaced by the persisted, result-entry version below —
                so there's never a redundant/conflicting fixtures list on screen. */}
            {game.tournament_format && !hasMatches && (
              <FixturesPanel format={game.tournament_format} teamNames={activeTeams.map((t) => t.name)} />
            )}
            {game.tournament_format && (
              <MatchesPanel
                gameId={game.id}
                format={game.tournament_format}
                approvedTeams={approvedTeams}
                requiredTeams={requiredTeams}
                isHost={isHost}
              />
            )}
            {game.tournament_format === "LEAGUE" && matches && (
              <StandingsPanel teams={approvedTeams} matches={matches} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
