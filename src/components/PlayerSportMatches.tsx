import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import PlayerCricketEntityCard from "./PlayerCricketEntityCard";
import { usePlayerGenericMatches } from "./PlayerSportOverview";
import { SPORT_CONFIGS, type GenericSport } from "../lib/genericSportStats";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";
import { SkeletonCardRows } from "./Skeleton";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;

// Unlike cricket (which has a separate read-only FullScorecard screen),
// these sports only register a LiveScoring route — it's the one screen that
// shows a match whether it's still live or already completed, and it's
// already reachable for any match via the same select-any RLS pattern.
const SCORECARD_ROUTE: Record<GenericSport, keyof HomeStackParamList> = {
  football: "FootballLiveScoring",
  padel: "PadelLiveScoring",
  badminton: "BadmintonLiveScoring",
  pickleball: "PickleballLiveScoring",
  table_tennis: "TableTennisLiveScoring",
  tennis: "TennisLiveScoring",
};

export default function PlayerSportMatches({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const navigation = useNavigation<Nav>();
  const { data: matches, isLoading } = usePlayerGenericMatches(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];

  if (isLoading) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;
  if (!matches || matches.length === 0) {
    return (
      <View className="items-center py-10">
        <Ionicons name="calendar-outline" size={32} color={colors.muted} />
        <Text className="text-muted text-sm mt-2">No matches yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-4">
      {matches.map((m) => {
        const isLive = m.status !== "COMPLETED";
        const dateLabel = new Date(m.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
        return (
          <PlayerCricketEntityCard
            key={m.id}
            title={`${m.sideAName} vs ${m.sideBName}`}
            entityId={m.id}
            kind="event"
            subtitle={isLive ? `Live · ${dateLabel}` : m.resultSummary ?? dateLabel}
            subtitleIcon={isLive ? "radio-outline" : "calendar-outline"}
            pillLabel={isLive ? "Live" : "Completed"}
            sportName={cfg.dbSportNames[0]}
            onPress={() => (navigation as any).navigate(SCORECARD_ROUTE[sport], { matchId: m.id })}
          />
        );
      })}
    </View>
  );
}
