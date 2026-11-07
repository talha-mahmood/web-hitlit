import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import Bouncy from "./Bouncy";
import TeamCrest from "./TeamCrest";
import { matchTeamScores } from "../lib/playerCricketStats";
import type { CricketMatchDetail } from "../lib/api/cricket";
import { usePlayerCricketMatches } from "./PlayerCricketOverview";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";
import { SkeletonCardRows } from "./Skeleton";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;

function MatchRow({ match }: { match: CricketMatchDetail }) {
  const navigation = useNavigation<Nav>();
  const isLive = match.status === "IN_PROGRESS";
  const scores = matchTeamScores(match);
  const dateLabel = new Date(match.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

  return (
    // marginBottom lives on this plain wrapper (not Bouncy's own style prop,
    // which doesn't reliably apply through its Animated/cssInterop wrapping)
    // — same 12px gap as the Statistics tab's Match-wise cards (mb-3 there).
    <View style={{ marginBottom: 12 }}>
      <Bouncy
        // LiveScoring is the permanent destination for a cricket match now —
        // live or completed, with read-only viewing + the Scorecard tab for
        // anyone who isn't the assigned scorer.
        onPress={() => navigation.navigate("LiveScoring", { matchId: match.id })}
        scaleTo={0.98}
      >
      {/* Same flat light-grey card as the Statistics tab's Match-wise cards
          (PlayerCricketStatistics.tsx's MatchWiseCard) — background set on
          this plain View (not Bouncy's own style prop, which doesn't
          reliably apply through its Animated/cssInterop wrapping). */}
      <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surfaceOverlay }}>
        <View className="flex-row items-center justify-between mb-3" style={{ gap: 8 }}>
          <Text className="text-muted text-xs font-semibold flex-1" numberOfLines={1}>
            Open Match, {match.format}, {dateLabel}
            {match.venue ? ` - ${match.venue}` : ""}
          </Text>
          <Text
            className="text-xs font-bold"
            style={{ color: isLive ? "#DC2626" : colors.muted, flexShrink: 0 }}
          >
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
    </View>
  );
}

export default function PlayerCricketMatches({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName, sportId);

  if (isLoading) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;
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
