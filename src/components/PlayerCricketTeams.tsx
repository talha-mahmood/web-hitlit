import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import TeamCrest from "./TeamCrest";
import { usePlayerCricketMatches } from "./PlayerCricketOverview";

const CREST_COLORS = [colors.primary, "#1D4ED8", "#B91C1C", "#7C3AED", "#D97706", "#0F766E"];

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
    <View className="flex-row flex-wrap mt-4" style={{ gap: 16 }}>
      {teams.map(([name, count], i) => (
        <View key={name} className="items-center rounded-2xl p-3" style={{ ...cardShadow, backgroundColor: "white", width: 96 }}>
          <TeamCrest color={CREST_COLORS[i % CREST_COLORS.length]} size={56} icon="cricket" />
          <Text className="text-ink font-bold text-xs mt-2 text-center" numberOfLines={2}>{name.toUpperCase()}</Text>
          <Text className="text-muted text-[10px] mt-0.5">{count} match{count === 1 ? "" : "es"}</Text>
        </View>
      ))}
    </View>
  );
}
