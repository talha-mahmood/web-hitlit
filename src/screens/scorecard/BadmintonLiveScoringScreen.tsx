import { useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import {
  useBadmintonMatch,
  useAddBadmintonRally,
  useDeleteLastBadmintonRally,
  useCompleteBadmintonMatch,
} from "../../hooks/useBadminton";
import { friendlyBadmintonError, rallyRowToEvent } from "../../lib/api/badminton";
import { useSyncScorecardMatchResult } from "../../hooks/useTournamentMatches";
import {
  replayBadmintonMatch,
  matchResultSummary,
  type BadmintonMatchConfig,
  type Team,
  type Indicator,
} from "../../lib/badmintonScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Route = RouteProp<ScorecardStackParamList, "BadmintonLiveScoring">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "BadmintonLiveScoring">;

const INDICATOR_LABEL: Record<Exclude<Indicator, null>, string> = {
  GAME_POINT: "GAME POINT",
  MATCH_POINT: "MATCH POINT",
};

export default function BadmintonLiveScoringScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  // Goes back to wherever the scorer came from — the sport's match list in
  // the Scorecard tab, or a tournament's match list when started from
  // "Go To Scorecard" (that route doesn't exist in the other tab stacks).
  const leaveScorecard = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("BadmintonHome"));
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useBadmintonMatch(params.matchId);
  const addRally = useAddBadmintonRally(params.matchId);
  const deleteLastRally = useDeleteLastBadmintonRally(params.matchId);
  const completeMatch = useCompleteBadmintonMatch();
  const syncTournamentResult = useSyncScorecardMatchResult();

  const rallies = useMemo(() => {
    if (!match) return [];
    return [...match.badminton_rallies].sort((a, b) => a.seq - b.seq).map(rallyRowToEvent);
  }, [match]);

  const config: BadmintonMatchConfig | null = match
    ? {
        playMode: match.play_mode as BadmintonMatchConfig["playMode"],
        firstServingTeam: match.first_serving_team as Team,
        teamAServerIndex: match.team_a_server_index as 0 | 1,
        teamBServerIndex: match.team_b_server_index as 0 | 1,
        pointsToWin: match.points_to_win,
        gamesToWin: match.games_to_win,
      }
    : null;

  const state = useMemo(() => {
    if (!config) return null;
    return replayBadmintonMatch(rallies, config);
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
            syncTournamentResult.mutate({ sport: "badminton", scorecardMatchId: match.id, teamAWon: state.winner === "A" });
          },
          onError: (err) => Alert.alert("Error", friendlyBadmintonError(err, "Could not save the match result.")),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  if (isLoading || !match || !state || !config) {
    return (
      <View className="flex-1 items-center justify-center bg-green-50">
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
      { onError: (err) => Alert.alert("Error", friendlyBadmintonError(err, "Could not record rally.")) }
    );
  };

  const handleUndo = () => {
    if (rallies.length === 0) return;
    const last = rallies[rallies.length - 1];
    Alert.alert("Undo Last Rally", "Remove the most recent rally?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: () =>
          deleteLastRally.mutate(last.seq, {
            onError: (err) => Alert.alert("Error", friendlyBadmintonError(err, "Could not undo.")),
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
              {state.games.map((game, i) => (
                <View key={i} className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <Text className="text-muted text-xs font-semibold">GAME {i + 1}</Text>
                  <Text className="text-ink font-bold text-sm">
                    {game.scoreA} - {game.scoreB}
                  </Text>
                </View>
              ))}
            </View>

            <View className="w-full h-px bg-border my-5" />
            <Text className="text-muted text-xs font-semibold">FINAL</Text>
            <Text className="text-ink font-extrabold text-2xl mt-1">
              {state.gamesWonA} - {state.gamesWonB}
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
        <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>
          {match.team_a_name} vs {match.team_b_name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        {/* Team/player headers */}
        <View className="flex-row items-start justify-between px-2 mb-4">
          <View className="flex-1">
            <Text className="text-ink font-bold text-base" numberOfLines={1}>{match.team_a_name}</Text>
            {isDoubles && teamAPlayerNames.map((p, i) => (
              <Text key={i} className="text-muted text-xs mt-0.5" numberOfLines={1}>{p}</Text>
            ))}
          </View>
          <View className="flex-1 items-end">
            <Text className="text-ink font-bold text-base" numberOfLines={1}>{match.team_b_name}</Text>
            {isDoubles && teamBPlayerNames.map((p, i) => (
              <Text key={i} className="text-muted text-xs mt-0.5 text-right" numberOfLines={1}>{p}</Text>
            ))}
          </View>
        </View>

        {/* Games won */}
        <View className="bg-white rounded-2xl p-4 mb-4 items-center" style={cardShadow}>
          <Text className="text-muted text-xs font-semibold mb-1">GAMES</Text>
          <View className="flex-row items-center" style={{ gap: 24 }}>
            <Text className="text-ink font-extrabold" style={{ fontSize: 28 }}>{state.gamesWonA}</Text>
            <Text className="text-muted font-bold" style={{ fontSize: 18 }}>-</Text>
            <Text className="text-ink font-extrabold" style={{ fontSize: 28 }}>{state.gamesWonB}</Text>
          </View>
        </View>

        {/* Per-game score table */}
        <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
          <View className="flex-row items-center mb-2">
            <View style={{ flex: 1.4 }} />
            {state.games.map((_, i) => (
              <Text key={i} className="text-muted text-xs font-semibold flex-1 text-center">GAME {i + 1}</Text>
            ))}
          </View>
          <View className="flex-row items-center mb-1.5">
            <Text className="text-ink font-semibold text-sm" style={{ flex: 1.4 }} numberOfLines={1}>{match.team_a_name}</Text>
            {state.games.map((g, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{g.scoreA}</Text>
            ))}
          </View>
          <View className="flex-row items-center">
            <Text className="text-ink font-semibold text-sm" style={{ flex: 1.4 }} numberOfLines={1}>{match.team_b_name}</Text>
            {state.games.map((g, i) => (
              <Text key={i} className="text-ink font-bold text-sm flex-1 text-center">{g.scoreB}</Text>
            ))}
          </View>
        </View>

        {/* Current game */}
        <View className="bg-white rounded-2xl p-5 mb-4 items-center" style={cardShadow}>
          <Text className="text-muted text-xs font-semibold mb-3">CURRENT GAME</Text>
          <View className="flex-row items-center" style={{ gap: 28 }}>
            <View className="items-center">
              <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{currentGame.scoreA}</Text>
              <Text className="text-muted text-xs mt-1" numberOfLines={1}>{match.team_a_name}</Text>
            </View>
            <Text className="text-muted font-bold" style={{ fontSize: 20 }}>-</Text>
            <View className="items-center">
              <Text className="text-ink font-extrabold" style={{ fontSize: 36 }}>{currentGame.scoreB}</Text>
              <Text className="text-muted text-xs mt-1" numberOfLines={1}>{match.team_b_name}</Text>
            </View>
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

        {/* Server */}
        <View className="bg-white rounded-2xl px-4 py-3 mb-4" style={cardShadow}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
            <Text className="text-ink text-sm flex-1" numberOfLines={1}>
              <Text className="font-bold">SERVER: </Text>
              {servingPlayerName}
            </Text>
          </View>
          <Text className="text-muted text-xs mt-1.5 ml-4" numberOfLines={1}>
            Service Court: {state.server.servingSide}
          </Text>
        </View>

        {/* Rally history */}
        {rallies.length > 0 && (
          <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs font-semibold mb-2">RALLY HISTORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row" style={{ gap: 6 }}>
                {rallies.map((r, i) => (
                  <View
                    key={i}
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 26,
                      height: 26,
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
          </View>
        )}

        {/* Scoring buttons — both dim and stop accepting taps the instant
            one is pressed, until that rally is actually reflected in the
            score. */}
        <View style={{ gap: 10 }}>
          <View pointerEvents={addRally.isPending ? "none" : "auto"} style={{ opacity: addRally.isPending ? 0.5 : 1, gap: 10 }}>
            <Pressable
              onPress={() => handleRally("A")}
              className="rounded-2xl py-4 items-center bg-primary"
              style={addRally.isPending ? undefined : primaryButtonShadow}
            >
              <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_a_name} Point</Text>
            </Pressable>
            <Pressable
              onPress={() => handleRally("B")}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: "#1D4ED8", ...(addRally.isPending ? undefined : primaryButtonShadow) }}
            >
              <Text className="text-white font-bold text-base" numberOfLines={1}>{match.team_b_name} Point</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleUndo}
            disabled={rallies.length === 0 || deleteLastRally.isPending}
            className="flex-row items-center justify-center rounded-2xl py-3 mt-2 border border-border"
            style={{ gap: 8, opacity: rallies.length === 0 ? 0.5 : 1 }}
          >
            <Ionicons name="arrow-undo-outline" size={16} color={colors.muted} />
            <Text className="text-muted text-sm font-semibold">Undo Last Rally</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
