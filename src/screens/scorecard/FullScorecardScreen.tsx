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
import { dayLabel } from "../../lib/badgeColors";
import TeamCrest from "../../components/TeamCrest";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Route = RouteProp<ScorecardStackParamList, "FullScorecard">;
type Nav = NativeStackNavigationProp<ScorecardStackParamList, "FullScorecard">;

// Short 2-letter initials avatar for a player row (batter/bowler), colored
// per team — the app only has these as free-text names, not linked
// profiles/photos, so this is the same initials-in-a-circle treatment used
// elsewhere for players without a real avatar.
function PlayerAvatar({ name, color, bg }: { name: string; color: string; bg: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.trim().slice(0, 2);
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: 30, height: 30, backgroundColor: bg }}
    >
      <Text className="font-bold" style={{ fontSize: 11, color }}>
        {(initials || "?").toUpperCase()}
      </Text>
    </View>
  );
}

function InningsCard({
  teamName,
  inningsNumber,
  color,
  bg,
  state,
}: {
  teamName: string;
  inningsNumber: number;
  color: string;
  bg: string;
  state: InningsState;
}) {
  const runRate = computeRunRate(state.runs, state.legalBalls);
  return (
    <View
      className="rounded-2xl border border-border overflow-hidden mb-4 bg-white"
      style={cardShadow}
    >
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
          <TeamCrest color={color} size={36} icon="cricket" />
          <View className="flex-1">
            <Text className="text-ink font-bold text-base" numberOfLines={1}>{teamName}</Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
              {inningsNumber === 1 ? "1st" : "2nd"} Innings · {state.isComplete ? "Completed" : "Batting"}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
            {state.runs}/{state.wickets}
          </Text>
          <Text className="text-muted text-xs" numberOfLines={1}>
            ({formatOvers(state.legalBalls)} ov, RR {runRate.toFixed(2)})
          </Text>
        </View>
      </View>

      <View className="px-4 pb-4">
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
            <View key={name} className="py-2.5 border-b border-border">
              <View className="flex-row items-center">
                <View className="flex-row items-center flex-1" style={{ gap: 8 }}>
                  <PlayerAvatar name={name} color={color} bg={bg} />
                  <View className="flex-1">
                    <Text className="text-ink text-sm font-semibold" numberOfLines={1}>
                      {name}
                    </Text>
                    <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                      {s.isOut ? s.outDescription : "Not out"}
                    </Text>
                  </View>
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

        <View className="rounded-xl bg-gray-50 px-3 py-2 mt-3">
          <Text className="text-muted text-xs">
            Extras: {state.extras.wide + state.extras.noball + state.extras.bye + state.extras.legbye} (wd{" "}
            {state.extras.wide}, nb {state.extras.noball}, b {state.extras.bye}, lb {state.extras.legbye})
          </Text>
        </View>

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
                <View key={name} className="flex-row items-center py-2.5 border-b border-border">
                  <View className="flex-row items-center flex-1" style={{ gap: 8 }}>
                    <PlayerAvatar name={name} color={color} bg={bg} />
                    <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={1}>{name}</Text>
                  </View>
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
          <View className="mt-3 mb-4">
            <Text className="text-muted text-xs font-semibold mb-1">Fall of Wickets</Text>
            <Text className="text-muted text-xs">
              {state.fallOfWickets
                .map((f) => `${f.teamScore}-${f.wicketNumber} (${f.playerOut}, ${f.overs} ov)`)
                .join(", ")}
            </Text>
          </View>
        )}
      </View>
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
      <View className="flex-1 items-center justify-center bg-green-50">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const matchDate = new Date(match.created_at);
  const timeLabel = matchDate.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });

  return (
    <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-4 pb-3" style={{ gap: 6 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-ink font-extrabold text-base" numberOfLines={1}>Match Complete</Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            Cricket · {dayLabel(match.created_at.slice(0, 10))}, {timeLabel}
          </Text>
        </View>
        <View
          className="flex-row items-center rounded-full"
          style={{ gap: 5, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primaryLight }}
        >
          <Ionicons name="checkmark-circle" size={15} color={colors.primaryDark} />
          <Text className="font-bold text-xs" style={{ color: colors.primaryDark }}>Completed</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Team crests + result, with a winner ribbon */}
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
            {match.result_summary && (
              <View
                className="flex-row items-center rounded-full mb-4"
                style={{ gap: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.primaryLight }}
              >
                <Ionicons name="trophy" size={15} color={colors.primaryDark} />
                <Text className="font-extrabold text-xs text-center" style={{ color: colors.primaryDark, letterSpacing: 0.5 }}>
                  {match.result_summary.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ position: "relative" }}>
              <View className="flex-row items-center justify-between w-full">
                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color={colors.primary} icon="cricket" />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_a_name}</Text>
                </View>
                <View style={{ width: 92 }} />
                <View className="items-center" style={{ width: 92 }}>
                  <TeamCrest color="#1D4ED8" icon="cricket" />
                  <Text className="text-ink font-bold text-sm mt-2 text-center" numberOfLines={1}>{match.team_b_name}</Text>
                </View>
              </View>
              <View
                className="items-center justify-center rounded-full bg-white"
                style={{ position: "absolute", width: 40, height: 40, left: "50%", top: 8, marginLeft: -20, ...cardShadow }}
              >
                <Text className="text-ink font-extrabold" style={{ fontSize: 12 }}>VS</Text>
              </View>
            </View>
          </View>
        </View>

        {innings.length === 0 ? (
          <Text className="text-muted text-sm text-center mt-10">No balls bowled yet.</Text>
        ) : (
          innings.map(({ inn, teamName, state }) => {
            const isTeamA = inn.batting_team === "A";
            return (
              <InningsCard
                key={inn.id}
                teamName={teamName}
                inningsNumber={inn.innings_number}
                color={isTeamA ? colors.primary : "#1D4ED8"}
                bg={isTeamA ? colors.primaryLight : "#DBEAFE"}
                state={state}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
