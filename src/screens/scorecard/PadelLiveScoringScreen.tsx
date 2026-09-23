import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { usePadelMatch, useAddPadelPoint, useDeleteLastPadelPoint, useCompletePadelMatch } from "../../hooks/usePadel";
import { useSyncScorecardMatchResult } from "../../hooks/useTournamentMatches";
import { friendlyPadelError, pointRowToEvent } from "../../lib/api/padel";
import { replayPadelMatch, formatSetScore, matchResultSummary, type PadelMatchConfig, type Team } from "../../lib/padelScoring";
import { getSportImage } from "../../lib/sportImages";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Route = RouteProp<ScorecardStackParamList, "PadelLiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "PadelLiveScoring">;

// Small avatar circle (player initial) used on the team header cards — the
// app only stores player names as free text for these matches (no linked
// profile/avatar), so an initial-in-a-circle is the closest honest stand-in
// for a photo.
function TeamPlayerAvatar({ name, color, bg }: { name: string; color: string; bg: string }) {
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

// A single team's live game-point value as a colored pill instead of plain
// centered text.
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

export default function PadelLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  // Goes back to wherever the scorer came from — the sport's match list in
  // the Scorecard tab, or a tournament's match list when started from
  // "Go To Scorecard" (that route doesn't exist in the other tab stacks).
  const leaveScorecard = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("PadelHome"));
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = usePadelMatch(params.matchId);
  const addPoint = useAddPadelPoint(params.matchId);
  const deleteLastPoint = useDeleteLastPadelPoint(params.matchId);
  const completeMatch = useCompletePadelMatch();
  const syncTournamentResult = useSyncScorecardMatchResult();
  const [receivingSide, setReceivingSide] = useState<"RIGHT" | "LEFT">("RIGHT");

  const points = useMemo(() => {
    if (!match) return [];
    return [...match.padel_points].sort((a, b) => a.seq - b.seq).map(pointRowToEvent);
  }, [match]);

  const config: PadelMatchConfig | null = match
    ? {
        format: match.format as PadelMatchConfig["format"],
        deuceType: match.deuce_type as PadelMatchConfig["deuceType"],
        firstServerTeam: match.first_server_team as Team,
        firstServerPlayerIndex: match.first_server_player_index as 0 | 1,
        gamesPerSet: match.games_per_set,
      }
    : null;

  const state = useMemo(() => {
    if (!config) return null;
    return replayPadelMatch(points, config);
  }, [points, config]);

  // The moment the point log itself decides the match, persist that result
  // — nothing further for the scorer to confirm, unlike cricket where an
  // innings boundary needs an explicit "start 2nd innings"/"finish" step.
  useEffect(() => {
    if (!match || !state) return;
    if (state.isComplete && state.winner && match.status === "IN_PROGRESS" && !completeMatch.isPending) {
      const summary = matchResultSummary(match.team_a_name, match.team_b_name, state);
      completeMatch.mutate(
        { matchId: match.id, winnerTeam: state.winner, resultSummary: summary },
        {
          onSuccess: () => {
            // Best-effort — a sync failure (e.g. this wasn't actually a
            // tournament match) shouldn't block the host from seeing their
            // finished scorecard.
            syncTournamentResult.mutate({ sport: "padel", scorecardMatchId: match.id, teamAWon: state.winner === "A" });
          },
          onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not save the match result.")),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  useEffect(() => {
    setReceivingSide("RIGHT");
  }, [state?.currentGame.isDecisivePoint]);

  if (isLoading || !match || !state) {
    return (
      <View className="flex-1 items-center justify-center bg-green-50">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const handlePoint = (winner: Team) => {
    if (state.isComplete) return;
    const seq = points.length + 1;
    addPoint.mutate(
      { seq, winner },
      { onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not record point.")) }
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
            onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not undo.")),
          }),
      },
    ]);
  };

  const isDoubles = match.play_mode === "DOUBLES";
  const teamAPlayerNames = match.team_a_players.length > 0 ? match.team_a_players : ["Player A1", "Player A2"];
  const teamBPlayerNames = match.team_b_players.length > 0 ? match.team_b_players : ["Player B1", "Player B2"];
  const serverName = isDoubles
    ? state.server.team === "A"
      ? teamAPlayerNames[state.server.playerIndex] ?? teamAPlayerNames[0]
      : teamBPlayerNames[state.server.playerIndex] ?? teamBPlayerNames[0]
    : state.server.team === "A"
      ? match.team_a_name
      : match.team_b_name;
  const receiverNames = state.server.team === "A" ? teamBPlayerNames : teamAPlayerNames;
  const receivingLabel = isDoubles
    ? receiverNames.filter(Boolean).join(" / ")
    : state.server.team === "A"
      ? match.team_b_name
      : match.team_a_name;
  // The plain-number game score ("40 - 30") gets split into two colored
  // pills; DEUCE/ADVANTAGE/GOLDEN POINT/etc. stay as a single centered label.
  const plainScoreMatch = /^(\S+) - (\S+)$/.exec(state.currentGame.display);
  const plainScoreParts = plainScoreMatch ? ([plainScoreMatch[1], plainScoreMatch[2]] as const) : null;
  const padelBgImage = getSportImage("padel");

  if (state.isComplete && state.winner) {
    const winnerName = state.winner === "A" ? match.team_a_name : match.team_b_name;
    return (
      <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
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
              <Ionicons name="trophy" size={36} color={colors.primaryDark} />
            </View>
            <Text className="text-muted text-xs font-semibold">MATCH COMPLETE</Text>
            <Text className="text-ink font-extrabold text-xl mt-1 text-center">{winnerName} — Winner</Text>

            <View className="w-full mt-6" style={{ gap: 8 }}>
              {state.sets.map((set, i) => (
                <View key={i} className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <Text className="text-muted text-xs font-semibold">
                    {set.isMatchTiebreak ? "MATCH TIEBREAK" : `SET ${i + 1}`}
                  </Text>
                  <Text className="text-ink font-bold text-sm">
                    {formatSetScore(set, "A")} - {formatSetScore(set, "B")}
                  </Text>
                </View>
              ))}
            </View>

            <View className="w-full h-px bg-border my-5" />
            <Text className="text-muted text-xs font-semibold">FINAL</Text>
            <Text className="text-ink font-extrabold text-2xl mt-1">
              {state.setsWonA} - {state.setsWonB}
            </Text>
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
    <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
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
            {match.team_a_name} vs {match.team_b_name}
          </Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            {isDoubles ? "Doubles" : "Singles"} · Padel
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        {/* Team cards, with a "VS" badge overlapping both */}
        <View style={{ position: "relative", marginBottom: 16 }}>
          <View className="flex-row items-stretch" style={{ gap: 10 }}>
            <View
              className="flex-1 bg-white rounded-2xl overflow-hidden"
              style={{ ...cardShadow, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary }}
            >
              <View className="p-3" style={{ position: "relative" }}>
                <Text className="text-ink font-extrabold text-base" numberOfLines={1}>{match.team_a_name}</Text>
                {isDoubles && (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {teamAPlayerNames.map((p, i) => (
                      <View key={i} className="flex-row items-center" style={{ gap: 6 }}>
                        <TeamPlayerAvatar name={p} color={colors.primaryDark} bg={colors.primaryLight} />
                        <Text className="text-ink text-xs font-medium flex-1" numberOfLines={1}>{p}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <MaterialCommunityIcons
                  name="racquetball"
                  size={56}
                  color={colors.primary}
                  style={{ position: "absolute", right: -10, bottom: -10, opacity: 0.1 }}
                />
              </View>
            </View>

            <View
              className="flex-1 bg-white rounded-2xl overflow-hidden"
              style={{ ...cardShadow, borderWidth: 1, borderColor: colors.border, borderRightWidth: 4, borderRightColor: "#1D4ED8" }}
            >
              <View className="p-3" style={{ position: "relative", alignItems: "flex-end" }}>
                <Text className="text-ink font-extrabold text-base text-right" numberOfLines={1}>{match.team_b_name}</Text>
                {isDoubles && (
                  <View style={{ gap: 6, marginTop: 8, alignItems: "flex-end" }}>
                    {teamBPlayerNames.map((p, i) => (
                      <View key={i} className="flex-row items-center" style={{ gap: 6 }}>
                        <Text className="text-ink text-xs font-medium" numberOfLines={1}>{p}</Text>
                        <TeamPlayerAvatar name={p} color="#1D4ED8" bg="#DBEAFE" />
                      </View>
                    ))}
                  </View>
                )}
                <MaterialCommunityIcons
                  name="racquetball"
                  size={56}
                  color="#1D4ED8"
                  style={{ position: "absolute", left: -10, bottom: -10, opacity: 0.1 }}
                />
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
            {state.sets.map((set, i) => (
              <Text key={i} className="text-muted text-xs font-semibold flex-1 text-center">
                {set.isMatchTiebreak ? "MTB" : i + 1}
              </Text>
            ))}
          </View>
          <View className="flex-row items-center mb-1.5">
            <View className="flex-row items-center" style={{ flex: 1.4, gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
              <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>{match.team_a_name}</Text>
            </View>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "A")}</Text>
            ))}
          </View>
          <View className="flex-row items-center">
            <View className="flex-row items-center" style={{ flex: 1.4, gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#1D4ED8" }} />
              <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>{match.team_b_name}</Text>
            </View>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "B")}</Text>
            ))}
          </View>
        </View>

        {/* Current game / tiebreak */}
        <View className="rounded-2xl mb-4 overflow-hidden" style={{ ...cardShadow, position: "relative" }}>
          {padelBgImage && (
            <>
              <Image source={padelBgImage} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" blurRadius={3} />
              <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(255,255,255,0.86)" }} />
            </>
          )}
          <View className="p-5 items-center">
            <Text className="text-muted text-xs font-bold mb-3" style={{ letterSpacing: 0.5 }}>
              {state.currentGame.isMatchTiebreak ? "MATCH TIEBREAK" : state.currentGame.isTiebreak ? "TIEBREAK" : "CURRENT GAME"}
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
            ) : ["DEUCE", "GOLDEN POINT", "STAR POINT"].includes(state.currentGame.display) ||
              state.currentGame.display.startsWith("ADVANTAGE") ? (
              <View className="items-center">
                {state.currentGame.display === "STAR POINT" && <Text style={{ fontSize: 22 }}>⭐</Text>}
                <Text className="font-extrabold text-center" style={{ fontSize: 22, color: colors.primaryDark }}>
                  {state.currentGame.display}
                </Text>
              </View>
            ) : (
              <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{state.currentGame.display}</Text>
            )}

            {state.currentGame.isDecisivePoint && (
            <View className="mt-4 items-center">
              <Text className="text-muted text-xs font-semibold mb-2">
                {(state.server.team === "A" ? match.team_b_name : match.team_a_name)} receiving — choose side
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                {(["RIGHT", "LEFT"] as const).map((side) => (
                  <Pressable
                    key={side}
                    onPress={() => setReceivingSide(side)}
                    className="px-4 py-1.5 rounded-full"
                    style={{
                      backgroundColor: receivingSide === side ? colors.primary : "#F3F4F6",
                    }}
                  >
                    <Text className={`text-xs font-bold ${receivingSide === side ? "text-white" : "text-ink"}`}>
                      {side}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            )}
          </View>
        </View>

        {/* Server */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3" style={{ ...cardShadow, gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text className="text-ink text-sm flex-1" numberOfLines={1}>
            <Text className="font-bold">SERVER: </Text>
            {isDoubles ? `${serverName} (${state.server.team === "A" ? match.team_a_name : match.team_b_name})` : serverName}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
        <Text className="text-muted text-xs text-center mb-4" style={{ marginTop: 4 }}>
          Receiving: {receivingLabel}
        </Text>

        {/* Point history */}
        {points.length > 0 && (
          <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
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
            total score, same as the cricket scorer's run buttons. */}
        <View style={{ gap: 10 }}>
          <View pointerEvents={addPoint.isPending ? "none" : "auto"} style={{ opacity: addPoint.isPending ? 0.5 : 1, gap: 10 }}>
            <Pressable onPress={() => handlePoint("A")} style={addPoint.isPending ? undefined : primaryButtonShadow}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, paddingVertical: 16, overflow: "hidden", position: "relative" }}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="add" size={18} color="white" style={{ marginRight: 6 }} />
                  <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_a_name} Point</Text>
                </View>
                <MaterialCommunityIcons
                  name="racquetball"
                  size={40}
                  color="white"
                  style={{ position: "absolute", right: 14, top: "50%", marginTop: -20, opacity: 0.25 }}
                />
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => handlePoint("B")} style={addPoint.isPending ? undefined : primaryButtonShadow}>
              <LinearGradient
                colors={["#2563EB", "#1D4ED8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, paddingVertical: 16, overflow: "hidden", position: "relative" }}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="add" size={18} color="white" style={{ marginRight: 6 }} />
                  <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_b_name} Point</Text>
                </View>
                <MaterialCommunityIcons
                  name="racquetball"
                  size={40}
                  color="white"
                  style={{ position: "absolute", right: 14, top: "50%", marginTop: -20, opacity: 0.25 }}
                />
              </LinearGradient>
            </Pressable>
          </View>

          <Pressable
            onPress={handleUndo}
            disabled={points.length === 0 || deleteLastPoint.isPending}
            className="flex-row items-center justify-center rounded-full py-3 mt-2 border border-border"
            style={{ gap: 8, opacity: points.length === 0 ? 0.5 : 1 }}
          >
            <Ionicons name="arrow-undo-outline" size={16} color={colors.muted} />
            <Text className="text-muted text-sm font-semibold">Undo Last Point</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
