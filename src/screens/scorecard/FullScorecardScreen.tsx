import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import { useCricketMatch } from "../../hooks/useCricket";
import { ballRowToEvent, type CricketInnings, type CricketBallRow } from "../../lib/api/cricket";
import { replayInnings, formatOvers, computeRunRate, type InningsState } from "../../lib/cricketScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Route = RouteProp<ScorecardStackParamList, "FullScorecard">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "FullScorecard">;

function InningsCard({
  teamName,
  state,
}: {
  teamName: string;
  state: InningsState;
}) {
  const runRate = computeRunRate(state.runs, state.legalBalls);
  return (
    <View className="bg-white rounded-2xl border border-border p-4 mb-4" style={cardShadow}>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-ink font-bold text-base">{teamName}</Text>
        <Text className="text-ink font-extrabold text-lg">
          {state.runs}/{state.wickets}{" "}
          <Text className="text-muted text-sm font-normal">
            ({formatOvers(state.legalBalls)} ov, RR {runRate.toFixed(2)})
          </Text>
        </Text>
      </View>

      <View className="flex-row pb-2 border-b border-border">
        <Text className="text-muted text-xs font-semibold flex-1">Batter</Text>
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
          <View key={name} className="py-2 border-b border-border">
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-ink text-sm font-medium" numberOfLines={1}>
                  {name}
                </Text>
                <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                  {s.isOut ? s.outDescription : state.isComplete ? "not out" : name === state.striker || name === state.nonStriker ? "batting" : "not out"}
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

      <Text className="text-muted text-xs mt-3">
        Extras: {state.extras.wide + state.extras.noball + state.extras.bye + state.extras.legbye} (wd{" "}
        {state.extras.wide}, nb {state.extras.noball}, b {state.extras.bye}, lb {state.extras.legbye})
      </Text>

      {state.bowlingOrder.length > 0 && (
        <>
          <View className="flex-row pt-4 pb-2 border-b border-border mt-2">
            <Text className="text-muted text-xs font-semibold flex-1">Bowler</Text>
            <Text className="text-muted text-xs font-semibold" style={{ width: 40, textAlign: "center" }}>O</Text>
            <Text className="text-muted text-xs font-semibold" style={{ width: 32, textAlign: "center" }}>M</Text>
            <Text className="text-muted text-xs font-semibold" style={{ width: 32, textAlign: "center" }}>R</Text>
            <Text className="text-muted text-xs font-semibold" style={{ width: 32, textAlign: "center" }}>W</Text>
            <Text className="text-muted text-xs font-semibold" style={{ width: 44, textAlign: "center" }}>Econ</Text>
          </View>
          {state.bowlingOrder.map((name) => {
            const b = state.bowlingStats[name];
            const econ = b.legalBalls > 0 ? (b.runsConceded / b.legalBalls) * 6 : 0;
            return (
              <View key={name} className="flex-row items-center py-2 border-b border-border">
                <Text className="text-ink text-sm flex-1" numberOfLines={1}>{name}</Text>
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
        <View className="mt-3">
          <Text className="text-muted text-xs font-semibold mb-1">Fall of Wickets</Text>
          <Text className="text-muted text-xs">
            {state.fallOfWickets
              .map((f) => `${f.teamScore}-${f.wicketNumber} (${f.playerOut}, ${f.overs} ov)`)
              .join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
}

function deriveInnings(
  innings: CricketInnings & { cricket_balls: CricketBallRow[] },
  oversLimit: number,
  totalPlayers: number
): InningsState | null {
  const balls = [...innings.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
  if (balls.length === 0) return null;
  return replayInnings(
    balls,
    innings.batting_team as "A" | "B",
    oversLimit,
    totalPlayers,
    balls[0].strikerName,
    balls[0].nonStrikerName
  );
}

export default function FullScorecardScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: match, isLoading } = useCricketMatch(params.matchId);

  const innings = useMemo(() => {
    if (!match) return [];
    return [...match.cricket_innings]
      .sort((a, b) => a.innings_number - b.innings_number)
      .map((inn) => {
        const teamName = inn.batting_team === "A" ? match.team_a_name : match.team_b_name;
        const totalPlayers = inn.batting_team === "A" ? match.team_a_players.length : match.team_b_players.length;
        const state = deriveInnings(inn, match.overs_limit, totalPlayers);
        return { inn, teamName, state };
      })
      .filter((x) => x.state !== null) as { inn: (typeof match.cricket_innings)[number]; teamName: string; state: InningsState }[];
  }, [match]);

  if (isLoading || !match) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row items-center bg-primary px-4 pb-4" style={{ paddingTop: insets.top + 16, gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {match.team_a_name} vs {match.team_b_name}
          </Text>
          {match.result_summary && (
            <Text className="text-white text-xs mt-0.5" style={{ opacity: 0.9 }}>
              {match.result_summary}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {innings.length === 0 ? (
          <Text className="text-muted text-sm text-center mt-10">No balls bowled yet.</Text>
        ) : (
          innings.map(({ inn, teamName, state }) => (
            <InningsCard key={inn.id} teamName={teamName} state={state} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
