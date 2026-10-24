import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import PlayerCricketEntityCard from "./PlayerCricketEntityCard";
import { usePlayerGenericMatches } from "./PlayerSportOverview";
import { SPORT_CONFIGS, type GenericSport } from "../lib/genericSportStats";

export default function PlayerSportTeams({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: matches, isLoading } = usePlayerGenericMatches(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;

  const teamCounts = new Map<string, number>();
  for (const m of matches ?? []) {
    // A singles match has no players array — the player's identity lives
    // only in the side-name column.
    const onA = m.sideAPlayers.includes(fullName) || m.sideAName === fullName;
    const name = onA ? m.sideAName : m.sideBName;
    teamCounts.set(name, (teamCounts.get(name) ?? 0) + 1);
  }
  const teams = Array.from(teamCounts.entries()).sort((a, b) => b[1] - a[1]);

  if (teams.length === 0) {
    return (
      <View className="items-center py-10">
        <Ionicons name="people-outline" size={32} color={colors.muted} />
        <Text className="text-muted text-sm mt-2">No teams yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-4">
      {teams.map(([name, count]) => (
        <PlayerCricketEntityCard
          key={name}
          title={name.toUpperCase()}
          subtitle={`${count} match${count === 1 ? "" : "es"}`}
          subtitleIcon="stats-chart-outline"
          sportName={cfg.dbSportNames[0]}
        />
      ))}
    </View>
  );
}
