import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useTennisMatch, useAddTennisPoint, useDeleteLastTennisPoint, useCompleteTennisMatch , useTennisPendingCount } from "../../hooks/useTennis";
import { useNetworkStore } from "../../store/networkStore";
import { useSyncScorecardMatchResult } from "../../hooks/useTournamentMatches";
import { friendlyTennisError, pointRowToEvent } from "../../lib/api/tennis";
import { replayTennisMatch, formatSetScore, matchResultSummary, type TennisMatchConfig, type Player, type Indicator } from "../../lib/tennisScoring";
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

type Route = RouteProp<ScorecardStackParamList, "TennisLiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "TennisLiveScoring">;

const INDICATOR_LABEL: Record<Exclude<Indicator, null>, string> = {
  GAME_POINT: "GAME POINT",
  BREAK_POINT: "BREAK POINT",
  SET_POINT: "SET POINT",
  MATCH_POINT: "MATCH POINT",
};

// Small avatar circle (player initial) used on the player header cards — the
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

// Faint decorative dot grid for a card corner (SETS card background flair).
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

// A single player's live game-point value as a colored pill instead of
// plain centered text.
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

export default function TennisLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  // Goes back to wherever the scorer came from — the sport's match list in
  // the Scorecard tab, or a tournament's match list when started from
  // "Go To Scorecard" (that route doesn't exist in the other tab stacks).
  const leaveScorecard = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("TennisHome"));
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useTennisMatch(params.matchId);
  // Anyone with the match's scoring code can open this screen to watch
  // (e.g. via "View Scoring"), but only the match's own creator should be
  // able to actually add points / undo / complete it.
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  const qc = useQueryClient();

  // Live push for every viewer (not just the scorer) — a point the scorer
  // just added, or a match-level change, lands here instantly instead of
  // needing a manual refresh. Same pattern cricket's live scoring already
  // uses.
  useEffect(() => {
    if (!params.matchId) return;
    const channel = supabase
      .channel(uniqueChannelName(`tennisLiveScoring:${params.matchId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tennis_matches", filter: `id=eq.${params.matchId}` },
        () => qc.invalidateQueries({ queryKey: ["tennisMatch", params.matchId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tennis_points", filter: `match_id=eq.${params.matchId}` },
        () => qc.invalidateQueries({ queryKey: ["tennisMatch", params.matchId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.matchId, qc]);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingCount = useTennisPendingCount(params.matchId);
  const addPoint = useAddTennisPoint(params.matchId);
  const deleteLastPoint = useDeleteLastTennisPoint(params.matchId);
  const completeMatch = useCompleteTennisMatch();
  const syncTournamentResult = useSyncScorecardMatchResult();
  const profile = useProfileStore((s) => s.profile);
  const [generatingReport, setGeneratingReport] = useState(false);

  const points = useMemo(() => {
    if (!match) return [];
    return [...match.tennis_points].sort((a, b) => a.seq - b.seq).map(pointRowToEvent);
  }, [match]);

  const config: TennisMatchConfig | null = match
    ? {
        format: match.format as TennisMatchConfig["format"],
        firstServer: match.first_server as Player,
        gamesPerSet: match.games_per_set,
        playMode: match.play_mode as TennisMatchConfig["playMode"],
        playerAServerIndex: match.player_a_server_index as 0 | 1,
        playerBServerIndex: match.player_b_server_index as 0 | 1,
      }
    : null;

  const state = useMemo(() => {
    if (!config) return null;
    return replayTennisMatch(points, config);
  }, [points, config]);

  // The moment the point log itself decides the match, persist that result
  // — nothing further for the scorer to confirm.
  useEffect(() => {
    if (!match || !state) return;
    if (state.isComplete && state.winner && match.status === "IN_PROGRESS" && !completeMatch.isPending) {
      const summary = matchResultSummary(match.player_a_name, match.player_b_name, state);
      completeMatch.mutate(
        { matchId: match.id, winnerPlayer: state.winner, resultSummary: summary },
        {
          onSuccess: () => {
            syncTournamentResult.mutate({ sport: "tennis", scorecardMatchId: match.id, teamAWon: state.winner === "A" });
          },
          onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not save the match result.")),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  if (isLoading || !match || !state) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const handlePoint = (winner: Player) => {
    if (state.isComplete) return;
    const seq = points.length + 1;
    addPoint.mutate(
      { seq, winner },
      { onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not record point.")) }
    );
  };

  const handleUndo = () => {
    if (points.length === 0) return;
    const last = points[points.length - 1];
    Alert.alert("Undo Last Point", "Remove the most recent point?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: () =>
          deleteLastPoint.mutate(last.seq, {
            onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not undo.")),
          }),
      },
    ]);
  };

  const isDoubles = match.play_mode === "DOUBLES";
  const playerAPlayerNames = match.player_a_players.length > 0 ? match.player_a_players : ["Player A1", "Player A2"];
  const playerBPlayerNames = match.player_b_players.length > 0 ? match.player_b_players : ["Player B1", "Player B2"];
  const serverName = isDoubles
    ? state.server.player === "A"
      ? `${playerAPlayerNames[state.server.playerIndex] ?? playerAPlayerNames[0]} (${match.player_a_name})`
      : `${playerBPlayerNames[state.server.playerIndex] ?? playerBPlayerNames[0]} (${match.player_b_name})`
    : state.server.player === "A"
      ? match.player_a_name
      : match.player_b_name;
  // The plain-number game score ("40 - 30") gets split into two colored
  // pills; DEUCE/ADVANTAGE/etc. stay as a single centered label.
  const plainScoreMatch = /^(\S+) - (\S+)$/.exec(state.currentGame.display);
  const plainScoreParts = plainScoreMatch ? ([plainScoreMatch[1], plainScoreMatch[2]] as const) : null;
  const tennisBgImage = getSportImage("tennis");

  const handleGenerateMatchReport = async () => {
    setGeneratingReport(true);
    try {
      const html = buildGenericMatchReportHtml({
        sportLabel: "Tennis",
        teamAName: match.player_a_name,
        teamBName: match.player_b_name,
        finalScoreA: `${state.setsWonA} sets`,
        finalScoreB: `${state.setsWonB} sets`,
        resultSummary: match.result_summary,
        venue: match.venue,
        createdAt: match.created_at,
        playMode: match.play_mode === "DOUBLES" ? "Doubles" : "Singles",
        formatLabel: `${match.format === "BEST_OF_3" ? "Best of 3" : match.format} sets`,
        organiserName: profile?.full_name ?? "—",
        breakdownTitle: "Set-by-Set",
        breakdown: state.sets.map((set, i) => ({
          label: `Set ${i + 1}`,
          scoreA: formatSetScore(set, "A"),
          scoreB: formatSetScore(set, "B"),
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
    const winnerName = state.winner === "A" ? match.player_a_name : match.player_b_name;
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center px-4 pb-3" style={{ gap: 6 }}>
          <Pressable onPress={() => leaveScorecard()} hitSlop={8} className="p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-ink font-extrabold text-base" numberOfLines={1}>Match Complete</Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>Tennis</Text>
          </View>
          <Pressable onPress={handleGenerateMatchReport} disabled={generatingReport}>
            <GradientFill className="flex-row items-center rounded-full px-4 py-2.5" style={{ gap: 6 }}>
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
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
          {/* Player crests + final score, with a winner ribbon */}
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
                <Ionicons name="trophy" size={15} color={colors.primaryDark} />
                <Text className="font-extrabold text-xs" style={{ color: colors.primaryDark, letterSpacing: 0.5 }}>
                  {winnerName.toUpperCase()} WINS
                </Text>
              </View>

              <View className="flex-row items-center justify-between w-full">
                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color={colors.primary} icon="tennis" />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.player_a_name}</Text>
                </View>

                <View className="items-center" style={{ flex: 1 }}>
                  <View className="flex-row items-center" style={{ gap: 16 }}>
                    <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{state.setsWonA}</Text>
                    <Text className="text-muted font-bold" style={{ fontSize: 22 }}>-</Text>
                    <Text className="text-ink font-extrabold" style={{ fontSize: 42 }}>{state.setsWonB}</Text>
                  </View>
                  <View className="rounded-full px-3 py-1 mt-2 bg-gray-100">
                    <Text className="text-muted text-xs font-extrabold" style={{ letterSpacing: 0.5 }}>SETS</Text>
                  </View>
                </View>

                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color="#1D4ED8" icon="tennis" />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.player_b_name}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Per-set breakdown */}
          <View className="bg-white rounded-2xl p-4 mb-4" style={{ ...cardShadow, gap: 8 }}>
            {state.sets.map((set, i) => (
              <View key={i} className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Ionicons name="time-outline" size={14} color={colors.muted} />
                  <Text className="text-muted text-xs font-bold" style={{ letterSpacing: 0.5 }}>SET {i + 1}</Text>
                </View>
                <Text className="text-ink font-bold text-sm">
                  {formatSetScore(set, "A")} - {formatSetScore(set, "B")}
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
              <Text className="text-white font-bold text-base">Back to Matches</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
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
            {match.player_a_name} vs {match.player_b_name}
          </Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            {isDoubles ? "Doubles" : "Singles"} · Tennis
          </Text>
        </View>
        <ScoringCodeBadge code={match.scoring_code} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        {(!isOnline || pendingCount > 0) && (
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
                ? `Syncing ${pendingCount} point${pendingCount === 1 ? "" : "s"}…`
                : pendingCount > 0
                  ? `Offline — ${pendingCount} point${pendingCount === 1 ? "" : "s"} saved, will sync when back online`
                  : "Offline — scoring is saved on this device and will sync when back online"}
            </Text>
          </View>
        )}

        {/* Player cards, with a "VS" badge overlapping both */}
        <View style={{ position: "relative", marginBottom: 16 }}>
          <View className="flex-row items-stretch" style={{ gap: 10 }}>
            <View
              className="flex-1 bg-white rounded-2xl overflow-hidden"
              style={{ ...cardShadow, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary }}
            >
              <View className="p-3">
                <Text className="text-ink font-extrabold text-base" numberOfLines={1}>{match.player_a_name}</Text>
                {isDoubles && (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {playerAPlayerNames.map((p, i) => (
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
              className="flex-1 bg-white rounded-2xl overflow-hidden"
              style={{ ...cardShadow, borderWidth: 1, borderColor: colors.border, borderRightWidth: 4, borderRightColor: "#1D4ED8" }}
            >
              <View className="p-3" style={{ alignItems: "flex-end" }}>
                <Text className="text-ink font-extrabold text-base text-right" numberOfLines={1}>{match.player_b_name}</Text>
                {isDoubles && (
                  <View style={{ gap: 6, marginTop: 8, alignItems: "flex-end" }}>
                    {playerBPlayerNames.map((p, i) => (
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
            className="items-center justify-center rounded-full bg-white"
            style={{ position: "absolute", width: 40, height: 40, left: "50%", top: "50%", marginLeft: -20, marginTop: -20, ...cardShadow }}
          >
            <Text className="text-ink font-extrabold" style={{ fontSize: 12 }}>VS</Text>
          </View>
        </View>

        {/* Sets won */}
        <View className="bg-white rounded-2xl p-4 mb-4 items-center" style={{ ...cardShadow, position: "relative", overflow: "hidden" }}>
          <DotGridCorner side="left" />
          <DotGridCorner side="right" />
          <View className="flex-row items-center mb-1" style={{ gap: 5 }}>
            <Ionicons name="trophy" size={14} color={colors.warning} />
            <Text className="text-muted text-xs font-bold" style={{ letterSpacing: 0.5 }}>SETS</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 24 }}>
            <Text className="text-ink font-extrabold" style={{ fontSize: 30 }}>{state.setsWonA}</Text>
            <Text className="text-muted font-bold" style={{ fontSize: 18 }}>-</Text>
            <Text className="text-ink font-extrabold" style={{ fontSize: 30 }}>{state.setsWonB}</Text>
          </View>
          <View className="rounded-full bg-gray-100 px-3 py-1 mt-2">
            <Text className="text-muted text-xs font-medium">
              First to {state.setsToWin} set{state.setsToWin === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {/* Per-set score table */}
        <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
          <View className="flex-row items-center mb-2 pb-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text className="text-ink font-bold text-sm" style={{ flex: 1.4 }}>SET {state.sets.length}</Text>
            {state.sets.map((_, i) => (
              <Text key={i} className="text-muted text-xs font-semibold flex-1 text-center">{i + 1}</Text>
            ))}
          </View>
          <View className="flex-row items-center mb-1.5">
            <View className="flex-row items-center" style={{ flex: 1.4, gap: 6 }}>
              <GradientFill style={{ width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>{match.player_a_name}</Text>
            </View>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "A")}</Text>
            ))}
          </View>
          <View className="flex-row items-center">
            <View className="flex-row items-center" style={{ flex: 1.4, gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#1D4ED8" }} />
              <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>{match.player_b_name}</Text>
            </View>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "B")}</Text>
            ))}
          </View>
        </View>

        {/* Current game / tiebreak */}
        <View className="rounded-2xl mb-4 overflow-hidden" style={{ ...cardShadow, position: "relative" }}>
          {tennisBgImage && (
            <>
              <Image source={tennisBgImage} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" blurRadius={3} />
              <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(255,255,255,0.86)" }} />
            </>
          )}
          <View className="p-5 items-center">
            <Text className="text-muted text-xs font-bold mb-3" style={{ letterSpacing: 0.5 }}>
              {state.currentGame.isTiebreak ? "TIEBREAK" : "CURRENT GAME"}
            </Text>
            {state.currentGame.isTiebreak ? (
              <View className="flex-row items-center" style={{ gap: 20 }}>
                <ScorePill value={state.currentGame.pointsA} color={colors.primary} bg={colors.primaryLight} />
                <Text className="text-muted font-bold" style={{ fontSize: 20 }}>-</Text>
                <ScorePill value={state.currentGame.pointsB} color="#1D4ED8" bg="#DBEAFE" />
              </View>
            ) : plainScoreParts ? (
              <View className="flex-row items-center" style={{ gap: 16 }}>
                <ScorePill value={plainScoreParts[0]} color={colors.primary} bg={colors.primaryLight} />
                <Text className="text-muted font-bold" style={{ fontSize: 20 }}>-</Text>
                <ScorePill value={plainScoreParts[1]} color="#1D4ED8" bg="#DBEAFE" />
              </View>
            ) : state.currentGame.display === "DEUCE" || state.currentGame.display.startsWith("ADVANTAGE") ? (
              <Text className="font-extrabold text-center" style={{ fontSize: 22, color: colors.primaryDark }}>
                {state.currentGame.display}
              </Text>
            ) : (
              <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{state.currentGame.display}</Text>
            )}

            {state.indicator && (
              <View className="rounded-full px-3 py-1 mt-3" style={{ backgroundColor: colors.primaryLight }}>
                <Text className="text-xs font-extrabold" style={{ color: colors.primaryDark }}>
                  {INDICATOR_LABEL[state.indicator]}
                  {state.indicatorFor ? ` — ${state.indicatorFor === "A" ? match.player_a_name : match.player_b_name}` : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Server */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3" style={{ ...cardShadow, gap: 8 }}>
          <GradientFill style={{ width: 8, height: 8, borderRadius: 4 }} />
          <Text className="text-ink text-sm flex-1" numberOfLines={1}>
            <Text className="font-bold">SERVER: </Text>
            {serverName}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>

        {/* Point history */}
        {points.length > 0 && (
          <View className="bg-white rounded-2xl p-4 mt-4 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-bold mb-2" style={{ letterSpacing: 0.5 }}>POINT HISTORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row" style={{ gap: 8 }}>
                {points.map((p, i) => (
                  <View
                    key={i}
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: p.winner === "A" ? colors.primaryLight : "#DBEAFE",
                    }}
                  >
                    <Text
                      className="font-bold text-xs"
                      style={{ color: p.winner === "A" ? colors.primaryDark : "#1D4ED8" }}
                    >
                      {p.winner}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <View className="rounded-full bg-gray-100" style={{ height: 3, width: "40%", alignSelf: "center", marginTop: 12 }} />
          </View>
        )}

        {/* Scoring buttons — both dim and stop accepting taps the instant
            one is pressed, until that point is actually reflected in the
            total score. Only the match's own creator sees these — everyone
            else (e.g. someone who opened this via "View Scoring") is
            watch-only. */}
        {isScorer && (
          <View style={{ gap: 10, marginTop: points.length > 0 ? 0 : 16 }}>
            <View pointerEvents={addPoint.isPending ? "none" : "auto"} style={{ gap: 10 }}>
              <GradientActionButton
                onPress={() => handlePoint("A")}
                colors={[colors.primary, colors.primaryDark]}
                icon="add"
                label={`${match.player_a_name} Point`}
                watermarkIcon="tennisball-outline"
                style={addPoint.isPending ? undefined : primaryButtonShadow}
              />
              <GradientActionButton
                onPress={() => handlePoint("B")}
                colors={["#2563EB", "#1D4ED8"]}
                icon="add"
                label={`${match.player_b_name} Point`}
                watermarkIcon="tennisball-outline"
                style={addPoint.isPending ? undefined : primaryButtonShadow}
              />
            </View>

            <OutlineActionButton
              onPress={handleUndo}
              disabled={points.length === 0 || deleteLastPoint.isPending}
              icon="arrow-undo-outline"
              label="Undo Last Point"
              style={{ marginTop: 2, opacity: points.length === 0 ? 0.5 : 1 }}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
