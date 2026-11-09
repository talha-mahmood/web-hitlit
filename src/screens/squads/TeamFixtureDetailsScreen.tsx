import { Pressable, ScrollView, Text, View } from "react-native";
import { CommonActions, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Image from "../../components/images/OptimizedImage";
import { SkeletonBlock } from "../../components/Skeleton";
import { getSportIcon } from "../../lib/sportIcons";
import { getSportImage } from "../../lib/sportImages";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { useMyOwnedSquads } from "../../hooks/useSquadTeamFill";
import { useMySquads } from "../../hooks/useSquadTeamFill";
import { useTeamFixture } from "../../hooks/useSquads";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import type { TeamFixturePrefill } from "../../lib/api/teamChallenges";

const newMatchRoute = (sportName: string): keyof HomeStackParamList => {
  const sport = sportName.toLowerCase();
  if (sport === "football") return "FootballNewMatch";
  if (["hard ball", "tape ball", "outdoor cricket", "cricket"].includes(sport)) return "NewMatch";
  if (sport === "padel") return "PadelNewMatch";
  if (sport === "tennis") return "TennisNewMatch";
  if (sport === "badminton") return "BadmintonNewMatch";
  if (sport === "pickleball") return "PickleballNewMatch";
  return "TableTennisNewMatch";
};

const liveRoute = (table: string): keyof HomeStackParamList => {
  const routes: Record<string, keyof HomeStackParamList> = {
    football_matches: "FootballLiveScoring",
    cricket_matches: "LiveScoring",
    padel_matches: "PadelLiveScoring",
    tennis_matches: "TennisLiveScoring",
    badminton_matches: "BadmintonLiveScoring",
    pickleball_matches: "PickleballLiveScoring",
    table_tennis_matches: "TableTennisLiveScoring",
  };
  return routes[table] ?? "FootballLiveScoring";
};

const dateTime = (value: string) => new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(value));

export default function TeamFixtureDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, "TeamFixtureDetails">>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: fixture, isLoading: fixtureLoading, error } = useTeamFixture(route.params.fixtureId);
  const { data: memberships = [] } = useMySquads(userId);
  const { data: managed = [] } = useMyOwnedSquads(userId);
  // useMySquads is disabled (and so reports isLoading: false, not "done,
  // no memberships") until userId resolves — without waiting on `!userId`
  // too, the "member of fixture?" check below would read false for a frame
  // before auth/memberships settle and flash "Fixture unavailable".
  const isLoading = fixtureLoading || !userId;
  const memberOfFixture = fixture && memberships.some((team) => team.id === fixture.home_squad_id || team.id === fixture.away_squad_id);
  const isManager = fixture && managed.some((team) => (team.id === fixture.home_squad_id || team.id === fixture.away_squad_id) && team.group_type === "team");
  const canStart = Boolean(isManager && fixture?.status === "scheduled" && new Date(fixture.scheduled_at).getTime() <= Date.now());
  const linkedTable = fixture?.scorecard_table ?? (fixture?.football_match_id ? "football_matches" : null);
  const linkedMatchId = fixture?.scorecard_match_id ?? fixture?.football_match_id ?? null;

  return (
    <View className="flex-1 bg-app" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-4" style={{ minHeight: 58, paddingBottom: 8, gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="h-9 w-8 items-center justify-center"><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable>
        <View className="flex-1"><Text className="text-ink font-extrabold" style={{ fontSize: 18 }}>Team fixture</Text><Text className="text-muted" style={{ fontSize: 12 }}>Confirmed match details</Text></View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
        {isLoading ? (
          <View className="rounded-3xl border border-border bg-surface p-5">
            <View className="flex-row items-center">
              {[0, 1].map((i) => (
                <View key={i} className="flex-1 items-center" style={{ gap: 8 }}>
                  <SkeletonBlock width={68} height={68} borderRadius={20} />
                  <SkeletonBlock width={80} height={14} />
                </View>
              ))}
            </View>
            <View className="mt-5 items-center rounded-xl px-3 py-2" style={{ backgroundColor: colors.primaryLight }}>
              <SkeletonBlock width={70} height={14} />
            </View>
            <View className="mt-5" style={{ gap: 16 }}>
              {([
                { icon: "location", label: "Venue" },
                { icon: "calendar", label: "Date and time" },
                { icon: "trophy", label: "Sport and format" },
              ] as const).map((row) => (
                <View key={row.label} className="flex-row items-center" style={{ gap: 12 }}>
                  <Ionicons name={row.icon} size={19} color={colors.primary} />
                  <View>
                    <Text className="text-muted text-xs">{row.label}</Text>
                    <SkeletonBlock width={140} height={14} style={{ marginTop: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : !fixture || error || !memberOfFixture ? (
          <View className="items-center rounded-2xl border border-border bg-surface p-6"><Ionicons name="alert-circle-outline" size={38} color={colors.muted} /><Text className="mt-3 text-ink font-bold">Fixture unavailable</Text><Text className="mt-1 text-center text-muted">{error ? getFriendlyErrorMessage(error, "This fixture is only visible to members of either team.") : "This fixture is only visible to members of either team."}</Text></View>
        ) : (
          <View className="rounded-3xl border border-border bg-surface p-5">
            <View className="flex-row items-center">
              {[fixture.home, fixture.away].map((team) => {
                const { icon, bg, fg } = getSportIcon(fixture.sportName);
                const photo = team.icon_url ? { uri: team.icon_url } : getSportImage(fixture.sportName);
                return (
                <View key={team.id} className="flex-1 items-center" style={{ gap: 8 }}>
                  {photo ? <Image source={photo} style={{ width: 68, height: 68, borderRadius: 20 }} resizeMode="cover" /> : <View className="items-center justify-center rounded-2xl" style={{ width: 68, height: 68, backgroundColor: bg }}><MaterialCommunityIcons name={icon} size={32} color={fg} /></View>}
                  <Text className="text-center text-ink font-bold" numberOfLines={2}>{team.name}</Text>
                </View>
                );
              })}
            </View>
            <View className="mt-5 items-center rounded-xl px-3 py-2" style={{ backgroundColor: colors.primaryLight }}><Text className="text-primary font-bold capitalize">{fixture.status}</Text></View>
            <View className="mt-5" style={{ gap: 16 }}>
              <View className="flex-row items-center" style={{ gap: 12 }}><Ionicons name="location" size={19} color={colors.primary} /><View><Text className="text-muted text-xs">Venue</Text><Text className="text-ink font-semibold">{fixture.venue}</Text></View></View>
              <View className="flex-row items-center" style={{ gap: 12 }}><Ionicons name="calendar" size={19} color={colors.primary} /><View><Text className="text-muted text-xs">Date and time</Text><Text className="text-ink font-semibold">{dateTime(fixture.scheduled_at)}</Text></View></View>
              <View className="flex-row items-center" style={{ gap: 12 }}><Ionicons name="trophy" size={19} color={colors.primary} /><View><Text className="text-muted text-xs">Sport and format</Text><Text className="text-ink font-semibold">{fixture.sportName} · {fixture.match_format}</Text></View></View>
            </View>
            {fixture.result ? <View className="mt-5 rounded-xl bg-surfaceRaised p-3"><Text className="text-muted text-xs">Final result</Text><Text className="mt-1 text-ink font-bold">{fixture.result}</Text></View> : null}
            {isManager && linkedTable && linkedMatchId ? (
              <Pressable onPress={() => navigation.dispatch(CommonActions.navigate(liveRoute(linkedTable), { matchId: linkedMatchId }))} className="mt-5 items-center rounded-xl py-3" style={{ backgroundColor: colors.primary }}><Text className="text-white font-bold">Open Scorecard</Text></Pressable>
            ) : isManager && canStart ? (
              <Pressable onPress={() => {
                const teamFixture: TeamFixturePrefill = { fixtureId: fixture.id, sportId: fixture.sport_id, sportName: fixture.sportName, matchFormat: fixture.match_format as TeamFixturePrefill["matchFormat"], teamAName: fixture.home.name, teamBName: fixture.away.name, venue: fixture.venue };
                navigation.dispatch(CommonActions.navigate(newMatchRoute(fixture.sportName), { teamFixture }));
              }} className="mt-5 items-center rounded-xl py-3" style={{ backgroundColor: colors.primary }}><Text className="text-white font-bold">Start {fixture.sportName} Scorecard</Text></Pressable>
            ) : isManager && fixture.status === "scheduled" ? (
              <Text className="mt-5 text-center text-muted text-xs">The match scorecard will be available at the scheduled time.</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
