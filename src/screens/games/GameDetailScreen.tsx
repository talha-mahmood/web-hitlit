import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useGameDetail, useJoinGame, useLeaveGame, useCancelGame, useApprovePlayer, useRejectPlayer, useRemovePlayer } from "../../hooks/useGames";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { GameDetail } from "../../lib/api/games";

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

// ── sub-components ────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  return (
    <View className="flex-row items-start py-3 border-b border-border" style={{ gap: 12 }}>
      <Ionicons name={icon} size={18} color={colors.muted} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        <Text className="text-ink text-sm font-medium mt-0.5">{value}</Text>
      </View>
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

function PendingRequestRow({
  name,
  avatar,
  onApprove,
  onReject,
  disabled,
}: {
  name: string | null;
  avatar: string | null;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  return (
    <View className="flex-row items-center py-3 border-b border-border" style={{ gap: 12 }}>
      {avatar ? (
        <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
      ) : (
        <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
          <Text className="text-primary font-bold">{initials}</Text>
        </View>
      )}
      <Text className="flex-1 text-ink font-medium text-sm" numberOfLines={1}>
        {name ?? "Player"}
      </Text>
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
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function GameDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: game, isLoading, error } = useGameDetail(params.gameId);
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
  // Belt-and-suspenders: the DB-side cron job (expire_past_games) flips status to
  // COMPLETED every 10 minutes, but this hides the join/leave CTA immediately once
  // the game's end time passes, without waiting on that job to run.
  const hasEnded = new Date(`${game.game_date}T${game.end_time}+05:00`).getTime() < Date.now();
  const isOpen = (game.status === "OPEN" || game.status === "FULL") && !hasEnded;
  const isCancelled = game.status === "CANCELLED";
  const pendingRequests = game.game_players.filter((p) => p.status === "PENDING");

  const skillLabel = !game.skill_level ? "Any Level" :
    game.skill_level === "BEGINNER" ? "Beginner" :
    game.skill_level === "INTERMEDIATE" ? "Intermediate" :
    game.skill_level === "ADVANCED" ? "Advanced" : "Pro";

  const genderLabel = game.gender === "male" ? "Male Only" :
    game.gender === "female" ? "Female Only" : "Everyone";

  const handleJoin = () => {
    if (!userId) return;
    Alert.alert(
      "Request to Join",
      game.entry_fee > 0
        ? `Entry fee: Rs ${game.entry_fee.toLocaleString()} (pay at the venue). The host must approve your request before you're added. Send request?`
        : "The host must approve your request before you're added. Send request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Request",
          onPress: () => {
            joinGame.mutate(
              { gameId: game.id, userId },
              {
                onError: (err) =>
                  Alert.alert("Error", err instanceof Error ? err.message : "Could not send request. Try again."),
              }
            );
          },
        },
      ]
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
    Alert.alert("Cancel Game", "This will cancel the game for all players. This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Game",
        style: "destructive",
        onPress: () => {
          cancelGame.mutate(game.id, {
            onSuccess: () => navigation.goBack(),
            onError: (err) =>
              Alert.alert("Error", err instanceof Error ? err.message : "Could not cancel."),
          });
        },
      },
    ]);
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
        {isCreator && !isCancelled && !hasEnded && (
          <Pressable
            onPress={() => navigation.navigate("EditGame", { gameId: game.id })}
            className="mr-2 p-1"
          >
            <Ionicons name="create-outline" size={22} color={colors.ink} />
          </Pressable>
        )}
        {(isCreator || hasJoined) && (
          <Pressable
            onPress={() => navigation.navigate("GameChat", { gameId: game.id, gameTitle: game.title })}
            className="mr-2 p-1"
          >
            <Ionicons name="chatbubbles-outline" size={22} color={colors.ink} />
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
        {/* Game info card */}
        <View className="mx-4 mt-4 border border-border rounded-2xl overflow-hidden">
          <View className="bg-primary-light px-4 py-3">
            <Text className="text-primary-dark font-semibold text-sm">Game Details</Text>
          </View>
          <View className="px-4">
            <InfoRow icon="calendar-outline" label="Date" value={formatDateFull(game.game_date)} />
            <InfoRow
              icon="time-outline"
              label="Time"
              value={`${formatTime(game.game_date, game.start_time)} – ${formatTime(game.game_date, game.end_time)}`}
            />
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

        {/* Description */}
        {!!game.description && (
          <View className="mx-4 mt-4 border border-border rounded-2xl p-4">
            <Text className="text-ink font-semibold text-sm mb-2">About this game</Text>
            <Text className="text-muted text-sm leading-relaxed">{game.description}</Text>
          </View>
        )}

        {/* Players */}
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
          <View className="mx-4 mt-4 border border-border rounded-2xl p-4">
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

        {/* Host */}
        <View className="mx-4 mt-4 flex-row items-center border border-border rounded-2xl p-4" style={{ gap: 12 }}>
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

      {/* CTA */}
      {isOpen && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 pt-3 pb-6">
          {isBusy ? (
            <ActivityIndicator color={colors.primary} />
          ) : isCreator ? (
            <Pressable
              onPress={handleCancel}
              className="border border-danger rounded-xl py-4 items-center"
            >
              <Text className="text-danger font-semibold">Cancel This Game</Text>
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
            <Pressable onPress={handleJoin} className="bg-primary rounded-xl py-4 items-center">
              <Text className="text-white font-semibold text-base">
                {game.entry_fee > 0
                  ? `Request to Join · Rs ${game.entry_fee.toLocaleString()}`
                  : "Request to Join"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
