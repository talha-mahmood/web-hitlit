import { View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import Bouncy from "./Bouncy";
import TeamCrest from "./TeamCrest";
import { matchTeamScores } from "../lib/playerCricketStats";
import { useSquadCricketMatches } from "../hooks/useSquadCricketStats";
import { usePlayerGenericMatches } from "./PlayerSportOverview";
import { classifySportKind, type GenericSport } from "../lib/genericSportStats";
import type { CricketMatchDetail } from "../lib/api/cricket";
import type { GenericMatchRow as GenericMatchRowData } from "../lib/genericSportStats";
import type { SquadDetail } from "../lib/api/squads";
import type { SquadsStackParamList } from "../navigation/SquadsStackNavigator";

type Nav = NativeStackNavigationProp<SquadsStackParamList>;

// LiveScoring is cricket's single permanent per-match destination — each
// other sport has its own equivalent screen (same route names already
// registered in every stack that carries GameDetail, see e.g.
// GamesStackNavigator). An explicit map here instead of deriving the name
// from SPORT_CONFIGS keeps the route name a literal, type-checked string.
const GENERIC_LIVE_SCORING_ROUTE: Record<GenericSport, keyof SquadsStackParamList> = {
  football: "FootballLiveScoring",
  padel: "PadelLiveScoring",
  badminton: "BadmintonLiveScoring",
  pickleball: "PickleballLiveScoring",
  table_tennis: "TableTennisLiveScoring",
  tennis: "TennisLiveScoring",
};

// Same card styling as PlayerCricketMatches.tsx's MatchRow — team-scoped
// here instead of player-scoped.
function CricketMatchRow({ match }: { match: CricketMatchDetail }) {
  const navigation = useNavigation<Nav>();
  const isLive = match.status === "IN_PROGRESS";
  const scores = matchTeamScores(match);
  const dateLabel = new Date(match.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

  return (
    <View style={{ marginBottom: 12 }}>
      <Bouncy onPress={() => navigation.navigate("LiveScoring", { matchId: match.id })} scaleTo={0.98}>
        <View className="rounded-2xl p-4" style={{ backgroundColor: "#F3F4F6" }}>
          <View className="flex-row items-center justify-between mb-3" style={{ gap: 8 }}>
            <Text className="text-muted text-xs font-semibold flex-1" numberOfLines={1}>
              Open Match, {match.format}, {dateLabel}
              {match.venue ? ` - ${match.venue}` : ""}
            </Text>
            <Text className="text-xs font-bold" style={{ color: isLive ? "#DC2626" : colors.muted, flexShrink: 0 }}>
              {isLive ? "LIVE" : match.status === "SCHEDULED" ? "Scheduled" : "Completed"}
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

function GenericMatchCard({ sport, match }: { sport: GenericSport; match: GenericMatchRowData }) {
  const navigation = useNavigation<Nav>();
  const isLive = match.status === "IN_PROGRESS";
  const dateLabel = new Date(match.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
  const routeName = GENERIC_LIVE_SCORING_ROUTE[sport];

  return (
    <View style={{ marginBottom: 12 }}>
      <Bouncy onPress={() => (navigation.navigate as (name: string, params: object) => void)(routeName, { matchId: match.id })} scaleTo={0.98}>
        <View className="rounded-2xl p-4" style={{ backgroundColor: "#F3F4F6" }}>
          <View className="flex-row items-center justify-between mb-3" style={{ gap: 8 }}>
            <Text className="text-muted text-xs font-semibold flex-1" numberOfLines={1}>
              {dateLabel}
              {match.venue ? ` - ${match.venue}` : ""}
            </Text>
            <Text className="text-xs font-bold" style={{ color: isLive ? "#DC2626" : colors.muted, flexShrink: 0 }}>
              {isLive ? "LIVE" : match.status === "SCHEDULED" ? "Scheduled" : "Completed"}
            </Text>
          </View>
          <Text className="text-ink font-bold text-sm" numberOfLines={1}>{match.sideAName}</Text>
          <Text className="text-ink font-bold text-sm mt-1" numberOfLines={1}>{match.sideBName}</Text>
          {!isLive && match.resultSummary ? (
            <Text className="text-primary text-xs font-semibold mt-3" numberOfLines={1}>{match.resultSummary}</Text>
          ) : null}
        </View>
      </Bouncy>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="items-center py-10">
      <Ionicons name="baseball-outline" size={32} color={colors.muted} />
      <Text className="text-muted text-sm mt-2">No matches yet</Text>
    </View>
  );
}

export default function SquadTeamMatches({ squad }: { squad: SquadDetail }) {
  const sportKind = classifySportKind(squad.sports?.name);
  const isCricket = sportKind === "cricket";
  const genericSport = sportKind && sportKind !== "cricket" ? sportKind : null;

  const { data: cricketMatches, isLoading: cricketLoading } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const { data: genericMatches, isLoading: genericLoading } = usePlayerGenericMatches(genericSport, genericSport ? squad.name : null);

  if (isCricket) {
    if (cricketLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
    if (!cricketMatches || cricketMatches.length === 0) return <EmptyState />;
    return (
      <View className="mt-2">
        {cricketMatches.map((m) => (
          <CricketMatchRow key={m.id} match={m} />
        ))}
      </View>
    );
  }

  if (genericSport) {
    if (genericLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;
    if (!genericMatches || genericMatches.length === 0) return <EmptyState />;
    return (
      <View className="mt-2">
        {genericMatches.map((m) => (
          <GenericMatchCard key={m.id} sport={genericSport} match={m} />
        ))}
      </View>
    );
  }

  return <EmptyState />;
}
