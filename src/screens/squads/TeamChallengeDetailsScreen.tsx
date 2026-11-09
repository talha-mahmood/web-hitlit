import { useMemo } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Image from "../../components/images/OptimizedImage";
import { SkeletonBlock } from "../../components/Skeleton";
import { useCancelTeamChallenge, useRespondToTeamChallenge, useTeamChallenges } from "../../hooks/useSquads";
import { useMyOwnedSquads } from "../../hooks/useSquadTeamFill";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import { challengeFormatsForSport } from "../../lib/teamChallengeFormats";

const dateTime = (value: string) => new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(value));

export default function TeamChallengeDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, "TeamChallengeDetails">>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: squads = [], isLoading: squadsLoading } = useMyOwnedSquads(userId);
  const managerSquads = useMemo(() => squads.filter((squad) => squad.group_type === "team" && challengeFormatsForSport(squad.sports?.name).length > 0), [squads]);
  const managerIds = useMemo(() => managerSquads.map((squad) => squad.id).sort(), [managerSquads]);
  const { data: challenges = [], isLoading } = useTeamChallenges(managerIds);
  const challenge = challenges.find((item) => item.id === route.params.challengeId);
  const respond = useRespondToTeamChallenge(managerIds);
  const cancel = useCancelTeamChallenge(managerIds);
  const isReceiver = challenge ? managerIds.includes(challenge.receiver_squad_id) : false;
  const isSender = challenge ? managerIds.includes(challenge.sender_squad_id) : false;

  async function handleResponse(accept: boolean) {
    if (!challenge) return;
    try {
      await respond.mutateAsync({ challengeId: challenge.id, accept });
      Alert.alert(accept ? "Challenge accepted" : "Challenge declined", accept ? "The fixture is confirmed." : "The sender has been notified.");
    } catch (error) {
      Alert.alert("Could not update challenge", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function handleCancel() {
    if (!challenge) return;
    try {
      await cancel.mutateAsync(challenge.id);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Could not cancel challenge", error instanceof Error ? error.message : "Please try again.");
    }
  }

  const loading = squadsLoading || (managerIds.length > 0 && isLoading);

  return (
    <View className="flex-1 bg-app" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center px-4" style={{ minHeight: 58, paddingBottom: 8, gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="h-9 w-8 items-center justify-center"><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable>
        <View className="flex-1"><Text className="text-ink font-extrabold" style={{ fontSize: 18 }}>Challenge details</Text><Text className="text-muted" style={{ fontSize: 12 }}>Team match request</Text></View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading ? (
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
                { icon: "time-outline", label: "Sent" },
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
        ) : !challenge ? (
          <View className="items-center rounded-2xl border border-border bg-surface p-6"><Ionicons name="alert-circle-outline" size={38} color={colors.muted} /><Text className="mt-3 text-ink font-bold">Challenge unavailable</Text><Text className="mt-1 text-center text-muted">It may have been removed or you may no longer manage either team.</Text></View>
        ) : (
          <>
            <View className="rounded-3xl border border-border bg-surface p-5">
              <View className="flex-row items-center">
                {[challenge.sender, challenge.receiver].map((team) => (
                  <View key={team.id} className="flex-1 items-center" style={{ gap: 8 }}>
                    {team.icon_url ? <Image source={{ uri: team.icon_url }} style={{ width: 68, height: 68, borderRadius: 20 }} resizeMode="cover" /> : <View className="items-center justify-center rounded-2xl bg-surfaceRaised" style={{ width: 68, height: 68 }}><Ionicons name="shield" size={32} color={colors.primary} /></View>}
                    <Text className="text-center text-ink font-bold" numberOfLines={2}>{team.name}</Text>
                  </View>
                ))}
              </View>
              <View className="mt-5 items-center rounded-xl px-3 py-2" style={{ backgroundColor: colors.primaryLight }}><Text className="text-primary font-bold capitalize">{challenge.status}</Text></View>
              <View className="mt-5" style={{ gap: 16 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}><Ionicons name="location" size={19} color={colors.primary} /><View><Text className="text-muted text-xs">Venue</Text><Text className="text-ink font-semibold">{challenge.venue}</Text></View></View>
                <View className="flex-row items-center" style={{ gap: 12 }}><Ionicons name="calendar" size={19} color={colors.primary} /><View><Text className="text-muted text-xs">Date and time</Text><Text className="text-ink font-semibold">{dateTime(challenge.scheduled_at)}</Text></View></View>
                <View className="flex-row items-center" style={{ gap: 12 }}><Ionicons name="trophy" size={19} color={colors.primary} /><View><Text className="text-muted text-xs">Sport and format</Text><Text className="text-ink font-semibold">{challenge.sender.sports?.name ?? "Sport"} · {challenge.match_format}</Text></View></View>
                <View className="flex-row items-center" style={{ gap: 12 }}><Ionicons name="time-outline" size={19} color={colors.primary} /><View><Text className="text-muted text-xs">Sent</Text><Text className="text-ink font-semibold">{dateTime(challenge.created_at)}</Text></View></View>
              </View>
            </View>
            {challenge.status === "accepted" && challenge.fixture?.game_id ? (
              <Pressable onPress={() => navigation.navigate("GameDetail", { gameId: challenge.fixture!.game_id! })} className="mt-4 items-center rounded-2xl py-4" style={{ backgroundColor: colors.primary }}>
                <Text className="text-white font-bold">Go to Game</Text>
              </Pressable>
            ) : null}
            {challenge.status === "pending" && isReceiver ? (
              <View className="mt-4 flex-row" style={{ gap: 10 }}>
                <Pressable disabled={respond.isPending} onPress={() => void handleResponse(false)} className="flex-1 items-center rounded-2xl border border-border bg-surfaceRaised py-4"><Text className="text-ink font-bold">Decline</Text></Pressable>
                <Pressable disabled={respond.isPending} onPress={() => void handleResponse(true)} className="flex-1 items-center rounded-2xl py-4" style={{ backgroundColor: colors.primary }}><Text className="text-white font-bold">Accept challenge</Text></Pressable>
              </View>
            ) : null}
            {challenge.status === "pending" && isSender ? (
              <Pressable disabled={cancel.isPending} onPress={() => void handleCancel()} className="mt-4 items-center rounded-2xl border border-border bg-surfaceRaised py-4"><Text className="text-ink font-bold">Cancel challenge</Text></Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
