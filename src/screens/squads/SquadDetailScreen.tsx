import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Image, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import {
  useSquadDetail,
  useJoinSquad,
  useLeaveSquad,
  useDisbandSquad,
  useApproveMember,
  useRejectMember,
  useRemoveMember,
  useSetSquadJoinBlocked,
  useSetMemberHost,
} from "../../hooks/useSquads";
import { useSquadChatUnreadCount } from "../../hooks/useSquadMessages";
import { usePendingSquadInvites, useRespondToSquadInvite } from "../../hooks/useSquadTeamFill";
import {
  useMyPendingSquadInvite,
  useCreateSquadInvite,
  useAcceptSquadInvite,
  useDeclineSquadInvite,
} from "../../hooks/useInvites";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, primaryButtonShadow, cardShadow } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import JoinRequestModal from "../../components/JoinRequestModal";
import InviteUsersModal from "../../components/InviteUsersModal";
import AddMemberByIdModal from "../../components/AddMemberByIdModal";
import ChatIcon from "../../components/ChatIcon";
import BlinkingEyeIcon from "../../components/BlinkingEyeIcon";
import WaveDivider from "../../components/WaveDivider";
import { SkeletonDetailHeader } from "../../components/Skeleton";
import type { Database } from "../../types/database.types";
import { SQUAD_SKILL_COLORS } from "../../lib/badgeColors";
import { getSportIcon } from "../../lib/sportIcons";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { useDismissedInvites } from "../../lib/useDismissedInvites";

type DetailRoute = RouteProp<SquadsStackParamList, "SquadDetail">;
type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadDetail">;

// ── helpers ───────────────────────────────────────────────────────────────────

function skillLabel(skill: string | null): string {
  if (!skill) return "Any Level";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

// ── sub-components ────────────────────────────────────────────────────────────
// Same shell as GameDetailScreen's InfoRow — icon in a light-green circle,
// optional badge next to the label, optional colored pill for the value.

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
  pillColor?: string;
  badge?: { label: string; color: string };
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

function MemberAvatar({
  name,
  avatar,
  isOwner,
  isHost,
  onOpenMenu,
  onPressAvatar,
}: {
  name: string | null;
  avatar: string | null;
  isOwner: boolean;
  isHost?: boolean;
  // Opens the "Remove Member" / "Make Group Host" picker — only passed for
  // members a host/owner is actually allowed to manage (never the owner's
  // own row).
  onOpenMenu?: () => void;
  // Opens that member's player profile — a separate tap target from the
  // menu button above, so managing a member and viewing their profile never
  // collide.
  onPressAvatar?: () => void;
}) {
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
        {onOpenMenu && (
          <Pressable
            onPress={onOpenMenu}
            hitSlop={8}
            className="absolute -top-1 -right-1 bg-white rounded-full w-5 h-5 items-center justify-center border border-border"
            style={{
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <Ionicons name="ellipsis-vertical" size={11} color={colors.ink} />
          </Pressable>
        )}
      </Pressable>
      {isOwner ? (
        <GradientFill className="rounded-full px-1.5 py-0.5 mt-1">
          <Text className="text-white text-xs font-medium">Captain</Text>
        </GradientFill>
      ) : isHost ? (
        <GradientFill className="rounded-full px-1.5 py-0.5 mt-1">
          <Text className="text-white text-xs font-medium">Host</Text>
        </GradientFill>
      ) : null}
      <Text className="text-muted text-xs mt-1 text-center" numberOfLines={1}>
        {(name ?? "Member").split(" ")[0]}
      </Text>
    </View>
  );
}

// Same dashed placeholder GameDetailScreen shows for an unfilled player slot.
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

// Unlike a game join request (name + avatar only), a squad join request also
// shows the requester's skill level and location so the captain can judge
// fit before approving — that's the whole point of squads having those
// fields at all.
function SquadPendingRequestRow({
  name,
  avatar,
  skill,
  location,
  onApprove,
  onReject,
  onPressAvatar,
  disabled,
}: {
  name: string | null;
  avatar: string | null;
  skill: string | null;
  location: string | null;
  onApprove: () => void;
  onReject: () => void;
  onPressAvatar?: () => void;
  disabled: boolean;
}) {
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
            {skillLabel(skill)} · {location ?? "Location not set"}
          </Text>
        </View>
        <Pressable
          onPress={onReject}
          disabled={disabled}
          className="border border-border rounded-lg px-3 py-1.5"
        >
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

export default function SquadDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddByIdModal, setShowAddByIdModal] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const { data: squad, isLoading, error, refetch, isRefetching } = useSquadDetail(params.squadId);
  const { data: chatUnreadCount } = useSquadChatUnreadCount(squad?.id, userId);
  const joinSquad = useJoinSquad();
  const leaveSquad = useLeaveSquad();
  const disbandSquad = useDisbandSquad();
  const approveMember = useApproveMember(params.squadId);
  const rejectMember = useRejectMember(params.squadId);
  const removeMember = useRemoveMember(params.squadId);
  const setMemberHost = useSetMemberHost(params.squadId);
  const setJoinBlocked = useSetSquadJoinBlocked();
  const { data: mySquadInvite } = useMyPendingSquadInvite(params.squadId, userId);
  const { isDismissed: isInviteDismissed, dismiss: dismissInvite } = useDismissedInvites();
  const createInvite = useCreateSquadInvite(params.squadId);
  const acceptInvite = useAcceptSquadInvite(params.squadId);
  const declineInvite = useDeclineSquadInvite(params.squadId);
  const { data: gameInvites } = usePendingSquadInvites(params.squadId);
  const respondToGameInvite = useRespondToSquadInvite(params.squadId);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white px-4 pt-4">
        <SkeletonDetailHeader />
      </View>
    );
  }

  if (error || !squad) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-ink font-semibold text-base mb-2">Group not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-primary font-medium">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const activeMembers = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const emptySlots = squad.max_players ? Math.max(0, squad.max_players - activeMembers.length) : 0;
  const isFull = !!squad.max_players && activeMembers.length >= squad.max_players;
  // Owner-closed via "Block New Join Requests" — treated the same as being
  // full everywhere a player would otherwise see a way to join.
  const isClosedToJoins = isFull || squad.join_requests_blocked;

  const isOwner = squad.squad_owner_id === userId;
  const myMemberRecord = userId
    ? squad.squad_members.find((m) => m.user_id === userId && m.status === "ACTIVE")
    : null;
  // A promoted host — same authority as the owner everywhere below, enforced
  // server-side by RLS policies that accept either squad_owner_id or an
  // ACTIVE squad_members row with role='host'.
  const isHost = myMemberRecord?.role === "host";
  const canManage = isOwner || isHost;
  const myPendingRecord = userId
    ? squad.squad_members.find((m) => m.user_id === userId && m.status === "PENDING")
    : null;
  const hasJoined = !!myMemberRecord;
  const hasRequested = !!myPendingRecord;
  // A Male Only/Female Only squad can't be joined by someone who doesn't
  // match — enforced server-side too (squad_members RLS), this just shows
  // why up front instead of letting them tap Request to Join and hit an error.
  const isGenderRestricted =
    squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;
  const pendingRequests = squad.squad_members.filter((m) => m.status === "PENDING");

  const handleJoin = () => {
    if (!userId) return;
    setShowJoinModal(true);
  };

  const handleSubmitJoinRequest = (
    skillLevel: Database["public"]["Enums"]["skill_level_type"],
    location: string
  ) => {
    if (!userId) return;
    joinSquad.mutate(
      { squadId: squad.id, userId, skillLevel, location },
      {
        onSuccess: () => setShowJoinModal(false),
        onError: (err) =>
          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request. Try again.")),
      }
    );
  };

  const handleToggleJoinBlocked = () => {
    const nextBlocked = !squad.join_requests_blocked;
    Alert.alert(
      nextBlocked ? "Block New Join Requests?" : "Unblock New Join Requests?",
      nextBlocked
        ? "No one will be able to request to join this group until you unblock it."
        : "Players will be able to request to join this group again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextBlocked ? "Block" : "Unblock",
          style: nextBlocked ? "destructive" : "default",
          onPress: () => {
            setJoinBlocked.mutate(
              { squadId: squad.id, blocked: nextBlocked },
              {
                onError: (err) =>
                  Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update this setting. Try again.")),
              }
            );
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    if (!userId) return;
    Alert.alert("Leave Group", "Are you sure you want to leave?", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          leaveSquad.mutate(
            { squadId: squad.id, userId },
            {
              onError: (err) =>
                Alert.alert("Error", getFriendlyErrorMessage(err, "Could not leave. Try again.")),
            }
          );
        },
      },
    ]);
  };

  const handleCancelRequest = () => {
    if (!userId) return;
    Alert.alert("Cancel Request", "Withdraw your request to join this group?", [
      { text: "Keep Request", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () => {
          leaveSquad.mutate(
            { squadId: squad.id, userId },
            {
              onError: (err) =>
                Alert.alert("Error", getFriendlyErrorMessage(err, "Could not withdraw. Try again.")),
            }
          );
        },
      },
    ]);
  };

  const handleRespondGameInvite = (inviteId: string, accept: boolean) => {
    respondToGameInvite.mutate(
      { inviteId, accept },
      {
        onError: (err) =>
          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not respond to invite.")),
      }
    );
  };

  const handleApprove = (squadMemberId: string, name: string | null) => {
    approveMember.mutate(squadMemberId, {
      onError: (err) =>
        Alert.alert("Error", getFriendlyErrorMessage(err, `Could not approve ${name ?? "member"}.`)),
    });
  };

  const handleReject = (squadMemberId: string, name: string | null) => {
    Alert.alert(
      "Reject Request",
      `Reject ${name ?? "this player"}'s request to join?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => {
            rejectMember.mutate(squadMemberId, {
              onError: (err) =>
                Alert.alert("Error", getFriendlyErrorMessage(err, "Could not reject request.")),
            });
          },
        },
      ]
    );
  };

  const handleRemove = (squadMemberId: string, name: string | null) => {
    Alert.alert(
      "Remove Member",
      `Remove ${name ?? "this member"} from the group? They won't be able to rejoin without sending a new request.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeMember.mutate(squadMemberId, {
              onError: (err) =>
                Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove member.")),
            });
          },
        },
      ]
    );
  };

  const handleManageMember = (squadMemberId: string, name: string | null, currentlyHost: boolean) => {
    const label = name ?? "this member";
    Alert.alert(
      currentlyHost ? "Remove as Host?" : "Make Group Host?",
      currentlyHost
        ? `${label} will lose host privileges and go back to being a regular member.`
        : `${label} will be able to manage members, edit the group, and everything else a host can do.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: currentlyHost ? "Remove Host" : "Make Host",
          style: currentlyHost ? "destructive" : "default",
          onPress: () => {
            setMemberHost.mutate(
              { squadMemberId, isHost: !currentlyHost },
              {
                onError: (err) =>
                  Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update host status.")),
              }
            );
          },
        },
      ]
    );
  };

  // The three-dot button on a member's avatar — picks between the two
  // existing actions below, each of which still shows its own confirmation.
  const handleOpenMemberMenu = (squadMemberId: string, name: string | null, currentlyHost: boolean) => {
    Alert.alert(name ?? "Member", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: currentlyHost ? "Remove as Host" : "Make Group Host", onPress: () => handleManageMember(squadMemberId, name, currentlyHost) },
      { text: "Remove Member", style: "destructive", onPress: () => handleRemove(squadMemberId, name) },
    ]);
  };

  const handleDisband = () => {
    Alert.alert("Disband Group", "This will permanently disband the group for everyone. This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Disband",
        style: "destructive",
        onPress: () => {
          disbandSquad.mutate(squad.id, {
            onSuccess: () => navigation.goBack(),
            onError: (err) =>
              Alert.alert("Error", getFriendlyErrorMessage(err, "Could not disband.")),
          });
        },
      },
    ]);
  };

  const handleCopySquadCode = async () => {
    await Clipboard.setStringAsync(squad.squad_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  const handleAcceptInvite = () => {
    if (!mySquadInvite) return;
    acceptInvite.mutate(mySquadInvite.id, {
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not accept invite.")),
    });
  };

  const handleDeclineInvite = () => {
    if (!mySquadInvite) return;
    Alert.alert("Decline Invite", `Decline the invite to "${squad.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () =>
          declineInvite.mutate(mySquadInvite.id, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not decline invite.")),
          }),
      },
    ]);
  };

  const isBusy = joinSquad.isPending || leaveSquad.isPending || disbandSquad.isPending;
  const isApprovingOrRejecting = approveMember.isPending || rejectMember.isPending || removeMember.isPending;

  const squadSkillColor = squad.skill_level ? SQUAD_SKILL_COLORS[squad.skill_level] : colors.muted;
  const genderLabel = squad.gender === "male" ? "Male Only" : squad.gender === "female" ? "Female Only" : "Everyone";
  const genderPillColor = squad.gender === "male" ? "#2563EB" : squad.gender === "female" ? "#EC4899" : colors.primary;

  const sportIconInfo = squad.sports?.name ? getSportIcon(squad.sports.name) : null;

  return (
    <View className="flex-1 bg-white">
      {/* Hero header — dark gradient with a decorative sport-icon watermark,
          same treatment as GameDetailScreen, fading into the page via a
          wave divider. */}
      <View style={{ position: "relative" }}>
        <LinearGradient
          colors={["#07301D", "#0E5C34", "#1D9254"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 10, paddingBottom: 28, paddingHorizontal: 16, overflow: "hidden" }}
        >
          {sportIconInfo && (
            <MaterialCommunityIcons
              name={sportIconInfo.icon}
              size={84}
              color="white"
              style={{ position: "absolute", right: -14, bottom: -10, opacity: 0.14, transform: [{ rotate: "-10deg" }] }}
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
            <Text className="text-white font-extrabold flex-1" style={{ fontSize: 19 }} numberOfLines={1}>
              {squad.name}
            </Text>
            {(isOwner || hasJoined) && (
              <Pressable
                onPress={() => navigation.navigate("SquadChat", { squadId: squad.id, squadName: squad.name })}
                className="ml-3 items-center justify-center rounded-full"
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

          <View className="flex-row items-center flex-wrap mt-2.5" style={{ gap: 8 }}>
            {sportIconInfo && squad.sports?.name && (
              <View
                className="flex-row items-center bg-white"
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 5 }}
              >
                <MaterialCommunityIcons name={sportIconInfo.icon} size={13} color={sportIconInfo.fg} />
                <Text style={{ color: sportIconInfo.fg, fontSize: 12, fontWeight: "700" }}>{squad.sports.name}</Text>
              </View>
            )}
            {canManage && (
              <Pressable
                onPress={handleToggleJoinBlocked}
                disabled={setJoinBlocked.isPending}
                className="flex-row items-center"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  gap: 5,
                  backgroundColor: "white",
                }}
              >
                {setJoinBlocked.isPending ? (
                  <ActivityIndicator size="small" color={squad.join_requests_blocked ? colors.primary : colors.danger} />
                ) : (
                  <>
                    <View style={{ width: 13, height: 13 }}>
                      <Ionicons
                        name="person"
                        size={13}
                        color={squad.join_requests_blocked ? colors.primary : colors.danger}
                      />
                      {squad.join_requests_blocked ? (
                        <GradientFill
                          className="items-center justify-center rounded-full"
                          style={{ position: "absolute", right: -3, bottom: -3, width: 9, height: 9, borderWidth: 1, borderColor: "white" }}
                        >
                          <Ionicons name="ban" size={6} color="white" />
                        </GradientFill>
                      ) : (
                        <View
                          className="items-center justify-center rounded-full"
                          style={{
                            position: "absolute",
                            right: -3,
                            bottom: -3,
                            width: 9,
                            height: 9,
                            backgroundColor: colors.danger,
                            borderWidth: 1,
                            borderColor: "white",
                          }}
                        >
                          <Ionicons name="ban" size={6} color="white" />
                        </View>
                      )}
                    </View>
                    <Text
                      style={{
                        color: squad.join_requests_blocked ? colors.primary : colors.danger,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {squad.join_requests_blocked ? "Unblock New Users" : "Block New Users"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
            {isClosedToJoins && (
              <View className="bg-white px-2 py-1 rounded-lg">
                <Text className="text-orange-600 text-xs font-semibold">Full</Text>
              </View>
            )}
          </View>
        </LinearGradient>
        <WaveDivider color={colors.background} height={22} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: hasJoined ? 40 : 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {mySquadInvite && !isInviteDismissed(mySquadInvite.id) && (
          <View className="mx-5 mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <View className="flex-row items-start">
              <Text className="text-ink font-semibold text-sm mb-1 flex-1 pr-2">
                {mySquadInvite.profiles?.full_name ?? "The owner"} invited you to this group
              </Text>
              <Pressable onPress={() => dismissInvite(mySquadInvite.id)} hitSlop={8} className="-mt-1 -mr-1 p-1">
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-xs mb-3">Accept to join instantly — no approval needed.</Text>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={handleDeclineInvite}
                disabled={declineInvite.isPending || acceptInvite.isPending}
                className="flex-1 border border-danger rounded-lg py-2.5 items-center"
              >
                <Text className="text-danger font-semibold text-sm">Decline</Text>
              </Pressable>
              <Pressable
                onPress={handleAcceptInvite}
                disabled={declineInvite.isPending || acceptInvite.isPending}
                className="flex-1"
              >
                <GradientFill className="rounded-lg py-2.5 items-center">
                  {acceptInvite.isPending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-semibold text-sm">Accept</Text>
                  )}
                </GradientFill>
              </Pressable>
            </View>
          </View>
        )}

        {/* Squad info — card, collapsed behind a dropdown by default;
            tapping the header reveals it. Same shell as GameDetailScreen's
            "Game Details" card. */}
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
                  <Text className="text-ink font-bold text-base">Group Details</Text>
                  <BlinkingEyeIcon size={16} />
                </View>
                <Text className="text-muted text-xs mt-0.5">View complete group information</Text>
              </View>
              <Ionicons name={detailsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </Pressable>
            {detailsExpanded && (
              <View className="pb-1" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                {/* The ID/code is only meaningful (and only shown) to people
                    already in the squad — a non-member has nothing to do with
                    it and shouldn't see it at all. */}
                {(isOwner || hasJoined) && (
                  <InfoRow
                    icon="pricetag-outline"
                    label="Group ID"
                    value={squad.squad_code}
                    action={
                      <Pressable
                        onPress={handleCopySquadCode}
                        hitSlop={8}
                        className="flex-row items-center px-3 py-1.5 rounded-lg bg-white"
                        style={{ gap: 4, borderWidth: 1, borderColor: colors.border }}
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
                    }
                  />
                )}
                {squad.sports && <InfoRow icon="football-outline" label="Sport" value={squad.sports.name} />}
                <InfoRow
                  icon="speedometer-outline"
                  label="Skill Level"
                  value={skillLabel(squad.skill_level)}
                  pillColor={squadSkillColor}
                />
                <InfoRow icon="location-outline" label="Location" value={squad.location ?? "Not set"} />
                <InfoRow icon="people-outline" label="Open To" value={genderLabel} pillColor={genderPillColor} divider={false} />
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {!!squad.description && (
          <View className="px-3.5 mt-6">
            <View className="flex-row items-center bg-white rounded-2xl p-4" style={{ ...cardShadow, gap: 12 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}
              >
                <Ionicons name="megaphone-outline" size={19} color={colors.primaryDark} />
              </View>
              <View className="flex-1">
                <Text className="text-ink font-bold text-base mb-1">About this group</Text>
                <Text className="text-muted text-sm leading-relaxed">{squad.description}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Members */}
        <View className="px-3.5 mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-ink font-semibold text-sm">
              Members ({activeMembers.length}{squad.max_players ? `/${squad.max_players}` : ""})
            </Text>
            {!!squad.max_players && (
              emptySlots > 0 ? (
                <View className="bg-green-50 px-2 py-0.5 rounded-full">
                  <Text className="text-primary text-xs font-medium">
                    {emptySlots} spot{emptySlots !== 1 ? "s" : ""} left
                  </Text>
                </View>
              ) : (
                <View className="bg-red-50 px-2 py-0.5 rounded-full">
                  <Text className="text-red-600 text-xs font-medium">Full</Text>
                </View>
              )
            )}
          </View>
          {(canManage || isOwner || hasJoined) && (
            <View className="flex-row items-center justify-end mb-3" style={{ gap: 8 }}>
              {canManage && (
                <Pressable
                  onPress={() => setShowAddByIdModal(true)}
                  className="flex-row items-center rounded-full border border-primary"
                  style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 5 }}
                >
                  <Ionicons name="key-outline" size={14} color={colors.primary} />
                  <Text className="text-primary text-xs font-bold">Add by ID</Text>
                </Pressable>
              )}
              {(isOwner || hasJoined) && (
                <Pressable onPress={() => setShowInviteModal(true)} style={primaryButtonShadow}>
                  <LinearGradient
                    colors={["#0E5C34", "#1D9254"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 999,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="person-add-outline" size={16} color="white" />
                    <Text className="text-white text-sm font-bold">Invite Players</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          )}
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {activeMembers.map((m) => {
              const rowIsOwner = m.user_id === squad.squad_owner_id;
              return (
                <MemberAvatar
                  key={m.id}
                  name={m.profiles?.full_name ?? null}
                  avatar={m.profiles?.avatar ?? null}
                  isOwner={rowIsOwner}
                  isHost={m.role === "host"}
                  onOpenMenu={
                    canManage && !rowIsOwner && !isApprovingOrRejecting
                      ? () => handleOpenMemberMenu(m.id, m.profiles?.full_name ?? null, m.role === "host")
                      : undefined
                  }
                  onPressAvatar={() => navigation.navigate("PlayerProfile", { userId: m.user_id })}
                />
              );
            })}
            {Array.from({ length: Math.min(emptySlots, 8) }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} />
            ))}
          </View>
        </View>

        {/* Game/tournament invites — owner/host only, accept to open the fill-team flow on that game */}
        {canManage && (gameInvites?.length ?? 0) > 0 && (
          <View className="px-3.5 mt-6">
            <Text className="text-ink font-semibold text-sm mb-1">
              Game Invites ({gameInvites!.length})
            </Text>
            <Text className="text-muted text-xs mb-2">
              A host invited your group to join their game or tournament.
            </Text>
            {gameInvites!.map((invite) => (
              <View
                key={invite.id}
                className="flex-row items-center border border-border rounded-xl px-3 py-2.5 mb-2"
                style={{ gap: 10 }}
              >
                <View className="flex-1">
                  <Text className="text-ink text-sm font-medium" numberOfLines={1}>
                    {invite.games?.title ?? "Game"}
                  </Text>
                  <Text className="text-muted text-xs mt-0.5">
                    {invite.games?.game_type === "TOURNAMENT" ? "Tournament" : "Game"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRespondGameInvite(invite.id, false)}
                  disabled={respondToGameInvite.isPending}
                  className="rounded-lg px-3 py-2 bg-gray-100"
                >
                  <Text className="text-muted text-xs font-semibold">Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRespondGameInvite(invite.id, true)}
                  disabled={respondToGameInvite.isPending}
                  style={primaryButtonShadow}
                >
                  <GradientFill className="rounded-lg px-3 py-2">
                    <Text className="text-white text-xs font-semibold">Accept</Text>
                  </GradientFill>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Pending join requests — owner/host only, shows requester's skill + location */}
        {canManage && pendingRequests.length > 0 && (
          <View className="px-3.5 mt-6">
            <Text className="text-ink font-semibold text-sm mb-1">
              Join Requests ({pendingRequests.length})
            </Text>
            <Text className="text-muted text-xs mb-2">
              Approve members before they're added to the squad.
            </Text>
            {pendingRequests.map((m) => (
              <SquadPendingRequestRow
                key={m.id}
                name={m.profiles?.full_name ?? null}
                avatar={m.profiles?.avatar ?? null}
                skill={m.skill_level ?? m.profiles?.skill_level ?? null}
                location={m.location ?? m.profiles?.city ?? null}
                disabled={isApprovingOrRejecting || isFull}
                onApprove={() => handleApprove(m.id, m.profiles?.full_name ?? null)}
                onReject={() => handleReject(m.id, m.profiles?.full_name ?? null)}
                onPressAvatar={() => navigation.navigate("PlayerProfile", { userId: m.user_id })}
              />
            ))}
            {isFull && (
              <Text className="text-orange-600 text-xs mt-2">
                Group is full — reject remaining requests or remove a member to approve more.
              </Text>
            )}
          </View>
        )}

        {/* Owner */}
        <View className="px-3.5 mt-6 flex-row items-center" style={{ gap: 12 }}>
          <Pressable
            onPress={() => squad.profiles?.id && navigation.navigate("PlayerProfile", { userId: squad.profiles.id })}
            disabled={!squad.profiles?.id}
          >
            {squad.profiles?.avatar ? (
              <Image
                source={{ uri: squad.profiles.avatar }}
                className="w-10 h-10 rounded-full bg-primary-light"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
                <Text className="text-primary font-bold">
                  {(squad.profiles?.full_name ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
          <View>
            <Text className="text-muted text-xs">Captained by</Text>
            <Text className="text-ink font-semibold text-sm">
              {squad.profiles?.full_name ?? "Unknown"}
            </Text>
          </View>
        </View>

        {/* Delete This Group / Leave Group — sit right under "Captained by"
            instead of pinned to the bottom of the screen, so they scroll
            with the rest of the details instead of floating over them. Only
            the original owner can't leave (no "leave" concept for them —
            disbanding is the only way out); a promoted host is still a
            regular member underneath, so they get both buttons. */}
        {(canManage || (hasJoined && !isOwner)) && (
          <View className="px-3.5 mt-4" style={{ gap: 8 }}>
            {canManage &&
              (disbandSquad.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Pressable onPress={handleDisband} className="border border-danger rounded-xl py-4 items-center">
                  <Text className="text-danger font-semibold">Delete This Group</Text>
                </Pressable>
              ))}
            {hasJoined && !isOwner && (
              leaveSquad.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Pressable onPress={handleLeave} className="border border-danger rounded-xl py-4 items-center">
                  <Text className="text-danger font-semibold">Leave Group</Text>
                </Pressable>
              )
            )}
          </View>
        )}
      </ScrollView>

      {/* CTA — only for people who aren't members yet (Delete/Leave moved
          inline above, under "Captained by"). */}
      {!hasJoined && (
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-3.5 pt-3 pb-3">
        {isBusy ? (
          <ActivityIndicator color={colors.primary} />
        ) : hasRequested ? (
          <View style={{ gap: 8 }}>
            <View className="bg-orange-50 rounded-xl py-3 items-center">
              <Text className="text-orange-600 font-semibold">
                Request Sent — Awaiting Captain Approval
              </Text>
            </View>
            <Pressable
              onPress={handleCancelRequest}
              className="border border-danger rounded-xl py-3 items-center"
            >
              <Text className="text-danger font-semibold">Cancel Request</Text>
            </Pressable>
          </View>
        ) : isClosedToJoins ? (
          <View className="bg-gray-100 rounded-xl py-4 items-center">
            <Text className="text-muted font-semibold">Group is Full</Text>
          </View>
        ) : isGenderRestricted ? (
          <View className="bg-gray-100 rounded-xl py-4 items-center px-6">
            <Text className="text-muted font-semibold text-center">
              This squad is open to {squad.gender === "male" ? "male" : "female"} players only, so you can't
              request to join.
            </Text>
          </View>
        ) : (
          <Pressable onPress={handleJoin} style={primaryButtonShadow}>
            <GradientFill className="rounded-xl py-4 items-center">
              <Text className="text-white font-semibold text-base">Request to Join</Text>
            </GradientFill>
          </Pressable>
        )}
      </View>
      )}

      <JoinRequestModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSubmit={handleSubmitJoinRequest}
        submitting={joinSquad.isPending}
        title="Request to Join"
        subtitle="The captain must approve your request before you're added."
      />

      <InviteUsersModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={`Invite Players · ${squad.name}`}
        excludeIds={[squad.squad_owner_id, ...squad.squad_members.map((m) => m.user_id)]}
        onInvite={async (user) => {
          if (!userId) return;
          await createInvite.mutateAsync({ invitedUserId: user.id, invitedBy: userId });
        }}
      />

      <AddMemberByIdModal
        visible={showAddByIdModal}
        onClose={() => setShowAddByIdModal(false)}
        squadId={squad.id}
        excludeUserIds={[squad.squad_owner_id, ...squad.squad_members.map((m) => m.user_id)]}
        disabledReason={isFull ? "This group is full." : undefined}
      />
    </View>
  );
}
