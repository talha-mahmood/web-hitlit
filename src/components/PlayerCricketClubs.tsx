import { useEffect, useState } from "react";
import { View, Text, Image, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import Bouncy from "./Bouncy";
import { fetchMySquads, type SquadListItem } from "../lib/api/squads";
import { getSportIcon } from "../lib/sportIcons";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";

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

  if (squads === null) return <ActivityIndicator color={colors.primary} className="mt-10" />;

  const clubs = squads.filter((s) => CRICKET_SPORT_NAMES.includes((s.sports?.name ?? "").toLowerCase()));

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
        const { icon, fg } = getSportIcon(s.sports?.name ?? "");
        const activeCount = s.squad_members.filter((m) => m.status === "ACTIVE").length;
        return (
          <Bouncy
            key={s.id}
            onPress={() => navigation.navigate("SquadDetail", { squadId: s.id })}
            scaleTo={0.98}
            style={{ ...cardShadow, borderRadius: 20, marginBottom: 12, backgroundColor: "#111827" }}
          >
            <View className="flex-row items-center rounded-[20px] p-4" style={{ gap: 14 }}>
              {s.icon_url ? (
                <Image source={{ uri: s.icon_url }} style={{ width: 56, height: 56, borderRadius: 14 }} />
              ) : (
                <View className="items-center justify-center rounded-2xl" style={{ width: 56, height: 56, backgroundColor: "rgba(255,255,255,0.1)" }}>
                  <MaterialCommunityIcons name={icon} size={26} color={fg} />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-white font-bold text-base" numberOfLines={1}>{s.name}</Text>
                <Text className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {s.sports?.name ?? "Cricket"} • {activeCount} member{activeCount === 1 ? "" : "s"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            </View>
          </Bouncy>
        );
      })}
    </View>
  );
}
