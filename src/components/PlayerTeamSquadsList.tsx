import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import PlayerCricketEntityCard from "./PlayerCricketEntityCard";
import { usePlayerTeamSquads } from "../hooks/useSquads";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";
import { SkeletonCardRows } from "./Skeleton";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;

// Real group_type='team' squad membership — replaces the old
// PlayerCricketTeams/PlayerSportTeams, which derived pseudo-"teams" from
// scorecard team-name strings rather than actual group membership. Used for
// the "Teams" tab for every sport (sport-agnostic, unlike the components it
// replaces), since squad membership isn't scorecard-derived.
export default function PlayerTeamSquadsList({ userId, sportId }: { userId: string; sportId?: string | null }) {
  const navigation = useNavigation<Nav>();
  const { data: squads, isLoading } = usePlayerTeamSquads(userId, sportId);

  if (isLoading) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;

  if (!squads || squads.length === 0) {
    return (
      <View className="items-center py-10">
        <Ionicons name="people-outline" size={32} color={colors.muted} />
        <Text className="text-muted text-sm mt-2">No teams yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-4">
      {squads.map((s) => (
        <PlayerCricketEntityCard
          key={s.id}
          photoUrl={s.icon_url}
          title={s.name.toUpperCase()}
          subtitle={`${s.member_count} member${s.member_count === 1 ? "" : "s"}`}
          subtitleIcon="people-outline"
          pillLabel="Team"
          sportName={s.sports?.name ?? "cricket"}
          onPress={() => navigation.navigate("SquadDetail", { squadId: s.id })}
        />
      ))}
    </View>
  );
}
