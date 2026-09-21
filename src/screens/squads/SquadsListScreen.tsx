import { View, Text, Image, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSquads, useJoinSquad } from "../../hooks/useSquads";
import { useSports } from "../../hooks/useSports";
import SearchField from "../../components/SearchField";
import SportFilterDropdown from "../../components/SportFilterDropdown";
import { SPORT_ICON_BADGE_SIZE } from "../../components/SportsBySportSection";
import JoinRequestModal from "../../components/JoinRequestModal";
import Bouncy from "../../components/Bouncy";
import AvatarStack from "../../components/AvatarStack";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { SquadListItem } from "../../lib/api/squads";
import type { Database } from "../../types/database.types";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { SQUAD_SKILL_COLORS } from "../../lib/badgeColors";
import { matchesLocationQuery } from "../../lib/locationFilter";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadsList">;

// Matches the header's Create button's rendered footprint (px-3 py-2 +
// "Create" text + its icon) so the card's Join CTA reads as the same size
// even though its own label has no icon and varies ("Join"/"Joined"/"Requested").
const JOIN_BUTTON_MIN_WIDTH = 96;

function SquadCard({ squad, onPress, onJoinPress, currentUserId, myGender, index }: {
  squad: SquadListItem;
  onPress: () => void;
  onJoinPress: () => void;
  currentUserId?: string;
  myGender?: string | null;
  index: number;
}) {
  const active = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const isFull = !!squad.max_players && active.length >= squad.max_players;
  // Owner-closed via "Block New Join Requests" on the squad's own page —
  // shown and treated exactly like being full.
  const isClosedToJoins = isFull || squad.join_requests_blocked;
  const isMySquad = squad.squad_owner_id === currentUserId;
  const hasJoined = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  // A Male Only/Female Only squad can't be joined by someone who doesn't
  // match — enforced server-side too (squad_members RLS), this just keeps
  // the CTA from offering something that would be rejected.
  const isGenderRestricted =
    squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;
  const skill = squad.skill_level;
  const skillColor = skill ? SQUAD_SKILL_COLORS[skill] : null;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      {/* Shadow lives on this outer, non-clipping wrapper — a shadow doesn't
          render on a view with overflow:hidden (needed below to clip the top
          accent bar to the rounded corners), so it has to sit one level up. */}
      <Bouncy
        onPress={onPress}
        className="mb-3"
        style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16 }}
        scaleTo={0.98}
      >
        <View className="border border-border rounded-2xl overflow-hidden bg-white mb-3">
        <View className="bg-primary h-1" />
        <View className="px-5 pt-4 pb-5">
          {/* Join CTA sits top-right, sized/shaped like the header's Create
              button — hidden for the owner, and once full (the "Full" badge
              here already says so). Nested Bouncy so tapping it doesn't also
              trigger the card's own onPress. */}
          <View className="flex-row items-center mb-2.5" style={{ gap: 8 }}>
            <AvatarStack
              people={active.map((m) => ({
                avatar: m.profiles?.avatar ?? null,
                name: m.profiles?.full_name ?? null,
              }))}
              size={24}
            />
            <Text className="text-muted text-sm font-medium">
              {active.length} member{active.length !== 1 ? "s" : ""}
            </Text>
            <View className="flex-1" />
            {isMySquad && (
              <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                <Text className="text-blue-600 text-xs font-medium">My Squad</Text>
              </View>
            )}
            {isClosedToJoins && (
              <View className="bg-red-50 px-2 py-0.5 rounded-full">
                <Text className="text-red-600 text-xs font-medium">Full</Text>
              </View>
            )}
            {!isMySquad && !isClosedToJoins && isGenderRestricted && (
              <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                <Text className="text-muted text-xs font-medium">
                  {squad.gender === "male" ? "Male Only" : "Female Only"}
                </Text>
              </View>
            )}
            {!isMySquad && !isClosedToJoins && !isGenderRestricted && (
              <Bouncy onPress={onJoinPress} scaleTo={0.94}>
                {hasJoined ? (
                  <View
                    className="flex-row items-center justify-center bg-green-50 rounded-xl px-3 py-2"
                    style={{ gap: 4, minWidth: JOIN_BUTTON_MIN_WIDTH }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text className="text-primary font-semibold text-sm">Joined</Text>
                  </View>
                ) : hasRequested ? (
                  <View
                    className="items-center justify-center bg-orange-50 rounded-xl px-3 py-2"
                    style={{ minWidth: JOIN_BUTTON_MIN_WIDTH }}
                  >
                    <Text className="text-orange-600 font-semibold text-sm">Requested</Text>
                  </View>
                ) : (
                  <View
                    className="items-center justify-center bg-primary rounded-xl px-3 py-2"
                    style={{ minWidth: JOIN_BUTTON_MIN_WIDTH, ...primaryButtonShadow }}
                  >
                    <Text className="text-white font-semibold text-sm">Join</Text>
                  </View>
                )}
              </Bouncy>
            )}
          </View>

          <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
            {squad.icon_url && (
              <Image
                source={{ uri: squad.icon_url }}
                style={{ width: SPORT_ICON_BADGE_SIZE, height: SPORT_ICON_BADGE_SIZE, borderRadius: 8 }}
                resizeMode="cover"
              />
            )}
            <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>
              {squad.name}
            </Text>
          </View>

          <View className="flex-row items-center mb-2" style={{ gap: 4 }}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text className="text-muted text-sm flex-1" numberOfLines={1}>
              {squad.location ?? "Location not set"}
            </Text>
          </View>

          {squad.sports && (
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <View className="bg-primary-light px-2 py-0.5 rounded-full">
                <Text className="text-primary text-xs font-semibold">{squad.sports.name}</Text>
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-2" style={{ gap: 6 }}>
              {skillColor && skill && (
                <View style={{ backgroundColor: skillColor, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                  </Text>
                </View>
              )}
              <Ionicons name="person-circle-outline" size={14} color={colors.muted} />
              <Text className="text-muted text-sm flex-1" numberOfLines={1}>
                {squad.profiles?.full_name ?? "Unknown"}
              </Text>
            </View>
            {!!squad.max_players && (
              <Text className="text-muted text-xs">
                {active.length}/{squad.max_players}
              </Text>
            )}
          </View>
        </View>
        </View>
      </Bouncy>
    </Animated.View>
  );
}

export default function SquadsListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(undefined);
  const [myOnly, setMyOnly] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(locationInput.trim()), 300);
    return () => clearTimeout(t);
  }, [locationInput]);

  const { data: sports } = useSports();
  const { data: squadsData, isLoading, isRefetching, refetch } = useSquads({
    search: debouncedSearch || undefined,
    sportId: selectedSportId,
  });
  const locationFiltered = debouncedLocation
    ? (squadsData ?? []).filter((s) => matchesLocationQuery([s.location], debouncedLocation))
    : squadsData;
  const squads = myOnly ? (locationFiltered ?? []).filter((s) => s.squad_owner_id === userId) : locationFiltered;

  // Join-request modal is a single shared instance (not one per card) —
  // this tracks which squad (if any) it's currently open for.
  const [joinTargetSquad, setJoinTargetSquad] = useState<SquadListItem | null>(null);
  const joinSquad = useJoinSquad();
  const handleSubmitJoinRequest = (
    skillLevel: Database["public"]["Enums"]["skill_level_type"],
    location: string
  ) => {
    if (!userId || !joinTargetSquad) return;
    joinSquad.mutate(
      { squadId: joinTargetSquad.id, userId, skillLevel, location },
      {
        onSuccess: () => setJoinTargetSquad(null),
        onError: (err) =>
          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request.")),
      }
    );
  };

  return (
    <View className="flex-1 bg-green-50" style={{ paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
          )}
          <Text className="text-2xl font-bold text-ink">Squads</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("CreateSquad")}
          className="flex-row items-center bg-primary rounded-xl px-3 py-2"
          style={{ gap: 4, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white font-semibold text-sm">Create</Text>
        </Pressable>
      </View>

      {/* Search by squad name or squad ID */}
      <View className="px-5 mb-3 flex-row items-center" style={{ gap: 8 }}>
        <View className="flex-1">
          <SearchField
            value={searchInput}
            onChangeText={setSearchInput}
            prefix="Search by "
            variants={["squad name", "squad ID"]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          className="w-11 h-11 rounded-2xl bg-primary items-center justify-center"
          style={primaryButtonShadow}
        >
          <Ionicons name="filter" size={18} color="white" />
          {(!!debouncedLocation || !!selectedSportId) && (
            <View
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "white",
              }}
            />
          )}
        </Pressable>
      </View>

      {/* All / My Squads toggle */}
      <View className="px-5 mb-3 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={() => setMyOnly(false)}
          className={`px-4 py-2 rounded-full ${myOnly ? "bg-white border border-border" : "bg-primary"}`}
        >
          <Text className={`text-sm font-semibold ${myOnly ? "text-muted" : "text-white"}`}>All</Text>
        </Pressable>
        <Pressable
          onPress={() => setMyOnly(true)}
          className={`px-4 py-2 rounded-full ${myOnly ? "bg-primary" : "bg-white border border-border"}`}
        >
          <Text className={`text-sm font-semibold ${myOnly ? "text-white" : "text-muted"}`}>My Squads</Text>
        </Pressable>
      </View>

      {/* Location + sport filters — hidden behind the filter icon until tapped */}
      {showFilters && (
        <View className="px-5 mb-3">
          <SearchField
            value={locationInput}
            onChangeText={setLocationInput}
            prefix="Filter by "
            variants={["location", "city", "area"]}
            autoCapitalize="none"
            autoCorrect={false}
            icon="location-outline"
          />
        </View>
      )}
      {showFilters && (
        <SportFilterDropdown
          sports={sports ?? []}
          selectedSportId={selectedSportId}
          onSelect={(id) => {
            setSelectedSportId(id);
            setShowFilters(false);
          }}
        />
      )}

      {/* Squads list */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={squads ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 0 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            debouncedSearch || debouncedLocation || selectedSportId || myOnly ? (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No squads found</Text>
                <Text className="text-muted text-sm text-center px-8">
                  {debouncedSearch && debouncedLocation
                    ? `No squads match "${debouncedSearch}" near "${debouncedLocation}".`
                    : debouncedLocation
                      ? `No squads found near "${debouncedLocation}".`
                      : debouncedSearch
                        ? `No squads match "${debouncedSearch}". Try a different name or squad ID.`
                        : myOnly
                          ? "You haven't created any squads yet."
                          : "No squads match this sport filter yet."}
                </Text>
              </View>
            ) : (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="people-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No squads yet</Text>
                <Text className="text-muted text-sm text-center px-8">
                  Create a squad to find regular playmates near you!
                </Text>
                <Pressable
                  onPress={() => navigation.navigate("CreateSquad")}
                  className="bg-primary rounded-xl px-6 py-3 mt-2"
                >
                  <Text className="text-white font-semibold">Create a Squad</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <SquadCard
              squad={item}
              currentUserId={userId}
              myGender={myGender}
              index={index}
              onPress={() => navigation.navigate("SquadDetail", { squadId: item.id })}
              onJoinPress={() => setJoinTargetSquad(item)}
            />
          )}
        />
      )}

      <JoinRequestModal
        visible={!!joinTargetSquad}
        onClose={() => setJoinTargetSquad(null)}
        onSubmit={handleSubmitJoinRequest}
        submitting={joinSquad.isPending}
        title="Request to Join"
        subtitle="The squad captain will see this and can approve or reject your request."
      />
    </View>
  );
}
