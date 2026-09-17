import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import {
  useTournamentTeams,
  useCreateTeam,
  useLeaveTeam,
  useApproveTeam,
  useRejectPendingTeam,
} from "../../hooks/useTournamentTeams";
import {
  useSquadFillTournamentTeam,
  useSendGameSquadInvite,
  useGameSquadInvitesForGame,
} from "../../hooks/useSquadTeamFill";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow } from "../../constants/theme";
import CreateTeamModal from "../../components/CreateTeamModal";
import SelectTeamModal from "../../components/SelectTeamModal";
import InviteSquadModal from "../../components/InviteSquadModal";
import type { GameDetail } from "../../lib/api/games";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";

type Nav = NativeStackNavigationProp<GamesStackParamList>;

const TEAM_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  FORMING: { bg: "bg-blue-50", text: "text-blue-700", label: "Recruiting" },
  PENDING_HOST_APPROVAL: { bg: "bg-amber-50", text: "text-amber-700", label: "Awaiting Approval" },
  APPROVED: { bg: "bg-green-50", text: "text-green-700", label: "Full" },
  REJECTED: { bg: "bg-red-50", text: "text-red-600", label: "Removed" },
};

function MemberAvatar({
  name,
  avatar,
}: {
  name: string | null;
  avatar: string | null;
}) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  return (
    <View className="items-center" style={{ width: 56 }}>
      {avatar ? (
        <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
      ) : (
        <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
          <Text className="text-primary font-bold text-sm">{initials}</Text>
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
  onLeave,
  onFillWithSquad,
  onApprove,
  onReject,
  noun,
}: {
  team: TournamentTeam;
  requiredSize: number;
  userId?: string;
  isHost: boolean;
  disabled: boolean;
  // True when the user already has a JOINED spot on a *different*
  // (non-rejected) team in this same tournament — until they leave it,
  // they can't join this team too.
  hasActiveTeamElsewhere: boolean;
  onLeave: () => void;
  onFillWithSquad?: () => void;
  onApprove: () => void;
  onReject: () => void;
  // This section is also reused for regular (non-tournament) games that
  // default to 2 teams — copy that mentions "the tournament" needs to say
  // "the game" there instead.
  noun: "tournament" | "game";
}) {
  const [codeCopied, setCodeCopied] = useState(false);
  const joinedMembers = team.tournament_team_members.filter((m) => m.status === "JOINED");
  const myMembership = userId
    ? team.tournament_team_members.find((m) => m.user_id === userId)
    : undefined;
  const isTeamFull = requiredSize > 0 && joinedMembers.length >= requiredSize;
  // A team's roster fills up (see auto_approve_full_team) and moves to
  // either APPROVED (host filled it) or PENDING_HOST_APPROVAL (anyone else
  // did) — either way, FORMING is the only status where the roster is still
  // editable. REJECTED (the host pulled it back out from Approved) is
  // terminal — there's no resubmit path.
  const isRosterEditable = team.status === "FORMING";
  const isPendingApproval = team.status === "PENDING_HOST_APPROVAL";
  const playersNeeded = Math.max(requiredSize - joinedMembers.length, 0);
  const badge = TEAM_STATUS_BADGE[team.status];
  // The "Create Team" squad-registration CTA only makes sense on a genuinely
  // empty team — the server only allows it there too.
  const isEmpty = joinedMembers.length === 0;
  // A team only has a real captain/code once someone has actually claimed
  // it (created it, or registered a squad into it) — visible to that team's
  // own people and the host only, same rule as the game/tournament ID.
  const isClaimed = !!team.captain_id;
  const canSeeTeamCode = isClaimed && (isHost || !!myMembership);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(team.team_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  return (
    <View className="border border-border rounded-2xl bg-white p-4" style={cardShadow}>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-ink font-bold text-sm flex-1" numberOfLines={1}>{team.name}</Text>
        {badge && (
          <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
          </View>
        )}
      </View>
      <Text className="text-muted text-xs mb-3">
        {joinedMembers.length}/{requiredSize || "—"} players
      </Text>

      {canSeeTeamCode && (
        <Pressable
          onPress={handleCopyCode}
          hitSlop={8}
          className="flex-row items-center self-start px-2 py-1 rounded-lg bg-gray-50 mb-3"
          style={{ gap: 4 }}
        >
          <Text className="text-muted text-xs font-medium">Team ID: {team.team_code}</Text>
          <Ionicons name={codeCopied ? "checkmark" : "copy-outline"} size={12} color={codeCopied ? colors.primary : colors.muted} />
        </Pressable>
      )}

      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {joinedMembers.map((m) => (
          <MemberAvatar
            key={m.id}
            name={m.profiles?.full_name ?? null}
            avatar={m.profiles?.avatar ?? null}
          />
        ))}
      </View>

      {team.status === "REJECTED" && (
        <Text className="text-danger text-xs mt-2">Removed from the {noun} by the host.</Text>
      )}

      {/* Roster filled up but this team wasn't put together by the host —
          it needs the host's sign-off before it actually joins the
          tournament. The host sees Approve/Reject right here; everyone
          else just sees where things stand. */}
      {isPendingApproval && (
        <View className="mt-3">
          {isHost ? (
            <>
              <View className="rounded-lg py-2.5 items-center bg-amber-50">
                <Text className="text-amber-700 text-xs font-semibold">Awaiting your approval</Text>
              </View>
              <View className="flex-row mt-2" style={{ gap: 8 }}>
                <Pressable
                  onPress={onReject}
                  disabled={disabled}
                  className="flex-1 border border-danger rounded-lg py-2 items-center"
                >
                  <Text className="text-danger text-xs font-semibold">Reject</Text>
                </Pressable>
                <Pressable
                  onPress={onApprove}
                  disabled={disabled}
                  className="flex-1 bg-primary rounded-lg py-2 items-center"
                >
                  <Text className="text-white text-xs font-semibold">Approve</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View className="rounded-lg py-2.5 items-center bg-amber-50">
              <Text className="text-amber-700 text-xs font-semibold text-center">
                Sent to the host for approval
              </Text>
            </View>
          )}
        </View>
      )}

      {/* This team's own CTA. Individually joining always inserts the player
          straight in — there's no approval step for that — so a JOINED
          member just gets a progress readout alongside their Leave option,
          and anyone else can register a whole squad via Create Team. A team
          moves on automatically the instant it's full (see
          auto_approve_full_team). */}
      {isRosterEditable && (
        <View className="mt-3">
          {myMembership?.status === "JOINED" ? (
            <>
              <View className={`rounded-lg py-2.5 items-center ${isTeamFull ? "bg-green-50" : "bg-gray-100"}`}>
                <Text className={`text-xs font-semibold ${isTeamFull ? "text-green-700" : "text-muted"}`}>
                  {isTeamFull
                    ? `Team full — joining ${noun}…`
                    : `${joinedMembers.length}/${requiredSize || "—"} Players — Need ${playersNeeded} More`}
                </Text>
              </View>
              <Pressable
                onPress={onLeave}
                disabled={disabled}
                className="border border-danger rounded-lg py-2 items-center mt-2"
              >
                <Text className="text-danger text-xs font-semibold">Leave Team</Text>
              </Pressable>
            </>
          ) : hasActiveTeamElsewhere ? (
            <Text className="text-muted text-xs text-center">
              You already have a spot on another team in this {noun}.
            </Text>
          ) : null}
          {/* Registers a whole squad into this slot in one go — independent
              of the individual-join flow above, and not gated on
              hasActiveTeamElsewhere since the squad owner themselves need
              not be one of the registered players. */}
          {isEmpty && onFillWithSquad && (
            <Pressable
              onPress={onFillWithSquad}
              disabled={disabled}
              className="bg-primary rounded-lg py-2 items-center mt-2"
            >
              <Text className="text-white text-xs font-semibold">Create Team</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default function TournamentTeamsSection({ game }: { game: GameDetail }) {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.session?.user.id);
  const isHost = game.creator_id === userId;
  // This section is shared with regular (non-tournament) games that default
  // to 2 teams — everything below works the same either way, only the
  // player-facing copy needs to say "game" instead of "tournament" there.
  const noun: "tournament" | "game" = game.game_type === "TOURNAMENT" ? "tournament" : "game";
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fillTeamId, setFillTeamId] = useState<string | null>(null);
  const [showInviteSquadModal, setShowInviteSquadModal] = useState(false);

  const { data: teamsData, isLoading } = useTournamentTeams(game.id);
  const createTeam = useCreateTeam(game.id);
  const leaveTeam = useLeaveTeam(game.id);
  const squadFillTeam = useSquadFillTournamentTeam(game.id);
  const approveTeam = useApproveTeam(game.id);
  const rejectPendingTeam = useRejectPendingTeam(game.id);
  const sendSquadInvite = useSendGameSquadInvite(game.id);
  const { data: squadInvites } = useGameSquadInvitesForGame(game.id);

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} className="mt-4" />;
  }

  const teams = teamsData ?? [];
  const requiredSize = game.players_per_team ?? 0;
  const requiredTeams = game.number_of_teams ?? 0;

  // A rejected (host-removed) team doesn't count against the tournament's
  // team slots, and its members are free to form/join a different team —
  // there's no way back in for a removed team once it's gone.
  const activeTeams = teams.filter((t) => t.status !== "REJECTED");
  const myTeam = userId
    ? teams.find(
        (t) =>
          t.status !== "REJECTED" &&
          t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED")
      )
    : undefined;
  const canCreateTeam = !myTeam && requiredTeams > 0 && activeTeams.length < requiredTeams;
  const isPoolFormat = game.tournament_format === "POOL";

  const disabled =
    createTeam.isPending || leaveTeam.isPending || approveTeam.isPending || rejectPendingTeam.isPending;

  const fillTeam = fillTeamId ? teams.find((t) => t.id === fillTeamId) : undefined;
  // A squad can fill more than one team here (its owner just repeats
  // "Create Team" on another card with a different subset of members), but
  // never with the same player on two teams — this is every player already
  // JOINED anywhere else, so SelectTeamModal can hide them from the picker.
  const joinedElsewhereUserIds = activeTeams.flatMap((t) =>
    t.tournament_team_members.filter((m) => m.status === "JOINED").map((m) => m.user_id)
  );

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

  const handleApprove = (teamId: string) => {
    approveTeam.mutate(teamId, {
      onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not approve this team."),
    });
  };

  const handleReject = (teamId: string) => {
    Alert.alert("Reject Team", "This will clear the pending roster and reopen this slot. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () =>
          rejectPendingTeam.mutate(teamId, {
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not reject this team."),
          }),
      },
    ]);
  };

  return (
    <View>
      {/* Groups/Fixtures/Matches/Standings all live on their own screen now
          instead of stacking inline here — this just links to it. */}
      <Pressable
        onPress={() => navigation.navigate("TournamentMatches", { gameId: game.id })}
        className="mx-4 mt-4 flex-row items-center justify-between border border-border rounded-2xl bg-white p-4"
        style={cardShadow}
      >
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="list-outline" size={18} color={colors.primaryDark} />
          </View>
          <Text className="text-ink font-semibold text-sm">
            {isPoolFormat ? "Groups & Matches List" : "Matches List"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <View className="mx-4 mt-4 flex-row items-center justify-between mb-3">
        <Text className="text-ink font-semibold text-sm">
          Teams ({activeTeams.length}/{requiredTeams || "—"})
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          {isHost && (
            <Pressable
              onPress={() => setShowInviteSquadModal(true)}
              className="flex-row items-center border border-primary rounded-lg px-3 py-1.5"
              style={{ gap: 4 }}
            >
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              <Text className="text-primary text-xs font-semibold">Invite a Squad</Text>
            </Pressable>
          )}
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
      </View>

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
              onLeave={() => handleLeave(team.id)}
              onFillWithSquad={userId ? () => setFillTeamId(team.id) : undefined}
              onApprove={() => handleApprove(team.id)}
              onReject={() => handleReject(team.id)}
              noun={noun}
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
            { creatorId: userId, name },
            {
              onSuccess: () => setShowCreateModal(false),
              onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not create team."),
            }
          );
        }}
      />

      <SelectTeamModal
        visible={!!fillTeamId}
        onClose={() => setFillTeamId(null)}
        userId={userId}
        requiredCount={requiredSize}
        defaultTeamName={fillTeam?.name ?? ""}
        submitting={squadFillTeam.isPending}
        isHost={isHost}
        excludeUserIds={joinedElsewhereUserIds}
        onSubmit={(squadId, memberUserIds, teamName) => {
          if (!fillTeamId) return;
          squadFillTeam.mutate(
            { teamId: fillTeamId, squadId, memberUserIds, teamName },
            {
              onSuccess: () => setFillTeamId(null),
              onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not register team."),
            }
          );
        }}
      />

      {isHost && (
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
                onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not send invite."),
              }
            );
          }}
        />
      )}
    </View>
  );
}
