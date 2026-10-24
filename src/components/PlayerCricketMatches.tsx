import { View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import Bouncy from "./Bouncy";
import TeamCrest from "./TeamCrest";
import { matchTeamScores } from "../lib/playerCricketStats";
import type { CricketMatchDetail } from "../lib/api/cricket";
import { usePlayerCricketMatches } from "./PlayerCricketOverview";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;

function MatchRow({ match }: { match: CricketMatchDetail }) {
  const navigation = useNavigation<Nav>();
  const isLive = match.status === "IN_PROGRESS";
  const scores = matchTeamScores(match);
  const dateLabel = new Date(match.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Bouncy
      // LiveScoring is the permanent destination for a cricket match now —
      // live or completed, with read-only viewing + the Scorecard tab for
      // anyone who isn't the assigned scorer.
      onPress={() => navigation.navigate("LiveScoring", { matchId: match.id })}
      scaleTo={0.98}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16, marginBottom: 12 }}
    >
      <View className="rounded-2xl bg-white p-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-muted text-xs font-semibold">
            Open Match, {match.format}, {dateLabel}
            {match.venue ? ` - ${match.venue}` : ""}
          </Text>
          <Text className="text-xs font-bold" style={{ color: isLive ? "#DC2626" : colors.muted }}>
            {isLive ? "LIVE" : "Completed"}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
            <TeamCrest color={colors.primary} size={32} icon="cricket" />
            <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>{match.team_a_name}</Text>
          </View>
          <Text className="text-ink font-bold text-sm">
            {scores.A ? `${scores.A.runs}-${scores.A.wickets} (${scores.A.oversLabel})` : ""}
          </Text>
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
            <TeamCrest color="#1D4ED8" size={32} icon="cricket" />
            <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>{match.team_b_name}</Text>
          </View>
          <Text className="text-ink font-bold text-sm">
            {scores.B ? `${scores.B.runs}-${scores.B.wickets} (${scores.B.oversLabel})` : ""}
          </Text>
        </View>
        {!isLive && match.result_summary ? (
          <Text className="text-primary text-xs font-semibold mt-3" numberOfLines={1}>{match.result_summary}</Text>
        ) : null}
      </View>
    </Bouncy>
  );
}

export default function PlayerCricketMatches({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName, sportId);

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  if (!matches || matches.length === 0) {
    return (
      <View className="items-center py-10">
        <Ionicons name="baseball-outline" size={32} color={colors.muted} />
        <Text className="text-muted text-sm mt-2">No matches yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-4">
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} />
      ))}
    </View>
  );
}
