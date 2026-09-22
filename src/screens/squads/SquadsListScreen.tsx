import { View, Text, Image, FlatList, ScrollView, Modal, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSquads, useJoinSquad } from "../../hooks/useSquads";
import { useSports } from "../../hooks/useSports";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import FieldInput from "../../components/FieldInput";
import SearchField from "../../components/SearchField";
import SelectSportModal from "../../components/SelectSportModal";
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
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import { matchesLocationQuery } from "../../lib/locationFilter";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadsList">;

function SquadCard({
  squad,
  onPress,
  onJoinPress,
  currentUserId,
  myGender,
  index,
}: {
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
  // A squad owner auto-joins their own squad as captain, so hasJoined
  // already covers them too — no separate "My Squad" badge needed, same as
  // the "isMyGame" case on the Games list doesn't get one either.
  const hasJoined = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  // A Male Only/Female Only squad can't be joined by someone who doesn't
  // match — enforced server-side too (squad_members RLS), this just keeps
  // the CTA from offering something that would be rejected.
  const isGenderRestricted =
    squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;
  const skill = squad.skill_level;
  const skillColor = skill ? SQUAD_SKILL_COLORS[skill] : null;

  const sportName = squad.sports?.name ?? "";
  const sportPhoto = getSportImage(sportName);
  const sportGlyph = getSportIcon(sportName);
  // The name/location/members rows keep clear of the sport picture on the right.
  const rightGutter = { paddingRight: 92 };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      <Bouncy
        onPress={onPress}
        // Spacing between cards comes from the FlatList's own
        // contentContainerStyle gap below, not a className margin here —
        // Bouncy's explicit style prop (needed for the press animation)
        // takes priority over a className-derived margin, so a margin set
        // here never actually showed up.
        style={{ ...cardShadow, backgroundColor: "white", borderRadius: 24 }}
        scaleTo={0.98}
      >
        <View className="border border-border overflow-hidden bg-white" style={{ borderRadius: 24, position: "relative" }}>
          {/* Join/Joined/Requested CTA — pinned to the card's top-right
              corner. Nested Bouncy so a tap here doesn't also trigger the
              card's own onPress. */}
          <View style={{ position: "absolute", top: 16, right: 16, zIndex: 5 }}>
            {isClosedToJoins && !hasJoined ? (
              <View className="bg-red-50 rounded-2xl px-3 py-2">
                <Text className="text-red-600 font-bold text-sm">Full</Text>
              </View>
            ) : !isMySquad && isGenderRestricted ? (
              <View className="bg-gray-100 rounded-2xl px-3 py-2">
                <Text className="text-muted font-bold text-sm">
                  {squad.gender === "male" ? "Male Only" : "Female Only"}
                </Text>
              </View>
            ) : (
              <Bouncy onPress={hasJoined || isMySquad ? undefined : onJoinPress} scaleTo={0.94}>
                {hasJoined || isMySquad ? (
                  <View
                    className="flex-row items-center justify-center bg-green-50 rounded-2xl px-3 py-2"
                    style={{ gap: 4, minWidth: 78 }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text className="text-primary font-semibold text-sm">Joined</Text>
                  </View>
                ) : hasRequested ? (
                  <View className="items-center justify-center bg-orange-50 rounded-2xl px-3 py-2" style={{ minWidth: 78 }}>
                    <Text className="text-orange-600 font-semibold text-sm">Requested</Text>
                  </View>
                ) : (
                  <View
                    className="items-center justify-center bg-primary rounded-2xl px-3 py-2"
                    style={{ minWidth: 78, ...primaryButtonShadow }}
                  >
                    <Text className="text-white font-bold text-sm">Join</Text>
                  </View>
                )}
              </Bouncy>
            )}
          </View>

          {/* Sport picture in a soft green disc, tucked into the right edge */}
          <View
            pointerEvents="none"
            className="items-center justify-center overflow-hidden"
            style={{
              position: "absolute",
              right: -30,
              top: 56,
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: "#E4F7EA",
            }}
          >
            {sportPhoto ? (
              <View style={{ width: 132, height: 74, marginRight: 26, mixBlendMode: "multiply" }}>
                <Image source={sportPhoto} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
              </View>
            ) : sportName ? (
              <MaterialCommunityIcons name={sportGlyph.icon} size={54} color={sportGlyph.fg} style={{ marginRight: 26, opacity: 0.8 }} />
            ) : (
              <Ionicons name="people" size={50} color={colors.primary} style={{ marginRight: 26, opacity: 0.8 }} />
            )}
          </View>

          <View className="px-4 pt-4 pb-4">
            {/* Row 2: Icon (if the owner set a custom one) + Name — kept
                clear of the corner CTA above via a wider right gutter, and
                truncates to one line if there isn't room. */}
            <View className="flex-row items-center mb-1.5" style={{ gap: 8, paddingRight: 100 }}>
              {squad.icon_url && (
                <Image source={{ uri: squad.icon_url }} style={{ width: 32, height: 32, borderRadius: 8 }} resizeMode="cover" />
              )}
              <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 20 }} numberOfLines={1}>
                {squad.name}
              </Text>
            </View>

            {/* Row 3: Location */}
            <View className="flex-row items-center mb-2.5" style={{ gap: 5, ...rightGutter }}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                {squad.location ?? "Location not set"}
              </Text>
            </View>

            {/* Row 4: avatar stack + member count */}
            <View className="flex-row items-center mb-3" style={{ gap: 8, ...rightGutter }}>
              <AvatarStack
                people={active.map((m) => ({
                  avatar: m.profiles?.avatar ?? null,
                  name: m.profiles?.full_name ?? null,
                }))}
                size={30}
              />
              <Text className="text-muted font-medium" style={{ fontSize: 14 }}>
                {active.length} member{active.length !== 1 ? "s" : ""}
                {!!squad.max_players ? ` · ${active.length}/${squad.max_players}` : ""}
              </Text>
            </View>

            {/* Row 5: Sport badge */}
            {squad.sports && (
              <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                <View className="bg-primary-light px-3 py-1 rounded-full">
                  <Text className="text-primary text-xs font-bold">{squad.sports.name}</Text>
                </View>
              </View>
            )}

            {/* Row 6: skill pill + creator */}
            <View className="flex-row items-center mt-3">
              {skillColor && skill && (
                <View
                  className="flex-row items-center"
                  style={{ backgroundColor: skillColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, gap: 6 }}
                >
                  <Ionicons name="stats-chart" size={13} color="white" />
                  <Text style={{ color: "white", fontSize: 12.5, fontWeight: "700" }}>
                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                  </Text>
                </View>
              )}
              {skillColor && skill ? (
                <View style={{ width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 12 }} />
              ) : null}
              <Ionicons name="person-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
              <Text className="text-muted flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                {squad.profiles?.full_name ?? "Unknown"}
              </Text>
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
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(undefined);
  // "All" / "My Squads" pills, and the Distance dropdown beside them — same
  // row as the Games list, minus its Date pill (squads aren't scheduled).
  const [listFilter, setListFilter] = useState<"all" | "mine">("all");
  const myOnly = listFilter === "mine";
  const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [distanceOpen, setDistanceOpen] = useState(false);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();

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
  const scoped = myOnly ? (locationFiltered ?? []).filter((s) => s.squad_owner_id === userId) : locationFiltered;
  // Squads don't carry their own coordinates (just a typed-in location
  // label), so "near me" is measured from the squad owner's own registered
  // location instead — the closest real coordinates available today.
  const squads =
    distanceKmFilter != null && myCoords
      ? (scoped ?? []).filter((s) => {
          const lat = s.profiles?.latitude;
          const lng = s.profiles?.longitude;
          if (lat == null || lng == null) return false;
          return distanceKm(myCoords.latitude, myCoords.longitude, lat, lng) <= distanceKmFilter;
        })
      : scoped;

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
        <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
          )}
          <View className="flex-1">
            <Text className="text-ink font-extrabold" style={{ fontSize: 26 }}>
              Squads
            </Text>
            <Text className="text-muted" style={{ fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
              Find and join exciting squads near you
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate("CreateSquad")}
          className="flex-row items-center bg-primary rounded-full px-5 py-3"
          style={{ gap: 6, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-bold" style={{ fontSize: 15 }}>
            Create
          </Text>
        </Pressable>
      </View>

      {/* Search — the sport filter used to sit as an icon button here; it's
          now the "Sports" pill in the filter row below instead. */}
      <View className="px-5 mb-3">
        <FieldInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search squads, sport, location..."
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ borderRadius: 28, height: 52 }}
          left={<Ionicons name="search-outline" size={20} color={colors.muted} style={{ marginRight: 8 }} />}
        />
      </View>

      {/* All / My Squads / Distance — one row, evenly spaced. Wrapped in a
          relatively-positioned box so the Distance dropdown below can float
          over "Filter by location" instead of pushing it down. */}
      <View style={{ position: "relative", zIndex: 20 }}>
        <View style={{ marginBottom: 12 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            {(
              [
                { key: "all", label: "All" },
                { key: "mine", label: "My Squads" },
              ] as const
            ).map((p) => {
              const active = listFilter === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => {
                    setDistanceOpen(false);
                    setListFilter(p.key);
                  }}
                  className="rounded-full"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: active ? colors.primary : "white",
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text className="font-medium" style={{ fontSize: 13.5, color: active ? "white" : colors.muted }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
            {/* "Sports" — opens the same sport-select sheet the filter icon
                next to the search box used to open. */}
            <Pressable
              onPress={() => {
                setDistanceOpen(false);
                setSportSheetOpen(true);
              }}
              className="flex-row items-center rounded-full"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 5,
                backgroundColor: selectedSportId ? colors.primary : "white",
                borderWidth: 1,
                borderColor: selectedSportId ? colors.primary : colors.border,
              }}
            >
              <Ionicons name="options-outline" size={14} color={selectedSportId ? "white" : colors.muted} />
              <Text
                className="font-medium"
                style={{ fontSize: 13.5, color: selectedSportId ? "white" : colors.muted }}
                numberOfLines={1}
              >
                Sports
              </Text>
            </Pressable>
            <View>
              {/* The card itself no longer opens the dropdown — only the
                  chevron icon at the end does. */}
              <View
                className="flex-row items-center rounded-full"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  gap: 5,
                  borderWidth: 1,
                  backgroundColor: distanceKmFilter != null ? colors.primary : "white",
                  borderColor: distanceKmFilter != null ? colors.primary : colors.border,
                }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: distanceKmFilter != null ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  }}
                >
                  <Ionicons name="navigate" size={8} color={distanceKmFilter != null ? "white" : colors.muted} />
                </View>
                <Text
                  className="font-medium"
                  style={{ fontSize: 13.5, color: distanceKmFilter != null ? "white" : colors.muted }}
                >
                  {distanceKmFilter != null ? `${distanceKmFilter} km` : "Distance"}
                </Text>
                <Pressable
                  onPress={() => {
                    if (locationStatus !== "granted") requestLocation();
                    setDistanceOpen((v) => !v);
                  }}
                  hitSlop={8}
                >
                  <Ionicons
                    name={distanceOpen ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={distanceKmFilter != null ? "white" : colors.muted}
                  />
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Distance options — a transparent full-screen Modal rather than an
            inline overlay, so a tap anywhere outside the card (including the
            rest of the squads list) closes it; a tap on the card itself is
            swallowed by its own Pressable instead of reaching the backdrop. */}
        <Modal visible={distanceOpen} transparent animationType="none" onRequestClose={() => setDistanceOpen(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setDistanceOpen(false)}>
            <View style={{ position: "absolute", top: insets.top + 168, right: 20 }}>
              {/* Little speech-bubble tail pointing up at the button. */}
              <View
                style={{
                  width: 0,
                  height: 0,
                  marginLeft: 24,
                  borderLeftWidth: 9,
                  borderRightWidth: 9,
                  borderBottomWidth: 9,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderBottomColor: "white",
                }}
              />
              <Pressable onPress={() => {}}>
                <View
                  className="bg-white"
                  style={{
                    minWidth: 250,
                    marginTop: -1,
                    borderRadius: 20,
                    paddingVertical: 6,
                    ...cardShadow,
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                  }}
                >
                  {locationStatus === "denied" && (
                    <Text className="text-muted" style={{ fontSize: 11.5, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 }}>
                      Enable location to filter by distance.
                    </Text>
                  )}
                  {DISTANCE_OPTIONS_KM.map((km, i) => {
                    const selected = distanceKmFilter === km;
                    return (
                      <View key={km}>
                        <Pressable
                          onPress={() => {
                            setDistanceKmFilter(selected ? null : km);
                            setDistanceOpen(false);
                          }}
                          className="flex-row items-center justify-between"
                          style={{
                            marginHorizontal: 6,
                            marginVertical: 3,
                            paddingLeft: 12,
                            paddingRight: 20,
                            paddingVertical: 12,
                            gap: 10,
                            borderRadius: 14,
                            backgroundColor: selected ? colors.primaryLight : "transparent",
                          }}
                        >
                          <View className="flex-row items-center" style={{ gap: 12 }}>
                            <Ionicons name="location" size={20} color={selected ? colors.primary : "#4B5563"} />
                            <Text
                              className={selected ? "font-bold" : "font-semibold"}
                              style={{ fontSize: 17, color: selected ? colors.primary : colors.ink }}
                            >
                              {km} km
                            </Text>
                          </View>
                          {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                        </Pressable>
                        {i < DISTANCE_OPTIONS_KM.length - 1 ? (
                          <View style={{ height: 1, backgroundColor: "#EEF0F1", marginHorizontal: 14 }} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>

      {/* Location filter — always visible. */}
      <View className="px-5 mb-2">
        <SearchField
          value={locationInput}
          onChangeText={setLocationInput}
          prefix="Filter by "
          variants={["location"]}
          autoCapitalize="none"
          autoCorrect={false}
          icon="location-outline"
        />
      </View>
      <SelectSportModal
        visible={sportSheetOpen}
        onClose={() => setSportSheetOpen(false)}
        sports={sports ?? []}
        selectedSportId={selectedSportId}
        onApply={(id) => {
          setSelectedSportId(id);
          setSportSheetOpen(false);
        }}
      />

      {/* Squads list */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={squads ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4, gap: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            debouncedSearch || debouncedLocation || selectedSportId || myOnly || distanceKmFilter != null ? (
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
                          : distanceKmFilter != null
                            ? `No squads found within ${distanceKmFilter} km.`
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
