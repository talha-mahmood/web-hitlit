import { useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useTennisMatch, useAddTennisPoint, useDeleteLastTennisPoint, useCompleteTennisMatch } from "../../hooks/useTennis";
import { friendlyTennisError, pointRowToEvent } from "../../lib/api/tennis";
import { replayTennisMatch, formatSetScore, matchResultSummary, type TennisMatchConfig, type Player, type Indicator } from "../../lib/tennisScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Route = RouteProp<ScorecardStackParamList, "TennisLiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "TennisLiveScoring">;

const INDICATOR_LABEL: Record<Exclude<Indicator, null>, string> = {
  GAME_POINT: "GAME POINT",
  BREAK_POINT: "BREAK POINT",
  SET_POINT: "SET POINT",
  MATCH_POINT: "MATCH POINT",
};

export default function TennisLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useTennisMatch(params.matchId);
  const addPoint = useAddTennisPoint(params.matchId);
  const deleteLastPoint = useDeleteLastTennisPoint(params.matchId);
  const completeMatch = useCompleteTennisMatch();

  const points = useMemo(() => {
    if (!match) return [];
    return [...match.tennis_points].sort((a, b) => a.seq - b.seq).map(pointRowToEvent);
  }, [match]);

  const config: TennisMatchConfig | null = match
    ? { format: match.format as TennisMatchConfig["format"], firstServer: match.first_server as Player }
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
        { onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not save the match result.")) }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  if (isLoading || !match || !state) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
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

  const serverName = state.server.player === "A" ? match.player_a_name : match.player_b_name;

  if (state.isComplete && state.winner) {
    const winnerName = state.winner === "A" ? match.player_a_name : match.player_b_name;
    return (
      <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center px-4 pb-4" style={{ gap: 6 }}>
          <Pressable onPress={() => navigation.navigate("TennisHome")} hitSlop={8} className="p-1">
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
                  <Text className="text-muted text-xs font-semibold">SET {i + 1}</Text>
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
            onPress={() => navigation.navigate("TennisHome")}
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
        <Pressable onPress={() => navigation.navigate("TennisHome")} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-row items-center px-2.5 py-1 rounded-full bg-red-500" style={{ gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "white" }} />
          <Text className="text-white text-xs font-bold">LIVE</Text>
        </View>
        <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>
          {match.player_a_name} vs {match.player_b_name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        {/* Player headers */}
        <View className="flex-row items-center justify-between px-2 mb-4">
          <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>{match.player_a_name}</Text>
          <Text className="text-ink font-bold text-base flex-1 text-right" numberOfLines={1}>{match.player_b_name}</Text>
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
              <Text key={i} className="text-muted text-xs font-semibold flex-1 text-center">SET {i + 1}</Text>
            ))}
          </View>
          <View className="flex-row items-center mb-1.5">
            <Text className="text-ink font-semibold text-sm" style={{ flex: 1.4 }} numberOfLines={1}>{match.player_a_name}</Text>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "A")}</Text>
            ))}
          </View>
          <View className="flex-row items-center">
            <Text className="text-ink font-semibold text-sm" style={{ flex: 1.4 }} numberOfLines={1}>{match.player_b_name}</Text>
            {state.sets.map((set, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{formatSetScore(set, "B")}</Text>
            ))}
          </View>
        </View>

        {/* Current game / tiebreak */}
        <View className="bg-white rounded-2xl p-5 mb-4 items-center" style={cardShadow}>
          <Text className="text-muted text-xs font-semibold mb-3">
            {state.currentGame.isTiebreak ? "TIEBREAK" : "CURRENT GAME"}
          </Text>
          {state.currentGame.isTiebreak ? (
            <View className="flex-row items-center" style={{ gap: 28 }}>
              <View className="items-center">
                <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{state.currentGame.pointsA}</Text>
                <Text className="text-muted text-xs mt-1" numberOfLines={1}>{match.player_a_name}</Text>
              </View>
              <Text className="text-muted font-bold" style={{ fontSize: 20 }}>-</Text>
              <View className="items-center">
                <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{state.currentGame.pointsB}</Text>
                <Text className="text-muted text-xs mt-1" numberOfLines={1}>{match.player_b_name}</Text>
              </View>
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

        {/* Server */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-4" style={{ ...cardShadow, gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text className="text-ink text-sm flex-1" numberOfLines={1}>
            <Text className="font-bold">SERVER: </Text>
            {serverName}
          </Text>
        </View>

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
            total score. */}
        <View style={{ gap: 10 }}>
          <View pointerEvents={addPoint.isPending ? "none" : "auto"} style={{ opacity: addPoint.isPending ? 0.5 : 1, gap: 10 }}>
            <Pressable
              onPress={() => handlePoint("A")}
              className="rounded-2xl py-4 items-center bg-primary"
              style={addPoint.isPending ? undefined : primaryButtonShadow}
            >
              <Text className="text-white font-bold text-base" numberOfLines={1}>{match.player_a_name} Point</Text>
            </Pressable>
            <Pressable
              onPress={() => handlePoint("B")}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: "#1D4ED8", ...(addPoint.isPending ? undefined : primaryButtonShadow) }}
            >
              <Text className="text-white font-bold text-base" numberOfLines={1}>{match.player_b_name} Point</Text>
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
