import { View, Text, Image, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import { getSportIcon } from "../lib/sportIcons";
import { getSportImage } from "../lib/sportImages";
import { formatDistanceKm } from "../lib/distance";
import { dayLabel, timeBadgeColor } from "../lib/badgeColors";
import AvatarStack from "./AvatarStack";
import Bouncy from "./Bouncy";
import type { GameListItem } from "../lib/api/games";
import type { SquadListItem } from "../lib/api/squads";

// Home-screen-only variant of the "Filter by Sport" tile — a taller, photo-
// led rounded-square card instead of SportsBySportSection's circular badge,
// to match the home screen's own visual language. SportsBySportSection
// itself is left untouched since Create Game/Tournament and Players
// Dashboard still use its circular style.
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
        className="items-center justify-center overflow-hidden bg-white"
        style={{
          width,
          height: width,
          borderRadius: 18,
          padding: 10,
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? colors.primary : colors.border,
        }}
      >
        {photo ? (
          <Image
            source={photo}
            style={{ width: "100%", height: "100%", borderRadius: 10 }}
            resizeMode="contain"
          />
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
}: {
  squad: SquadListItem;
  currentUserId?: string;
  myGender?: string | null;
  onPress: () => void;
}) {
  const active = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const isFull = !!squad.max_players && active.length >= squad.max_players;
  // Owner-closed via "Block New Join Requests" — treated the same as full.
  const isClosedToJoins = isFull || squad.join_requests_blocked;
  const hasJoined = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  const isGenderRestricted =
    squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;
  const { icon, bg, fg } = getSportIcon(squad.sports?.name ?? "");
  const photo = squad.icon_url ? { uri: squad.icon_url } : getSportImage(squad.sports?.name ?? "");

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
  const statusBg = isClosedToJoins || isGenderRestricted ? "#F3F4F6" : hasJoined ? colors.primaryLight : colors.primaryLight;

  return (
    <Bouncy
      onPress={onPress}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16, flex: 1 }}
      scaleTo={0.98}
    >
      <View className="border border-border rounded-2xl bg-white p-3" style={{ minHeight: 108 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {photo ? (
            <Image source={photo} style={{ width: 36, height: 36, borderRadius: 10 }} resizeMode="cover" />
          ) : (
            <View
              className="items-center justify-center"
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg }}
            >
              <MaterialCommunityIcons name={icon} size={18} color={fg} />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-ink font-bold text-sm" numberOfLines={1}>
              {squad.name}
            </Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
              {active.length}/{squad.max_players ?? "—"} players
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
  const photo = getSportImage(game.sports?.name ?? "");
  const { icon, bg, fg } = getSportIcon(game.sports?.name ?? "");
  const isFull = game.status === "FULL" || (!isTeamBased && joined.length >= game.max_players);

  return (
    <Bouncy
      onPress={onPress}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16 }}
      scaleTo={0.98}
      className="mb-3"
    >
      <View className="flex-row items-center border border-border rounded-2xl bg-white p-3" style={{ gap: 12 }}>
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
              <Text className="text-white text-[10px] font-bold">{dayLabel(game.game_date)}</Text>
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
              style={{ backgroundColor: isFull ? "#F3F4F6" : colors.primaryLight }}
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
