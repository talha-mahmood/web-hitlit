import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  useTournamentTeams,
  useCreateTeam,
  useRequestToJoinTeam,
  useLeaveTeam,
} from "../../hooks/useTournamentTeams";
import {
  useSquadFillTournamentTeam,
  useSendGameSquadInvite,
  useGameSquadInvitesForGame,
} from "../../hooks/useSquadTeamFill";
import { useCreateGameInvite } from "../../hooks/useInvites";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow } from "../../constants/theme";
import CreateTeamModal from "../../components/CreateTeamModal";
import JoinRequestModal from "../../components/JoinRequestModal";
import SquadFillModal from "../../components/SquadFillModal";
import InviteSquadModal from "../../components/InviteSquadModal";
import InviteUsersModal from "../../components/InviteUsersModal";
import type { GameDetail } from "../../lib/api/games";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";

type Nav = NativeStackNavigationProp<GamesStackParamList>;

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

const TEAM_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  FORMING: { bg: "bg-blue-50", text: "text-blue-700", label: "Recruiting" },
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
  disabled,
  hasActiveTeamElsewhere,
  onRequestJoin,
  onLeave,
  onFillWithSquad,
  noun,
}: {
  team: TournamentTeam;
  requiredSize: number;
  userId?: string;
  disabled: boolean;
  // True when the user already has a JOINED spot on a *different*
  // (non-rejected) team in this same tournament — until they leave it,
  // they can't join this team too.
  hasActiveTeamElsewhere: boolean;
  onRequestJoin: () => void;
  onLeave: () => void;
  onFillWithSquad?: () => void;
  // This section is also reused for regular (non-tournament) games that
  // default to 2 teams — copy that mentions "the tournament" needs to say
  // "the game" there instead.
  noun: "tournament" | "game";
}) {
  const joinedMembers = team.tournament_team_members.filter((m) => m.status === "JOINED");
  const myMembership = userId
    ? team.tournament_team_members.find((m) => m.user_id === userId)
    : undefined;
  const isTeamFull = requiredSize > 0 && joinedMembers.length >= requiredSize;
  // A team auto-joins the tournament the instant its roster fills up (see
  // the auto_approve_full_team DB trigger) — the only status that still
  // means "still recruiting, roster editable" is FORMING. REJECTED (the
  // host pulled it back out) is terminal — there's no resubmit path.
  const isRosterEditable = team.status === "FORMING";
  const playersNeeded = Math.max(requiredSize - joinedMembers.length, 0);
  const badge = TEAM_STATUS_BADGE[team.status];
  // "Fill With My Squad" registers a whole squad into a team in one go — the
  // server only allows this on a genuinely empty team, so that's the same
  // gate used here rather than duplicating the check loosely.
  const isEmpty = joinedMembers.length === 0;

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

      {/* This team's own CTA. Joining always inserts the player straight in —
          there's no approval step to wait on — so a JOINED member just gets
          a progress readout alongside their Leave option, and anyone else
          gets an instant Join button. A team joins the tournament
          automatically the instant it's full (see the auto_approve_full_team
          DB trigger). */}
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
          ) : team.status === "FORMING" && !isTeamFull ? (
            <Pressable
              onPress={onRequestJoin}
              disabled={disabled}
              className="bg-primary rounded-lg py-2 items-center"
            >
              <Text className="text-white text-xs font-semibold">Join Team</Text>
            </Pressable>
          ) : null}
          {/* A squad owner can register their whole squad for this slot in
              one go — independent of the individual-join flow above, and
              not gated on hasActiveTeamElsewhere since the squad owner
              themselves need not be one of the registered players. */}
          {isEmpty && onFillWithSquad && (
            <Pressable
              onPress={onFillWithSquad}
              disabled={disabled}
              className="border border-primary rounded-lg py-2 items-center mt-2"
            >
              <Text className="text-primary text-xs font-semibold">Fill With My Squad</Text>
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
  const [joinRequestTeamId, setJoinRequestTeamId] = useState<string | null>(null);
  const [fillTeamId, setFillTeamId] = useState<string | null>(null);
  const [showInviteSquadModal, setShowInviteSquadModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data: teamsData, isLoading } = useTournamentTeams(game.id);
  const createTeam = useCreateTeam(game.id);
  const requestToJoinTeam = useRequestToJoinTeam(game.id);
  const leaveTeam = useLeaveTeam(game.id);
  const squadFillTeam = useSquadFillTournamentTeam(game.id);
  const sendSquadInvite = useSendGameSquadInvite(game.id);
  const createInvite = useCreateGameInvite(game.id);
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

  const disabled = createTeam.isPending || requestToJoinTeam.isPending || leaveTeam.isPending;

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
              onPress={() => setShowInviteModal(true)}
              className="flex-row items-center border border-primary rounded-lg px-3 py-1.5"
              style={{ gap: 4 }}
            >
              <Ionicons name="person-add-outline" size={14} color={colors.primary} />
              <Text className="text-primary text-xs font-semibold">Invite Players</Text>
            </Pressable>
          )}
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
              disabled={disabled}
              hasActiveTeamElsewhere={!!myTeam && myTeam.id !== team.id}
              onRequestJoin={() => setJoinRequestTeamId(team.id)}
              onLeave={() => handleLeave(team.id)}
              onFillWithSquad={userId ? () => setFillTeamId(team.id) : undefined}
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

      <JoinRequestModal
        visible={!!joinRequestTeamId}
        onClose={() => setJoinRequestTeamId(null)}
        submitting={requestToJoinTeam.isPending}
        title="Join Team"
        subtitle="You'll join this team instantly — no approval needed."
        onSubmit={handleSubmitJoinRequest}
      />

      <SquadFillModal
        visible={!!fillTeamId}
        onClose={() => setFillTeamId(null)}
        userId={userId}
        requiredCount={requiredSize}
        submitting={squadFillTeam.isPending}
        title="Fill Team With Your Squad"
        onSubmit={(squadId, memberUserIds) => {
          if (!fillTeamId) return;
          squadFillTeam.mutate(
            { teamId: fillTeamId, squadId, memberUserIds },
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

      {isHost && (
        <InviteUsersModal
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title={`Invite Players · ${game.title}`}
          excludeIds={[
            game.creator_id,
            ...teams.flatMap((t) =>
              t.tournament_team_members.filter((m) => m.status === "JOINED").map((m) => m.user_id)
            ),
          ]}
          onInvite={async (user) => {
            if (!userId) return;
            await createInvite.mutateAsync({ invitedUserId: user.id, invitedBy: userId });
          }}
        />
      )}
    </View>
  );
}
