import { View, Text, Pressable } from "react-native";
import Image from "./images/OptimizedImage";
import GeneratedEntityVisual from "./GeneratedEntityVisual";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import { getSportIcon } from "../lib/sportIcons";
import { getSportImage, getSportCardThumb } from "../lib/sportImages";
import { formatDistanceKm } from "../lib/distance";
import { dayLabel, timeBadgeColor } from "../lib/badgeColors";
import AvatarStack from "./AvatarStack";
import Bouncy from "./Bouncy";
import type { GameListItem } from "../lib/api/games";
import type { SquadListItem } from "../lib/api/squads";
import type { EventListItem } from "../lib/api/events";

// Shared square sport image tile used on Home and Create Group. Photo tiles
// use the full square canvas so no dark inset frame remains around the image.
export function HomeSportTile({
  name,
  selected,
  width,
  onPress,
}: {
  name: string;
  selected: boolean;
  width: number;
  onPress: () => void;
}) {
  const photo = getSportImage(name);
  const { icon, bg, fg } = getSportIcon(name);

  return (
    <Pressable onPress={onPress} style={{ width, alignItems: "center" }}>
      <View
        className="items-center justify-center overflow-hidden"
        style={{
          width,
          height: width,
          borderRadius: 14,
          padding: photo ? 0 : 10,
          backgroundColor: photo ? "transparent" : colors.surface,
          // Only the selected tile has a visible border. Unselected tiles keep
          // the same width but transparent, so nothing shifts on select.
          borderWidth: 2.5,
          borderColor: selected ? colors.primary : "transparent",
        }}
      >
        {photo ? (
          <Image source={photo} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        ) : (
          <View
            className="items-center justify-center rounded-full"
            style={{ width: "100%", height: "100%", backgroundColor: bg }}
          >
            <MaterialCommunityIcons name={icon} size={width * 0.42} color={fg} />
          </View>
        )}
      </View>
      <Text
        className={`text-center mt-1.5 ${selected ? "text-primary font-bold" : "text-ink font-semibold"}`}
        style={{ fontSize: 12 }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  );
}

// Wide squad card — icon + name/location on top, member avatars + a status
// pill below. The pill is a plain status label derived from data the list
// already carries (not a separate join action) — the whole card's onPress
// still just opens the squad detail screen, same as before.
export function HomeSquadCard({
  squad,
  currentUserId,
  myGender,
  onPress,
  distanceLabel,
  onChallenge,
  challengePending = false,
}: {
  squad: SquadListItem;
  currentUserId?: string;
  myGender?: string | null;
  onPress: () => void;
  distanceLabel?: string;
  onChallenge?: () => void;
  // A challenge to this squad is already pending their response — shows a
  // disabled "Pending" pill instead of the "Challenge" button until they
  // accept (or decline/it's cancelled), matching ChallengeTeamsScreen.
  challengePending?: boolean;
}) {
  const active = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const isFull = !!squad.max_players && active.length >= squad.max_players;
  // Owner-closed via "Block New Join Requests" — treated the same as full.
  const isClosedToJoins = isFull || squad.join_requests_blocked;
  const hasJoined = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  const isGenderRestricted =
    squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;

  const statusLabel = isClosedToJoins
    ? "Full"
    : isGenderRestricted
      ? squad.gender === "male"
        ? "Male Only"
        : "Female Only"
      : hasJoined
        ? "Joined"
        : "Join";
  const statusColor = isClosedToJoins || isGenderRestricted ? colors.muted : hasJoined ? colors.primary : colors.primary;
  const statusBg = isClosedToJoins || isGenderRestricted ? colors.surfaceOverlay : hasJoined ? colors.primaryLight : colors.primaryLight;

  return (
    <Bouncy
      onPress={onPress}
      style={{ ...cardShadow, backgroundColor: colors.surface, borderRadius: 16, flex: 1 }}
      scaleTo={0.98}
    >
      <View className="border border-border rounded-2xl bg-surface p-3">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <GeneratedEntityVisual id={squad.id} name={squad.name} sport={squad.sports?.name} kind={squad.group_type === "team" ? "team" : "squad"} imageUrl={squad.icon_url} size={36} />
          <View className="flex-1">
            <Text className="text-ink font-bold text-sm" numberOfLines={1}>
              {squad.name}
            </Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
              {active.length}{squad.max_players ? `/${squad.max_players}` : ""} members
            </Text>
          </View>
          {distanceLabel ? (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="navigate-outline" size={13} color={colors.primary} />
              <Text className="text-muted text-xs">{distanceLabel} away</Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center justify-between mt-3">
          <AvatarStack
            people={active.map((m) => ({ avatar: m.profiles?.avatar ?? null, name: m.profiles?.full_name ?? null }))}
            size={22}
          />
          {onChallenge && challengePending ? (
            <View className="rounded-full px-3 py-1 border border-border" style={{ backgroundColor: colors.surfaceRaised, minHeight: 30, justifyContent: "center" }}>
              <Text className="text-muted font-bold" style={{ fontSize: 12 }}>Pending</Text>
            </View>
          ) : onChallenge ? (
            <Pressable
              onPress={(event) => { event.stopPropagation(); onChallenge(); }}
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: colors.primary, minHeight: 30, justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel={`Challenge ${squad.name}`}
            >
              <Text className="text-white font-bold" style={{ fontSize: 12 }}>Challenge</Text>
            </Pressable>
          ) : (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: statusBg }}>
              <Text className="text-xs font-bold" style={{ color: statusColor }}>
                {statusLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Bouncy>
  );
}

// Wide event card — same shell as HomeSquadCard, minus the sport photo
// (events aren't tied to a sport) and the max_players capacity (events have
// no capacity field) — a generic calendar icon stands in for the photo.
export function HomeEventCard({
  event,
  currentUserId,
  myGender,
  onPress,
}: {
  event: EventListItem;
  currentUserId?: string;
  myGender?: string | null;
  onPress: () => void;
}) {
  const active = event.event_members.filter((m) => m.status === "ACTIVE");
  const isClosedToJoins = event.join_requests_blocked;
  const hasJoined = event.event_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = event.event_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  const isGenderRestricted =
    event.gender !== "mixed" && (!myGender || myGender !== event.gender) && !hasJoined && !hasRequested;

  const statusLabel = isClosedToJoins
    ? "Closed"
    : isGenderRestricted
      ? event.gender === "male"
        ? "Male Only"
        : "Female Only"
      : hasJoined
        ? "Joined"
        : "Join";
  const statusColor = isClosedToJoins || isGenderRestricted ? colors.muted : colors.primary;
  const statusBg = isClosedToJoins || isGenderRestricted ? colors.surfaceOverlay : colors.primaryLight;

  return (
    <Bouncy
      onPress={onPress}
      style={{ ...cardShadow, backgroundColor: colors.surface, borderRadius: 16, flex: 1 }}
      scaleTo={0.98}
    >
      <View className="border border-border rounded-2xl bg-surface p-3">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <GeneratedEntityVisual id={event.id} name={event.name} sport={event.event_type} kind="event" imageUrl={event.icon_url} size={36} />
          <View className="flex-1">
            <Text className="text-ink font-bold text-sm" numberOfLines={1}>
              {event.name}
            </Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
              {active.length} member{active.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between mt-3">
          <AvatarStack
            people={active.map((m) => ({ avatar: m.profiles?.avatar ?? null, name: m.profiles?.full_name ?? null }))}
            size={22}
          />
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: statusBg }}>
            <Text className="text-xs font-bold" style={{ color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>
    </Bouncy>
  );
}

function formatTimeRange(startTime: string): string {
  return new Date(`2000-01-01T${startTime}`).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Wide single-row card for both games and tournaments — thumbnail, title +
// day badge, location, time, joined avatars, and a status pill. Same as
// HomeSquadCard, the pill is a derived label only; the card's onPress is
// still the only interactive action (navigates to the game/tournament
// detail screen exactly as the compact tile version already did).
export function HomeGameRowCard({
  game,
  distanceKm,
  onPress,
}: {
  game: GameListItem;
  distanceKm: number | null;
  onPress: () => void;
}) {
  const isTournament = game.game_type === "TOURNAMENT";
  // True for real tournaments and for regular games created with the newer
  // team-based join flow (2 teams by default) — false only for old-style
  // regular games that still use the flat game_players join list.
  const isTeamBased = game.number_of_teams != null;
  const joined = game.game_players.filter((p) => p.status === "JOINED");
  const badgeColor = isTournament ? "#7C3AED" : timeBadgeColor(game.start_time);
  const placeName = game.venues?.name ?? game.custom_venue_name ?? "Location TBD";
  const photo = getSportCardThumb(game.sports?.name ?? "");
  const { icon, bg, fg } = getSportIcon(game.sports?.name ?? "");
  const isFull = game.status === "FULL" || (!isTeamBased && joined.length >= game.max_players);

  return (
    <Bouncy
      onPress={onPress}
      style={{ ...cardShadow, backgroundColor: colors.surface, borderRadius: 16 }}
      scaleTo={0.98}
      className="mb-3"
    >
      <View className="flex-row items-center border border-border rounded-2xl bg-surface p-3" style={{ gap: 12 }}>
        {photo ? (
          <Image source={photo} style={{ width: 60, height: 60, borderRadius: 14 }} resizeMode="cover" />
        ) : (
          <View
            className="items-center justify-center"
            style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: bg }}
          >
            <MaterialCommunityIcons name={icon} size={28} color={fg} />
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>
              {game.title}
            </Text>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badgeColor }}>
              <Text className="text-jazba-white text-[10px] font-bold">{dayLabel(game.game_date)}</Text>
            </View>
          </View>
          <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
            <Ionicons name="location-outline" size={12} color={colors.muted} />
            <Text className="text-muted text-xs flex-1" numberOfLines={1}>
              {placeName}
              {distanceKm !== null ? ` · ${formatDistanceKm(distanceKm)}` : ""}
            </Text>
          </View>
          <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={colors.muted} />
            <Text className="text-muted text-xs">{formatTimeRange(game.start_time)}</Text>
          </View>
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <AvatarStack
                people={joined.map((p) => ({ avatar: p.profiles?.avatar ?? null, name: p.profiles?.full_name ?? null }))}
                size={20}
              />
              <Text className="text-muted text-[11px] font-medium">
                {joined.length}
                {!isTeamBased ? `/${game.max_players}` : ""} joined
              </Text>
            </View>
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: isFull ? colors.surfaceOverlay : colors.primaryLight }}
            >
              <Text className="text-xs font-bold" style={{ color: isFull ? colors.muted : colors.primary }}>
                {isTeamBased ? "View Details" : isFull ? "Full" : "Join"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Bouncy>
  );
}
