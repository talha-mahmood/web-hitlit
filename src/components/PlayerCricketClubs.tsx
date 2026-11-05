import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import PlayerCricketEntityCard from "./PlayerCricketEntityCard";
import { fetchMySquads, type SquadListItem } from "../lib/api/squads";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";
import { SkeletonCardRows } from "./Skeleton";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;

const CRICKET_SPORT_NAMES = ["hard ball", "tape ball", "outdoor cricket"];

export default function PlayerCricketClubs({ userId }: { userId: string }) {
  const navigation = useNavigation<Nav>();
  const [squads, setSquads] = useState<SquadListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMySquads(userId).then((rows) => {
      if (!cancelled) setSquads(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (squads === null) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;

  // A "club" here is a real group whose type was explicitly set to Club at
  // creation (group_type), scoped to this player's cricket sports — not a
  // guess, and not every group they're in.
  const clubs = squads.filter(
    (s) => s.group_type === "club" && CRICKET_SPORT_NAMES.includes((s.sports?.name ?? "").toLowerCase())
  );

  if (clubs.length === 0) {
    return (
      <View className="items-center py-10">
        <Ionicons name="shield-outline" size={32} color={colors.muted} />
        <Text className="text-muted text-sm mt-2">No clubs yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-4">
      {clubs.map((s) => {
        const activeCount = s.squad_members.filter((m) => m.status === "ACTIVE").length;
        return (
          <PlayerCricketEntityCard
            key={s.id}
            photoUrl={s.icon_url}
            title={s.name}
            subtitle={`${s.location ?? "Location not set"} · ${activeCount} member${activeCount === 1 ? "" : "s"}`}
            sportName={s.sports?.name ?? "cricket"}
            onPress={() => navigation.navigate("SquadDetail", { squadId: s.id })}
          />
        );
      })}
    </View>
  );
}
