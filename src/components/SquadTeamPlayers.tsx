import { useMemo, useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, cardShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { useSquadCricketMatches } from "../hooks/useSquadCricketStats";
import { computePlayerFigures } from "../lib/playerCricketStats";
import type { SquadDetail } from "../lib/api/squads";
import type { SquadsStackParamList } from "../navigation/SquadsStackNavigator";
import { SkeletonCardRows } from "./Skeleton";

type Nav = NativeStackNavigationProp<SquadsStackParamList>;
type SortMode = "az" | "matches";

function PlayerRow({
  name,
  avatar,
  played,
  showMatches,
  onPress,
}: {
  name: string;
  avatar: string | null;
  played: number;
  showMatches: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center bg-surface rounded-2xl p-3 mb-2" style={{ gap: 12, ...cardShadow }}>
      {avatar ? (
        <Image source={{ uri: avatar }} className="w-11 h-11 rounded-full bg-primary-light" />
      ) : (
        <View className="w-11 h-11 rounded-full bg-primary-light items-center justify-center">
          <Text className="text-primary font-bold">{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>
        {name}
      </Text>
      {showMatches && <Text className="text-muted text-xs">{played} mat</Text>}
    </Pressable>
  );
}

// The squad's active roster — A-Z always, and (cricket only, since no other
// sport has per-player match counts to sort by) by matches played for this
// specific team. Drops the reference screenshots' ROLE/SQUAD filters, which
// don't map to anything this app tracks for a single roster.
export default function SquadTeamPlayers({ squad, isCricket }: { squad: SquadDetail; isCricket: boolean }) {
  const navigation = useNavigation<Nav>();
  const [sort, setSort] = useState<SortMode>("az");
  const { data: matches, isLoading } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const activeMembers = squad.squad_members.filter((m) => m.status === "ACTIVE");

  const rows = useMemo(
    () =>
      activeMembers.map((m) => {
        const name = m.profiles?.full_name ?? "Member";
        const played = isCricket && matches ? computePlayerFigures(matches, name).length : 0;
        return { id: m.id, userId: m.user_id, name, avatar: m.profiles?.avatar ?? null, played };
      }),
    [activeMembers, matches, isCricket]
  );

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "matches") copy.sort((a, b) => b.played - a.played);
    else copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [rows, sort]);

  if (isCricket && isLoading) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;

  return (
    <View>
      <View className="flex-row self-start rounded-full overflow-hidden mb-4" style={{ backgroundColor: "#1C2D3A" }}>
        {(["az", ...(isCricket ? (["matches"] as SortMode[]) : [])] as SortMode[]).map((key) =>
          sort === key ? (
            <Pressable key={key} onPress={() => setSort(key)}>
              <GradientFill className="px-4 py-2">
                <Text className="text-jazba-white font-bold text-xs">{key === "az" ? "A-Z" : "Most Matches"}</Text>
              </GradientFill>
            </Pressable>
          ) : (
            <Pressable key={key} onPress={() => setSort(key)} className="px-4 py-2">
              <Text className="font-bold text-xs" style={{ color: "#CBD4DD" }}>
                {key === "az" ? "A-Z" : "Most Matches"}
              </Text>
            </Pressable>
          )
        )}
      </View>

      {sorted.map((r) => (
        <PlayerRow
          key={r.id}
          name={r.name}
          avatar={r.avatar}
          played={r.played}
          showMatches={isCricket}
          onPress={() => navigation.navigate("PlayerProfile", { userId: r.userId })}
        />
      ))}
    </View>
  );
}
