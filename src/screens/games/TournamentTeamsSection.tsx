import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useTournamentTeams,
  useCreateTeam,
  useRequestToJoinTeam,
  useApproveTeamMember,
  useRejectTeamMember,
  useRemoveTeamMember,
  useLeaveTeam,
  useSubmitTeam,
  useApproveTeam,
  useRejectTeam,
} from "../../hooks/useTournamentTeams";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow } from "../../constants/theme";
import CreateTeamModal from "../../components/CreateTeamModal";
import JoinRequestModal from "../../components/JoinRequestModal";
import type { Database } from "../../types/database.types";
import type { GameDetail } from "../../lib/api/games";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

function skillLevelLabel(skill: string | null): string {
  if (!skill) return "Not specified";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

const TEAM_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  FORMING: { bg: "bg-blue-50", text: "text-blue-700", label: "Recruiting" },
  PENDING_HOST_APPROVAL: { bg: "bg-orange-50", text: "text-orange-600", label: "Awaiting Host" },
  APPROVED: { bg: "bg-green-50", text: "text-green-700", label: "Approved" },
  REJECTED: { bg: "bg-red-50", text: "text-red-600", label: "Rejected" },
};

function MemberAvatar({
  name,
  avatar,
  isCaptain,
  onRemove,
}: {
  name: string | null;
  avatar: string | null;
  isCaptain: boolean;
  onRemove?: () => void;
}) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  return (
    <View className="items-center" style={{ width: 56 }}>
      <View>
        {avatar ? (
          <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
        ) : (
          <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
            <Text className="text-primary font-bold text-sm">{initials}</Text>
          </View>
        )}
        {onRemove && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            className="absolute -top-1 -right-1 bg-danger rounded-full w-4 h-4 items-center justify-center border-2 border-white"
          >
            <Ionicons name="close" size={9} color="white" />
          </Pressable>
        )}
      </View>
      {isCaptain && (
        <View className="bg-primary rounded-full px-1 py-0.5 mt-0.5">
          <Text className="text-white" style={{ fontSize: 9, fontWeight: "600" }}>Captain</Text>
        </View>
      )}
      <Text className="text-muted text-xs mt-0.5 text-center" numberOfLines={1}>
        {(name ?? "Player").split(" ")[0]}
      </Text>
    </View>
  );
}

function TeamCard({
  team,
  requiredSize,
  userId,
  isHost,
  disabled,
  hasActiveTeamElsewhere,
  onRequestJoin,
  onLeave,
  onApproveMember,
  onRejectMember,
  onRemoveMember,
  onSubmitTeam,
  onRemoveTeam,
}: {
  team: TournamentTeam;
  requiredSize: number;
  userId?: string;
  isHost: boolean;
  disabled: boolean;
  // True when the user already has a PENDING request or a JOINED spot on a
  // *different* (non-rejected) team in this same tournament — until the
  // captain there rejects them or they leave, they can't request this team.
  hasActiveTeamElsewhere: boolean;
  onRequestJoin: () => void;
  onLeave: () => void;
  onApproveMember: (memberId: string, name: string | null) => void;
  onRejectMember: (memberId: string, name: string | null) => void;
  onRemoveMember: (memberId: string, name: string | null) => void;
  onSubmitTeam: () => void;
  onRemoveTeam: () => void;
}) {
  const joinedMembers = team.tournament_team_members.filter((m) => m.status === "JOINED");
  const pendingMembers = team.tournament_team_members.filter((m) => m.status === "PENDING");
  const isCaptain = team.captain_id === userId;
  const myMembership = userId
    ? team.tournament_team_members.find((m) => m.user_id === userId)
    : undefined;
  const isTeamFull = requiredSize > 0 && joinedMembers.length >= requiredSize;
  const isRosterEditable = team.status === "FORMING" || team.status === "REJECTED";
  const playersNeeded = Math.max(requiredSize - joinedMembers.length, 0);
  const badge = TEAM_STATUS_BADGE[team.status];

  return (
    <View className="border border-border rounded-2xl p-4" style={cardShadow}>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>{team.name}</Text>
        {badge && (
          <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
          </View>
        )}
      </View>
      <Text className="text-muted text-xs mb-3">
        {joinedMembers.length}/{requiredSize || "—"} players · Captain: {team.profiles?.full_name ?? "Unknown"}
      </Text>

      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {joinedMembers.map((m) => (
          <MemberAvatar
            key={m.id}
            name={m.profiles?.full_name ?? null}
            avatar={m.profiles?.avatar ?? null}
            isCaptain={m.user_id === team.captain_id}
            onRemove={
              isCaptain && m.user_id !== team.captain_id && !disabled && isRosterEditable
                ? () => onRemoveMember(m.id, m.profiles?.full_name ?? null)
                : undefined
            }
          />
        ))}
      </View>

      {/* Captain's own pending requests for this team */}
      {isCaptain && isRosterEditable && pendingMembers.length > 0 && (
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-ink font-medium text-xs mb-2">
            Join Requests ({pendingMembers.length})
          </Text>
          {pendingMembers.map((m) => (
            <View key={m.id} className="flex-row items-center py-1.5" style={{ gap: 8 }}>
              <View className="flex-1">
                <Text className="text-ink text-sm" numberOfLines={1}>
                  {m.profiles?.full_name ?? "Player"}
                </Text>
                <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                  {skillLevelLabel(m.skill_level)} · {m.location ?? "Location not specified"}
                </Text>
              </View>
              <Pressable
                onPress={() => onRejectMember(m.id, m.profiles?.full_name ?? null)}
                disabled={disabled}
                className="border border-border rounded-lg px-2.5 py-1"
              >
                <Text className="text-muted text-xs font-semibold">Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => onApproveMember(m.id, m.profiles?.full_name ?? null)}
                disabled={disabled || isTeamFull}
                className="bg-primary rounded-lg px-2.5 py-1"
              >
                <Text className="text-white text-xs font-semibold">Approve</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {team.status === "PENDING_HOST_APPROVAL" && (
        <View className="mt-3 bg-orange-50 rounded-lg py-2.5 items-center">
          <Text className="text-orange-600 text-xs font-semibold">
            Request Pending — awaiting host approval
          </Text>
        </View>
      )}

      {team.status === "APPROVED" && (
        <View className="mt-3" style={{ gap: 8 }}>
          <View className="bg-green-50 rounded-lg py-2.5 items-center">
            <Text className="text-green-700 text-xs font-semibold">
              Approved — this team is in the tournament
            </Text>
          </View>
          {isHost && (
            <Pressable
              onPress={onRemoveTeam}
              disabled={disabled}
              className="border border-danger rounded-lg py-2 items-center"
            >
              <Text className="text-danger text-xs font-semibold">Remove Team</Text>
            </Pressable>
          )}
        </View>
      )}

      {team.status === "REJECTED" && (
        <Text className="text-danger text-xs mt-2">
          Rejected by the tournament host{isCaptain ? " — fix your roster and resubmit below." : "."}
        </Text>
      )}

      {/* This team's own CTA — hidden for the host on OTHER teams (they get
          the approval queue / Remove Team button instead), but shown for the
          host's own team same as any other captain. */}
      {(!isHost || isCaptain) && isRosterEditable && (
        <View className="mt-3">
          {isCaptain ? (
            <Pressable
              onPress={() => {
                if (!isTeamFull) {
                  Alert.alert(
                    "Team Incomplete",
                    "First complete your players required for a team then you can make a Join Request. You can ask members from squads to join your team."
                  );
                  return;
                }
                onSubmitTeam();
              }}
              disabled={disabled}
              className={`rounded-lg py-2.5 items-center ${isTeamFull ? "bg-green-600" : "bg-gray-200"}`}
            >
              <Text className={`text-xs font-semibold ${isTeamFull ? "text-white" : "text-muted"}`}>
                {isTeamFull
                  ? isHost
                    ? "Add Team to Tournament"
                    : team.status === "REJECTED"
                      ? "Resubmit to Tournament Host"
                      : "Submit Team to Tournament Host"
                  : `${joinedMembers.length}/${requiredSize || "—"} Players — Need ${playersNeeded} More`}
              </Text>
            </Pressable>
          ) : myMembership?.status === "JOINED" ? (
            <Pressable
              onPress={onLeave}
              disabled={disabled}
              className="border border-danger rounded-lg py-2 items-center"
            >
              <Text className="text-danger text-xs font-semibold">Leave Team</Text>
            </Pressable>
          ) : myMembership?.status === "PENDING" ? (
            <Text className="text-orange-600 text-xs font-medium text-center">
              Request sent — awaiting captain approval
            </Text>
          ) : !myMembership && hasActiveTeamElsewhere ? (
            <Text className="text-muted text-xs text-center">
              You already have a request or spot on another team in this tournament.
            </Text>
          ) : !myMembership && team.status === "FORMING" && !isTeamFull ? (
            <Pressable
              onPress={onRequestJoin}
              disabled={disabled}
              className="bg-primary rounded-lg py-2 items-center"
            >
              <Text className="text-white text-xs font-semibold">Request to Join Team</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function TournamentTeamsSection({ game }: { game: GameDetail }) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const isHost = game.creator_id === userId;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinRequestTeamId, setJoinRequestTeamId] = useState<string | null>(null);

  const { data: teamsData, isLoading } = useTournamentTeams(game.id);
  const createTeam = useCreateTeam(game.id);
  const requestToJoinTeam = useRequestToJoinTeam(game.id);
  const approveTeamMember = useApproveTeamMember(game.id);
  const rejectTeamMember = useRejectTeamMember(game.id);
  const removeTeamMember = useRemoveTeamMember(game.id);
  const leaveTeam = useLeaveTeam(game.id);
  const submitTeam = useSubmitTeam(game.id);
  const approveTeam = useApproveTeam(game.id);
  const rejectTeam = useRejectTeam(game.id);

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} className="mt-4" />;
  }

  const teams = teamsData ?? [];
  const requiredSize = game.players_per_team ?? 0;
  const requiredTeams = game.number_of_teams ?? 0;

  // A rejected team doesn't count against the tournament's team slots, and
  // its non-captain members are free to form/join a different team — but a
  // captain always "owns" their team regardless of status, since they should
  // fix its roster and resubmit rather than abandon it for a new one.
  const activeTeams = teams.filter((t) => t.status !== "REJECTED");
  const myTeam = userId
    ? teams.find((t) => {
        if (t.captain_id === userId) return true;
        if (t.status === "REJECTED") return false;
        return t.tournament_team_members.some(
          (m) => m.user_id === userId && (m.status === "JOINED" || m.status === "PENDING")
        );
      })
    : undefined;
  // The host can create their own team too — since they're also the one who'd
  // approve it, their team skips PENDING_HOST_APPROVAL entirely (see
  // submitTeamForApproval / enforce_team_status_transition).
  const canCreateTeam = !myTeam && requiredTeams > 0 && activeTeams.length < requiredTeams;
  const teamsAwaitingHost = isHost ? teams.filter((t) => t.status === "PENDING_HOST_APPROVAL") : [];

  const disabled =
    createTeam.isPending ||
    requestToJoinTeam.isPending ||
    approveTeamMember.isPending ||
    rejectTeamMember.isPending ||
    removeTeamMember.isPending ||
    leaveTeam.isPending ||
    submitTeam.isPending ||
    approveTeam.isPending ||
    rejectTeam.isPending;

  const handleSubmitJoinRequest = (skillLevel: SkillLevel, location: string) => {
    if (!userId || !joinRequestTeamId) return;
    requestToJoinTeam.mutate(
      { teamId: joinRequestTeamId, userId, skillLevel, location },
      {
        onSuccess: () => setJoinRequestTeamId(null),
        onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not send request."),
      }
    );
  };

  const handleLeave = (teamId: string) => {
    if (!userId) return;
    Alert.alert("Leave Team", "Are you sure you want to leave this team?", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          leaveTeam.mutate(
            { teamId, userId },
            { onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not leave.") }
          ),
      },
    ]);
  };

  const handleApproveMember = (memberId: string, name: string | null) => {
    approveTeamMember.mutate(memberId, {
      onError: (err) =>
        Alert.alert("Error", err instanceof Error ? err.message : `Could not approve ${name ?? "player"}.`),
    });
  };

  const handleRejectMember = (memberId: string, name: string | null) => {
    Alert.alert("Reject Request", `Reject ${name ?? "this player"}'s request to join your team?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () =>
          rejectTeamMember.mutate(memberId, {
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not reject request."),
          }),
      },
    ]);
  };

  const handleSubmitTeam = (teamId: string, name: string, isResubmit: boolean, isHostOwnTeam: boolean) => {
    Alert.alert(
      isHostOwnTeam ? "Add Team to Tournament" : isResubmit ? "Resubmit Team" : "Submit Team",
      isHostOwnTeam
        ? `Add "${name}" to the tournament? As the host, your team doesn't need approval.`
        : `Send "${name}" to the tournament host for approval?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isHostOwnTeam ? "Add" : isResubmit ? "Resubmit" : "Submit",
          onPress: () =>
            submitTeam.mutate(
              { teamId, isHostOwnTeam },
              {
                onError: (err) =>
                  Alert.alert("Error", err instanceof Error ? err.message : "Could not submit team."),
              }
            ),
        },
      ]
    );
  };

  const handleRemoveMember = (memberId: string, name: string | null) => {
    Alert.alert("Remove Member", `Remove ${name ?? "this member"} from your team?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeTeamMember.mutate(memberId, {
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not remove member."),
          }),
      },
    ]);
  };

  const handleApproveTeam = (teamId: string, name: string) => {
    Alert.alert("Approve Team", `Give "${name}" a slot in this tournament?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: () =>
          approveTeam.mutate(teamId, {
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not approve team."),
          }),
      },
    ]);
  };

  const handleRejectTeam = (teamId: string, name: string) => {
    Alert.alert("Reject Team", `Reject "${name}"? This frees up a slot for another team.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () =>
          rejectTeam.mutate(teamId, {
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not reject team."),
          }),
      },
    ]);
  };

  // Same underlying action as handleRejectTeam (status -> REJECTED), but for
  // a team that was already given a slot — the host is revoking it, not
  // reviewing a submission, so the confirmation wording differs.
  const handleRemoveApprovedTeam = (teamId: string, name: string) => {
    Alert.alert(
      "Remove Team",
      `Remove "${name}" from the tournament? This frees up their slot for another team.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            rejectTeam.mutate(teamId, {
              onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not remove team."),
            }),
        },
      ]
    );
  };

  return (
    <View>
      <View className="mx-4 mt-4 flex-row items-center justify-between mb-3">
        <Text className="text-ink font-semibold text-sm">
          Teams ({activeTeams.length}/{requiredTeams || "—"})
        </Text>
        {canCreateTeam && (
          <Pressable
            onPress={() => setShowCreateModal(true)}
            className="flex-row items-center bg-primary rounded-lg px-3 py-1.5"
            style={{ gap: 4 }}
          >
            <Ionicons name="add" size={14} color="white" />
            <Text className="text-white text-xs font-semibold">Create Team</Text>
          </Pressable>
        )}
      </View>

      {/* Host: teams awaiting approval */}
      {teamsAwaitingHost.length > 0 && (
        <View className="mx-4 mb-3 border border-border rounded-2xl p-4" style={cardShadow}>
          <Text className="text-ink font-semibold text-sm mb-1">
            Teams Awaiting Your Approval ({teamsAwaitingHost.length})
          </Text>
          <Text className="text-muted text-xs mb-2">
            These teams are full and ready — approve to give them a slot in the tournament.
          </Text>
          {teamsAwaitingHost.map((t) => (
            <View key={t.id} className="flex-row items-center py-2.5 border-b border-border" style={{ gap: 10 }}>
              <View className="flex-1">
                <Text className="text-ink font-medium text-sm" numberOfLines={1}>{t.name}</Text>
                <Text className="text-muted text-xs mt-0.5">
                  {t.tournament_team_members.filter((m) => m.status === "JOINED").length} players · Captain: {t.profiles?.full_name ?? "Unknown"}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRejectTeam(t.id, t.name)}
                disabled={disabled}
                className="border border-border rounded-lg px-3 py-1.5"
              >
                <Text className="text-muted text-xs font-semibold">Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => handleApproveTeam(t.id, t.name)}
                disabled={disabled}
                className="bg-primary rounded-lg px-3 py-1.5"
              >
                <Text className="text-white text-xs font-semibold">Approve</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View className="mx-4" style={{ gap: 12 }}>
        {teams.length === 0 ? (
          <View className="border border-dashed border-border rounded-2xl p-6 items-center">
            <Ionicons name="people-outline" size={32} color={colors.border} />
            <Text className="text-muted text-sm text-center mt-2">
              No teams yet. Be the first to create one!
            </Text>
          </View>
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              requiredSize={requiredSize}
              userId={userId}
              isHost={isHost}
              disabled={disabled}
              hasActiveTeamElsewhere={!!myTeam && myTeam.id !== team.id}
              onRequestJoin={() => setJoinRequestTeamId(team.id)}
              onLeave={() => handleLeave(team.id)}
              onApproveMember={handleApproveMember}
              onRejectMember={handleRejectMember}
              onRemoveMember={handleRemoveMember}
              onSubmitTeam={() =>
                handleSubmitTeam(team.id, team.name, team.status === "REJECTED", isHost && team.captain_id === userId)
              }
              onRemoveTeam={() => handleRemoveApprovedTeam(team.id, team.name)}
            />
          ))
        )}
      </View>

      <CreateTeamModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        submitting={createTeam.isPending}
        onSubmit={(name) => {
          if (!userId) return;
          createTeam.mutate(
            { captainId: userId, name },
            {
              onSuccess: () => setShowCreateModal(false),
              onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not create team."),
            }
          );
        }}
      />

      <JoinRequestModal
        visible={!!joinRequestTeamId}
        onClose={() => setJoinRequestTeamId(null)}
        submitting={requestToJoinTeam.isPending}
        title="Request to Join Team"
        subtitle="The team captain will see this and can approve or reject your request."
        onSubmit={handleSubmitJoinRequest}
      />
    </View>
  );
}
