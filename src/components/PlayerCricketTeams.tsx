import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import PlayerCricketEntityCard from "./PlayerCricketEntityCard";
import { usePlayerCricketMatches } from "./PlayerCricketOverview";

export default function PlayerCricketTeams({ fullName }: { fullName: string }) {
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName);

  if (isLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;

  const teamCounts = new Map<string, number>();
  for (const m of matches ?? []) {
    const onA = m.team_a_players.includes(fullName);
    const teamName = onA ? m.team_a_name : m.team_b_name;
    teamCounts.set(teamName, (teamCounts.get(teamName) ?? 0) + 1);
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
          sportName="cricket"
        />
      ))}
    </View>
  );
}
