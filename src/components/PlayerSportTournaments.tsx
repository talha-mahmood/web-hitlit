import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import PlayerCricketEntityCard from "./PlayerCricketEntityCard";
import { supabase } from "../lib/supabase";
import { usePlayerGenericMatches } from "./PlayerSportOverview";
import { SPORT_CONFIGS, type GenericSport } from "../lib/genericSportStats";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";
import { SkeletonCardRows } from "./Skeleton";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;
export type TournamentEntry = { gameId: string; title: string; iconUrl: string | null; gameDate: string | null };

export async function fetchTournamentsForMatches(sport: GenericSport, matchIds: string[]): Promise<TournamentEntry[]> {
  if (matchIds.length === 0) return [];
  const cfg = SPORT_CONFIGS[sport];
  const { data: tms, error: tmError } = await supabase
    .from("tournament_matches")
    .select("game_id")
    .in(cfg.tournamentMatchIdCol, matchIds);
  if (tmError) throw new Error(tmError.message);
  const gameIds = Array.from(new Set((tms ?? []).map((t) => t.game_id)));
  if (gameIds.length === 0) return [];
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, title, icon_url, game_date")
    .in("id", gameIds);
  if (gamesError) throw new Error(gamesError.message);
  return (games ?? []).map((g) => ({ gameId: g.id, title: g.title ?? "Tournament", iconUrl: g.icon_url, gameDate: g.game_date }));
}

export default function PlayerSportTournaments({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const navigation = useNavigation<Nav>();
  const { data: matches, isLoading: matchesLoading } = usePlayerGenericMatches(sport, fullName);
  const [tournaments, setTournaments] = useState<TournamentEntry[] | null>(null);
  const cfg = SPORT_CONFIGS[sport];

  useEffect(() => {
    if (!matches) return;
    let cancelled = false;
    fetchTournamentsForMatches(sport, matches.map((m) => m.id)).then((rows) => {
      if (!cancelled) setTournaments(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [matches, sport]);

  if (matchesLoading || tournaments === null) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;

  if (tournaments.length === 0) {
    return (
      <View className="items-center py-10">
        <Ionicons name="trophy-outline" size={32} color={colors.muted} />
        <Text className="text-muted text-sm mt-2">No tournaments yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-4">
      {tournaments.map((t) => (
        <PlayerCricketEntityCard
          key={t.gameId}
          photoUrl={t.iconUrl}
          title={t.title}
          subtitle={
            t.gameDate
              ? new Date(t.gameDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
              : null
          }
          subtitleIcon="calendar-outline"
          pillLabel="Tournament"
          sportName={cfg.dbSportNames[0]}
          onPress={() => navigation.navigate("GameDetail", { gameId: t.gameId })}
        />
      ))}
    </View>
  );
}
