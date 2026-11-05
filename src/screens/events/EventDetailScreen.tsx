import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Image, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import {
  useEventDetail,
  useJoinEvent,
  useLeaveEvent,
  useDisbandEvent,
  useApproveMember,
  useRejectMember,
  useRemoveMember,
  useSetEventJoinBlocked,
  useSetMemberHost,
} from "../../hooks/useEvents";
import { useEventChatUnreadCount } from "../../hooks/useEventMessages";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, primaryButtonShadow, cardShadow } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import EventJoinRequestModal from "../../components/EventJoinRequestModal";
import ChatIcon from "../../components/ChatIcon";
import BlinkingEyeIcon from "../../components/BlinkingEyeIcon";
import WaveDivider from "../../components/WaveDivider";
import { SkeletonDetailHeader } from "../../components/Skeleton";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type DetailRoute = RouteProp<CommunityStackParamList, "EventDetail">;
type Nav = NativeStackNavigationProp<CommunityStackParamList, "EventDetail">;

// ── sub-components ────────────────────────────────────────────────────────────
// Same shell as SquadDetailScreen's InfoRow — icon in a light-green circle,
// optional colored pill for the value.

function InfoRow({
  icon,
  label,
  value,
  action,
  pillColor,
  divider = true,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  action?: React.ReactNode;
  pillColor?: string;
  divider?: boolean;
}) {
  return (
    <View
      className="flex-row items-center py-3"
      style={{ gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: colors.border }}
    >
      <View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}>
        <Ionicons name={icon} size={17} color={colors.primaryDark} />
      </View>
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        {pillColor ? (
          pillColor === colors.primary ? (
            <GradientFill style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4 }}>
              <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{value}</Text>
            </GradientFill>
          ) : (
            <View style={{ backgroundColor: pillColor, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4 }}>
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
  onOpenMenu?: () => void;
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
            className="absolute -top-1 -right-1 bg-surface rounded-full w-5 h-5 items-center justify-center border border-border"
            style={{ shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 }}
          >
            <Ionicons name="ellipsis-vertical" size={11} color={colors.ink} />
          </Pressable>
        )}
      </Pressable>
      {isOwner ? (
        <GradientFill className="rounded-full px-1.5 py-0.5 mt-1">
          <Text className="text-jazba-white text-xs font-medium">Host</Text>
        </GradientFill>
      ) : isHost ? (
        <GradientFill className="rounded-full px-1.5 py-0.5 mt-1">
          <Text className="text-jazba-white text-xs font-medium">Co-host</Text>
        </GradientFill>
      ) : null}
      <Text className="text-muted text-xs mt-1 text-center" numberOfLines={1}>
        {(name ?? "Member").split(" ")[0]}
      </Text>
    </View>
  );
}

// An event join request shows the requester's location so the host can
// judge fit before approving — mirrors SquadPendingRequestRow minus skill.
function EventPendingRequestRow({
  name,
  avatar,
  location,
  onApprove,
  onReject,
  onPressAvatar,
  disabled,
}: {
  name: string | null;
  avatar: string | null;
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
            {location ?? "Location not set"}
          </Text>
        </View>
        <Pressable onPress={onReject} disabled={disabled} className="border border-border rounded-lg px-3 py-1.5">
          <Text className="text-muted text-xs font-semibold">Reject</Text>
        </Pressable>
        <Pressable onPress={onApprove} disabled={disabled}>
          <GradientFill className="rounded-lg px-3 py-1.5">
            <Text className="text-jazba-white text-xs font-semibold">Approve</Text>
          </GradientFill>
        </Pressable>
      </View>
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const { data: event, isLoading, error, refetch, isRefetching } = useEventDetail(params.eventId);
  const { data: chatUnreadCount } = useEventChatUnreadCount(event?.id, userId);
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();
  const disbandEvent = useDisbandEvent();
  const approveMember = useApproveMember(params.eventId);
  const rejectMember = useRejectMember(params.eventId);
  const removeMember = useRemoveMember(params.eventId);
  const setMemberHost = useSetMemberHost(params.eventId);
  const setJoinBlocked = useSetEventJoinBlocked();

  if (isLoading) {
    return (
      <View className="flex-1 bg-app px-4 pt-4">
        <SkeletonDetailHeader />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-app items-center justify-center px-6">
        <Text className="text-ink font-semibold text-base mb-2">Event not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-primary font-medium">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const activeMembers = event.event_members.filter((m) => m.status === "ACTIVE");
  // Owner-closed via "Block New Join Requests" — events have no capacity
  // field, so this is the only way an event can be "closed".
  const isClosedToJoins = event.join_requests_blocked;

  const isOwner = event.event_owner_id === userId;
  const myMemberRecord = userId ? event.event_members.find((m) => m.user_id === userId && m.status === "ACTIVE") : null;
  // A promoted host — same authority as the owner everywhere below, enforced
  // server-side by RLS policies that accept either event_owner_id or an
  // ACTIVE event_members row with role='host'.
  const isHost = myMemberRecord?.role === "host";
  const canManage = isOwner || isHost;
  const myPendingRecord = userId ? event.event_members.find((m) => m.user_id === userId && m.status === "PENDING") : null;
  const hasJoined = !!myMemberRecord;
  const hasRequested = !!myPendingRecord;
  // A Male Only/Female Only event can't be joined by someone who doesn't
  // match — enforced server-side too (event_members RLS), this just shows
  // why up front instead of letting them tap Request to Join and hit an error.
  const isGenderRestricted = event.gender !== "mixed" && (!myGender || myGender !== event.gender) && !hasJoined && !hasRequested;
  const pendingRequests = event.event_members.filter((m) => m.status === "PENDING");

  const handleJoin = () => {
    if (!userId) return;
    setShowJoinModal(true);
  };

  const handleSubmitJoinRequest = (location: string) => {
    if (!userId) return;
    joinEvent.mutate(
      { eventId: event.id, userId, location },
      {
        onSuccess: () => setShowJoinModal(false),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request. Try again.")),
      }
    );
  };

  const handleToggleJoinBlocked = () => {
    const nextBlocked = !event.join_requests_blocked;
    Alert.alert(
      nextBlocked ? "Block New Join Requests?" : "Unblock New Join Requests?",
      nextBlocked
        ? "No one will be able to request to join this event until you unblock it."
        : "Players will be able to request to join this event again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextBlocked ? "Block" : "Unblock",
          style: nextBlocked ? "destructive" : "default",
          onPress: () => {
            setJoinBlocked.mutate(
              { eventId: event.id, blocked: nextBlocked },
              { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update this setting. Try again.")) }
            );
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    if (!userId) return;
    Alert.alert("Leave Event", "Are you sure you want to leave?", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          leaveEvent.mutate(
            { eventId: event.id, userId },
            { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not leave. Try again.")) }
          );
        },
      },
    ]);
  };

  const handleCancelRequest = () => {
    if (!userId) return;
    Alert.alert("Cancel Request", "Withdraw your request to join this event?", [
      { text: "Keep Request", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () => {
          leaveEvent.mutate(
            { eventId: event.id, userId },
            { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not withdraw. Try again.")) }
          );
        },
      },
    ]);
  };

  const handleApprove = (eventMemberId: string, name: string | null) => {
    approveMember.mutate(eventMemberId, {
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, `Could not approve ${name ?? "member"}.`)),
    });
  };

  const handleReject = (eventMemberId: string, name: string | null) => {
    Alert.alert("Reject Request", `Reject ${name ?? "this player"}'s request to join?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => {
          rejectMember.mutate(eventMemberId, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not reject request.")),
          });
        },
      },
    ]);
  };

  const handleRemove = (eventMemberId: string, name: string | null) => {
    Alert.alert(
      "Remove Member",
      `Remove ${name ?? "this member"} from the event? They won't be able to rejoin without sending a new request.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeMember.mutate(eventMemberId, {
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove member.")),
            });
          },
        },
      ]
    );
  };

  const handleManageMember = (eventMemberId: string, name: string | null, currentlyHost: boolean) => {
    const label = name ?? "this member";
    Alert.alert(
      currentlyHost ? "Remove as Co-host?" : "Make Co-host?",
      currentlyHost
        ? `${label} will lose co-host privileges and go back to being a regular member.`
        : `${label} will be able to manage members, edit the event, and everything else a co-host can do.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: currentlyHost ? "Remove Co-host" : "Make Co-host",
          style: currentlyHost ? "destructive" : "default",
          onPress: () => {
            setMemberHost.mutate(
              { eventMemberId, isHost: !currentlyHost },
              { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update co-host status.")) }
            );
          },
        },
      ]
    );
  };

  const handleOpenMemberMenu = (eventMemberId: string, name: string | null, currentlyHost: boolean) => {
    Alert.alert(name ?? "Member", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: currentlyHost ? "Remove as Co-host" : "Make Co-host", onPress: () => handleManageMember(eventMemberId, name, currentlyHost) },
      { text: "Remove Member", style: "destructive", onPress: () => handleRemove(eventMemberId, name) },
    ]);
  };

  const handleDisband = () => {
    Alert.alert("Delete Event", "This will permanently delete the event for everyone. This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          disbandEvent.mutate(event.id, {
            onSuccess: () => navigation.goBack(),
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete event.")),
          });
        },
      },
    ]);
  };

  const handleCopyEventCode = async () => {
    await Clipboard.setStringAsync(event.event_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  const isBusy = joinEvent.isPending || leaveEvent.isPending || disbandEvent.isPending;
  const isApprovingOrRejecting = approveMember.isPending || rejectMember.isPending || removeMember.isPending;

  const genderLabel = event.gender === "male" ? "Male Only" : event.gender === "female" ? "Female Only" : "Everyone";
  const genderPillColor = event.gender === "male" ? "#2563EB" : event.gender === "female" ? "#EC4899" : colors.primary;

  return (
    <View className="flex-1 bg-app">
      {/* Hero header — dark gradient with a decorative calendar watermark,
          same treatment as SquadDetailScreen/GameDetailScreen, fading into
          the page via a wave divider. */}
      <View style={{ position: "relative" }}>
        <LinearGradient
          colors={["#07301D", "#0F9F58", "#18C66A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 10, paddingBottom: 28, paddingHorizontal: 16, overflow: "hidden" }}
        >
          <MaterialCommunityIcons
            name="calendar-star"
            size={84}
            color="white"
            style={{ position: "absolute", right: -14, bottom: -10, opacity: 0.14, transform: [{ rotate: "-10deg" }] }}
          />

          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.goBack()}
              className="items-center justify-center rounded-full mr-3"
              style={{ width: 38, height: 38, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </Pressable>
            <Text className="text-jazba-white font-extrabold flex-1" style={{ fontSize: 19 }} numberOfLines={1}>
              {event.name}
            </Text>
            {(isOwner || hasJoined) && (
              <Pressable
                onPress={() => navigation.navigate("EventChat", { eventId: event.id, eventName: event.name })}
                className="ml-3 items-center justify-center rounded-full"
                style={{ width: 42, height: 42, backgroundColor: "#0A1723", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 }}
              >
                <ChatIcon size={23} unreadCount={chatUnreadCount} />
              </Pressable>
            )}
          </View>

          <View className="flex-row items-center flex-wrap mt-2.5" style={{ gap: 8 }}>
            <View className="flex-row items-center bg-surface" style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 5 }}>
              <MaterialCommunityIcons name="calendar" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{event.event_type}</Text>
            </View>
            {canManage && (
              <Pressable
                onPress={handleToggleJoinBlocked}
                disabled={setJoinBlocked.isPending}
                className="flex-row items-center"
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 5, backgroundColor: "#0A1723" }}
              >
                {setJoinBlocked.isPending ? (
                  <ActivityIndicator size="small" color={event.join_requests_blocked ? colors.primary : colors.danger} />
                ) : (
                  <>
                    <View style={{ width: 13, height: 13 }}>
                      <Ionicons name="person" size={13} color={event.join_requests_blocked ? colors.primary : colors.danger} />
                      {event.join_requests_blocked ? (
                        <GradientFill
                          className="items-center justify-center rounded-full"
                          style={{ position: "absolute", right: -3, bottom: -3, width: 9, height: 9, borderWidth: 1, borderColor: "white" }}
                        >
                          <Ionicons name="ban" size={6} color="white" />
                        </GradientFill>
                      ) : (
                        <View
                          className="items-center justify-center rounded-full"
                          style={{ position: "absolute", right: -3, bottom: -3, width: 9, height: 9, backgroundColor: colors.danger, borderWidth: 1, borderColor: "white" }}
                        >
                          <Ionicons name="ban" size={6} color="white" />
                        </View>
                      )}
                    </View>
                    <Text style={{ color: event.join_requests_blocked ? colors.primary : colors.danger, fontSize: 12, fontWeight: "700" }}>
                      {event.join_requests_blocked ? "Unblock New Users" : "Block New Users"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
            {isClosedToJoins && (
              <View className="bg-surface px-2 py-1 rounded-lg">
                <Text className="text-orange-600 text-xs font-semibold">Closed</Text>
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
        {/* Event info — card, collapsed behind a dropdown by default;
            tapping the header reveals it. */}
        <View className="px-3.5 mt-5">
          <View className="bg-surface rounded-2xl px-4" style={cardShadow}>
            <Pressable onPress={() => setDetailsExpanded((v) => !v)} className="flex-row items-center py-4" style={{ gap: 12 }}>
              <View className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}>
                <Ionicons name="document-text-outline" size={19} color={colors.primaryDark} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text className="text-ink font-bold text-base">Event Details</Text>
                  <BlinkingEyeIcon size={16} />
                </View>
                <Text className="text-muted text-xs mt-0.5">View complete event information</Text>
              </View>
              <Ionicons name={detailsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </Pressable>
            {detailsExpanded && (
              <View className="pb-1" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                {/* The ID/code is only meaningful (and only shown) to people
                    already in the event — a non-member has nothing to do with
                    it and shouldn't see it at all. */}
                {(isOwner || hasJoined) && (
                  <InfoRow
                    icon="pricetag-outline"
                    label="Event ID"
                    value={event.event_code}
                    action={
                      <Pressable
                        onPress={handleCopyEventCode}
                        hitSlop={8}
                        className="flex-row items-center px-3 py-1.5 rounded-lg bg-surface"
                        style={{ gap: 4, borderWidth: 1, borderColor: colors.border }}
                      >
                        <Ionicons name={codeCopied ? "checkmark" : "copy-outline"} size={14} color={codeCopied ? colors.primary : colors.muted} />
                        <Text className={`text-xs font-medium ${codeCopied ? "text-primary" : "text-muted"}`}>
                          {codeCopied ? "Copied" : "Copy"}
                        </Text>
                      </Pressable>
                    }
                  />
                )}
                <InfoRow icon="albums-outline" label="Event Type" value={event.event_type} />
                <InfoRow icon="location-outline" label="Location" value={event.location ?? "Not set"} />
                <InfoRow icon="people-outline" label="Open To" value={genderLabel} pillColor={genderPillColor} divider={false} />
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {!!event.description && (
          <View className="px-3.5 mt-6">
            <View className="flex-row items-center bg-surface rounded-2xl p-4" style={{ ...cardShadow, gap: 12 }}>
              <View className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}>
                <Ionicons name="megaphone-outline" size={19} color={colors.primaryDark} />
              </View>
              <View className="flex-1">
                <Text className="text-ink font-bold text-base mb-1">About this event</Text>
                <Text className="text-muted text-sm leading-relaxed">{event.description}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Members */}
        <View className="px-3.5 mt-6">
          <Text className="text-ink font-semibold text-sm mb-3">Members ({activeMembers.length})</Text>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {activeMembers.map((m) => {
              const rowIsOwner = m.user_id === event.event_owner_id;
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
          </View>
        </View>

        {/* Pending join requests — owner/host only, shows requester's location */}
        {canManage && pendingRequests.length > 0 && (
          <View className="px-3.5 mt-6">
            <Text className="text-ink font-semibold text-sm mb-1">Join Requests ({pendingRequests.length})</Text>
            <Text className="text-muted text-xs mb-2">Approve members before they're added to the event.</Text>
            {pendingRequests.map((m) => (
              <EventPendingRequestRow
                key={m.id}
                name={m.profiles?.full_name ?? null}
                avatar={m.profiles?.avatar ?? null}
                location={m.location ?? m.profiles?.city ?? null}
                disabled={isApprovingOrRejecting}
                onApprove={() => handleApprove(m.id, m.profiles?.full_name ?? null)}
                onReject={() => handleReject(m.id, m.profiles?.full_name ?? null)}
                onPressAvatar={() => navigation.navigate("PlayerProfile", { userId: m.user_id })}
              />
            ))}
          </View>
        )}

        {/* Owner */}
        <View className="px-3.5 mt-6 flex-row items-center" style={{ gap: 12 }}>
          <Pressable
            onPress={() => event.profiles?.id && navigation.navigate("PlayerProfile", { userId: event.profiles.id })}
            disabled={!event.profiles?.id}
          >
            {event.profiles?.avatar ? (
              <Image source={{ uri: event.profiles.avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
            ) : (
              <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
                <Text className="text-primary font-bold">{(event.profiles?.full_name ?? "?").charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
          <View>
            <Text className="text-muted text-xs">Hosted by</Text>
            <Text className="text-ink font-semibold text-sm">{event.profiles?.full_name ?? "Unknown"}</Text>
          </View>
        </View>

        {/* Delete This Event / Leave Event */}
        {(canManage || (hasJoined && !isOwner)) && (
          <View className="px-3.5 mt-4" style={{ gap: 8 }}>
            {canManage &&
              (disbandEvent.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Pressable onPress={handleDisband} className="border border-danger rounded-xl py-4 items-center">
                  <Text className="text-danger font-semibold">Delete This Event</Text>
                </Pressable>
              ))}
            {hasJoined && !isOwner && (
              leaveEvent.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Pressable onPress={handleLeave} className="border border-danger rounded-xl py-4 items-center">
                  <Text className="text-danger font-semibold">Leave Event</Text>
                </Pressable>
              )
            )}
          </View>
        )}
      </ScrollView>

      {/* CTA — only for people who aren't members yet. */}
      {!hasJoined && (
      <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border px-3.5 pt-3 pb-3">
        {isBusy ? (
          <ActivityIndicator color={colors.primary} />
        ) : hasRequested ? (
          <View style={{ gap: 8 }}>
            <View className="bg-orange-50 rounded-xl py-3 items-center">
              <Text className="text-orange-600 font-semibold">Request Sent — Awaiting Host Approval</Text>
            </View>
            <Pressable onPress={handleCancelRequest} className="border border-danger rounded-xl py-3 items-center">
              <Text className="text-danger font-semibold">Cancel Request</Text>
            </Pressable>
          </View>
        ) : isClosedToJoins ? (
          <View className="bg-gray-100 rounded-xl py-4 items-center">
            <Text className="text-muted font-semibold">Event is Closed</Text>
          </View>
        ) : isGenderRestricted ? (
          <View className="bg-gray-100 rounded-xl py-4 items-center px-6">
            <Text className="text-muted font-semibold text-center">
              This event is open to {event.gender === "male" ? "male" : "female"} players only, so you can't request to join.
            </Text>
          </View>
        ) : (
          <Pressable onPress={handleJoin} style={primaryButtonShadow}>
            <GradientFill className="rounded-xl py-4 items-center">
              <Text className="text-jazba-white font-semibold text-base">Request to Join</Text>
            </GradientFill>
          </Pressable>
        )}
      </View>
      )}

      <EventJoinRequestModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSubmit={handleSubmitJoinRequest}
        submitting={joinEvent.isPending}
        title="Request to Join"
        subtitle="The host must approve your request before you're added."
      />
    </View>
  );
}
