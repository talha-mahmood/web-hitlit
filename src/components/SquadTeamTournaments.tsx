import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import PlayerCricketEntityCard from "./PlayerCricketEntityCard";
import { useSquadCricketMatches } from "../hooks/useSquadCricketStats";
import { usePlayerGenericMatches } from "./PlayerSportOverview";
import { fetchTournamentsForMatches as fetchCricketTournaments, type TournamentEntry } from "./PlayerCricketTournaments";
import { fetchTournamentsForMatches as fetchGenericTournaments } from "./PlayerSportTournaments";
import { classifySportKind, type GenericSport } from "../lib/genericSportStats";
import type { SquadDetail } from "../lib/api/squads";
import type { SquadsStackParamList } from "../navigation/SquadsStackNavigator";

type Nav = NativeStackNavigationProp<SquadsStackParamList>;

// Reuses fetchTournamentsForMatches from PlayerCricketTournaments.tsx /
// PlayerSportTournaments.tsx verbatim — both only ever needed match ids, so
// feeding them this squad's own match list (instead of a player's) is the
// entire change needed here.
export default function SquadTeamTournaments({ squad }: { squad: SquadDetail }) {
  const navigation = useNavigation<Nav>();
  const sportKind = classifySportKind(squad.sports?.name);
  const isCricket = sportKind === "cricket";
  const genericSport = sportKind && sportKind !== "cricket" ? sportKind : null;

  const { data: cricketMatches, isLoading: cricketLoading } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const { data: genericMatches, isLoading: genericLoading } = usePlayerGenericMatches(genericSport, genericSport ? squad.name : null);
  const [tournaments, setTournaments] = useState<TournamentEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isCricket && cricketMatches) {
      fetchCricketTournaments(cricketMatches.map((m) => m.id)).then((rows) => !cancelled && setTournaments(rows));
    } else if (genericSport && genericMatches) {
      fetchGenericTournaments(genericSport, genericMatches.map((m) => m.id)).then((rows) => !cancelled && setTournaments(rows));
    }
    return () => {
      cancelled = true;
    };
  }, [isCricket, cricketMatches, genericSport, genericMatches]);

  const loading = isCricket ? cricketLoading || tournaments === null : genericLoading || tournaments === null;
  if (loading) return <ActivityIndicator color={colors.primary} className="mt-10" />;

  if (!tournaments || tournaments.length === 0) {
    return (
      <View className="items-center py-10">
        <Ionicons name="trophy-outline" size={32} color={colors.muted} />
        <Text className="text-muted text-sm mt-2">No tournaments yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-2">
      {tournaments.map((t) => (
        <PlayerCricketEntityCard
          key={t.gameId}
          photoUrl={t.iconUrl}
          title={t.title}
          subtitle={
            t.gameDate ? new Date(t.gameDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : null
          }
          subtitleIcon="calendar-outline"
          pillLabel="Tournament"
          sportName={squad.sports?.name ?? "cricket"}
          onPress={() => navigation.navigate("GameDetail", { gameId: t.gameId })}
        />
      ))}
    </View>
  );
}
