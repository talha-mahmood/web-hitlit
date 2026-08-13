import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useGameDetail, useJoinGame, useLeaveGame, useCancelGame, useApprovePlayer, useRejectPlayer, useRemovePlayer } from "../../hooks/useGames";
import { useGameChatUnreadCount } from "../../hooks/useGameMessages";
import { useTournamentTeams } from "../../hooks/useTournamentTeams";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { GameDetail } from "../../lib/api/games";
import JoinRequestModal from "../../components/JoinRequestModal";
import ChatIcon from "../../components/ChatIcon";
import TournamentTeamsSection from "./TournamentTeamsSection";
import type { Database } from "../../types/database.types";

type DetailRoute = RouteProp<GamesStackParamList, "GameDetail">;
type Nav = NativeStackNavigationProp<GamesStackParamList, "GameDetail">;

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// start_time/end_time are TIME columns ('HH:MM:SS'), combine with game_date for display
function formatTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}+05:00`).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// A multi-day tournament's real span is game_date..end_date.
function formatDateRangeFull(gameDate: string, endDate: string): string {
  const [sy, sm, sd] = gameDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const fmt = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).toLocaleDateString("en-PK", { month: "long", day: "numeric", year: "numeric" });
  return `${fmt(sy, sm, sd)} – ${fmt(ey, em, ed)}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start py-3 border-b border-border" style={{ gap: 12 }}>
      <Ionicons name={icon} size={18} color={colors.muted} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        <Text className="text-ink text-sm font-medium mt-0.5">{value}</Text>
      </View>
      {action}
    </View>
  );
}

function PlayerAvatar({
  name,
  avatar,
  isCreator,
  onRemove,
}: {
  name: string | null;
  avatar: string | null;
  isCreator: boolean;
  onRemove?: () => void;
}) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  return (
    <View className="items-center" style={{ width: 64 }}>
      <View>
        {avatar ? (
          <Image source={{ uri: avatar }} className="w-12 h-12 rounded-full bg-primary-light" />
        ) : (
          <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center">
            <Text className="text-primary font-bold text-base">{initials}</Text>
          </View>
        )}
        {onRemove && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            className="absolute -top-1 -right-1 bg-danger rounded-full w-5 h-5 items-center justify-center border-2 border-white"
          >
            <Ionicons name="close" size={11} color="white" />
          </Pressable>
        )}
      </View>
      {isCreator && (
        <View className="bg-primary rounded-full px-1.5 py-0.5 mt-1">
          <Text className="text-white text-xs font-medium">Host</Text>
        </View>
      )}
      <Text className="text-muted text-xs mt-1 text-center" numberOfLines={1}>
        {(name ?? "Player").split(" ")[0]}
      </Text>
    </View>
  );
}

function EmptySlot() {
  return (
    <View className="items-center" style={{ width: 64 }}>
      <View className="w-12 h-12 rounded-full border-2 border-dashed border-border items-center justify-center">
        <Ionicons name="add" size={20} color={colors.border} />
      </View>
      <Text className="text-border text-xs mt-1">Open</Text>
    </View>
  );
}

function skillLevelLabel(skill: string | null): string {
  if (!skill) return "Not specified";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

function PendingRequestRow({
  name,
  avatar,
  skill,
  location,
  onApprove,
  onReject,
  disabled,
}: {
  name: string | null;
  avatar: string | null;
  skill: string | null;
  location: string | null;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  return (
    <View className="py-3 border-b border-border">
      <View className="flex-row items-center" style={{ gap: 12 }}>
        {avatar ? (
          <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
        ) : (
          <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
            <Text className="text-primary font-bold">{initials}</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-ink font-medium text-sm" numberOfLines={1}>
            {name ?? "Player"}
          </Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            {skillLevelLabel(skill)} · {location ?? "Location not specified"}
          </Text>
        </View>
        <Pressable
          onPress={onReject}
          disabled={disabled}
          className="border border-border rounded-lg px-3 py-1.5"
        >
          <Text className="text-muted text-xs font-semibold">Reject</Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          disabled={disabled}
          className="bg-primary rounded-lg px-3 py-1.5"
        >
          <Text className="text-white text-xs font-semibold">Approve</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function GameDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const { data: game, isLoading, error } = useGameDetail(params.gameId);
  // Only meaningful once `game` has loaded and turned out to be a tournament —
  // "" keeps the query/realtime subscription off for regular games and while
  // still loading (see useTournamentTeams: both are no-ops on a falsy gameId).
  const { data: tournamentTeams } = useTournamentTeams(
    game?.game_type === "TOURNAMENT" ? params.gameId : ""
  );
  const { data: chatUnreadCount } = useGameChatUnreadCount(game?.id, userId);
  const joinGame = useJoinGame();
  const leaveGame = useLeaveGame();
  const cancelGame = useCancelGame();
  const approvePlayer = useApprovePlayer(params.gameId);
  const rejectPlayer = useRejectPlayer(params.gameId);
  const removePlayer = useRemovePlayer(params.gameId);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-ink font-semibold text-base mb-2">Game not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-primary font-medium">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const joinedPlayers = game.game_players.filter((p) => p.status === "JOINED");
  const emptySlots = Math.max(0, game.max_players - joinedPlayers.length);
  const isFull = game.status === "FULL" || joinedPlayers.length >= game.max_players;

  const isCreator = game.creator_id === userId;
  const myPlayerRecord = userId
    ? game.game_players.find((p) => p.user_id === userId && p.status === "JOINED")
    : null;
  const myPendingRecord = userId
    ? game.game_players.find((p) => p.user_id === userId && p.status === "PENDING")
    : null;
  const hasJoined = !!myPlayerRecord;
  const hasRequested = !!myPendingRecord;
  // Belt-and-suspenders: the DB-side cron job (expire_past_games) archives and
  // hard-deletes the game every 10 minutes, but this hides the join/leave CTA
  // immediately once the game's end time passes, without waiting on that job to run.
  const hasEnded =
    new Date(`${game.end_date ?? game.game_date}T${game.end_time}+05:00`).getTime() < Date.now();
  const isOpen = (game.status === "OPEN" || game.status === "FULL") && !hasEnded;
  const isCancelled = game.status === "CANCELLED";
  const pendingRequests = game.game_players.filter((p) => p.status === "PENDING");
  const isTournament = game.game_type === "TOURNAMENT";
  // Tournament participation lives entirely in tournament_team_members, not
  // game_players — a captain or regular team member never gets a game_players
  // row, so hasJoined alone would miss them for copy-ID/chat access.
  const isTournamentTeamMember =
    isTournament &&
    !!userId &&
    (tournamentTeams ?? []).some(
      (t) =>
        t.status !== "REJECTED" &&
        t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED")
    );
  // Chat, specifically, only opens up once the host has actually approved the
  // member's team — being on a still-forming or awaiting-approval team isn't
  // "part of the tournament" yet.
  const isApprovedTournamentParticipant =
    isTournament &&
    !!userId &&
    (tournamentTeams ?? []).some(
      (t) =>
        t.status === "APPROVED" &&
        t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED")
    );

  const skillLabel = !game.skill_level ? "Any Level" :
    game.skill_level === "BEGINNER" ? "Beginner" :
    game.skill_level === "INTERMEDIATE" ? "Intermediate" :
    game.skill_level === "ADVANCED" ? "Advanced" : "Pro";

  const genderLabel = game.gender === "male" ? "Male Only" :
    game.gender === "female" ? "Female Only" : "Everyone";

  const handleJoin = () => {
    if (!userId) return;
    setShowJoinModal(true);
  };

  const handleSubmitJoinRequest = (
    skillLevel: Database["public"]["Enums"]["skill_level_type"],
    location: string
  ) => {
    if (!userId) return;
    joinGame.mutate(
      { gameId: game.id, userId, skillLevel, location },
      {
        onSuccess: () => setShowJoinModal(false),
        onError: (err) =>
          Alert.alert("Error", err instanceof Error ? err.message : "Could not send request. Try again."),
      }
    );
  };

  const handleLeave = () => {
    if (!userId) return;
    Alert.alert("Leave Game", "Are you sure you want to leave?", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          leaveGame.mutate(
            { gameId: game.id, userId },
            {
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not leave. Try again."),
            }
          );
        },
      },
    ]);
  };

  const handleCancelRequest = () => {
    if (!userId) return;
    Alert.alert("Cancel Request", "Withdraw your request to join this game?", [
      { text: "Keep Request", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () => {
          leaveGame.mutate(
            { gameId: game.id, userId },
            {
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not withdraw. Try again."),
            }
          );
        },
      },
    ]);
  };

  const handleApprove = (gamePlayerId: string, name: string | null) => {
    approvePlayer.mutate(gamePlayerId, {
      onError: (err) =>
        Alert.alert("Error", err instanceof Error ? err.message : `Could not approve ${name ?? "player"}.`),
    });
  };

  const handleReject = (gamePlayerId: string, name: string | null) => {
    Alert.alert(
      "Reject Request",
      `Reject ${name ?? "this player"}'s request to join?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => {
            rejectPlayer.mutate(gamePlayerId, {
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not reject request."),
            });
          },
        },
      ]
    );
  };

  const handleRemove = (gamePlayerId: string, name: string | null) => {
    Alert.alert(
      "Remove Player",
      `Remove ${name ?? "this player"} from the game? They won't be able to rejoin without sending a new request.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removePlayer.mutate(gamePlayerId, {
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not remove player."),
            });
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    const noun = isTournament ? "tournament" : "game";
    Alert.alert(
      `Cancel ${isTournament ? "Tournament" : "Game"}`,
      `This will cancel the ${noun} for all ${isTournament ? "teams" : "players"}. This cannot be undone.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: `Cancel ${isTournament ? "Tournament" : "Game"}`,
          style: "destructive",
          onPress: () => {
            cancelGame.mutate(game.id, {
              onSuccess: () => navigation.goBack(),
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not cancel."),
            });
          },
        },
      ]
    );
  };

  const handleCopyGameCode = async () => {
    await Clipboard.setStringAsync(game.game_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  const isBusy = joinGame.isPending || leaveGame.isPending || cancelGame.isPending;
  const isApprovingOrRejecting = approvePlayer.isPending || rejectPlayer.isPending || removePlayer.isPending;

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>{game.title}</Text>
          <Text className="text-muted text-sm">{game.sports?.name}</Text>
        </View>
        {isCreator && !isTournament && !isCancelled && !hasEnded && (
          <Pressable
            onPress={() => navigation.navigate("EditGame", { gameId: game.id })}
            className="mr-2 p-1"
          >
            <Ionicons name="create-outline" size={22} color={colors.ink} />
          </Pressable>
        )}
        {(isCreator || hasJoined || isApprovedTournamentParticipant) && (
          <Pressable
            onPress={() => navigation.navigate("GameChat", { gameId: game.id, gameTitle: game.title })}
            className="ml-1 mr-2 items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              backgroundColor: colors.primaryLight,
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <ChatIcon size={19} unreadCount={chatUnreadCount} />
          </Pressable>
        )}
        {isCancelled && (
          <View className="bg-red-50 px-2 py-1 rounded-lg">
            <Text className="text-red-600 text-xs font-semibold">Cancelled</Text>
          </View>
        )}
        {!isCancelled && hasEnded && (
          <View className="bg-gray-100 px-2 py-1 rounded-lg">
            <Text className="text-muted text-xs font-semibold">Ended</Text>
          </View>
        )}
        {!isCancelled && !hasEnded && isFull && (
          <View className="bg-orange-50 px-2 py-1 rounded-lg">
            <Text className="text-orange-600 text-xs font-semibold">Full</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Game info card — shadow lives on this outer, non-clipping
            wrapper since a shadow doesn't render on a view with
            overflow:hidden (needed to clip the header band's corners). */}
        <View className="mx-4 mt-4 rounded-2xl" style={cardShadow}>
          <View className="border border-border rounded-2xl overflow-hidden">
            <View className="bg-primary-light px-4 py-3">
              <Text className="text-primary-dark font-semibold text-sm">
                {isTournament ? "Tournament Details" : "Game Details"}
              </Text>
            </View>
            <View className="px-4">
              <InfoRow
                icon="pricetag-outline"
                label={isTournament ? "Tournament ID" : "Game ID"}
                value={game.game_code}
                action={
                  (isCreator || hasJoined || isTournamentTeamMember) && (
                    <Pressable
                      onPress={handleCopyGameCode}
                      hitSlop={8}
                      className="flex-row items-center px-2.5 py-1.5 rounded-lg bg-gray-100"
                      style={{ gap: 4 }}
                    >
                      <Ionicons
                        name={codeCopied ? "checkmark" : "copy-outline"}
                        size={14}
                        color={codeCopied ? colors.primary : colors.muted}
                      />
                      <Text className={`text-xs font-medium ${codeCopied ? "text-primary" : "text-muted"}`}>
                        {codeCopied ? "Copied" : "Copy"}
                      </Text>
                    </Pressable>
                  )
                }
              />
              {isTournament && game.end_date && game.end_date !== game.game_date ? (
                <>
                  <InfoRow
                    icon="calendar-outline"
                    label="Dates"
                    value={formatDateRangeFull(game.game_date, game.end_date)}
                  />
                  <InfoRow
                    icon="time-outline"
                    label="Daily Start Time"
                    value={formatTime(game.game_date, game.start_time)}
                  />
                </>
              ) : (
                <>
                  <InfoRow icon="calendar-outline" label="Date" value={formatDateFull(game.game_date)} />
                  <InfoRow
                    icon="time-outline"
                    label="Time"
                    value={`${formatTime(game.game_date, game.start_time)} – ${formatTime(game.game_date, game.end_time)}`}
                  />
                </>
              )}
              {game.venues && (
                <InfoRow
                  icon="location-outline"
                  label="Venue"
                  value={`${game.venues.name}${game.venues.city ? `, ${game.venues.city}` : ""}`}
                />
              )}
              <InfoRow icon="speedometer-outline" label="Skill Level" value={skillLabel} />
              <InfoRow icon="people-outline" label="Open To" value={genderLabel} />
              <InfoRow
                icon="cash-outline"
                label="Entry Fee"
                value={game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()} (pay at venue)` : "Free"}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        {!!game.description && (
          <View className="mx-4 mt-4 border border-border rounded-2xl p-4" style={cardShadow}>
            <Text className="text-ink font-semibold text-sm mb-2">
              About this {isTournament ? "tournament" : "game"}
            </Text>
            <Text className="text-muted text-sm leading-relaxed">{game.description}</Text>
          </View>
        )}

        {/* Players (regular games) / Teams (tournaments) */}
        {isTournament ? (
          <TournamentTeamsSection game={game} />
        ) : (
          <>
            <View className="mx-4 mt-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-ink font-semibold text-sm">
                  Players ({joinedPlayers.length}/{game.max_players})
                </Text>
                <Text className="text-muted text-sm">
                  {emptySlots > 0 ? `${emptySlots} spot${emptySlots !== 1 ? "s" : ""} left` : "Full"}
                </Text>
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {joinedPlayers.map((p) => (
                  <PlayerAvatar
                    key={p.id}
                    name={p.profiles?.full_name ?? null}
                    avatar={p.profiles?.avatar ?? null}
                    isCreator={p.user_id === game.creator_id}
                    onRemove={
                      isCreator && p.user_id !== game.creator_id && !isApprovingOrRejecting
                        ? () => handleRemove(p.id, p.profiles?.full_name ?? null)
                        : undefined
                    }
                  />
                ))}
                {Array.from({ length: Math.min(emptySlots, 8) }).map((_, i) => (
                  <EmptySlot key={`empty-${i}`} />
                ))}
              </View>
            </View>

            {/* Pending join requests — host only */}
            {isCreator && pendingRequests.length > 0 && (
              <View className="mx-4 mt-4 border border-border rounded-2xl p-4" style={cardShadow}>
                <Text className="text-ink font-semibold text-sm mb-1">
                  Join Requests ({pendingRequests.length})
                </Text>
                <Text className="text-muted text-xs mb-2">
                  Approve players before they're added to the game.
                </Text>
                {pendingRequests.map((p) => (
                  <PendingRequestRow
                    key={p.id}
                    name={p.profiles?.full_name ?? null}
                    avatar={p.profiles?.avatar ?? null}
                    skill={p.skill_level}
                    location={p.location}
                    disabled={isApprovingOrRejecting || isFull}
                    onApprove={() => handleApprove(p.id, p.profiles?.full_name ?? null)}
                    onReject={() => handleReject(p.id, p.profiles?.full_name ?? null)}
                  />
                ))}
                {isFull && (
                  <Text className="text-orange-600 text-xs mt-2">
                    Game is full — reject remaining requests or remove a player to approve more.
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Host */}
        <View
          className="mx-4 mt-4 flex-row items-center border border-border rounded-2xl p-4"
          style={{ gap: 12, ...cardShadow }}
        >
          {game.profiles?.avatar ? (
            <Image
              source={{ uri: game.profiles.avatar }}
              className="w-10 h-10 rounded-full bg-primary-light"
            />
          ) : (
            <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
              <Text className="text-primary font-bold">
                {(game.profiles?.full_name ?? "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text className="text-muted text-xs">Hosted by</Text>
            <Text className="text-ink font-semibold text-sm">
              {game.profiles?.full_name ?? "Unknown"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA — for tournaments, non-host actions (create/join a team) live
          inline in TournamentTeamsSection instead of a single bottom button */}
      {isOpen && (isCreator || !isTournament) && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 pt-3 pb-6">
          {isBusy ? (
            <ActivityIndicator color={colors.primary} />
          ) : isCreator ? (
            <Pressable
              onPress={handleCancel}
              className="border border-danger rounded-xl py-4 items-center"
            >
              <Text className="text-danger font-semibold">
                Cancel This {isTournament ? "Tournament" : "Game"}
              </Text>
            </Pressable>
          ) : hasJoined ? (
            <Pressable
              onPress={handleLeave}
              className="border border-danger rounded-xl py-4 items-center"
            >
              <Text className="text-danger font-semibold">Leave Game</Text>
            </Pressable>
          ) : hasRequested ? (
            <View style={{ gap: 8 }}>
              <View className="bg-orange-50 rounded-xl py-3 items-center">
                <Text className="text-orange-600 font-semibold">
                  Request Sent — Awaiting Host Approval
                </Text>
              </View>
              <Pressable
                onPress={handleCancelRequest}
                className="border border-danger rounded-xl py-3 items-center"
              >
                <Text className="text-danger font-semibold">Cancel Request</Text>
              </Pressable>
            </View>
          ) : isFull ? (
            <View className="bg-gray-100 rounded-xl py-4 items-center">
              <Text className="text-muted font-semibold">Game is Full</Text>
            </View>
          ) : (
            <Pressable
              onPress={handleJoin}
              className="bg-primary rounded-xl py-4 items-center"
              style={primaryButtonShadow}
            >
              <Text className="text-white font-semibold text-base">
                {game.entry_fee > 0
                  ? `Request to Join · Rs ${game.entry_fee.toLocaleString()}`
                  : "Request to Join"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <JoinRequestModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSubmit={handleSubmitJoinRequest}
        submitting={joinGame.isPending}
        title="Request to Join"
        subtitle={
          game.entry_fee > 0
            ? `Entry fee: Rs ${game.entry_fee.toLocaleString()} (pay at the venue). The host must approve your request before you're added.`
            : "The host must approve your request before you're added."
        }
      />
    </View>
  );
}
