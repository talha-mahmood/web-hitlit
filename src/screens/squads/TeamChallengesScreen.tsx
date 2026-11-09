import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import Image from "../../components/images/OptimizedImage";
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
  return (
    <View className="flex-1 items-center" style={{ gap: 6 }}>
      {team.icon_url ? <Image source={{ uri: team.icon_url }} style={{ width: 42, height: 42, borderRadius: 12 }} resizeMode="cover" /> : <View className="items-center justify-center rounded-xl bg-surfaceRaised" style={{ width: 42, height: 42 }}><Ionicons name="shield" size={21} color={colors.primary} /></View>}
      <Text className="text-center text-ink font-semibold" numberOfLines={1} style={{ fontSize: 13 }}>{team.name}</Text>
    </View>
  );
}

export default function TeamChallengesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, "TeamChallenges">>();
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
      if (tab === "received") return received && challenge.status === "pending";
      if (tab === "sent") return sent && challenge.status === "pending";
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
    <Pressable onPress={() => navigation.navigate("TeamFixtureDetails", { fixtureId: item.id })} className="mb-3 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-center">
        <Text className="flex-1 text-center text-ink font-bold" numberOfLines={1}>{item.home.name}</Text>
        <View className="px-3"><Ionicons name="trophy" size={19} color={colors.primary} /></View>
        <Text className="flex-1 text-center text-ink font-bold" numberOfLines={1}>{item.away.name}</Text>
      </View>
      <Text className="mt-3 text-center text-primary text-xs font-bold">{item.status === "completed" ? "Completed" : "Confirmed fixture"} · {item.sportName} · {item.match_format}</Text>
      <View className="mt-3 flex-row items-center" style={{ gap: 7 }}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text className="flex-1 text-muted" numberOfLines={1}>{item.venue}</Text></View>
      <View className="mt-2 flex-row items-center" style={{ gap: 7 }}><Ionicons name="calendar-outline" size={16} color={colors.primary} /><Text className="text-muted">{formatDate(item.scheduled_at)} · {formatTime(item.scheduled_at)}</Text></View>
      {item.result ? <Text className="mt-3 text-center text-ink font-bold">{item.result}</Text> : null}
    </Pressable>
  );

  const renderItem = ({ item }: { item: TeamChallenge }) => {
    const received = managerIds.includes(item.receiver_squad_id);
    const busy = respond.isPending || cancel.isPending;
    return (
      <Pressable onPress={() => navigation.navigate("TeamChallengeDetails", { challengeId: item.id })} className="mb-3 overflow-hidden rounded-2xl border border-border bg-surface p-4">
        <View className="flex-row items-center">
          <TeamBadge team={item.sender} />
          <View className="items-center px-2">
            <Ionicons name="arrow-forward" size={19} color={colors.muted} />
            <Text className="mt-1 text-primary text-xs font-bold">{item.status === "pending" ? "Pending" : item.status}</Text>
          </View>
          <TeamBadge team={item.receiver} />
        </View>
        <View className="mt-4" style={{ gap: 7 }}>
          <View className="flex-row items-center" style={{ gap: 7 }}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text className="flex-1 text-ink" numberOfLines={1}>{item.venue}</Text></View>
          <View className="flex-row items-center" style={{ gap: 7 }}><Ionicons name="calendar-outline" size={16} color={colors.primary} /><Text className="text-muted">{formatDate(item.scheduled_at)} · {formatTime(item.scheduled_at)} · {item.sender.sports?.name} · {item.match_format}</Text></View>
          {item.fixture ? <Text className="text-primary text-xs font-semibold">Confirmed fixture · {item.fixture.id.slice(0, 8).toUpperCase()}</Text> : null}
        </View>
        {item.status === "pending" ? (
          <View className="mt-4 flex-row" style={{ gap: 8 }}>
            {received ? (
              <>
                <Pressable disabled={busy} onPress={(event) => { event.stopPropagation(); void answer(item, false); }} className="flex-1 items-center rounded-xl border border-border bg-surfaceRaised py-3"><Text className="text-ink font-bold">Decline</Text></Pressable>
                <Pressable disabled={busy} onPress={(event) => { event.stopPropagation(); void answer(item, true); }} className="flex-1 items-center rounded-xl py-3" style={{ backgroundColor: colors.primary }}><Text className="text-white font-bold">Accept</Text></Pressable>
              </>
            ) : (
              <Pressable disabled={busy} onPress={(event) => { event.stopPropagation(); void cancelPending(item); }} className="flex-1 items-center rounded-xl border border-border bg-surfaceRaised py-3"><Text className="text-ink font-bold">Cancel challenge</Text></Pressable>
            )}
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-app">
      <View className="flex-row items-center px-5" style={{ paddingTop: 18, paddingBottom: 16, gap: 14 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Ionicons name="arrow-back" size={23} color={colors.ink} /></Pressable>
        <View className="flex-1"><Text className="text-ink text-xl font-extrabold">Team Challenges</Text><Text className="text-muted text-sm">Requests and confirmed fixtures</Text></View>
        <Pressable onPress={() => navigation.navigate("ChallengeTeams", undefined)} accessibilityLabel="Find teams to challenge" className="mr-1 h-10 flex-row items-center rounded-xl px-3" style={{ backgroundColor: colors.primary }}>
          <Ionicons name="search" size={17} color="#fff" />
          <Text className="ml-1.5 text-white font-bold">Find teams</Text>
        </Pressable>
        <Pressable onPress={() => void refresh()} hitSlop={8}><Ionicons name="refresh" size={21} color={colors.primary} /></Pressable>
      </View>
      <View className="mx-4 mb-3 flex-row rounded-2xl bg-surfaceRaised p-1">
        {(["received", "sent", "fixtures", "history"] as const).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} className="flex-1 items-center rounded-xl py-2.5" style={{ backgroundColor: tab === key ? colors.primaryLight : "transparent" }}>
            <Text style={{ color: tab === key ? colors.primary : colors.muted, fontWeight: "700", textTransform: "capitalize" }}>{key}</Text>
          </Pressable>
        ))}
      </View>
      {teamsLoading || membershipsLoading || (tab === "fixtures" ? fixturesLoading : managerIds.length > 0 && isLoading) ? <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View> : tab !== "fixtures" && managerIds.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8"><Ionicons name="shield-outline" size={42} color={colors.muted} /><Text className="mt-3 text-center text-ink font-bold text-lg">No managed team yet</Text><Text className="mt-2 text-center text-muted">Team owners and active hosts can manage challenges for supported sports.</Text><Pressable onPress={() => navigation.navigate("CreateSquad", { presetType: "team", lockType: true })} className="mt-5 rounded-2xl px-5 py-3" style={{ backgroundColor: colors.primary }}><Text className="text-white font-bold">Create Team</Text></Pressable></View>
      ) : (
        tab === "fixtures" ? (
          <FlatList
            data={fixtures}
            keyExtractor={(item) => item.id}
            renderItem={renderFixture}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, flexGrow: 1 }}
            onRefresh={() => void refresh()}
            refreshing={false}
            ListEmptyComponent={<View className="flex-1 items-center justify-center py-16"><Ionicons name="trophy-outline" size={42} color={colors.muted} /><Text className="mt-3 text-center text-ink font-semibold">No confirmed fixtures yet</Text><Text className="mt-1 text-center text-muted">Fixtures involving your sports teams will appear here.</Text></View>}
          />
        ) : (
          <FlatList
            data={visibleChallenges}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, flexGrow: 1 }}
            onRefresh={() => void refresh()}
            refreshing={false}
            ListEmptyComponent={<View className="flex-1 items-center justify-center py-16"><Ionicons name="trophy-outline" size={42} color={colors.muted} /><Text className="mt-3 text-center text-ink font-semibold">No {tab} challenges yet</Text><Text className="mt-1 text-center text-muted">Challenges to your managed teams will show here.</Text></View>}
          />
        )
      )}
    </View>
  );
}
