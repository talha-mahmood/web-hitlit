import { useEffect, useState } from "react";
import { View, Text, Image, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import Bouncy from "./Bouncy";
import { supabase } from "../lib/supabase";
import { usePlayerCricketMatches } from "./PlayerCricketOverview";
import type { HomeStackParamList } from "../navigation/HomeStackNavigator";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayerProfile">;

type TournamentEntry = { gameId: string; title: string; iconUrl: string | null; gameDate: string | null };

// A cricket match played as part of a tournament fixture carries the link
// back via tournament_matches.cricket_match_id — that's the real,
// non-guessed connection between a scorecard match and the tournament it
// belongs to (most scorecard matches are standalone pickup games with no
// such link, so this list is often empty, which is correct).
async function fetchTournamentsForMatches(cricketMatchIds: string[]): Promise<TournamentEntry[]> {
  if (cricketMatchIds.length === 0) return [];
  const { data: tms, error: tmError } = await supabase
    .from("tournament_matches")
    .select("game_id")
    .in("cricket_match_id", cricketMatchIds);
  if (tmError) throw new Error(tmError.message);
  const gameIds = Array.from(new Set((tms ?? []).map((t) => t.game_id)));
  if (gameIds.length === 0) return [];
  // RLS on `games` only returns tournaments the viewer is actually allowed to
  // see (public, or they're the host/a participant) — a private tournament
  // the viewer has no access to is correctly omitted here, not an error.
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, title, icon_url, game_date")
    .in("id", gameIds);
  if (gamesError) throw new Error(gamesError.message);
  return (games ?? []).map((g) => ({ gameId: g.id, title: g.title ?? "Tournament", iconUrl: g.icon_url, gameDate: g.game_date }));
}

export default function PlayerCricketTournaments({ fullName }: { fullName: string }) {
  const navigation = useNavigation<Nav>();
  const { data: matches, isLoading: matchesLoading } = usePlayerCricketMatches(fullName);
  const [tournaments, setTournaments] = useState<TournamentEntry[] | null>(null);

  useEffect(() => {
    if (!matches) return;
    let cancelled = false;
    fetchTournamentsForMatches(matches.map((m) => m.id)).then((rows) => {
      if (!cancelled) setTournaments(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [matches]);

  if (matchesLoading || tournaments === null) return <ActivityIndicator color={colors.primary} className="mt-10" />;

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
        <Bouncy
          key={t.gameId}
          onPress={() => navigation.navigate("GameDetail", { gameId: t.gameId })}
          scaleTo={0.98}
          style={{ ...cardShadow, borderRadius: 20, marginBottom: 12, overflow: "hidden" }}
        >
          <View style={{ height: 120, backgroundColor: "#1F2937", justifyContent: "flex-end" }}>
            {t.iconUrl ? (
              <Image source={{ uri: t.iconUrl }} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Ionicons name="trophy" size={40} color="rgba(255,255,255,0.25)" style={{ position: "absolute", right: 16, top: 16 }} />
            )}
            <View style={{ padding: 14, backgroundColor: "rgba(0,0,0,0.35)" }}>
              <Text className="text-white font-bold text-base" numberOfLines={1}>{t.title}</Text>
              {t.gameDate ? (
                <Text className="text-white text-xs mt-1" style={{ opacity: 0.85 }}>
                  {new Date(t.gameDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              ) : null}
            </View>
          </View>
        </Bouncy>
      ))}
    </View>
  );
}
