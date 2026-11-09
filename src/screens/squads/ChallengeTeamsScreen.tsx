import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useIsFocused, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import Image from "../../components/images/OptimizedImage";
import TeamManagerRequiredModal from "../../components/challenges/TeamManagerRequiredModal";
import TeamChallengeComposerModal from "../../components/challenges/TeamChallengeComposerModal";
import SelectChallengeCityModal from "../../components/SelectChallengeCityModal";
import { useSquads } from "../../hooks/useSquads";
import { useMyOwnedSquads } from "../../hooks/useSquadTeamFill";
import { useSports } from "../../hooks/useSports";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow } from "../../constants/theme";
import { distanceKm, formatDistanceKm } from "../../lib/distance";
import { challengeFormatsForSport } from "../../lib/teamChallengeFormats";
import type { SquadListItem } from "../../lib/api/squads";
import type { TeamChallengeFormat } from "../../lib/api/teamChallenges";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";

type Nav = NativeStackNavigationProp<HomeStackParamList, "ChallengeTeams">;
type Scope = "near" | "city";

export default function ChallengeTeamsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<HomeStackParamList, "ChallengeTeams">>();
  const focused = useIsFocused();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { coords } = useDeviceLocation();
  const { data: sports = [] } = useSports();
  const { data: managedTeams = [], refetch: refetchManagedTeams } = useMyOwnedSquads(userId);
  const [sportId, setSportId] = useState(route.params?.sportId ?? "");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("near");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<TeamChallengeFormat | null>(null);
  const [opponent, setOpponent] = useState<SquadListItem | null>(null);
  const [managerModalVisible, setManagerModalVisible] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const pendingCreateOpponentId = useRef<string | null>(null);
  const sport = sports.find((item) => item.id === sportId);
  const formats = useMemo(() => challengeFormatsForSport(sport?.name), [sport?.name]);
  const { data: squads = [], isLoading, isFetching, error, refetch } = useSquads({ search, sportId: sportId || undefined });

  useEffect(() => {
    if (sportId || !sports.length) return;
    const defaultSport = sports.find((item) => item.name.toLowerCase() === "football") ?? sports.find((item) => challengeFormatsForSport(item.name).length > 0);
    if (defaultSport) setSportId(defaultSport.id);
  }, [sportId, sports]);

  useEffect(() => {
    if (!focused) return;
    void refetchManagedTeams();
  }, [focused, refetchManagedTeams]);

  useEffect(() => {
    if (!focused || !pendingCreateOpponentId.current) return;
    const selectedOpponent = squads.find((item) => item.id === pendingCreateOpponentId.current);
    if (selectedOpponent && managedTeams.some((team) => team.sport_id === selectedOpponent.sport_id)) {
      pendingCreateOpponentId.current = null;
      setOpponent(selectedOpponent);
      setComposerVisible(true);
    }
  }, [focused, managedTeams, squads]);

  const teams = useMemo(() => {
    const eligible = squads.filter((team) =>
      team.group_type === "team" && team.id !== opponent?.id && team.squad_owner_id !== userId &&
      !managedTeams.some((managed) => managed.id === team.id) && challengeFormatsForSport(team.sports?.name).length > 0
    );
    const currentCity = selectedCity?.trim().toLocaleLowerCase();
    const filtered = currentCity
      ? eligible.filter((team) => [team.location, team.profiles?.city].some((value) => value?.toLocaleLowerCase().includes(currentCity)))
      : eligible;
    return filtered.map((team) => {
      const lat = team.profiles?.latitude;
      const lng = team.profiles?.longitude;
      const km = coords && lat != null && lng != null ? distanceKm(coords.latitude, coords.longitude, lat, lng) : null;
      return { team, km };
    }).sort((a, b) => {
      if (route.params?.opponentId === a.team.id) return -1;
      if (route.params?.opponentId === b.team.id) return 1;
      if (scope !== "near") return a.team.name.localeCompare(b.team.name);
      if (a.km == null) return b.km == null ? 0 : 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
  }, [coords, managedTeams, opponent?.id, route.params?.opponentId, scope, selectedCity, squads, userId]);

  function startChallenge(team: SquadListItem) {
    setOpponent(team);
    setSelectedFormat(null);
    if (managedTeams.some((managed) => managed.group_type === "team" && managed.sport_id === team.sport_id)) {
      setComposerVisible(true);
    } else {
      setManagerModalVisible(true);
    }
  }

  const selectedOpponent = opponent;
  return (
    <View className="flex-1 bg-app">
      <View className="flex-row items-center justify-center px-5" style={{ minHeight: 70 }}>
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Go back" className="absolute left-5 h-11 w-11 items-center justify-center rounded-full border border-border bg-surfaceRaised">
          <Ionicons name="arrow-back" size={23} color={colors.ink} />
        </Pressable>
        <Text className="text-ink text-2xl font-extrabold">Challenge a Team</Text>
      </View>

      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
        <Text className="text-ink text-lg font-bold">Pick a team to challenge</Text>
        <Pressable onPress={() => setExpanded((value) => !value)} className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surfaceRaised" accessibilityLabel={expanded ? "Collapse filters" : "Expand filters"}>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={21} color={colors.ink} />
        </Pressable>
      </View>

      {expanded ? (
        <View className="mx-4 mb-4 rounded-3xl border border-border bg-surface p-3" style={cardShadow}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable onPress={() => { setScope("near"); setSelectedCity(null); }} className="flex-row items-center rounded-full border px-3.5 py-2" style={{ borderColor: scope === "near" ? colors.primary : colors.border, backgroundColor: scope === "near" ? colors.primaryLight : colors.surfaceRaised }}>
              <Ionicons name="navigate-outline" size={16} color={scope === "near" ? colors.primary : colors.muted} />
              <Text className="ml-1.5 font-bold" style={{ color: scope === "near" ? colors.primary : colors.muted }}>Near me</Text>
            </Pressable>
            <Pressable onPress={() => setCityPickerVisible(true)} className="flex-row items-center rounded-full border px-3.5 py-2" style={{ borderColor: selectedCity ? colors.primary : colors.border, backgroundColor: selectedCity ? colors.primaryLight : colors.surfaceRaised }}>
              <Ionicons name="business-outline" size={16} color={selectedCity ? colors.primary : colors.muted} />
              <Text className="ml-1.5 font-medium" style={{ color: selectedCity ? colors.primary : colors.muted }}>{selectedCity ?? "City"}</Text>
            </Pressable>
            <Text className="ml-1 flex-1 text-muted" numberOfLines={1}>{selectedCity ? "Teams in selected city" : scope === "near" ? "Nearby teams" : "All cities"}</Text>
          </View>
          <View className="mt-3 flex-row items-center rounded-2xl border border-border bg-surfaceRaised px-3.5" style={{ minHeight: 52 }}>
            <Ionicons name="search-outline" size={21} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Team name..." placeholderTextColor={colors.muted} className="ml-2 flex-1 text-ink" style={{ fontSize: 15 }} returnKeyType="search" autoCapitalize="none" />
            {search ? <Pressable onPress={() => setSearch("")} hitSlop={8}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
          </View>
          <View className="mt-3 flex-row" style={{ gap: 7 }}>
            {formats.map(({ value, label }) => {
              const active = selectedFormat === value;
              return <Pressable key={value} onPress={() => setSelectedFormat(active ? null : value)} className="flex-1 items-center rounded-2xl border py-2.5" style={{ borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.surfaceRaised }}><Text className="font-bold" style={{ color: active ? colors.primary : colors.ink }}>{label}</Text></Pressable>;
            })}
          </View>
        </View>
      ) : null}

      {!sportId ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>
      ) : !route.params?.sportId ? (
        <>
          <View className="px-4 pb-3">
            <FlatList horizontal data={sports.filter((item) => challengeFormatsForSport(item.name).length > 0)} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} renderItem={({ item }) => {
              const active = sportId === item.id;
              return <Pressable onPress={() => { setSportId(item.id); setSelectedFormat(null); }} className="rounded-full border px-3.5 py-2" style={{ borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.surface }}><Text className="font-semibold" style={{ color: active ? colors.primary : colors.ink }}>{item.name}</Text></Pressable>;
            }} />
          </View>
          {renderTeamList()}
        </>
      ) : renderTeamList()}

      <TeamManagerRequiredModal visible={managerModalVisible} onClose={() => { setManagerModalVisible(false); setOpponent(null); }} onCreateTeam={() => {
        if (selectedOpponent) pendingCreateOpponentId.current = selectedOpponent.id;
        setManagerModalVisible(false);
        navigation.navigate("CreateSquad", { presetType: "team", lockType: true, presetSportId: selectedOpponent?.sport_id ?? sportId, lockSport: true });
      }} />
      <SelectChallengeCityModal visible={cityPickerVisible} value={selectedCity} onClose={() => setCityPickerVisible(false)} onSelect={(city) => {
        setSelectedCity(city);
        setScope(city ? "city" : "near");
        setCityPickerVisible(false);
      }} />
      <TeamChallengeComposerModal visible={composerVisible} senderTeams={managedTeams.filter((team) => team.group_type === "team")} opponent={selectedOpponent} initialFormat={selectedFormat} onClose={() => { setComposerVisible(false); setOpponent(null); }} onSent={() => { setComposerVisible(false); setOpponent(null); navigation.navigate("TeamChallenges", undefined); }} />
    </View>
  );

  function renderTeamList() {
    return (
      <FlatList
        data={teams}
        keyExtractor={({ team }) => team.id}
        onRefresh={() => void refetch()}
        refreshing={isFetching && !isLoading}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={error ? <Text className="mb-3 text-center" style={{ color: colors.danger }}>Could not load teams. Pull to refresh and try again.</Text> : null}
        ListEmptyComponent={isLoading ? <View className="flex-1 items-center justify-center py-16"><ActivityIndicator color={colors.primary} /></View> : <View className="flex-1 items-center justify-center py-16"><Ionicons name="search-outline" size={38} color={colors.muted} /><Text className="mt-3 text-ink font-semibold">No teams found</Text><Text className="mt-1 text-center text-muted">Try another name, sport, or location filter.</Text></View>}
        renderItem={({ item: { team, km } }) => (
          <View className="mb-2.5 flex-row items-center rounded-3xl border border-border bg-surface px-3 py-3" style={{ minHeight: 83, ...cardShadow }}>
            {team.icon_url ? <Image source={{ uri: team.icon_url }} style={{ width: 52, height: 52, borderRadius: 11 }} resizeMode="cover" /> : <View className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-surfaceRaised"><Ionicons name="shield-outline" size={25} color={colors.primary} /></View>}
            <View className="ml-2.5 mr-2 flex-1 justify-center">
              <Text className="text-ink text-lg font-semibold" numberOfLines={1}>{team.name}</Text>
              <View className="mt-0.5 flex-row items-center">
                <Ionicons name="location" size={14} color={colors.muted} />
                <Text className="ml-1 flex-1 text-muted" numberOfLines={1}>{team.location || team.profiles?.city || "Location not set"}{km !== null ? ` · ${formatDistanceKm(km)}` : ""}</Text>
              </View>
            </View>
            <Pressable onPress={() => startChallenge(team)} className="items-center justify-center rounded-2xl px-3.5" style={{ minHeight: 46, backgroundColor: colors.primary }}><Text className="text-white font-bold">Challenge</Text></Pressable>
          </View>
        )}
      />
    );
  }
}
