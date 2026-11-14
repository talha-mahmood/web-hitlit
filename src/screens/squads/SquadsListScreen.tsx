import { View, Text, FlatList, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import Image from "../../components/images/OptimizedImage";
import GeneratedEntityVisual from "../../components/GeneratedEntityVisual";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSquads, useJoinSquad } from "../../hooks/useSquads";
import { useSports } from "../../hooks/useSports";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import FieldInput from "../../components/FieldInput";
import SelectSportModal from "../../components/SelectSportModal";
import SelectDistanceModal from "../../components/SelectDistanceModal";
import SelectLocationModal from "../../components/SelectLocationModal";
import SelectGroupTypeModal from "../../components/SelectGroupTypeModal";
import JoinRequestModal from "../../components/JoinRequestModal";
import Bouncy from "../../components/Bouncy";
import AvatarStack from "../../components/AvatarStack";
import { colors, cardShadow, primaryButtonShadow, LIST_CARD_MIN_HEIGHT } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import { SkeletonCardRows } from "../../components/Skeleton";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { SquadListItem, SquadGroupType } from "../../lib/api/squads";
import type { Database } from "../../types/database.types";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { SQUAD_SKILL_COLORS } from "../../lib/badgeColors";
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import { matchesLocationQuery } from "../../lib/locationFilter";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadsList">;

const GROUP_TYPE_LABELS: Record<SquadGroupType, string> = {
  group: "Group",
  club: "Club",
  training_camp: "Training Camp",
  team: "Team",
};

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
        style={{ ...cardShadow, backgroundColor: colors.surface, borderRadius: 24 }}
        scaleTo={0.98}
      >
        <View className="border border-border overflow-hidden bg-surface" style={{ borderRadius: 24, position: "relative", minHeight: LIST_CARD_MIN_HEIGHT }}>
          {/* Join/Joined/Requested CTA — pinned to the card's top-right
              corner. Nested Bouncy so a tap here doesn't also trigger the
              card's own onPress. */}
          <View style={{ position: "absolute", top: 10, right: 10, zIndex: 5 }}>
            {isClosedToJoins && !hasJoined ? (
              <View className="bg-red-50 rounded-2xl px-2 py-1">
                <Text className="text-red-600 font-bold" style={{ fontSize: 11.5 }}>Full</Text>
              </View>
            ) : !isMySquad && isGenderRestricted ? (
              <View className="bg-gray-100 rounded-2xl px-2 py-1">
                <Text className="text-muted font-bold" style={{ fontSize: 11.5 }}>
                  {squad.gender === "male" ? "Male Only" : "Female Only"}
                </Text>
              </View>
            ) : (
              <Bouncy onPress={hasJoined || isMySquad ? undefined : onJoinPress} scaleTo={0.94}>
                {hasJoined || isMySquad ? (
                  <View
                    className="flex-row items-center justify-center bg-green-50 rounded-2xl px-2 py-1"
                    style={{ gap: 3, minWidth: 60 }}
                  >
                    <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                    <Text className="text-primary font-semibold" style={{ fontSize: 11.5 }}>Joined</Text>
                  </View>
                ) : hasRequested ? (
                  <View className="items-center justify-center bg-orange-50 rounded-2xl px-2 py-1" style={{ minWidth: 60 }}>
                    <Text className="text-orange-600 font-semibold" style={{ fontSize: 11.5 }}>Requested</Text>
                  </View>
                ) : (
                  <GradientFill
                    className="items-center justify-center rounded-2xl px-2 py-1"
                    style={{ minWidth: 60, ...primaryButtonShadow }}
                  >
                    <Text className="text-jazba-white font-bold" style={{ fontSize: 11.5 }}>Join</Text>
                  </GradientFill>
                )}
              </Bouncy>
            )}
          </View>

          {/* Generated squad visual in a soft green disc, tucked into the right edge
              — pushed down (and slightly further off-card) below the CTA
              badge above it, since a longer badge ("Male Only", "Female
              Only") is wider than "Join"/"Full" and was overlapping this
              disc when the two sat closer together. */}
          <View
            pointerEvents="none"
            className="items-center justify-center overflow-hidden"
            style={{
              position: "absolute",
              right: -28,
              top: 44,
              width: 82,
              height: 82,
              borderRadius: 41,
              backgroundColor: colors.primaryLight,
            }}
          >
            <GeneratedEntityVisual
              id={squad.id}
              name={squad.name}
              sport={sportName}
              kind={squad.group_type === "team" ? "team" : "squad"}
              imageUrl={squad.icon_url}
              size={48}
              style={{ marginRight: 17 }}
            />
          </View>

          <View className="px-2.5 pt-2 pb-2">
            {/* Row 2: Icon (if the owner set a custom one) + Name — kept
                clear of the corner CTA above via a wider right gutter, and
                truncates to one line if there isn't room. */}
            <View className="flex-row items-center mb-1" style={{ gap: 6, paddingRight: 80 }}>
              <View
                className="items-center justify-center overflow-hidden"
                style={{ width: 22, height: 22, borderRadius: 22 * 0.2, backgroundColor: colors.primaryLight }}
              >
                {sportPhoto ? (
                  <Image source={sportPhoto} style={{ width: 22, height: 13 }} resizeMode="contain" />
                ) : sportName ? (
                  <MaterialCommunityIcons name={sportGlyph.icon} size={14} color={sportGlyph.fg} style={{ opacity: 0.8 }} />
                ) : (
                  <Ionicons name="people" size={13} color={colors.primary} style={{ opacity: 0.8 }} />
                )}
              </View>
              <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                {squad.name}
              </Text>
            </View>

            {/* Row 3: Location */}
            <View className="flex-row items-center mb-1" style={{ gap: 4, ...rightGutter }}>
              <Ionicons name="location-outline" size={12} color={colors.muted} />
              <Text className="text-muted flex-1" style={{ fontSize: 11.5 }} numberOfLines={1}>
                {squad.location ?? "Location not set"}
              </Text>
            </View>

            {/* Row 4: avatar stack + member count */}
            <View className="flex-row items-center mb-1.5" style={{ gap: 5, ...rightGutter }}>
              <AvatarStack
                people={active.map((m) => ({
                  avatar: m.profiles?.avatar ?? null,
                  name: m.profiles?.full_name ?? null,
                }))}
                size={20}
              />
              <Text className="text-muted font-medium" style={{ fontSize: 11.5 }}>
                {active.length} member{active.length !== 1 ? "s" : ""}
                {!!squad.max_players ? ` · ${active.length}/${squad.max_players}` : ""}
              </Text>
            </View>

            {/* Row 5: Sport badge */}
            {squad.sports && (
              <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                <View className="bg-primary-light px-2 py-0.5 rounded-full">
                  <Text className="text-primary text-xs font-bold">{squad.sports.name}</Text>
                </View>
              </View>
            )}

            {/* Row 6: skill pill + creator — rightGutter keeps the name
                from ever growing under the sport-picture disc tucked into
                the card's right edge. */}
            <View className="flex-row items-center mt-1.5" style={{ ...rightGutter }}>
              {skillColor && skill && (
                <View
                  className="flex-row items-center"
                  style={{ backgroundColor: skillColor, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, gap: 4 }}
                >
                  <Ionicons name="stats-chart" size={11} color="white" />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                  </Text>
                </View>
              )}
              {skillColor && skill ? (
                <View style={{ width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 8 }} />
              ) : null}
              <Ionicons name="person-outline" size={13} color={colors.muted} style={{ marginRight: 4 }} />
              <Text className="text-muted flex-1" style={{ fontSize: 12 }} numberOfLines={1}>
                {squad.profiles?.full_name ?? "Unknown"}
              </Text>
            </View>
          </View>
        </View>
      </Bouncy>
    </Animated.View>
  );
}

// lockedGroupType: renders this same screen scoped to one squad type only
// (e.g. Training Camps) — no type filter pill (there's nothing to pick),
// and Create jumps straight into CreateSquad pre-locked to that type. Used
// by the Community screen's "Explore Training Camps" card; omitted, this
// is the regular all-types Squads list.
export default function SquadsListScreen({ lockedGroupType }: { lockedGroupType?: SquadGroupType } = {}) {
  const navigation = useNavigation<Nav>();
  const kindLabel = lockedGroupType ? GROUP_TYPE_LABELS[lockedGroupType] : "Squad";
  const kindLabelPlural = `${kindLabel}s`;
  const kindLabelPluralLower = kindLabelPlural.toLowerCase();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(undefined);
  // "All" / "My Squads" pills, and the Distance dropdown beside them — same
  // row as the Games list, minus its Date pill (squads aren't scheduled).
  const [listFilter, setListFilter] = useState<"all" | "mine">("all");
  const myOnly = listFilter === "mine";
  const [groupTypeOpen, setGroupTypeOpen] = useState(false);
  const [groupTypeFilters, setGroupTypeFilters] = useState<SquadGroupType[]>([]);
  const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [distanceOpen, setDistanceOpen] = useState(false);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: sports } = useSports();
  const { data: squadsData, isLoading, isRefetching, refetch } = useSquads({
    search: debouncedSearch || undefined,
    sportId: selectedSportId,
  });
  const locationFiltered = locationTags.length > 0
    ? (squadsData ?? []).filter((s) => matchesLocationQuery([s.location], locationTags))
    : squadsData;
  const myScoped = myOnly
    ? (locationFiltered ?? []).filter(
        (s) =>
          s.squad_owner_id === userId ||
          s.squad_members.some((m) => m.user_id === userId && m.status === "ACTIVE")
      )
    : locationFiltered;
  const effectiveTypeFilters = lockedGroupType ? [lockedGroupType] : groupTypeFilters;
  const scoped =
    effectiveTypeFilters.length > 0
      ? (myScoped ?? []).filter((s) => effectiveTypeFilters.includes(s.group_type as SquadGroupType))
      : myScoped;
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
    <View className="flex-1 bg-app">
      {/* Compact dark header; filters and group actions are unchanged. */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.background,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
            {navigation.canGoBack() && (
              <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color={colors.ink} />
              </Pressable>
            )}
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 19 }}>
                {kindLabelPlural}
              </Text>
              <Text className="text-muted" style={{ fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>
                Find and join {kindLabelPluralLower} nearby
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate("CreateSquad", lockedGroupType ? { presetType: lockedGroupType, lockType: true } : undefined)}
            className="flex-row items-center bg-surface rounded-full px-3.5 py-2"
            style={{ gap: 4, ...cardShadow }}
          >
            <Ionicons name="add" size={16} color={colors.primaryDark} />
            <Text className="font-bold" style={{ fontSize: 13, color: colors.primaryDark }}>
              Create
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ paddingTop: 16 }}>
      {/* Search — the sport filter used to sit as an icon button here; it's
          now the "Sports" pill in the filter row below instead. */}
      <View className="px-3.5 mb-3">
        <FieldInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={`Search ${kindLabelPluralLower}...`}
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
            contentContainerStyle={{ paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            {(
              [
                { key: "all", label: "All" },
                { key: "mine", label: `My ${kindLabelPlural}` },
              ] as const
            ).map((p) => {
              const active = listFilter === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => {
                    setDistanceOpen(false);
                    // Tapping the already-active pill again clears it back
                    // to "All" instead of re-selecting itself.
                    setListFilter(active && p.key !== "all" ? "all" : p.key);
                  }}
                  className="rounded-full"
                  style={{ borderWidth: 1, borderColor: active ? colors.primary : colors.border }}
                >
                  {active ? (
                    <GradientFill className="rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5 }}>
                      <Text className="font-medium" style={{ fontSize: 11.5, color: "white" }}>
                        {p.label}
                      </Text>
                    </GradientFill>
                  ) : (
                    <View className="rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.surface }}>
                      <Text className="font-medium" style={{ fontSize: 11.5, color: colors.muted }}>
                        {p.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            {/* "Squad Type" — opens a multi-select popup (Team/Club) rather
                than two separate single-select toggle pills. Hidden entirely
                on a lockedGroupType screen — there's nothing to pick. */}
            {!lockedGroupType && (
              <Pressable
                onPress={() => {
                  setDistanceOpen(false);
                  setGroupTypeOpen(true);
                }}
                className="rounded-full"
                style={{ borderWidth: 1, borderColor: groupTypeFilters.length > 0 ? colors.primary : colors.border }}
              >
                {groupTypeFilters.length > 0 ? (
                  <GradientFill className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5 }}>
                    <Text className="font-medium" style={{ fontSize: 11.5, color: "white" }} numberOfLines={1}>
                      {groupTypeFilters.length === 1
                        ? GROUP_TYPE_LABELS[groupTypeFilters[0]]
                        : `${groupTypeFilters.length} types`}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="white" />
                  </GradientFill>
                ) : (
                  <View className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5, backgroundColor: colors.surface }}>
                    <Text className="font-medium" style={{ fontSize: 11.5, color: colors.muted }}>
                      Squad Type
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={colors.muted} />
                  </View>
                )}
              </Pressable>
            )}
            {/* "Location" — opens a bottom sheet with a free-text field plus
                city suggestions (multi-select), in place of the old
                always-visible inline field. Right after All/My Squads. */}
            <Pressable
              onPress={() => setLocationOpen(true)}
              className="rounded-full"
              style={{ borderWidth: 1, borderColor: locationTags.length > 0 ? colors.primary : colors.border }}
            >
              {locationTags.length > 0 ? (
                <GradientFill className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5 }}>
                  <Ionicons name="location-outline" size={14} color="white" />
                  <Text className="font-medium" style={{ fontSize: 11.5, color: "white" }} numberOfLines={1}>
                    {locationTags.length === 1 ? locationTags[0] : `${locationTags.length} locations`}
                  </Text>
                </GradientFill>
              ) : (
                <View className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5, backgroundColor: colors.surface }}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <Text className="font-medium" style={{ fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
                    Location
                  </Text>
                </View>
              )}
            </Pressable>
            {/* "Sports" — opens the same sport-select sheet the filter icon
                next to the search box used to open. */}
            <Pressable
              onPress={() => {
                setDistanceOpen(false);
                setSportSheetOpen(true);
              }}
              className="rounded-full"
              style={{ borderWidth: 1, borderColor: selectedSportId ? colors.primary : colors.border }}
            >
              {selectedSportId ? (
                <GradientFill className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5 }}>
                  <Ionicons name="options-outline" size={14} color="white" />
                  <Text className="font-medium" style={{ fontSize: 11.5, color: "white" }} numberOfLines={1}>
                    Sports
                  </Text>
                </GradientFill>
              ) : (
                <View className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5, backgroundColor: colors.surface }}>
                  <Ionicons name="options-outline" size={14} color={colors.muted} />
                  <Text className="font-medium" style={{ fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
                    Sports
                  </Text>
                </View>
              )}
            </Pressable>
            {/* "Distance" — plain pill like Sports, opening a bottom sheet
                instead of the small inline dropdown it used to expand into. */}
            <Pressable
              onPress={() => {
                if (locationStatus !== "granted") requestLocation();
                setDistanceOpen(true);
              }}
              className="rounded-full"
              style={{ borderWidth: 1, borderColor: distanceKmFilter != null ? colors.primary : colors.border }}
            >
              {distanceKmFilter != null ? (
                <GradientFill className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5 }}>
                  <Ionicons name="navigate-outline" size={14} color="white" />
                  <Text className="font-medium" style={{ fontSize: 11.5, color: "white" }} numberOfLines={1}>
                    {`${distanceKmFilter} km`}
                  </Text>
                </GradientFill>
              ) : (
                <View className="flex-row items-center rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 5, gap: 5, backgroundColor: colors.surface }}>
                  <Ionicons name="navigate-outline" size={14} color={colors.muted} />
                  <Text className="font-medium" style={{ fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
                    Distance
                  </Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
      </View>

      <SelectDistanceModal
        visible={distanceOpen}
        onClose={() => setDistanceOpen(false)}
        options={DISTANCE_OPTIONS_KM}
        selectedKm={distanceKmFilter}
        locationDenied={locationStatus === "denied"}
        onApply={(km) => {
          setDistanceKmFilter(km);
          setDistanceOpen(false);
        }}
      />

      <SelectLocationModal
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        value={locationTags}
        onApply={(locs) => {
          setLocationTags(locs);
          setLocationOpen(false);
        }}
      />

      <SelectGroupTypeModal
        visible={groupTypeOpen}
        onClose={() => setGroupTypeOpen(false)}
        value={groupTypeFilters}
        onApply={(types) => {
          setGroupTypeFilters(types);
          setGroupTypeOpen(false);
        }}
      />

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
        <View className="px-3.5 pt-1">
          <SkeletonCardRows />
        </View>
      ) : (
        <FlatList
          data={squads ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20, paddingTop: 4, gap: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            debouncedSearch || locationTags.length > 0 || selectedSportId || myOnly || distanceKmFilter != null || groupTypeFilters.length > 0 ? (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No {kindLabelPluralLower} found</Text>
                <Text className="text-muted text-sm text-center px-8">
                  {debouncedSearch && locationTags.length > 0
                    ? `No ${kindLabelPluralLower} match "${debouncedSearch}" near "${locationTags.join(", ")}".`
                    : locationTags.length > 0
                      ? `No ${kindLabelPluralLower} found near "${locationTags.join(", ")}".`
                      : debouncedSearch
                        ? `No ${kindLabelPluralLower} match "${debouncedSearch}". Try a different name or squad ID.`
                        : myOnly
                          ? `You haven't created any ${kindLabelPluralLower} yet.`
                          : distanceKmFilter != null
                            ? `No ${kindLabelPluralLower} found within ${distanceKmFilter} km.`
                            : "No squads match this sport filter yet."}
                </Text>
              </View>
            ) : (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="people-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No {kindLabelPluralLower} yet</Text>
                <Text className="text-muted text-sm text-center px-8">
                  Create a {kindLabel.toLowerCase()} to find regular playmates near you!
                </Text>
                <Pressable onPress={() => navigation.navigate("CreateSquad", lockedGroupType ? { presetType: lockedGroupType, lockType: true } : undefined)}>
                  <GradientFill className="rounded-xl px-6 py-3 mt-2">
                    <Text className="text-jazba-white font-semibold">Create a {kindLabel}</Text>
                  </GradientFill>
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
