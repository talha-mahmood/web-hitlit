import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import {
  useSquadDetail,
  useJoinSquad,
  useLeaveSquad,
  useDisbandSquad,
  useApproveMember,
  useRejectMember,
  useRemoveMember,
} from "../../hooks/useSquads";
import { useSquadChatUnreadCount } from "../../hooks/useSquadMessages";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import JoinRequestModal from "../../components/JoinRequestModal";
import ChatIcon from "../../components/ChatIcon";
import type { Database } from "../../types/database.types";

type DetailRoute = RouteProp<SquadsStackParamList, "SquadDetail">;
type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadDetail">;

// ── helpers ───────────────────────────────────────────────────────────────────

function skillLabel(skill: string | null): string {
  if (!skill) return "Any Level";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
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

function MemberAvatar({
  name,
  avatar,
  isOwner,
  onRemove,
}: {
  name: string | null;
  avatar: string | null;
  isOwner: boolean;
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
      {isOwner && (
        <View className="bg-primary rounded-full px-1.5 py-0.5 mt-1">
          <Text className="text-white text-xs font-medium">Captain</Text>
        </View>
      )}
      <Text className="text-muted text-xs mt-1 text-center" numberOfLines={1}>
        {(name ?? "Member").split(" ")[0]}
      </Text>
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

export default function SquadDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const { data: squad, isLoading, error } = useSquadDetail(params.squadId);
  const { data: chatUnreadCount } = useSquadChatUnreadCount(squad?.id, userId);
  const joinSquad = useJoinSquad();
  const leaveSquad = useLeaveSquad();
  const disbandSquad = useDisbandSquad();
  const approveMember = useApproveMember(params.squadId);
  const rejectMember = useRejectMember(params.squadId);
  const removeMember = useRemoveMember(params.squadId);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !squad) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-ink font-semibold text-base mb-2">Squad not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-primary font-medium">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const activeMembers = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const emptySlots = squad.max_players ? Math.max(0, squad.max_players - activeMembers.length) : 0;
  const isFull = !!squad.max_players && activeMembers.length >= squad.max_players;

  const isOwner = squad.squad_owner_id === userId;
  const myMemberRecord = userId
    ? squad.squad_members.find((m) => m.user_id === userId && m.status === "ACTIVE")
    : null;
  const myPendingRecord = userId
    ? squad.squad_members.find((m) => m.user_id === userId && m.status === "PENDING")
    : null;
  const hasJoined = !!myMemberRecord;
  const hasRequested = !!myPendingRecord;
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
          Alert.alert("Error", err instanceof Error ? err.message : "Could not send request. Try again."),
      }
    );
  };

  const handleLeave = () => {
    if (!userId) return;
    Alert.alert("Leave Squad", "Are you sure you want to leave?", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          leaveSquad.mutate(
            { squadId: squad.id, userId },
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
    Alert.alert("Cancel Request", "Withdraw your request to join this squad?", [
      { text: "Keep Request", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () => {
          leaveSquad.mutate(
            { squadId: squad.id, userId },
            {
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not withdraw. Try again."),
            }
          );
        },
      },
    ]);
  };

  const handleApprove = (squadMemberId: string, name: string | null) => {
    approveMember.mutate(squadMemberId, {
      onError: (err) =>
        Alert.alert("Error", err instanceof Error ? err.message : `Could not approve ${name ?? "member"}.`),
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
                Alert.alert("Error", err instanceof Error ? err.message : "Could not reject request."),
            });
          },
        },
      ]
    );
  };

  const handleRemove = (squadMemberId: string, name: string | null) => {
    Alert.alert(
      "Remove Member",
      `Remove ${name ?? "this member"} from the squad? They won't be able to rejoin without sending a new request.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeMember.mutate(squadMemberId, {
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not remove member."),
            });
          },
        },
      ]
    );
  };

  const handleDisband = () => {
    Alert.alert("Disband Squad", "This will permanently disband the squad for everyone. This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Disband",
        style: "destructive",
        onPress: () => {
          disbandSquad.mutate(squad.id, {
            onSuccess: () => navigation.goBack(),
            onError: (err) =>
              Alert.alert("Error", err instanceof Error ? err.message : "Could not disband."),
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

  const isBusy = joinSquad.isPending || leaveSquad.isPending || disbandSquad.isPending;
  const isApprovingOrRejecting = approveMember.isPending || rejectMember.isPending || removeMember.isPending;

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
          <Text className="text-base font-bold text-ink" numberOfLines={1}>{squad.name}</Text>
          <Text className="text-muted text-sm">{skillLabel(squad.skill_level)}</Text>
        </View>
        {isOwner && (
          <Pressable
            onPress={() => navigation.navigate("EditSquad", { squadId: squad.id })}
            className="mr-2 p-1"
          >
            <Ionicons name="create-outline" size={22} color={colors.ink} />
          </Pressable>
        )}
        {(isOwner || hasJoined) && (
          <Pressable
            onPress={() => navigation.navigate("SquadChat", { squadId: squad.id, squadName: squad.name })}
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
        {isFull && (
          <View className="bg-orange-50 px-2 py-1 rounded-lg">
            <Text className="text-orange-600 text-xs font-semibold">Full</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Squad info card */}
        <View className="mx-4 mt-4 border border-border rounded-2xl overflow-hidden">
          <View className="bg-primary-light px-4 py-3">
            <Text className="text-primary-dark font-semibold text-sm">Squad Details</Text>
          </View>
          <View className="px-4">
            <InfoRow
              icon="pricetag-outline"
              label="Squad ID"
              value={squad.squad_code}
              action={
                (isOwner || hasJoined) && (
                  <Pressable
                    onPress={handleCopySquadCode}
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
            <InfoRow icon="speedometer-outline" label="Skill Level" value={skillLabel(squad.skill_level)} />
            <InfoRow icon="location-outline" label="Location" value={squad.location ?? "Not set"} />
          </View>
        </View>

        {/* Description */}
        {!!squad.description && (
          <View className="mx-4 mt-4 border border-border rounded-2xl p-4">
            <Text className="text-ink font-semibold text-sm mb-2">About this squad</Text>
            <Text className="text-muted text-sm leading-relaxed">{squad.description}</Text>
          </View>
        )}

        {/* Members */}
        <View className="mx-4 mt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-ink font-semibold text-sm">
              Members ({activeMembers.length}{squad.max_players ? `/${squad.max_players}` : ""})
            </Text>
            {!!squad.max_players && (
              <Text className="text-muted text-sm">
                {emptySlots > 0 ? `${emptySlots} spot${emptySlots !== 1 ? "s" : ""} left` : "Full"}
              </Text>
            )}
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {activeMembers.map((m) => (
              <MemberAvatar
                key={m.id}
                name={m.profiles?.full_name ?? null}
                avatar={m.profiles?.avatar ?? null}
                isOwner={m.user_id === squad.squad_owner_id}
                onRemove={
                  isOwner && m.user_id !== squad.squad_owner_id && !isApprovingOrRejecting
                    ? () => handleRemove(m.id, m.profiles?.full_name ?? null)
                    : undefined
                }
              />
            ))}
          </View>
        </View>

        {/* Pending join requests — owner only, shows requester's skill + location */}
        {isOwner && pendingRequests.length > 0 && (
          <View className="mx-4 mt-4 border border-border rounded-2xl p-4">
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
              />
            ))}
            {isFull && (
              <Text className="text-orange-600 text-xs mt-2">
                Squad is full — reject remaining requests or remove a member to approve more.
              </Text>
            )}
          </View>
        )}

        {/* Owner */}
        <View className="mx-4 mt-4 flex-row items-center border border-border rounded-2xl p-4" style={{ gap: 12 }}>
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
          <View>
            <Text className="text-muted text-xs">Captained by</Text>
            <Text className="text-ink font-semibold text-sm">
              {squad.profiles?.full_name ?? "Unknown"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 pt-3 pb-6">
        {isBusy ? (
          <ActivityIndicator color={colors.primary} />
        ) : isOwner ? (
          <Pressable
            onPress={handleDisband}
            className="border border-danger rounded-xl py-4 items-center"
          >
            <Text className="text-danger font-semibold">Disband This Squad</Text>
          </Pressable>
        ) : hasJoined ? (
          <Pressable
            onPress={handleLeave}
            className="border border-danger rounded-xl py-4 items-center"
          >
            <Text className="text-danger font-semibold">Leave Squad</Text>
          </Pressable>
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
        ) : isFull ? (
          <View className="bg-gray-100 rounded-xl py-4 items-center">
            <Text className="text-muted font-semibold">Squad is Full</Text>
          </View>
        ) : (
          <Pressable onPress={handleJoin} className="bg-primary rounded-xl py-4 items-center">
            <Text className="text-white font-semibold text-base">Request to Join</Text>
          </Pressable>
        )}
      </View>

      <JoinRequestModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSubmit={handleSubmitJoinRequest}
        submitting={joinSquad.isPending}
        title="Request to Join"
        subtitle="The captain must approve your request before you're added."
      />
    </View>
  );
}
