import { View, Text, FlatList, ScrollView, Pressable, RefreshControl, Alert } from "react-native";
import GeneratedEntityVisual from "../../components/GeneratedEntityVisual";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useEvents, useJoinEvent } from "../../hooks/useEvents";
import { isEventLive, hasEventEnded } from "../../lib/api/events";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { distanceKm } from "../../lib/distance";
import FieldInput from "../../components/FieldInput";
import SelectDistanceModal from "../../components/SelectDistanceModal";
import SelectLocationModal from "../../components/SelectLocationModal";
import EventJoinRequestModal from "../../components/EventJoinRequestModal";
import Bouncy from "../../components/Bouncy";
import AvatarStack from "../../components/AvatarStack";
import { colors, cardShadow, primaryButtonShadow, LIST_CARD_MIN_HEIGHT } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import { SkeletonCardRows } from "../../components/Skeleton";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import type { EventListItem } from "../../lib/api/events";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { matchesLocationQuery } from "../../lib/locationFilter";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "ExploreEvents">;

function EventCard({
  event,
  onPress,
  onJoinPress,
  currentUserId,
  myGender,
  index,
}: {
  event: EventListItem;
  onPress: () => void;
  onJoinPress: () => void;
  currentUserId?: string;
  myGender?: string | null;
  index: number;
}) {
  const active = event.event_members.filter((m) => m.status === "ACTIVE");
  // Owner-closed via "Block New Join Requests" on the event's own page.
  const isClosedToJoins = event.join_requests_blocked;
  const isMyEvent = event.event_owner_id === currentUserId;
  // An event owner auto-joins their own event as captain, so hasJoined
  // already covers them too — no separate "My Event" badge needed.
  const hasJoined = event.event_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = event.event_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  // A Male Only/Female Only event can't be joined by someone who doesn't
  // match — enforced server-side too (event_members RLS), this just keeps
  // the CTA from offering something that would be rejected.
  const isGenderRestricted =
    event.gender !== "mixed" && (!myGender || myGender !== event.gender) && !hasJoined && !hasRequested;
  // The name/location/members rows keep clear of the icon disc on the right.
  const rightGutter = { paddingRight: 92 };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
      <Bouncy
        onPress={onPress}
        style={{ ...cardShadow, backgroundColor: colors.surface, borderRadius: 24 }}
        scaleTo={0.98}
      >
        <View className="border border-border overflow-hidden bg-surface" style={{ borderRadius: 24, position: "relative", minHeight: LIST_CARD_MIN_HEIGHT }}>
          {/* Join/Joined/Requested CTA — pinned to the card's top-right corner. */}
          <View style={{ position: "absolute", top: 10, right: 10, zIndex: 5 }}>
            {isClosedToJoins && !hasJoined ? (
              <View className="bg-gray-100 rounded-2xl px-2 py-1">
                <Text className="text-muted font-bold" style={{ fontSize: 11.5 }}>Closed</Text>
              </View>
            ) : !isMyEvent && isGenderRestricted ? (
              <View className="bg-gray-100 rounded-2xl px-2 py-1">
                <Text className="text-muted font-bold" style={{ fontSize: 11.5 }}>
                  {event.gender === "male" ? "Male Only" : "Female Only"}
                </Text>
              </View>
            ) : (
              <Bouncy onPress={hasJoined || isMyEvent ? undefined : onJoinPress} scaleTo={0.94}>
                {hasJoined || isMyEvent ? (
                  <View className="flex-row items-center justify-center bg-green-50 rounded-2xl px-2 py-1" style={{ gap: 3, minWidth: 60 }}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                    <Text className="text-primary font-semibold" style={{ fontSize: 11.5 }}>Joined</Text>
                  </View>
                ) : hasRequested ? (
                  <View className="items-center justify-center bg-orange-50 rounded-2xl px-2 py-1" style={{ minWidth: 60 }}>
                    <Text className="text-orange-600 font-semibold" style={{ fontSize: 11.5 }}>Requested</Text>
                  </View>
                ) : (
                  <GradientFill className="items-center justify-center rounded-2xl px-2 py-1" style={{ minWidth: 60, ...primaryButtonShadow }}>
                    <Text className="text-jazba-white font-bold" style={{ fontSize: 11.5 }}>Join</Text>
                  </GradientFill>
                )}
              </Bouncy>
            )}
          </View>

          {/* Icon disc, tucked into the right edge — generic calendar glyph
              since events have no sport to show a photo for. */}
          <View
            pointerEvents="none"
            className="items-center justify-center overflow-hidden"
            style={{ position: "absolute", right: -28, top: 44, width: 82, height: 82, borderRadius: 41, backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="calendar" size={32} color={colors.primary} style={{ marginRight: 17, opacity: 0.8 }} />
          </View>

          <View className="px-2.5 pt-2 pb-2">
            {/* Row 2: Icon (if the owner set a custom one) + Name */}
            <View className="flex-row items-center mb-1" style={{ gap: 6, paddingRight: 80 }}>
              <GeneratedEntityVisual id={event.id} name={event.name} sport={event.event_type} kind="event" imageUrl={event.icon_url} size={22} />
              <Text className="text-ink font-extrabold flex-1" style={{ fontSize: 14 }} numberOfLines={1}>
                {event.name}
              </Text>
            </View>

            {/* Row 3: Location */}
            <View className="flex-row items-center mb-1" style={{ gap: 4, ...rightGutter }}>
              <Ionicons name="location-outline" size={12} color={colors.muted} />
              <Text className="text-muted flex-1" style={{ fontSize: 11.5 }} numberOfLines={1}>
                {event.location ?? "Location not set"}
              </Text>
            </View>

            {/* Row 4: avatar stack + member count */}
            <View className="flex-row items-center mb-1.5" style={{ gap: 5, ...rightGutter }}>
              <AvatarStack
                people={active.map((m) => ({ avatar: m.profiles?.avatar ?? null, name: m.profiles?.full_name ?? null }))}
                size={20}
              />
              <Text className="text-muted font-medium" style={{ fontSize: 11.5 }}>
                {active.length} member{active.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {/* Row 5: Event type badge */}
            <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
              <View className="bg-primary-light px-2 py-0.5 rounded-full">
                <Text className="text-primary text-xs font-bold">{event.event_type}</Text>
              </View>
            </View>

            {/* Row 6: host name */}
            <View className="flex-row items-center mt-1.5" style={{ ...rightGutter }}>
              <Ionicons name="person-outline" size={13} color={colors.muted} style={{ marginRight: 4 }} />
              <Text className="text-muted flex-1" style={{ fontSize: 12 }} numberOfLines={1}>
                {event.profiles?.full_name ?? "Unknown"}
              </Text>
            </View>
          </View>
        </View>
      </Bouncy>
    </Animated.View>
  );
}

export default function ExploreEventsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationTags, setLocationTags] = useState<string[]>([]);
  // "All" / "Upcoming" / "Live" / "Completed" / "My Events" pills, and the
  // Distance dropdown beside it — same row (and same mutually-exclusive
  // single-select pattern) as the Explore Tournaments list.
  const [listFilter, setListFilter] = useState<"all" | "upcoming" | "live" | "completed" | "mine">("all");
  const myOnly = listFilter === "mine";
  const upcomingOnlyFilter = listFilter === "upcoming";
  const liveOnlyFilter = listFilter === "live";
  const completedOnlyFilter = listFilter === "completed";
  const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [distanceOpen, setDistanceOpen] = useState(false);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: eventsData, isLoading, isRefetching, refetch } = useEvents({ search: debouncedSearch || undefined });
  const locationFiltered = locationTags.length > 0
    ? (eventsData ?? []).filter((e) => matchesLocationQuery([e.location], locationTags))
    : eventsData;
  const myScoped = myOnly
    ? (locationFiltered ?? []).filter(
        (e) => e.event_owner_id === userId || e.event_members.some((m) => m.user_id === userId && m.status === "ACTIVE")
      )
    : upcomingOnlyFilter
      ? (locationFiltered ?? []).filter(
          (e) =>
            !hasEventEnded(e.event_date, e.end_date, e.end_time) &&
            !isEventLive(e.event_date, e.start_time, e.end_date, e.end_time)
        )
      : liveOnlyFilter
        ? (locationFiltered ?? []).filter((e) => isEventLive(e.event_date, e.start_time, e.end_date, e.end_time))
        : completedOnlyFilter
          ? (locationFiltered ?? []).filter((e) => hasEventEnded(e.event_date, e.end_date, e.end_time))
          : locationFiltered;
  // Events don't carry their own coordinates (just a typed-in location
  // label), so "near me" is measured from the event owner's own registered
  // location instead — the closest real coordinates available today.
  const events =
    distanceKmFilter != null && myCoords
      ? (myScoped ?? []).filter((e) => {
          const lat = e.profiles?.latitude;
          const lng = e.profiles?.longitude;
          if (lat == null || lng == null) return false;
          return distanceKm(myCoords.latitude, myCoords.longitude, lat, lng) <= distanceKmFilter;
        })
      : myScoped;

  // Join-request modal is a single shared instance (not one per card) —
  // this tracks which event (if any) it's currently open for.
  const [joinTargetEvent, setJoinTargetEvent] = useState<EventListItem | null>(null);
  const joinEvent = useJoinEvent();
  const handleSubmitJoinRequest = (location: string) => {
    if (!userId || !joinTargetEvent) return;
    joinEvent.mutate(
      { eventId: joinTargetEvent.id, userId, location },
      {
        onSuccess: () => setJoinTargetEvent(null),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request.")),
      }
    );
  };

  return (
    <View className="flex-1 bg-app">
      {/* Compact dark header; search, hosting, and filtering stay intact. */}
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
                Events
              </Text>
              <Text className="text-muted" style={{ fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>
                Find and join events nearby
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate("HostEvent")}
            className="flex-row items-center bg-surface rounded-full px-3.5 py-2"
            style={{ gap: 4, ...cardShadow }}
          >
            <Ionicons name="add" size={16} color={colors.primaryDark} />
            <Text className="font-bold" style={{ fontSize: 13, color: colors.primaryDark }}>
              Host
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ paddingTop: 16 }}>
        <View className="px-3.5 mb-3">
          <FieldInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search events..."
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ borderRadius: 28, height: 52 }}
            left={<Ionicons name="search-outline" size={20} color={colors.muted} style={{ marginRight: 8 }} />}
          />
        </View>

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
                  { key: "upcoming", label: "Upcoming" },
                  { key: "live", label: "Live" },
                  { key: "completed", label: "Completed" },
                  { key: "mine", label: "My Events" },
                ] as const
              ).map((p) => {
                const active = listFilter === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      setDistanceOpen(false);
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

      {isLoading ? (
        <View className="px-3.5 pt-1">
          <SkeletonCardRows />
        </View>
      ) : (
        <FlatList
          data={events ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20, paddingTop: 4, gap: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            debouncedSearch || locationTags.length > 0 || listFilter !== "all" || distanceKmFilter != null ? (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No events found</Text>
                <Text className="text-muted text-sm text-center px-8">
                  {debouncedSearch && locationTags.length > 0
                    ? `No events match "${debouncedSearch}" near "${locationTags.join(", ")}".`
                    : locationTags.length > 0
                      ? `No events found near "${locationTags.join(", ")}".`
                      : debouncedSearch
                        ? `No events match "${debouncedSearch}". Try a different name or event type.`
                        : myOnly
                          ? "You haven't hosted any events yet."
                          : upcomingOnlyFilter
                            ? "No upcoming events right now."
                            : liveOnlyFilter
                              ? "No events are live right now."
                              : completedOnlyFilter
                                ? "No completed events yet."
                                : `No events found within ${distanceKmFilter} km.`}
                </Text>
              </View>
            ) : (
              <View className="items-center mt-16" style={{ gap: 12 }}>
                <Ionicons name="calendar-outline" size={48} color={colors.border} />
                <Text className="text-ink font-semibold text-base">No events yet</Text>
                <Text className="text-muted text-sm text-center px-8">
                  Host an event to bring players together near you!
                </Text>
                <Pressable onPress={() => navigation.navigate("HostEvent")}>
                  <GradientFill className="rounded-xl px-6 py-3 mt-2">
                    <Text className="text-jazba-white font-semibold">Host an Event</Text>
                  </GradientFill>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <EventCard
              event={item}
              currentUserId={userId}
              myGender={myGender}
              index={index}
              onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
              onJoinPress={() => setJoinTargetEvent(item)}
            />
          )}
        />
      )}

      <EventJoinRequestModal
        visible={!!joinTargetEvent}
        onClose={() => setJoinTargetEvent(null)}
        onSubmit={handleSubmitJoinRequest}
        submitting={joinEvent.isPending}
        title="Request to Join"
        subtitle="The event host will see this and can approve or reject your request."
      />
    </View>
  );
}
