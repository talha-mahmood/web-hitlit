import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import {
  useTableTennisMatch,
  useAddTableTennisRally,
  useDeleteLastTableTennisRally,
  useCompleteTableTennisMatch,
  useTableTennisPendingCount,
} from "../../hooks/useTableTennis";
import { useNetworkStore } from "../../store/networkStore";
import { friendlyTableTennisError, rallyRowToEvent } from "../../lib/api/tableTennis";
import { useSyncScorecardMatchResult } from "../../hooks/useTournamentMatches";
import {
  replayTableTennisMatch,
  matchResultSummary,
  type TableTennisMatchConfig,
  type Team,
  type Indicator,
} from "../../lib/tableTennisScoring";
import { getSportImage } from "../../lib/sportImages";
import TeamCrest from "../../components/TeamCrest";
import GradientFill from "../../components/GradientFill";
import GradientActionButton from "../../components/GradientActionButton";
import OutlineActionButton from "../../components/OutlineActionButton";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import ScoringCodeBadge from "../../components/ScoringCodeBadge";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import { uniqueChannelName } from "../../lib/realtimeChannel";
import { useProfileStore } from "../../store/profileStore";
import { buildGenericMatchReportHtml } from "../../lib/matchReport/genericMatchReport";
import { generateAndShareMatchReport } from "../../lib/matchReport/pdfShare";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Route = RouteProp<ScorecardStackParamList, "TableTennisLiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "TableTennisLiveScoring">;

const INDICATOR_LABEL: Record<Exclude<Indicator, null>, string> = {
  GAME_POINT: "GAME POINT",
  MATCH_POINT: "MATCH POINT",
  DEUCE: "DEUCE",
};

// Small avatar circle (player initial) used on the team header cards — the
// app only stores player names as free text for these matches (no linked
// profile/avatar), so an initial-in-a-circle is the closest honest stand-in
// for a photo.
function PlayerAvatar({ name, color, bg }: { name: string; color: string; bg: string }) {
  return (
    <View className="items-center justify-center rounded-full" style={{ width: 22, height: 22, backgroundColor: bg }}>
      <Text className="font-bold" style={{ fontSize: 10, color }}>
        {(name.trim().charAt(0) || "?").toUpperCase()}
      </Text>
    </View>
  );
}

function DotGridCorner({ side }: { side: "left" | "right" }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 14,
        ...(side === "left" ? { left: 14 } : { right: 14 }),
        flexDirection: "row",
        flexWrap: "wrap",
        width: 32,
      }}
    >
      {Array.from({ length: 16 }).map((_, i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border, margin: 2 }} />
      ))}
    </View>
  );
}

function ScorePill({ value, color, bg }: { value: string | number; color: string; bg: string }) {
  return (
    <View
      className="items-center justify-center rounded-2xl"
      style={{ minWidth: 84, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: bg }}
    >
      <Text className="font-extrabold" style={{ fontSize: 32, color }}>
        {value}
      </Text>
    </View>
  );
}

export default function TableTennisLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const leaveScorecard = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("TableTennisHome"));
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useTableTennisMatch(params.matchId);
  // Anyone with the match's scoring code can open this screen to watch
  // (e.g. via "View Scoring"), but only the match's own creator should be
  // able to actually add points / undo / complete it.
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  const qc = useQueryClient();

  // Live push for every viewer (not just the scorer) — a rally the scorer
  // just added, or a match-level change, lands here instantly instead of
  // needing a manual refresh. Same pattern cricket's live scoring already
  // uses.
  useEffect(() => {
    if (!params.matchId) return;
    const channel = supabase
      .channel(uniqueChannelName(`tableTennisLiveScoring:${params.matchId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_tennis_matches", filter: `id=eq.${params.matchId}` },
        () => qc.invalidateQueries({ queryKey: ["tableTennisMatch", params.matchId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_tennis_rallies", filter: `match_id=eq.${params.matchId}` },
        () => qc.invalidateQueries({ queryKey: ["tableTennisMatch", params.matchId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.matchId, qc]);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingCount = useTableTennisPendingCount(params.matchId);
  const addRally = useAddTableTennisRally(params.matchId);
  const deleteLastRally = useDeleteLastTableTennisRally(params.matchId);
  const completeMatch = useCompleteTableTennisMatch();
  const syncTournamentResult = useSyncScorecardMatchResult();
  const profile = useProfileStore((s) => s.profile);
  const [generatingReport, setGeneratingReport] = useState(false);

  const rallies = useMemo(() => {
    if (!match) return [];
    return [...match.table_tennis_rallies].sort((a, b) => a.seq - b.seq).map(rallyRowToEvent);
  }, [match]);

  const config: TableTennisMatchConfig | null = match
    ? {
        playMode: match.play_mode as TableTennisMatchConfig["playMode"],
        firstServingTeam: match.first_serving_team as Team,
        firstServerIndex: match.first_server_index as 0 | 1,
        pointsToWin: match.points_to_win,
        gamesToWin: match.games_to_win,
      }
    : null;

  const state = useMemo(() => {
    if (!config) return null;
    return replayTableTennisMatch(rallies, config);
  }, [rallies, config]);

  // The moment the rally log itself decides the match, persist that result
  // — nothing further for the scorer to confirm.
  useEffect(() => {
    if (!match || !state) return;
    if (state.isComplete && state.winner && match.status === "IN_PROGRESS" && !completeMatch.isPending) {
      const summary = matchResultSummary(match.team_a_name, match.team_b_name, state);
      completeMatch.mutate(
        { matchId: match.id, winnerTeam: state.winner, resultSummary: summary },
        {
          onSuccess: () => {
            syncTournamentResult.mutate({ sport: "table_tennis", scorecardMatchId: match.id, teamAWon: state.winner === "A" });
          },
          onError: (err) => Alert.alert("Error", friendlyTableTennisError(err, "Could not save the match result.")),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  if (isLoading || !match || !state || !config) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isDoubles = config.playMode === "DOUBLES";
  const handleRally = (winner: Team) => {
    if (state.isComplete) return;
    const seq = rallies.length + 1;
    addRally.mutate(
      { seq, winner },
      { onError: (err) => Alert.alert("Error", friendlyTableTennisError(err, "Could not record rally.")) }
    );
  };

  const handleUndo = () => {
    if (rallies.length === 0) return;
    const last = rallies[rallies.length - 1];
    Alert.alert("Undo Last Point", "Remove the most recent point?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: () =>
          deleteLastRally.mutate(last.seq, {
            onError: (err) => Alert.alert("Error", friendlyTableTennisError(err, "Could not undo.")),
          }),
      },
    ]);
  };

  const teamAPlayerNames = match.team_a_players.length > 0 ? match.team_a_players : [match.team_a_name];
  const teamBPlayerNames = match.team_b_players.length > 0 ? match.team_b_players : [match.team_b_name];
  const servingTeamName = state.server.servingTeam === "A" ? match.team_a_name : match.team_b_name;
  const servingPlayerName = isDoubles
    ? (state.server.servingTeam === "A" ? teamAPlayerNames : teamBPlayerNames)[state.server.serverIndex] ?? servingTeamName
    : servingTeamName;
  const currentGame = state.games[state.games.length - 1];
  const tableTennisBgImage = getSportImage("table tennis");

  const handleGenerateMatchReport = async () => {
    setGeneratingReport(true);
    try {
      const html = buildGenericMatchReportHtml({
        sportLabel: "Table Tennis",
        teamAName: match.team_a_name,
        teamBName: match.team_b_name,
        finalScoreA: `${state.gamesWonA} games`,
        finalScoreB: `${state.gamesWonB} games`,
        resultSummary: match.result_summary,
        venue: match.venue,
        createdAt: match.created_at,
        playMode: isDoubles ? "Doubles" : "Singles",
        formatLabel: `Best of ${match.games_to_win * 2 - 1} games, ${match.points_to_win} points`,
        organiserName: profile?.full_name ?? "—",
        breakdownTitle: "Game-by-Game",
        breakdown: state.games.map((game, i) => ({
          label: `Game ${i + 1}`,
          scoreA: String(game.scoreA),
          scoreB: String(game.scoreB),
        })),
        appName: "HitLit",
      });
      await generateAndShareMatchReport(html);
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the match report."));
    } finally {
      setGeneratingReport(false);
    }
  };

  if (state.isComplete && state.winner) {
    const winnerName = state.winner === "A" ? match.team_a_name : match.team_b_name;
    return (
      <View className="flex-1 bg-app" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center px-4 pb-3" style={{ gap: 6 }}>
          <Pressable onPress={() => leaveScorecard()} hitSlop={8} className="p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-ink font-extrabold text-base" numberOfLines={1}>Match Complete</Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>Table Tennis</Text>
          </View>
          <Pressable onPress={handleGenerateMatchReport} disabled={generatingReport}>
            <GradientFill className="flex-row items-center rounded-full px-4 py-2.5" style={{ gap: 6 }}>
              {generatingReport ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="white" />
                  <Text className="text-jazba-white font-bold text-sm">Generate Match Report</Text>
                </>
              )}
            </GradientFill>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
          {/* Team crests + final score, with a winner ribbon */}
          <View className="bg-surface rounded-2xl mb-4 overflow-hidden" style={{ ...cardShadow, position: "relative" }}>
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
                <Ionicons name="trophy" size={15} color={colors.primaryDark} />
                <Text className="font-extrabold text-xs" style={{ color: colors.primaryDark, letterSpacing: 0.5 }}>
                  {winnerName.toUpperCase()} WINS
                </Text>
              </View>

              <View className="flex-row items-center justify-between w-full">
                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color={colors.primary} icon="table-tennis" />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_a_name}</Text>
                </View>

                <View className="items-center" style={{ flex: 1 }}>
                  <View className="flex-row items-center" style={{ gap: 16 }}>
                    <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{state.gamesWonA}</Text>
                    <Text className="text-muted font-bold" style={{ fontSize: 22 }}>-</Text>
                    <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{state.gamesWonB}</Text>
                  </View>
                  <View className="rounded-full px-3 py-1 mt-2 bg-gray-100">
                    <Text className="text-muted text-xs font-extrabold" style={{ letterSpacing: 0.5 }}>GAMES</Text>
                  </View>
                </View>

                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color="#1D4ED8" icon="table-tennis" />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_b_name}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Per-game breakdown */}
          <View className="bg-surface rounded-2xl p-4 mb-4" style={{ ...cardShadow, gap: 8 }}>
            {state.games.map((game, i) => (
              <View key={i} className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Ionicons name="time-outline" size={14} color={colors.muted} />
                  <Text className="text-muted text-xs font-bold" style={{ letterSpacing: 0.5 }}>GAME {i + 1}</Text>
                </View>
                <Text className="text-ink font-bold text-sm">
                  {game.scoreA} - {game.scoreB}
                </Text>
              </View>
            ))}
          </View>

          <Pressable onPress={() => leaveScorecard()} style={primaryButtonShadow}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16 }}
            >
              <Ionicons name="arrow-back-circle-outline" size={18} color="white" style={{ marginRight: 8 }} />
              <Text className="text-jazba-white font-bold text-base">Back to Matches</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-4 pb-3" style={{ gap: 8 }}>
        <Pressable onPress={() => leaveScorecard()} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-row items-center px-2.5 py-1 rounded-full bg-red-500" style={{ gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink }} />
          <Text className="text-jazba-white text-xs font-bold">LIVE</Text>
        </View>
        <View className="flex-1">
          <Text className="text-ink font-extrabold text-base" numberOfLines={1}>
            {match.team_a_name} vs {match.team_b_name}
          </Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            {isDoubles ? "Doubles" : "Singles"} · Table Tennis
          </Text>
        </View>
        <ScoringCodeBadge code={match.scoring_code} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        {(!isOnline || pendingCount > 0) && (
          <View
            className="flex-row items-center rounded-2xl px-3.5 py-2.5 mb-4"
            style={{ backgroundColor: isOnline ? colors.primaryLight : colors.warningLight, gap: 8 }}
          >
            <Ionicons
              name={isOnline ? "cloud-upload-outline" : "cloud-offline-outline"}
              size={16}
              color={isOnline ? colors.primaryDark : "#92400E"}
            />
            <Text className="flex-1 text-xs font-semibold" style={{ color: isOnline ? colors.primaryDark : "#92400E" }}>
              {isOnline
                ? `Syncing ${pendingCount} rally${pendingCount === 1 ? "" : "s"}…`
                : pendingCount > 0
                  ? `Offline — ${pendingCount} rally${pendingCount === 1 ? "" : "s"} saved, will sync when back online`
                  : "Offline — scoring is saved on this device and will sync when back online"}
            </Text>
          </View>
        )}

        {/* Team cards, with a "VS" badge overlapping both */}
        <View style={{ position: "relative", marginBottom: 16 }}>
          <View className="flex-row items-stretch" style={{ gap: 10 }}>
            <View
              className="flex-1 bg-app rounded-2xl overflow-hidden"
              style={{ ...cardShadow, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary }}
            >
              <View className="p-3">
                <Text className="text-ink font-extrabold text-base" numberOfLines={1}>{match.team_a_name}</Text>
                {isDoubles && (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {teamAPlayerNames.map((p, i) => (
                      <View key={i} className="flex-row items-center" style={{ gap: 6 }}>
                        <PlayerAvatar name={p} color={colors.primaryDark} bg={colors.primaryLight} />
                        <Text className="text-ink text-xs font-medium flex-1" numberOfLines={1}>{p}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View
              className="flex-1 bg-app rounded-2xl overflow-hidden"
              style={{ ...cardShadow, borderWidth: 1, borderColor: colors.border, borderRightWidth: 4, borderRightColor: "#1D4ED8" }}
            >
              <View className="p-3" style={{ alignItems: "flex-end" }}>
                <Text className="text-ink font-extrabold text-base text-right" numberOfLines={1}>{match.team_b_name}</Text>
                {isDoubles && (
                  <View style={{ gap: 6, marginTop: 8, alignItems: "flex-end" }}>
                    {teamBPlayerNames.map((p, i) => (
                      <View key={i} className="flex-row items-center" style={{ gap: 6 }}>
                        <Text className="text-ink text-xs font-medium" numberOfLines={1}>{p}</Text>
                        <PlayerAvatar name={p} color="#1D4ED8" bg="#DBEAFE" />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          <View
            className="items-center justify-center rounded-full bg-surface"
            style={{ position: "absolute", width: 40, height: 40, left: "50%", top: "50%", marginLeft: -20, marginTop: -20, ...cardShadow }}
          >
            <Text className="text-ink font-extrabold" style={{ fontSize: 12 }}>VS</Text>
          </View>
        </View>

        {/* Games won */}
        <View className="bg-surface rounded-2xl p-4 mb-4 items-center" style={{ ...cardShadow, position: "relative", overflow: "hidden" }}>
          <DotGridCorner side="left" />
          <DotGridCorner side="right" />
          <View className="flex-row items-center mb-1" style={{ gap: 5 }}>
            <Ionicons name="trophy" size={14} color={colors.warning} />
            <Text className="text-muted text-xs font-bold" style={{ letterSpacing: 0.5 }}>GAMES</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 24 }}>
            <Text className="text-ink font-extrabold" style={{ fontSize: 30 }}>{state.gamesWonA}</Text>
            <Text className="text-muted font-bold" style={{ fontSize: 18 }}>-</Text>
            <Text className="text-ink font-extrabold" style={{ fontSize: 30 }}>{state.gamesWonB}</Text>
          </View>
          <View className="rounded-full bg-gray-100 px-3 py-1 mt-2">
            <Text className="text-muted text-xs font-medium">
              First to {config.gamesToWin} game{config.gamesToWin === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {/* Per-game score table */}
        <View className="bg-surface rounded-2xl p-4 mb-4" style={cardShadow}>
          <View className="flex-row items-center mb-2 pb-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text className="text-ink font-bold text-sm" style={{ flex: 1.4 }}>GAME {state.games.length}</Text>
            {state.games.map((_, i) => (
              <Text key={i} className="text-muted text-xs font-semibold flex-1 text-center">{i + 1}</Text>
            ))}
          </View>
          <View className="flex-row items-center mb-1.5">
            <View className="flex-row items-center" style={{ flex: 1.4, gap: 6 }}>
              <GradientFill style={{ width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>{match.team_a_name}</Text>
            </View>
            {state.games.map((g, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{g.scoreA}</Text>
            ))}
          </View>
          <View className="flex-row items-center">
            <View className="flex-row items-center" style={{ flex: 1.4, gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#1D4ED8" }} />
              <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>{match.team_b_name}</Text>
            </View>
            {state.games.map((g, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{g.scoreB}</Text>
            ))}
          </View>
        </View>

        {/* Current game */}
        <View className="rounded-2xl mb-4 overflow-hidden" style={{ ...cardShadow, position: "relative" }}>
          {tableTennisBgImage && (
            <>
              <Image source={tableTennisBgImage} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" blurRadius={3} />
              <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(255,255,255,0.86)" }} />
            </>
          )}
          <View className="p-5 items-center">
            <Text className="text-muted text-xs font-bold mb-3" style={{ letterSpacing: 0.5 }}>CURRENT GAME</Text>
            <View className="flex-row items-center" style={{ gap: 16 }}>
              <ScorePill value={currentGame.scoreA} color={colors.primary} bg={colors.primaryLight} />
              <Text className="text-muted font-bold" style={{ fontSize: 20 }}>-</Text>
              <ScorePill value={currentGame.scoreB} color="#1D4ED8" bg="#DBEAFE" />
            </View>

            {state.indicator && (
              <View className="rounded-full px-3 py-1 mt-3" style={{ backgroundColor: colors.primaryLight }}>
                <Text className="text-xs font-extrabold" style={{ color: colors.primaryDark }}>
                  {INDICATOR_LABEL[state.indicator]}
                  {state.indicatorFor ? ` — ${state.indicatorFor === "A" ? match.team_a_name : match.team_b_name}` : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Server */}
        <View className="flex-row items-center bg-surface rounded-2xl px-4 py-3 mb-4" style={{ ...cardShadow, gap: 8 }}>
          <GradientFill style={{ width: 8, height: 8, borderRadius: 4 }} />
          <Text className="text-ink text-sm flex-1" numberOfLines={1}>
            <Text className="font-bold">SERVER: </Text>
            {servingPlayerName}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>

        {/* Rally history */}
        {rallies.length > 0 && (
          <View className="bg-surface rounded-2xl p-4 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-bold mb-2" style={{ letterSpacing: 0.5 }}>RALLY HISTORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row" style={{ gap: 8 }}>
                {rallies.map((r, i) => (
                  <View
                    key={i}
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: r.winner === "A" ? colors.primaryLight : "#DBEAFE",
                    }}
                  >
                    <Text
                      className="font-bold text-xs"
                      style={{ color: r.winner === "A" ? colors.primaryDark : "#1D4ED8" }}
                    >
                      {r.winner}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <View className="rounded-full bg-gray-100" style={{ height: 3, width: "40%", alignSelf: "center", marginTop: 12 }} />
          </View>
        )}

        {/* Scoring buttons — both dim and stop accepting taps the instant
            one is pressed, until that rally is actually reflected in the
            score. Only the match's own creator sees these — everyone else
            (e.g. someone who opened this via "View Scoring") is watch-only. */}
        {isScorer && (
        <View style={{ gap: 10 }}>
          <View pointerEvents={addRally.isPending ? "none" : "auto"} style={{ gap: 10 }}>
            <GradientActionButton
              onPress={() => handleRally("A")}
              colors={[colors.primary, colors.primaryDark]}
              icon="add"
              label={`${match.team_a_name} Point`}
              watermarkIcon="disc-outline"
              style={addRally.isPending ? undefined : primaryButtonShadow}
            />
            <GradientActionButton
              onPress={() => handleRally("B")}
              colors={["#2563EB", "#1D4ED8"]}
              icon="add"
              label={`${match.team_b_name} Point`}
              watermarkIcon="disc-outline"
              style={addRally.isPending ? undefined : primaryButtonShadow}
            />
          </View>

          <OutlineActionButton
            onPress={handleUndo}
            disabled={rallies.length === 0 || deleteLastRally.isPending}
            icon="arrow-undo-outline"
            label="Undo Last Point"
            style={{ marginTop: 2, opacity: rallies.length === 0 ? 0.5 : 1 }}
          />
        </View>
        )}
      </ScrollView>
    </View>
  );
}
