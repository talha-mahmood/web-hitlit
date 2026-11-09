import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Image from "../../components/images/OptimizedImage";
import { SkeletonBlock } from "../../components/Skeleton";
import { getSportIcon } from "../../lib/sportIcons";
import { getSportImage } from "../../lib/sportImages";
import { useTeamChallenges, useTeamFixtures, useRespondToTeamChallenge, useCancelTeamChallenge } from "../../hooks/useSquads";
import { useMyOwnedSquads, useMySquads } from "../../hooks/useSquadTeamFill";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import type { TeamChallenge } from "../../lib/api/teamChallenges";
import { challengeFormatsForSport } from "../../lib/teamChallengeFormats";

type Tab = "received" | "sent" | "fixtures" | "history";
const formatDate = (value: string) => new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }).format(new Date(value));

function TeamBadge({ team }: { team: TeamChallenge["sender"] }) {
  const { icon, bg, fg } = getSportIcon(team.sports?.name ?? "");
  const photo = team.icon_url ? { uri: team.icon_url } : getSportImage(team.sports?.name ?? "");
  return (
    <View className="flex-1 items-center" style={{ gap: 6 }}>
      {photo ? <Image source={photo} style={{ width: 28, height: 28, borderRadius: 8 }} resizeMode="cover" /> : <View className="items-center justify-center rounded-lg" style={{ width: 28, height: 28, backgroundColor: bg }}><MaterialCommunityIcons name={icon} size={16} color={fg} /></View>}
      <Text className="text-center text-ink font-semibold" numberOfLines={1} style={{ fontSize: 10.5 }}>{team.name}</Text>
    </View>
  );
}

// Same shapes as renderItem/renderFixture below, with DB-driven text swapped
// for skeleton blocks — cards appear immediately on open instead of a bare
// spinner, then just fill in once challenges/fixtures load.
function ChallengeCardSkeleton() {
  return (
    <View className="mb-2 overflow-hidden rounded-xl border border-border bg-surface p-2.5">
      <View className="flex-row items-center">
        <View className="flex-1 items-center" style={{ gap: 6 }}>
          <SkeletonBlock width={28} height={28} borderRadius={8} />
          <SkeletonBlock width={60} height={10} />
        </View>
        <View className="items-center px-1.5"><Ionicons name="arrow-forward" size={17} color={colors.muted} /></View>
        <View className="flex-1 items-center" style={{ gap: 6 }}>
          <SkeletonBlock width={28} height={28} borderRadius={8} />
          <SkeletonBlock width={60} height={10} />
        </View>
      </View>
      <View className="mt-2" style={{ gap: 6 }}>
        <View className="flex-row items-center" style={{ gap: 5 }}><Ionicons name="location-outline" size={13} color={colors.primary} /><SkeletonBlock width="60%" height={11} /></View>
        <View className="flex-row items-center" style={{ gap: 5 }}><Ionicons name="calendar-outline" size={13} color={colors.primary} /><SkeletonBlock width="75%" height={10} /></View>
      </View>
    </View>
  );
}

function FixtureCardSkeleton() {
  return (
    <View className="mb-2 rounded-xl border border-border bg-surface p-2.5">
      <View className="flex-row items-center">
        <View className="flex-1 items-center"><SkeletonBlock width="70%" height={14} /></View>
        <View className="px-3"><Ionicons name="trophy" size={19} color={colors.primary} /></View>
        <View className="flex-1 items-center"><SkeletonBlock width="70%" height={14} /></View>
      </View>
      <View className="mt-2 items-center"><SkeletonBlock width="55%" height={11} /></View>
      <View className="mt-2 flex-row items-center" style={{ gap: 6 }}><Ionicons name="location-outline" size={14} color={colors.primary} /><SkeletonBlock width="60%" height={13} /></View>
      <View className="mt-1.5 flex-row items-center" style={{ gap: 6 }}><Ionicons name="calendar-outline" size={14} color={colors.primary} /><SkeletonBlock width="50%" height={12} /></View>
    </View>
  );
}

export default function TeamChallengesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, "TeamChallenges">>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: memberships = [], isLoading: membershipsLoading } = useMySquads(userId);
  const participantTeams = useMemo(() => memberships.filter((team) => team.group_type === "team" && challengeFormatsForSport(team.sports?.name).length > 0 && (team.squad_owner_id === userId || team.squad_members.some((member) => member.status === "ACTIVE" && member.user_id === userId))), [memberships, userId]);
  const participantIds = useMemo(() => participantTeams.map((team) => team.id).sort(), [participantTeams]);
  const { data: fixtures = [], isLoading: fixturesLoading, refetch: refetchFixtures } = useTeamFixtures(participantIds);
  const { data: managedTeams = [], isLoading: teamsLoading } = useMyOwnedSquads(userId);
  const managerTeams = useMemo(() => managedTeams.filter((team) => team.group_type === "team" && challengeFormatsForSport(team.sports?.name).length > 0), [managedTeams]);
  const managerIds = useMemo(() => managerTeams.map((team) => team.id).sort(), [managerTeams]);
  const { data: challenges = [], isLoading, refetch } = useTeamChallenges(managerIds);
  const respond = useRespondToTeamChallenge(managerIds);
  const cancel = useCancelTeamChallenge(managerIds);
  const [tab, setTab] = useState<Tab>(route.params?.focusChallengeId ? "received" : "received");

  const visibleChallenges = useMemo(() => {
    const selected = challenges.filter((challenge) => {
      const received = managerIds.includes(challenge.receiver_squad_id);
      const sent = managerIds.includes(challenge.sender_squad_id);
      // Pending or just-accepted, so the card stays put (now showing "Go to
      // Game") right where it was accepted instead of jumping to History.
      if (tab === "received") return received && (challenge.status === "pending" || challenge.status === "accepted");
      if (tab === "sent") return sent && (challenge.status === "pending" || challenge.status === "accepted");
      return challenge.status !== "pending";
    });
    if (route.params?.focusChallengeId) {
      const focus = challenges.find((challenge) => challenge.id === route.params?.focusChallengeId);
      if (focus && !selected.some((challenge) => challenge.id === focus.id)) return [focus, ...selected];
    }
    return selected;
  }, [challenges, managerIds, route.params?.focusChallengeId, tab]);

  async function answer(challenge: TeamChallenge, accept: boolean) {
    try {
      await respond.mutateAsync({ challengeId: challenge.id, accept });
      Alert.alert(accept ? "Challenge accepted" : "Challenge declined", accept ? "The fixture has been confirmed for both teams." : "The sender has been notified.");
    } catch (error) {
      Alert.alert("Could not update challenge", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function cancelPending(challenge: TeamChallenge) {
    try {
      await cancel.mutateAsync(challenge.id);
    } catch (error) {
      Alert.alert("Could not cancel challenge", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function refresh() {
    await Promise.all([refetch(), refetchFixtures()]);
  }

  const renderFixture = ({ item }: { item: (typeof fixtures)[number] }) => (
    <Pressable onPress={() => navigation.navigate("TeamFixtureDetails", { fixtureId: item.id })} className="mb-2 rounded-xl border border-border bg-surface p-2.5">
      <View className="flex-row items-center">
        <Text className="flex-1 text-center text-ink font-bold" numberOfLines={1}>{item.home.name}</Text>
        <View className="px-3"><Ionicons name="trophy" size={19} color={colors.primary} /></View>
        <Text className="flex-1 text-center text-ink font-bold" numberOfLines={1}>{item.away.name}</Text>
      </View>
      <Text className="mt-2 text-center text-primary font-bold" style={{ fontSize: 11 }}>{item.status === "completed" ? "Completed" : "Confirmed fixture"} · {item.sportName} · {item.match_format}</Text>
      <View className="mt-2 flex-row items-center" style={{ gap: 6 }}><Ionicons name="location-outline" size={14} color={colors.primary} /><Text className="flex-1 text-muted" numberOfLines={1} style={{ fontSize: 13 }}>{item.venue}</Text></View>
      <View className="mt-1.5 flex-row items-center" style={{ gap: 6 }}><Ionicons name="calendar-outline" size={14} color={colors.primary} /><Text className="text-muted" style={{ fontSize: 12 }}>{formatDate(item.scheduled_at)} · {formatTime(item.scheduled_at)}</Text></View>
      {item.result ? <Text className="mt-2 text-center text-ink font-bold">{item.result}</Text> : null}
    </Pressable>
  );

  const renderItem = ({ item }: { item: TeamChallenge }) => {
    const received = managerIds.includes(item.receiver_squad_id);
    const busy = respond.isPending || cancel.isPending;
    return (
      <Pressable onPress={() => navigation.navigate("TeamChallengeDetails", { challengeId: item.id })} className="mb-2 overflow-hidden rounded-xl border border-border bg-surface p-2.5">
        <View className="flex-row items-center">
          <TeamBadge team={item.sender} />
          <View className="items-center px-1.5">
            <Ionicons name="arrow-forward" size={17} color={colors.muted} />
            <Text className="mt-0.5 text-primary font-bold" style={{ fontSize: 10 }}>{item.status === "pending" ? "Pending" : item.status}</Text>
          </View>
          <TeamBadge team={item.receiver} />
        </View>
        <View className="mt-2" style={{ gap: 4 }}>
          <View className="flex-row items-center" style={{ gap: 5 }}><Ionicons name="location-outline" size={13} color={colors.primary} /><Text className="flex-1 text-ink" numberOfLines={1} style={{ fontSize: 12 }}>{item.venue}</Text></View>
          <View className="flex-row items-center" style={{ gap: 5 }}><Ionicons name="calendar-outline" size={13} color={colors.primary} /><Text className="flex-1 text-muted" numberOfLines={1} style={{ fontSize: 11 }}>{formatDate(item.scheduled_at)} · {formatTime(item.scheduled_at)} · {item.sender.sports?.name} · {item.match_format}</Text></View>
          {item.fixture ? <Text className="text-primary font-semibold" style={{ fontSize: 11 }}>Confirmed fixture · {item.fixture.id.slice(0, 8).toUpperCase()}</Text> : null}
        </View>
        {item.status === "pending" ? (
          <View className="mt-2.5 flex-row" style={{ gap: 6 }}>
            {received ? (
              <>
                <Pressable disabled={busy} onPress={(event) => { event.stopPropagation(); void answer(item, false); }} className="flex-1 items-center justify-center rounded-lg border border-border bg-surfaceRaised" style={{ minHeight: 32 }}><Text className="text-ink font-bold" style={{ fontSize: 11 }}>Decline</Text></Pressable>
                <Pressable disabled={busy} onPress={(event) => { event.stopPropagation(); void answer(item, true); }} className="flex-1 items-center justify-center rounded-lg" style={{ minHeight: 32, backgroundColor: colors.primary }}><Text className="text-white font-bold" style={{ fontSize: 11 }}>Accept</Text></Pressable>
              </>
            ) : (
              <Pressable disabled={busy} onPress={(event) => { event.stopPropagation(); void cancelPending(item); }} className="flex-1 items-center justify-center rounded-lg border border-border bg-surfaceRaised" style={{ minHeight: 32 }}><Text className="text-ink font-bold" style={{ fontSize: 11 }}>Cancel challenge</Text></Pressable>
            )}
          </View>
        ) : item.status === "accepted" && item.fixture?.game_id ? (
          <View className="mt-2.5">
            <Pressable
              onPress={(event) => { event.stopPropagation(); navigation.navigate("GameDetail", { gameId: item.fixture!.game_id! }); }}
              className="items-center justify-center rounded-lg"
              style={{ minHeight: 32, backgroundColor: colors.primary }}
            >
              <Text className="text-white font-bold" style={{ fontSize: 11 }}>Go to Game</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-app" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4" style={{ minHeight: 54, paddingBottom: 10, gap: 8 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={7} className="h-8 w-7 items-center justify-center"><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable>
        <View className="flex-1"><Text className="text-ink font-extrabold" numberOfLines={1} style={{ fontSize: 17 }}>Team Challenges</Text><Text className="text-muted" numberOfLines={1} style={{ fontSize: 11 }}>Requests and confirmed fixtures</Text></View>
      </View>
      <View className="mx-3 mb-2.5 flex-row rounded-xl bg-surfaceRaised p-1">
        {(["received", "sent", "fixtures", "history"] as const).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} className="flex-1 items-center rounded-lg py-2" style={{ backgroundColor: tab === key ? colors.primaryLight : "transparent" }}>
            <Text style={{ color: tab === key ? colors.primary : colors.muted, fontWeight: "700", textTransform: "capitalize", fontSize: 12 }}>{key}</Text>
          </Pressable>
        ))}
      </View>
      {teamsLoading || membershipsLoading || (tab === "fixtures" ? fixturesLoading : managerIds.length > 0 && isLoading) ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 2 }}>
          {Array.from({ length: 4 }, (_, i) => (tab === "fixtures" ? <FixtureCardSkeleton key={i} /> : <ChallengeCardSkeleton key={i} />))}
        </View>
      ) : tab !== "fixtures" && managerIds.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8"><Ionicons name="shield-outline" size={42} color={colors.muted} /><Text className="mt-3 text-center text-ink font-bold text-lg">No managed team yet</Text><Text className="mt-2 text-center text-muted">Team owners and active hosts can manage challenges for supported sports.</Text><Pressable onPress={() => navigation.navigate("CreateSquad", { presetType: "team", lockType: true })} className="mt-5 rounded-2xl px-5 py-3" style={{ backgroundColor: colors.primary }}><Text className="text-white font-bold">Create Team</Text></Pressable></View>
      ) : (
        tab === "fixtures" ? (
          <FlatList
            data={fixtures}
            keyExtractor={(item) => item.id}
            renderItem={renderFixture}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20, flexGrow: 1 }}
            onRefresh={() => void refresh()}
            refreshing={false}
            ListEmptyComponent={<View className="flex-1 items-center justify-center py-16"><Ionicons name="trophy-outline" size={42} color={colors.muted} /><Text className="mt-3 text-center text-ink font-semibold">No confirmed fixtures yet</Text><Text className="mt-1 text-center text-muted">Fixtures involving your sports teams will appear here.</Text></View>}
          />
        ) : (
          <FlatList
            data={visibleChallenges}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20, flexGrow: 1 }}
            onRefresh={() => void refresh()}
            refreshing={false}
            ListEmptyComponent={<View className="flex-1 items-center justify-center py-16"><Ionicons name="trophy-outline" size={42} color={colors.muted} /><Text className="mt-3 text-center text-ink font-semibold">No {tab} challenges yet</Text><Text className="mt-1 text-center text-muted">Challenges to your managed teams will show here.</Text></View>}
          />
        )
      )}
    </View>
  );
}
