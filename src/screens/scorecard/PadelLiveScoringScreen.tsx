import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { usePadelMatch, useAddPadelPoint, useDeleteLastPadelPoint, useCompletePadelMatch } from "../../hooks/usePadel";
import { friendlyPadelError, pointRowToEvent } from "../../lib/api/padel";
import { replayPadelMatch, formatSetScore, matchResultSummary, type PadelMatchConfig, type Team } from "../../lib/padelScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Route = RouteProp<ScorecardStackParamList, "PadelLiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "PadelLiveScoring">;

export default function PadelLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = usePadelMatch(params.matchId);
  const addPoint = useAddPadelPoint(params.matchId);
  const deleteLastPoint = useDeleteLastPadelPoint(params.matchId);
  const completeMatch = useCompletePadelMatch();
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
        { onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not save the match result.")) }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  useEffect(() => {
    setReceivingSide("RIGHT");
  }, [state?.currentGame.isDecisivePoint]);

  if (isLoading || !match || !state) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
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

  const teamAPlayerNames = match.team_a_players.length > 0 ? match.team_a_players : ["Player A1", "Player A2"];
  const teamBPlayerNames = match.team_b_players.length > 0 ? match.team_b_players : ["Player B1", "Player B2"];
  const serverName =
    state.server.team === "A"
      ? teamAPlayerNames[state.server.playerIndex] ?? teamAPlayerNames[0]
      : teamBPlayerNames[state.server.playerIndex] ?? teamBPlayerNames[0];
  const receiverNames = state.server.team === "A" ? teamBPlayerNames : teamAPlayerNames;

  if (state.isComplete && state.winner) {
    const winnerName = state.winner === "A" ? match.team_a_name : match.team_b_name;
    return (
      <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center px-4 pb-4" style={{ gap: 6 }}>
          <Pressable onPress={() => navigation.navigate("PadelHome")} hitSlop={8} className="p-1">
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
            onPress={() => navigation.navigate("PadelHome")}
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
        <Pressable onPress={() => navigation.navigate("PadelHome")} hitSlop={8} className="p-1">
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
        {/* Team headers */}
        <View className="flex-row items-start justify-between px-2 mb-4">
          <View className="flex-1">
            <Text className="text-ink font-bold text-base" numberOfLines={1}>{match.team_a_name}</Text>
            {teamAPlayerNames.map((p, i) => (
              <Text key={i} className="text-muted text-xs mt-0.5" numberOfLines={1}>{p}</Text>
            ))}
          </View>
          <View className="flex-1 items-end">
            <Text className="text-ink font-bold text-base" numberOfLines={1}>{match.team_b_name}</Text>
            {teamBPlayerNames.map((p, i) => (
              <Text key={i} className="text-muted text-xs mt-0.5 text-right" numberOfLines={1}>{p}</Text>
            ))}
          </View>
        </View>

        {/* Sets won */}
        <View className="bg-white rounded-2xl p-4 mb-4 items-center" style={cardShadow}>
          <Text className="text-muted text-xs font-semibold mb-1">SETS</Text>
          <View className="flex-row items-center" style={{ gap: 24 }}>
            <Text className="text-ink font-extrabold" style={{ fontSize: 28 }}>{state.setsWonA}</Text>
            <Text className="text-muted font-bold" style={{ fontSize: 18 }}>-</Text>
            <Text className="text-ink font-extrabold" style={{ fontSize: 28 }}>{state.setsWonB}</Text>
          </View>
        </View>

        {/* Per-set score table */}
        <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
          <View className="flex-row items-center mb-2">
            <View style={{ flex: 1.4 }} />
            {state.sets.map((_, i) => (
              <Text key={i} className="text-muted text-xs font-semibold flex-1 text-center">
                {state.sets[i].isMatchTiebreak ? "MTB" : `SET ${i + 1}`}
              </Text>
            ))}
          </View>
          <View className="flex-row items-center mb-1.5">
            <Text className="text-ink font-semibold text-sm" style={{ flex: 1.4 }} numberOfLines={1}>{match.team_a_name}</Text>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "A")}</Text>
            ))}
          </View>
          <View className="flex-row items-center">
            <Text className="text-ink font-semibold text-sm" style={{ flex: 1.4 }} numberOfLines={1}>{match.team_b_name}</Text>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "B")}</Text>
            ))}
          </View>
        </View>

        {/* Current game / tiebreak */}
        <View className="bg-white rounded-2xl p-5 mb-4 items-center" style={cardShadow}>
          <Text className="text-muted text-xs font-semibold mb-3">
            {state.currentGame.isMatchTiebreak ? "MATCH TIEBREAK" : state.currentGame.isTiebreak ? "TIEBREAK" : "CURRENT GAME"}
          </Text>
          {state.currentGame.isTiebreak ? (
            <View className="flex-row items-center" style={{ gap: 28 }}>
              <View className="items-center">
                <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{state.currentGame.pointsA}</Text>
                <Text className="text-muted text-xs mt-1" numberOfLines={1}>{match.team_a_name}</Text>
              </View>
              <Text className="text-muted font-bold" style={{ fontSize: 20 }}>-</Text>
              <View className="items-center">
                <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{state.currentGame.pointsB}</Text>
                <Text className="text-muted text-xs mt-1" numberOfLines={1}>{match.team_b_name}</Text>
              </View>
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

        {/* Server */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-4" style={{ ...cardShadow, gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text className="text-ink text-sm flex-1" numberOfLines={1}>
            <Text className="font-bold">SERVER: </Text>
            {serverName} ({state.server.team === "A" ? match.team_a_name : match.team_b_name})
          </Text>
        </View>
        <Text className="text-muted text-xs text-center -mt-2 mb-4">
          Receiving: {receiverNames.filter(Boolean).join(" / ")}
        </Text>

        {/* Point history */}
        {points.length > 0 && (
          <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-semibold mb-2">POINT HISTORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row" style={{ gap: 6 }}>
                {points.map((p, i) => (
                  <View
                    key={i}
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 26,
                      height: 26,
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
          </View>
        )}

        {/* Scoring buttons — both dim and stop accepting taps the instant
            one is pressed, until that point is actually reflected in the
            total score, same as the cricket scorer's run buttons. */}
        <View style={{ gap: 10 }}>
          <View pointerEvents={addPoint.isPending ? "none" : "auto"} style={{ opacity: addPoint.isPending ? 0.5 : 1, gap: 10 }}>
            <Pressable
              onPress={() => handlePoint("A")}
              className="rounded-2xl py-4 items-center bg-primary"
              style={addPoint.isPending ? undefined : primaryButtonShadow}
            >
              <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_a_name} Point</Text>
            </Pressable>
            <Pressable
              onPress={() => handlePoint("B")}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: "#1D4ED8", ...(addPoint.isPending ? undefined : primaryButtonShadow) }}
            >
              <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_b_name} Point</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleUndo}
            disabled={points.length === 0 || deleteLastPoint.isPending}
            className="flex-row items-center justify-center rounded-2xl py-3 mt-2 border border-border"
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
