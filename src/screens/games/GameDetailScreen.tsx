import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useGameDetail, useJoinGame, useLeaveGame, useCancelGame, useApprovePlayer, useRejectPlayer, useRemovePlayer } from "../../hooks/useGames";
import { useGameChatUnreadCount } from "../../hooks/useGameMessages";
import { useTournamentTeams } from "../../hooks/useTournamentTeams";
import {
  useMyPendingGameInvite,
  useCreateGameInvite,
  useAcceptGameInvite,
  useDeclineGameInvite,
  useMyPendingTeamInvite,
  useAcceptTeamInvite,
  useDeclineTeamInvite,
} from "../../hooks/useInvites";
import { useDismissedInvites } from "../../lib/useDismissedInvites";
import { useSquadFillGameSlots, useSendGameSquadInvite, useGameSquadInvitesForGame } from "../../hooks/useSquadTeamFill";
import { useAuthStore } from "../../store/authStore";
import { colors, primaryButtonShadow, cardShadow } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { GameDetail } from "../../lib/api/games";
import JoinRequestModal from "../../components/JoinRequestModal";
import InviteUsersModal from "../../components/InviteUsersModal";
import SquadFillModal from "../../components/SquadFillModal";
import InviteSquadModal from "../../components/InviteSquadModal";
import ChatIcon from "../../components/ChatIcon";
import BlinkingEyeIcon from "../../components/BlinkingEyeIcon";
import TournamentTeamsSection from "./TournamentTeamsSection";
import type { Database } from "../../types/database.types";
import { getSportIcon } from "../../lib/sportIcons";
import { GAME_SKILL_COLORS, timeBadgeColor, dayLabel } from "../../lib/badgeColors";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { addMinutesWithOverflow } from "../../lib/gameFormHelpers";
import WaveDivider from "../../components/WaveDivider";
import GradientFill from "../../components/GradientFill";

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
    new Date(y, m - 1, d).toLocaleDateString("en-PK", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(sy, sm, sd)} – ${fmt(ey, em, ed)}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  action,
  pillColor,
  badge,
  divider = true,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  action?: React.ReactNode;
  // When set, the value renders as a solid colored pill instead of plain
  // text — used for info that also carries color meaning elsewhere in the
  // app (skill level, open-to, entry fee), same palette as the list cards.
  pillColor?: string;
  // A small colored tag shown next to the label (e.g. "Today") — distinct
  // from `pillColor`, which recolors the value itself.
  badge?: { label: string; color: string };
  // Thin separator under the row — every row has one except the last in a
  // given section (pass divider={false} there).
  divider?: boolean;
}) {
  return (
    <View
      className="flex-row items-center py-3"
      style={{ gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: colors.border }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
      >
        <Ionicons name={icon} size={17} color={colors.primaryDark} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text className="text-muted text-xs">{label}</Text>
          {badge && (
            <View
              style={{
                backgroundColor: badge.color,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{badge.label}</Text>
            </View>
          )}
        </View>
        {pillColor ? (
          pillColor === colors.primary ? (
            <GradientFill
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                marginTop: 4,
              }}
            >
              <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{value}</Text>
            </GradientFill>
          ) : (
            <View
              style={{
                backgroundColor: pillColor,
                alignSelf: "flex-start",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                marginTop: 4,
              }}
            >
              <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{value}</Text>
            </View>
          )
        ) : (
          <Text className="text-ink text-sm font-medium mt-0.5">{value}</Text>
        )}
      </View>
      {action}
    </View>
  );
}

function PlayerAvatar({ name, avatar, isCreator, onRemove, onPressAvatar }: { name: string | null; avatar: string | null; isCreator: boolean; onRemove?: () => void; onPressAvatar?: () => void }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  return (
    <View className="items-center" style={{ width: 64 }}>
      <Pressable onPress={onPressAvatar} disabled={!onPressAvatar}>
        {avatar ? (
          <Image source={{ uri: avatar }} className="w-12 h-12 rounded-full bg-primary-light" />
        ) : (
          <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center">
            <Text className="text-primary font-bold text-base">{initials}</Text>
          </View>
        )}
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8} className="absolute -top-1 -right-1 bg-danger rounded-full w-5 h-5 items-center justify-center border-2 border-white">
            <Ionicons name="close" size={11} color="white" />
          </Pressable>
        )}
      </Pressable>
      {isCreator && (
        <GradientFill className="rounded-full px-1.5 py-0.5 mt-1">
          <Text className="text-white text-xs font-medium">Host</Text>
        </GradientFill>
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

function PendingRequestRow({ name, avatar, skill, location, onApprove, onReject, onPressAvatar, disabled }: { name: string | null; avatar: string | null; skill: string | null; location: string | null; onApprove: () => void; onReject: () => void; onPressAvatar?: () => void; disabled: boolean }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  return (
    <View className="py-3 border-b border-border">
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Pressable onPress={onPressAvatar} disabled={!onPressAvatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
          ) : (
            <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
              <Text className="text-primary font-bold">{initials}</Text>
            </View>
          )}
        </Pressable>
        <View className="flex-1">
          <Text className="text-ink font-medium text-sm" numberOfLines={1}>
            {name ?? "Player"}
          </Text>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            {skillLevelLabel(skill)} · {location ?? "Location not specified"}
          </Text>
        </View>
        <Pressable onPress={onReject} disabled={disabled} className="border border-border rounded-lg px-3 py-1.5">
          <Text className="text-muted text-xs font-semibold">Reject</Text>
        </Pressable>
        <Pressable onPress={onApprove} disabled={disabled}>
          <GradientFill className="rounded-lg px-3 py-1.5">
            <Text className="text-white text-xs font-semibold">Approve</Text>
          </GradientFill>
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSquadFillModal, setShowSquadFillModal] = useState(false);
  const [showInviteSquadModal, setShowInviteSquadModal] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const squadFillSlots = useSquadFillGameSlots(params.gameId);
  const sendSquadInvite = useSendGameSquadInvite(params.gameId);
  const { data: squadInvites } = useGameSquadInvitesForGame(params.gameId);

  const { data: game, isLoading, error } = useGameDetail(params.gameId);
  // Team-based joining (create/join Team A or Team B) now applies to any
  // game with a team structure, not just real tournaments — regular games
  // created after this change default to 2 teams. "" keeps the query/
  // realtime subscription off while still loading or for old-style flat
  // regular games (see useTournamentTeams: both are no-ops on a falsy
  // gameId).
  const { data: tournamentTeams } = useTournamentTeams(game?.number_of_teams != null ? params.gameId : "");
  const { data: chatUnreadCount } = useGameChatUnreadCount(game?.id, userId);
  const joinGame = useJoinGame();
  const leaveGame = useLeaveGame();
  const cancelGame = useCancelGame();
  const approvePlayer = useApprovePlayer(params.gameId);
  const rejectPlayer = useRejectPlayer(params.gameId);
  const removePlayer = useRemovePlayer(params.gameId);
  const { data: myGameInvite } = useMyPendingGameInvite(params.gameId, userId);
  const createInvite = useCreateGameInvite(params.gameId);
  const acceptInvite = useAcceptGameInvite(params.gameId);
  const declineInvite = useDeclineGameInvite(params.gameId);
  // A team invite (from "Invite Players"/"Fill with my Group" on a specific
  // team, see TournamentTeamsSection) — same "you're invited" banner
  // treatment as the game-level invite above, just for a specific team.
  const { data: myTeamInvite } = useMyPendingTeamInvite(params.gameId, userId);
  const acceptTeamInvite = useAcceptTeamInvite(params.gameId);
  const declineTeamInvite = useDeclineTeamInvite(params.gameId);
  const { isDismissed: isInviteDismissed, dismiss: dismissInvite } = useDismissedInvites();

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
  const myPlayerRecord = userId ? game.game_players.find((p) => p.user_id === userId && p.status === "JOINED") : null;
  const myPendingRecord = userId ? game.game_players.find((p) => p.user_id === userId && p.status === "PENDING") : null;
  const hasJoined = !!myPlayerRecord;
  const hasRequested = !!myPendingRecord;
  // Belt-and-suspenders: the DB-side cron job (expire_past_games) archives and
  // hard-deletes the game every 10 minutes, but this hides the join/leave CTA
  // immediately once the game's end time passes, without waiting on that job to run.
  const hasEnded = new Date(`${game.end_date ?? game.game_date}T${game.end_time}+05:00`).getTime() < Date.now();
  const isOpen = (game.status === "OPEN" || game.status === "FULL") && !hasEnded;
  const isCancelled = game.status === "CANCELLED";
  const pendingRequests = game.game_players.filter((p) => p.status === "PENDING");
  const isTournament = game.game_type === "TOURNAMENT";
  // True for real tournaments and for regular games created with the newer
  // team-based join flow (2 teams by default) — false only for old-style
  // regular games that still use the flat game_players join list.
  const isTeamBased = game.number_of_teams != null;
  // Team-based participation lives entirely in tournament_team_members, not
  // game_players — a team member never gets a game_players row, so
  // hasJoined alone would miss them for copy-ID/chat access.
  const isTournamentTeamMember = isTeamBased && !!userId && (tournamentTeams ?? []).some((t) => t.status !== "REJECTED" && t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED"));
  // Chat, specifically, only opens up once the host has actually approved the
  // member's team — being on a still-forming or awaiting-approval team isn't
  // "part of the game" yet.
  const isApprovedTournamentParticipant = isTeamBased && !!userId && (tournamentTeams ?? []).some((t) => t.status === "APPROVED" && t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED"));

  // "Book Venue" shows as soon as the game/tournament is created (as long as
  // it has a venue attached) — the host doesn't have to wait for every team
  // slot to fill first. Applies to any team-based game (tournaments, and
  // regular games created with the team flow).
  const hasLinkedVenue = !!game.venue_id;
  const hasCustomVenue = !!game.custom_venue_name;
  // A real (dropdown-picked) venue needs an actual booking — or, since
  // payment isn't integrated yet, counts as settled once the host has
  // messaged the venue on WhatsApp from its detail page (venue_contacted).
  // A manually typed venue has no venue record to book against, so it's
  // treated as already settled the moment it's set.
  const isVenueBooked = hasLinkedVenue ? !!game.booking_id || game.venue_contacted : hasCustomVenue;
  const showBookVenue = isTeamBased && isCreator && (hasLinkedVenue || hasCustomVenue);
  // "Cancel This Game/Tournament" stays visible alongside "Book Venue" until
  // the venue is actually booked (not hidden the moment a venue is merely
  // attached) — both now render inline under "Hosted by" rather than in a
  // fixed bottom bar, so there's no CTA-height padding to reserve for them.
  // Only a non-host viewer of a non-team-based game still gets a fixed
  // bottom bar (join/leave/request), which is what the scroll padding below
  // now reserves space for.
  const showsFixedBottomBar = isOpen && !isCreator && !isTeamBased;

  const skillLabel = !game.skill_level ? "Any Level" : game.skill_level === "BEGINNER" ? "Beginner" : game.skill_level === "INTERMEDIATE" ? "Intermediate" : game.skill_level === "ADVANCED" ? "Advanced" : "Pro";
  const skillPillColor = game.skill_level ? GAME_SKILL_COLORS[game.skill_level] : colors.muted;

  const genderLabel = game.gender === "male" ? "Male Only" : game.gender === "female" ? "Female Only" : "Everyone";
  const genderPillColor = game.gender === "male" ? "#2563EB" : game.gender === "female" ? "#EC4899" : colors.primary;

  const handleJoin = () => {
    if (!userId) return;
    setShowJoinModal(true);
  };

  const handleSubmitJoinRequest = (skillLevel: Database["public"]["Enums"]["skill_level_type"], location: string) => {
    if (!userId) return;
    joinGame.mutate(
      { gameId: game.id, userId, skillLevel, location },
      {
        onSuccess: () => setShowJoinModal(false),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request. Try again.")),
      },
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
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not leave. Try again.")),
            },
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
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not withdraw. Try again.")),
            },
          );
        },
      },
    ]);
  };

  const handleApprove = (gamePlayerId: string, name: string | null) => {
    approvePlayer.mutate(gamePlayerId, {
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, `Could not approve ${name ?? "player"}.`)),
    });
  };

  const handleReject = (gamePlayerId: string, name: string | null) => {
    Alert.alert("Reject Request", `Reject ${name ?? "this player"}'s request to join?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => {
          rejectPlayer.mutate(gamePlayerId, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not reject request.")),
          });
        },
      },
    ]);
  };

  const handleRemove = (gamePlayerId: string, name: string | null) => {
    Alert.alert("Remove Player", `Remove ${name ?? "this player"} from the game? They won't be able to rejoin without sending a new request.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removePlayer.mutate(gamePlayerId, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove player.")),
          });
        },
      },
    ]);
  };

  const handleCancel = () => {
    const noun = isTournament ? "tournament" : "game";
    Alert.alert(`Cancel ${isTournament ? "Tournament" : "Game"}`, `This will cancel the ${noun} for all ${isTournament ? "teams" : "players"}. This cannot be undone.`, [
      { text: "Keep", style: "cancel" },
      {
        text: `Cancel ${isTournament ? "Tournament" : "Game"}`,
        style: "destructive",
        onPress: () => {
          cancelGame.mutate(game.id, {
            onSuccess: () => navigation.goBack(),
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not cancel.")),
          });
        },
      },
    ]);
  };

  const handleAcceptInvite = () => {
    if (!myGameInvite) return;
    acceptInvite.mutate(myGameInvite.id, {
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not accept invite.")),
    });
  };

  const handleDeclineInvite = () => {
    if (!myGameInvite) return;
    Alert.alert("Decline Invite", `Decline the invite to "${game.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () =>
          declineInvite.mutate(myGameInvite.id, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not decline invite.")),
          }),
      },
    ]);
  };

  const handleAcceptTeamInvite = () => {
    if (!myTeamInvite) return;
    acceptTeamInvite.mutate(myTeamInvite.id, {
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not accept invite.")),
    });
  };

  const handleDeclineTeamInvite = () => {
    if (!myTeamInvite) return;
    Alert.alert("Decline Invite", `Decline the invite to join team "${myTeamInvite.tournament_teams?.name ?? ""}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () =>
          declineTeamInvite.mutate(myTeamInvite.id, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not decline invite.")),
          }),
      },
    ]);
  };

  const handleCopyGameCode = async () => {
    await Clipboard.setStringAsync(game.game_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  const isBusy = joinGame.isPending || leaveGame.isPending || cancelGame.isPending;
  const isApprovingOrRejecting = approvePlayer.isPending || rejectPlayer.isPending || removePlayer.isPending;

  const sportIconInfo = game.sports?.name ? getSportIcon(game.sports.name) : null;

  return (
    <View className="flex-1 bg-white">
      {/* Hero header — dark gradient with a decorative ball + sport-icon
          watermark, and a wave divider fading into the page background. */}
      <View style={{ position: "relative" }}>
        <LinearGradient
          colors={["#07301D", "#0E5C34", "#1D9254"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 16, paddingBottom: 44, paddingHorizontal: 16, overflow: "hidden" }}
        >
          {/* Decorative sport-icon watermark, generic across sports */}
          {sportIconInfo && (
            <MaterialCommunityIcons
              name={sportIconInfo.icon}
              size={130}
              color="white"
              style={{ position: "absolute", right: -20, bottom: -16, opacity: 0.14, transform: [{ rotate: "-10deg" }] }}
            />
          )}

          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.goBack()}
              className="items-center justify-center rounded-full mr-3"
              style={{ width: 38, height: 38, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </Pressable>
            {(isCreator || hasJoined || isApprovedTournamentParticipant) && (
              <Pressable
                onPress={() =>
                  navigation.navigate("GameChat", {
                    gameId: game.id,
                    gameTitle: game.title,
                    isTournament,
                    sportName: game.sports?.name,
                  })
                }
                className="ml-auto items-center justify-center rounded-full"
                style={{
                  width: 42,
                  height: 42,
                  backgroundColor: "white",
                  shadowColor: "#0F172A",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <ChatIcon size={23} unreadCount={chatUnreadCount} />
              </Pressable>
            )}
          </View>

          <Text className="text-white font-extrabold mt-3" style={{ fontSize: 26 }} numberOfLines={1}>
            {game.title}
          </Text>
          <View className="flex-row items-center flex-wrap mt-2.5" style={{ gap: 8 }}>
            {sportIconInfo && game.sports?.name && (
              <View
                className="flex-row items-center bg-white"
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 5 }}
              >
                <MaterialCommunityIcons name={sportIconInfo.icon} size={13} color={sportIconInfo.fg} />
                <Text style={{ color: sportIconInfo.fg, fontSize: 12, fontWeight: "700" }}>{game.sports.name}</Text>
              </View>
            )}
            {isTournament && (
              <View
                className="flex-row items-center"
                style={{ backgroundColor: "rgba(0,0,0,0.22)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 5 }}
              >
                <Ionicons name="trophy" size={12} color="white" />
                <Text className="text-white font-semibold" style={{ fontSize: 12 }}>Tournament</Text>
              </View>
            )}
            {isCreator && !isTeamBased && !isCancelled && !hasEnded && (
              <Pressable
                onPress={() => setShowInviteModal(true)}
                className="items-center justify-center rounded-full"
                style={{ width: 28, height: 28, backgroundColor: "rgba(255,255,255,0.16)" }}
              >
                <Ionicons name="person-add-outline" size={14} color="white" />
              </Pressable>
            )}
            {isCreator && !isTeamBased && !isCancelled && !hasEnded && (
              <Pressable
                onPress={() => setShowInviteSquadModal(true)}
                className="items-center justify-center rounded-full"
                style={{ width: 28, height: 28, backgroundColor: "rgba(255,255,255,0.16)" }}
              >
                <Ionicons name="people-outline" size={14} color="white" />
              </Pressable>
            )}
            {isCancelled && (
              <View className="bg-white px-2 py-1 rounded-lg">
                <Text className="text-red-600 text-xs font-semibold">Cancelled</Text>
              </View>
            )}
            {!isCancelled && hasEnded && (
              <View className="bg-white px-2 py-1 rounded-lg">
                <Text className="text-muted text-xs font-semibold">Ended</Text>
              </View>
            )}
            {!isCancelled && !hasEnded && isFull && (
              <View className="bg-white px-2 py-1 rounded-lg">
                <Text className="text-orange-600 text-xs font-semibold">Full</Text>
              </View>
            )}
          </View>
        </LinearGradient>
        <WaveDivider color={colors.background} height={30} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: showsFixedBottomBar ? 120 : 40 }}>
        {/* Pending host invite — shown regardless of game_type, since the
            normal bottom join CTA is hidden entirely for a tournament
            non-host (joining a tournament happens via a team below instead). */}
        {myGameInvite && !isInviteDismissed(myGameInvite.id) && (
          <View className="mx-5 mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <View className="flex-row items-start">
              <Text className="text-ink font-semibold text-sm mb-1 flex-1 pr-2">
                {myGameInvite.profiles?.full_name ?? "The host"} invited you to {isTournament ? "this tournament" : "this game"}
              </Text>
              <Pressable onPress={() => dismissInvite(myGameInvite.id)} hitSlop={8} className="-mt-1 -mr-1 p-1">
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-xs mb-3">{isTeamBased ? "Accept to let them know you're in, then join a team below." : "Accept to join instantly — no approval needed."}</Text>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable onPress={handleDeclineInvite} disabled={declineInvite.isPending || acceptInvite.isPending} className="flex-1 border border-danger rounded-lg py-2.5 items-center">
                <Text className="text-danger font-semibold text-sm">Decline</Text>
              </Pressable>
              <Pressable onPress={handleAcceptInvite} disabled={declineInvite.isPending || acceptInvite.isPending} className="flex-1">
                <GradientFill className="rounded-lg py-2.5 items-center">
                  {acceptInvite.isPending ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-semibold text-sm">Accept</Text>}
                </GradientFill>
              </Pressable>
            </View>
          </View>
        )}

        {/* Pending team invite — from "Invite Players"/"Fill with my Group"
            on a specific team (see TournamentTeamsSection). Accepting joins
            that team directly, no further action needed. */}
        {myTeamInvite && !isInviteDismissed(myTeamInvite.id) && (
          <View className="mx-5 mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <View className="flex-row items-start">
              <Text className="text-ink font-semibold text-sm mb-1 flex-1 pr-2">
                {myTeamInvite.profiles?.full_name ?? "A host"} invited you to join team "{myTeamInvite.tournament_teams?.name ?? "a team"}" in this {isTournament ? "tournament" : "game"}
              </Text>
              <Pressable onPress={() => dismissInvite(myTeamInvite.id)} hitSlop={8} className="-mt-1 -mr-1 p-1">
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-xs mb-3">Accept to join the team instantly — no approval needed.</Text>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable onPress={handleDeclineTeamInvite} disabled={declineTeamInvite.isPending || acceptTeamInvite.isPending} className="flex-1 border border-danger rounded-lg py-2.5 items-center">
                <Text className="text-danger font-semibold text-sm">Decline</Text>
              </Pressable>
              <Pressable onPress={handleAcceptTeamInvite} disabled={declineTeamInvite.isPending || acceptTeamInvite.isPending} className="flex-1">
                <GradientFill className="rounded-lg py-2.5 items-center">
                  {acceptTeamInvite.isPending ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-semibold text-sm">Accept</Text>}
                </GradientFill>
              </Pressable>
            </View>
          </View>
        )}

        {/* Game info — card, collapsed behind a dropdown by default;
            tapping the header reveals it. */}
        <View className="px-3.5 mt-5">
          <View className="bg-white rounded-2xl px-4" style={cardShadow}>
          <Pressable onPress={() => setDetailsExpanded((v) => !v)} className="flex-row items-center py-4" style={{ gap: 12 }}>
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}
            >
              <Ionicons name="document-text-outline" size={19} color={colors.primaryDark} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-ink font-bold text-base">{isTournament ? "Tournament Details" : "Game Details"}</Text>
                <BlinkingEyeIcon size={16} />
              </View>
              <Text className="text-muted text-xs mt-0.5">
                View {isTournament ? "complete tournament information" : "complete game information"}
              </Text>
            </View>
            <Ionicons name={detailsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          </Pressable>
          {detailsExpanded && (
            <View className="pb-1" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              {/* The ID/code is only meaningful (and only shown) to people
                  already in the game/tournament — an unjoined visitor has
                  nothing to do with it and shouldn't see it at all. */}
              {(isCreator || hasJoined || isTournamentTeamMember) && (
                <InfoRow
                  icon="pricetag-outline"
                  label={isTournament ? "Tournament ID" : "Game ID"}
                  value={game.game_code}
                  action={
                    <Pressable
                      onPress={handleCopyGameCode}
                      hitSlop={8}
                      className="flex-row items-center px-3 py-1.5 rounded-lg bg-white"
                      style={{ gap: 4, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Ionicons name={codeCopied ? "checkmark" : "copy-outline"} size={14} color={codeCopied ? colors.primary : colors.muted} />
                      <Text className={`text-xs font-medium ${codeCopied ? "text-primary" : "text-muted"}`}>{codeCopied ? "Copied" : "Copy"}</Text>
                    </Pressable>
                  }
                />
              )}
              {isTournament && game.end_date && game.end_date !== game.game_date ? (
                <>
                  <InfoRow icon="calendar-outline" label="Dates" value={formatDateRangeFull(game.game_date, game.end_date)} />
                  {game.daily_hours ? (
                    <InfoRow
                      icon="time-outline"
                      label="Daily Time"
                      value={`${formatTime(game.game_date, game.start_time)} – ${formatTime(game.game_date, `${addMinutesWithOverflow(game.start_time.slice(0, 5), game.daily_hours * 60).time}:00`)}`}
                    />
                  ) : (
                    <InfoRow icon="time-outline" label="Daily Start Time" value={formatTime(game.game_date, game.start_time)} />
                  )}
                </>
              ) : (
                <>
                  <InfoRow
                    icon="calendar-outline"
                    label="Date"
                    value={formatDateFull(game.game_date)}
                    badge={{
                      label: dayLabel(game.game_date),
                      color: timeBadgeColor(game.start_time),
                    }}
                  />
                  <InfoRow icon="time-outline" label="Time" value={`${formatTime(game.game_date, game.start_time)} – ${formatTime(game.game_date, game.end_time)}`} />
                </>
              )}
              {(game.venues || game.custom_venue_name) && <InfoRow icon="location-outline" label="Venue" value={game.venues ? `${game.venues.name}${game.venues.city ? `, ${game.venues.city}` : ""}` : (game.custom_venue_name as string)} />}
              <InfoRow icon="speedometer-outline" label="Skill Level" value={skillLabel} pillColor={skillPillColor} />
              <InfoRow icon="people-outline" label="Open To" value={genderLabel} pillColor={genderPillColor} />
              {!isTeamBased && <InfoRow icon="person-outline" label="Team Size" value={`${Math.floor(game.max_players / 2)} players per team (2 teams)`} />}
              <InfoRow
                icon="cash-outline"
                label={isTournament ? "Entry Fee Per Team" : "Entry Fee Per Person"}
                value={game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()} (pay at venue)` : "Free"}
                pillColor={game.entry_fee > 0 ? undefined : colors.primary}
                divider={false}
              />
            </View>
          )}
          </View>
        </View>

        {/* Description */}
        {!!game.description && (
          <View className="px-3.5 mt-6">
            <View className="flex-row items-center bg-white rounded-2xl p-4" style={{ ...cardShadow, gap: 12 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}
              >
                <Ionicons name="megaphone-outline" size={19} color={colors.primaryDark} />
              </View>
              <View className="flex-1">
                <Text className="text-ink font-bold text-base mb-1">About this {isTournament ? "tournament" : "game"}</Text>
                <Text className="text-muted text-sm leading-relaxed">{game.description}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Players (old-style flat regular games) / Teams (tournaments and
            team-based regular games) */}
        {isTeamBased ? (
          <TournamentTeamsSection game={game} />
        ) : (
          <>
            <View className="px-3.5 mt-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-ink font-semibold text-sm">
                  Players ({joinedPlayers.length}/{game.max_players})
                </Text>
                {emptySlots > 0 ? (
                  <View className="bg-green-50 px-2 py-0.5 rounded-full">
                    <Text className="text-primary text-xs font-medium">
                      {emptySlots} spot{emptySlots !== 1 ? "s" : ""} left
                    </Text>
                  </View>
                ) : (
                  <View className="bg-red-50 px-2 py-0.5 rounded-full">
                    <Text className="text-red-600 text-xs font-medium">Full</Text>
                  </View>
                )}
              </View>
              {emptySlots > 0 && !isCancelled && !hasEnded && (
                <Pressable onPress={() => setShowSquadFillModal(true)} className="border border-primary rounded-lg py-2 items-center mb-3">
                  <Text className="text-primary text-xs font-semibold">Fill Open Spots With My Group</Text>
                </Pressable>
              )}
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {joinedPlayers.map((p) => (
                  <PlayerAvatar key={p.id} name={p.profiles?.full_name ?? null} avatar={p.profiles?.avatar ?? null} isCreator={p.user_id === game.creator_id} onRemove={isCreator && p.user_id !== game.creator_id && !isApprovingOrRejecting ? () => handleRemove(p.id, p.profiles?.full_name ?? null) : undefined} onPressAvatar={() => navigation.navigate("PlayerProfile", { userId: p.user_id })} />
                ))}
                {Array.from({ length: Math.min(emptySlots, 8) }).map((_, i) => (
                  <EmptySlot key={`empty-${i}`} />
                ))}
              </View>
            </View>

            {/* Pending join requests — host only */}
            {isCreator && pendingRequests.length > 0 && (
              <View className="px-3.5 mt-6">
                <Text className="text-ink font-semibold text-sm mb-1">Join Requests ({pendingRequests.length})</Text>
                <Text className="text-muted text-xs mb-2">Approve players before they're added to the game.</Text>
                {pendingRequests.map((p) => (
                  <PendingRequestRow key={p.id} name={p.profiles?.full_name ?? null} avatar={p.profiles?.avatar ?? null} skill={p.skill_level} location={p.location} disabled={isApprovingOrRejecting || isFull} onApprove={() => handleApprove(p.id, p.profiles?.full_name ?? null)} onReject={() => handleReject(p.id, p.profiles?.full_name ?? null)} onPressAvatar={() => navigation.navigate("PlayerProfile", { userId: p.user_id })} />
                ))}
                {isFull && <Text className="text-orange-600 text-xs mt-2">Game is full — reject remaining requests or remove a player to approve more.</Text>}
              </View>
            )}
          </>
        )}

        {/* Host */}
        <View className="px-3.5 mt-6 flex-row items-center" style={{ gap: 12 }}>
          <Pressable
            onPress={() => game.profiles?.id && navigation.navigate("PlayerProfile", { userId: game.profiles.id })}
            disabled={!game.profiles?.id}
          >
            {game.profiles?.avatar ? (
              <Image source={{ uri: game.profiles.avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
            ) : (
              <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
                <Text className="text-primary font-bold">{(game.profiles?.full_name ?? "?").charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
          <View>
            <Text className="text-muted text-xs">Hosted by</Text>
            <Text className="text-ink font-semibold text-sm">{game.profiles?.full_name ?? "Unknown"}</Text>
          </View>
        </View>

        {/* Host management — Book Venue / Cancel — sits right under "Hosted
            by" instead of pinned to the bottom of the screen, so it scrolls
            with the rest of the details instead of floating over them. */}
        {isCreator && isOpen && (showBookVenue || !isVenueBooked) && (
          <View className="px-3.5 mt-4">
            {cancelGame.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                {showBookVenue && (
                  <Pressable
                    onPress={() => {
                      if (isVenueBooked) return;
                      navigation.navigate("VenueDetail", { venueId: game.venue_id!, forGameId: game.id });
                    }}
                    disabled={isVenueBooked}
                    className="mb-3"
                    style={isVenueBooked ? undefined : primaryButtonShadow}
                  >
                    {isVenueBooked ? (
                      <View className="rounded-xl py-4 items-center bg-gray-100">
                        <Text className="font-semibold text-base text-muted">Venue Booked</Text>
                      </View>
                    ) : (
                      <GradientFill className="rounded-xl py-4 items-center">
                        <Text className="font-semibold text-base text-white">Book Venue</Text>
                      </GradientFill>
                    )}
                  </Pressable>
                )}
                {!isVenueBooked && (
                  <Pressable onPress={handleCancel} className="border border-danger rounded-xl py-4 items-center">
                    <Text className="text-danger font-semibold">Cancel This {isTournament ? "Tournament" : "Game"}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* CTA — joiner actions only now (host management moved inline above,
          under "Hosted by"). For team-based games (tournaments, and regular
          games created with the team flow), non-host actions (create/join a
          team) live inline in TournamentTeamsSection instead of here. */}
      {showsFixedBottomBar && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-3.5 pt-3 pb-3">
          {isBusy ? (
            <ActivityIndicator color={colors.primary} />
          ) : hasJoined ? (
            <Pressable onPress={handleLeave} className="border border-danger rounded-xl py-4 items-center">
              <Text className="text-danger font-semibold">Leave Game</Text>
            </Pressable>
          ) : hasRequested ? (
            <View style={{ gap: 8 }}>
              <View className="bg-orange-50 rounded-xl py-3 items-center">
                <Text className="text-orange-600 font-semibold">Request Sent — Awaiting Host Approval</Text>
              </View>
              <Pressable onPress={handleCancelRequest} className="border border-danger rounded-xl py-3 items-center">
                <Text className="text-danger font-semibold">Cancel Request</Text>
              </Pressable>
            </View>
          ) : isFull ? (
            <View className="bg-gray-100 rounded-xl py-4 items-center">
              <Text className="text-muted font-semibold">Game is Full</Text>
            </View>
          ) : (
            <Pressable onPress={handleJoin} style={primaryButtonShadow}>
              <GradientFill className="rounded-xl py-4 items-center">
                <Text className="text-white font-semibold text-base">{game.entry_fee > 0 ? `Request to Join · Rs ${game.entry_fee.toLocaleString()}` : "Request to Join"}</Text>
              </GradientFill>
            </Pressable>
          )}
        </View>
      )}

      <JoinRequestModal visible={showJoinModal} onClose={() => setShowJoinModal(false)} onSubmit={handleSubmitJoinRequest} submitting={joinGame.isPending} title="Request to Join" subtitle={game.entry_fee > 0 ? `Entry fee: Rs ${game.entry_fee.toLocaleString()} (pay at the venue). The host must approve your request before you're added.` : "The host must approve your request before you're added."} />

      {!isTeamBased && (
        <InviteUsersModal
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title={`Invite Players · ${game.title}`}
          excludeIds={[game.creator_id, ...game.game_players.map((p) => p.user_id)]}
          onInvite={async (user) => {
            if (!userId) return;
            await createInvite.mutateAsync({
              invitedUserId: user.id,
              invitedBy: userId,
            });
          }}
        />
      )}

      {!isTeamBased && (
        <SquadFillModal
          visible={showSquadFillModal}
          onClose={() => setShowSquadFillModal(false)}
          userId={userId}
          requiredCount={emptySlots}
          submitting={squadFillSlots.isPending}
          title="Fill Open Spots With Your Group"
          onSubmit={(squadId, memberUserIds) => {
            squadFillSlots.mutate(
              { squadId, memberUserIds },
              {
                onSuccess: () => setShowSquadFillModal(false),
                onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not join the game.")),
              },
            );
          }}
        />
      )}

      {isCreator && !isTeamBased && (
        <InviteSquadModal
          visible={showInviteSquadModal}
          onClose={() => setShowInviteSquadModal(false)}
          submitting={sendSquadInvite.isPending}
          alreadyInvitedSquadIds={(squadInvites ?? []).map((i) => i.squad_id)}
          onInvite={(squadId, squadName) => {
            if (!userId) return;
            sendSquadInvite.mutate(
              { squadId, invitedBy: userId },
              {
                onSuccess: () => Alert.alert("Invited", `Invite sent to "${squadName}".`),
                onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send invite.")),
              },
            );
          }}
        />
      )}
    </View>
  );
}
