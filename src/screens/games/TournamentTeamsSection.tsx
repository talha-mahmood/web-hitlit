import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
import { useTeamChatUnreadCount } from "../../hooks/useTeamMessages";
import { manualSportForName } from "../../lib/manualScore";
import { getSportIcon } from "../../lib/sportIcons";
import { LinkedMatchScoreDetails } from "../../components/MatchScoreDetails";
import { useTournamentMatches } from "../../hooks/useTournamentMatches";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, cardShadow } from "../../constants/theme";
import CreateTeamModal from "../../components/CreateTeamModal";
import SelectTeamModal from "../../components/SelectTeamModal";
import InviteSquadModal from "../../components/InviteSquadModal";
import ChatIcon from "../../components/ChatIcon";
import type { GameDetail } from "../../lib/api/games";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";
import { soloAwareTeamName, type ScorecardPrefill } from "../../lib/api/tournamentMatches";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<GamesStackParamList>;

const TEAM_STATUS_META: Record<
  string,
  { bg: string; text: string; label: string; iconBg: string; iconColor: string }
> = {
  FORMING: { bg: "bg-blue-50", text: "text-blue-700", label: "Recruiting", iconBg: "#DBEAFE", iconColor: "#2563EB" },
  PENDING_HOST_APPROVAL: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Awaiting Approval",
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
  },
  APPROVED: { bg: "bg-green-50", text: "text-green-700", label: "Full", iconBg: colors.primaryLight, iconColor: colors.primaryDark },
  REJECTED: { bg: "bg-red-50", text: "text-red-600", label: "Removed", iconBg: "#FEE2E2", iconColor: colors.danger },
};

// A rotating palette so a team's member circles aren't all the same flat
// green — purely cosmetic (index-based, not tied to any real per-user color).
const MEMBER_COLORS = ["#7C3AED", "#16A34A", "#D97706", "#DB2777", "#0891B2", "#4F46E5", "#65A30D", "#DC2626"];

function MemberAvatar({
  name,
  avatar,
  colorIndex,
}: {
  name: string | null;
  avatar: string | null;
  colorIndex: number;
}) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length];
  return (
    <View className="items-center" style={{ width: 56 }}>
      <View style={{ position: "relative" }}>
        {avatar ? (
          <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
        ) : (
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: color }}
          >
            <Text className="text-white font-bold text-sm">{initials}</Text>
          </View>
        )}
        <View
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: "#22C55E",
            borderWidth: 2,
            borderColor: "white",
          }}
        />
      </View>
      <Text className="text-muted text-xs mt-1 text-center" numberOfLines={1}>
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
  onOpenChat,
  genderMismatch,
  gameGenderLabel,
  noun,
  sportName,
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
  onOpenChat: () => void;
  // True when this game/tournament is restricted to one gender and the
  // current user (or, more precisely, any squad they could use) doesn't
  // match it — hides "Create Team" in favor of an explanation.
  genderMismatch: boolean;
  gameGenderLabel: string;
  // This section is also reused for regular (non-tournament) games that
  // default to 2 teams — copy that mentions "the tournament" needs to say
  // "the game" there instead.
  noun: "tournament" | "game";
  // Decorative watermark icon only — the sport this game/tournament is for.
  sportName: string | null | undefined;
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
  const badge = TEAM_STATUS_META[team.status];
  const statusIcon: keyof typeof Ionicons.glyphMap =
    team.status === "APPROVED"
      ? "trophy"
      : team.status === "PENDING_HOST_APPROVAL"
        ? "hourglass"
        : team.status === "REJECTED"
          ? "close-circle"
          : "person";
  const watermarkIcon = sportName ? getSportIcon(sportName).icon : "trophy-outline";
  // The "Create Team" squad-registration CTA only makes sense on a genuinely
  // empty team — the server only allows it there too.
  const isEmpty = joinedMembers.length === 0;
  // A team only has a real captain/code once someone has actually claimed
  // it (created it, or registered a squad into it) — visible to that team's
  // own people and the host only, same rule as the game/tournament ID.
  const isClaimed = !!team.captain_id;
  const canSeeTeamCode = isClaimed && (isHost || !!myMembership);
  const isJoinedMember = myMembership?.status === "JOINED";
  const { data: teamChatUnread } = useTeamChatUnreadCount(isJoinedMember ? team.id : undefined, userId);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(team.team_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  return (
    <View
      className="border border-border rounded-2xl bg-white p-4"
      style={{ ...cardShadow, overflow: "hidden", position: "relative" }}
    >
      {/* Decorative watermark — purely visual, same language as the
          sport-icon backdrops used elsewhere on this screen. */}
      <MaterialCommunityIcons
        name={watermarkIcon}
        size={110}
        color={colors.primary}
        style={{ position: "absolute", right: -20, bottom: -20, opacity: 0.06 }}
      />

      <View className="flex-row items-center mb-1" style={{ gap: 10 }}>
        <View
          className="items-center justify-center rounded-xl"
          style={{ width: 40, height: 40, backgroundColor: badge?.iconBg ?? colors.primaryLight }}
        >
          <Ionicons name={statusIcon} size={19} color={badge?.iconColor ?? colors.primaryDark} />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-bold text-base" numberOfLines={1}>{team.name}</Text>
          <Text className="text-muted text-xs mt-0.5">
            {joinedMembers.length}/{requiredSize || "—"} players
          </Text>
        </View>
        {badge && (
          <View className={`px-3 py-1 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-bold ${badge.text}`}>{badge.label}</Text>
          </View>
        )}
        {/* Purely visual for now — no per-team menu (rename/remove) exists
            yet, so this doesn't open anything. */}
        <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} style={{ marginLeft: 4 }} />
      </View>

      {canSeeTeamCode && (
        <Pressable
          onPress={handleCopyCode}
          hitSlop={8}
          className="flex-row items-center self-start px-3 py-1.5 rounded-lg bg-gray-100 mt-2 mb-3"
          style={{ gap: 6 }}
        >
          <Text className="text-muted text-xs font-medium">Team ID: {team.team_code}</Text>
          <Ionicons name={codeCopied ? "checkmark" : "copy-outline"} size={13} color={codeCopied ? colors.primary : colors.muted} />
        </Pressable>
      )}

      {joinedMembers.length > 0 && (
        <View className="flex-row flex-wrap mt-1" style={{ gap: 10 }}>
          {joinedMembers.map((m, i) => (
            <MemberAvatar
              key={m.id}
              name={m.profiles?.full_name ?? null}
              avatar={m.profiles?.avatar ?? null}
              colorIndex={i}
            />
          ))}
        </View>
      )}

      {/* Only this specific team's own joined members can see or open its
          chat — not the whole tournament, and not anyone who hasn't joined
          this team. */}
      {isJoinedMember && (
        <Pressable
          onPress={onOpenChat}
          className="flex-row items-center justify-center rounded-full border border-primary py-3 mt-4"
          style={{ gap: 8 }}
        >
          <ChatIcon size={17} unreadCount={teamChatUnread} />
          <Text className="text-primary font-bold text-sm">Team Chat</Text>
        </Pressable>
      )}

      {team.status === "REJECTED" && (
        <Text className="text-danger text-xs mt-2">Removed from the {noun} by the host.</Text>
      )}

      {/* Roster filled up but this team wasn't put together by the host —
          it needs the host's sign-off before it actually joins the
          tournament. The host sees Approve/Reject right here; everyone
          else just sees where things stand. */}
      {isPendingApproval && (
        <View className="mt-4">
          {isHost ? (
            <>
              <View
                className="flex-row items-center rounded-xl px-3 py-2.5"
                style={{ backgroundColor: "#FEF3C7", gap: 8 }}
              >
                <Ionicons name="information-circle" size={16} color="#D97706" />
                <Text className="text-xs font-semibold flex-1" style={{ color: "#92400E" }}>
                  Waiting for your approval to join this team.
                </Text>
              </View>
              <View className="flex-row mt-3" style={{ gap: 10 }}>
                <Pressable
                  onPress={onReject}
                  disabled={disabled}
                  className="flex-1 flex-row items-center justify-center rounded-full border border-danger py-3"
                  style={{ gap: 6 }}
                >
                  <Ionicons name="close" size={16} color={colors.danger} />
                  <Text className="text-danger font-bold text-sm">Reject</Text>
                </Pressable>
                <Pressable
                  onPress={onApprove}
                  disabled={disabled}
                  className="flex-1 flex-row items-center justify-center rounded-full bg-primary py-3"
                  style={{ gap: 6 }}
                >
                  <Ionicons name="checkmark" size={16} color="white" />
                  <Text className="text-white font-bold text-sm">Approve</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View className="rounded-xl py-2.5 items-center bg-amber-50">
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
        <View className="mt-4">
          {isJoinedMember ? (
            <>
              <View className={`rounded-xl py-2.5 items-center ${isTeamFull ? "bg-green-50" : "bg-gray-100"}`}>
                <Text className={`text-xs font-semibold ${isTeamFull ? "text-green-700" : "text-muted"}`}>
                  {isTeamFull
                    ? `Team full — joining ${noun}…`
                    : `${joinedMembers.length}/${requiredSize || "—"} Players — Need ${playersNeeded} More`}
                </Text>
              </View>
              <Pressable
                onPress={onLeave}
                disabled={disabled}
                className="rounded-full border border-danger py-3 items-center mt-2"
              >
                <Text className="text-danger font-bold text-sm">Leave Team</Text>
              </Pressable>
            </>
          ) : null}
          {/* Registers a whole squad into this slot in one go — independent
              of the individual-join flow above, and not gated on
              hasActiveTeamElsewhere since the squad owner themselves need
              not be one of the registered players. */}
          {isEmpty && onFillWithSquad && !genderMismatch && (
            <Pressable
              onPress={onFillWithSquad}
              disabled={disabled}
              className="flex-row items-center justify-center rounded-full bg-primary py-3.5 mt-3"
              style={{ gap: 8 }}
            >
              <View
                className="items-center justify-center rounded-full bg-white"
                style={{ width: 22, height: 22 }}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </View>
              <Text className="text-white font-bold text-sm">Create Team</Text>
            </Pressable>
          )}
          {isEmpty && genderMismatch && (
            <Text className="text-muted text-xs text-center mt-2">
              This {noun} is open to {gameGenderLabel} players only, so you can't create a team here.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// A regular (non-tournament) team-based game always starts with exactly two
// team slots — placeholders named "Team A"/"Team B" created the moment the
// game is created (see createTournamentTeamPlaceholders in
// CreateGameScreen) — so this card can show right away and just update live
// as each slot gets filled/renamed, well before there's a real match row to
// point "Go To Scorecard" at. That match row itself is created server-side
// (a trigger on tournament_teams) the moment both teams are approved,
// mirroring the tournament flow's "Generate Matches" step without needing
// the host to press anything.
function HeadToHeadMatchCard({
  game,
  isHost,
  teams,
}: {
  game: GameDetail;
  isHost: boolean;
  teams: TournamentTeam[];
}) {
  const navigation = useNavigation<Nav>();
  const { data: matches } = useTournamentMatches(game.id);

  const match = (matches ?? [])[0] ?? null;
  // A team with just one joined player is shown by that player's name.
  const displayName = (t: TournamentTeam | undefined, fallback: string) =>
    t
      ? soloAwareTeamName(
          t.name,
          t.tournament_team_members.map((m) => ({ status: m.status, full_name: m.profiles?.full_name }))
        )
      : fallback;
  const teamAName = displayName(teams[0], "Team A");
  const teamBName = displayName(teams[1], "Team B");

  // Same rule as the tournament's "Book Venue"/"Go To Scorecard": a real
  // (dropdown-picked) venue needs an actual booking, a manually typed one
  // is treated as already settled. The button itself only ever appears once
  // the match row exists (both teams approved).
  const isVenueBooked = game.venue_id ? !!game.booking_id : !!game.custom_venue_name;
  const sportName = (game.sports?.name ?? "").trim().toLowerCase();
  const isCricketSport = sportName.includes("cricket");
  // Once the match has a result (scored live or entered by hand) there's
  // nothing left to score, so neither scoring button is offered.
  const canGoToScorecard = isHost && isVenueBooked && !!match?.team_a && !!match?.team_b && match.status !== "COMPLETED";

  const rosterByTeamId = new Map<string, string[]>();
  for (const t of teams) {
    rosterByTeamId.set(
      t.id,
      t.tournament_team_members.filter((m) => m.status === "JOINED").map((m) => m.profiles?.full_name ?? "Player")
    );
  }

  const handleEnterScoreManually = () => {
    const manualSport = manualSportForName(sportName);
    if (!match?.team_a || !match?.team_b || !manualSport) return;
    navigation.navigate("ManualScore", {
      sport: manualSport,
      allowDraw: true,
      prefill: {
        tournamentMatchId: match.id,
        gameId: game.id,
        teamAName: match.team_a.name,
        teamBName: match.team_b.name,
        teamAPlayers: rosterByTeamId.get(match.team_a.id) ?? [],
        teamBPlayers: rosterByTeamId.get(match.team_b.id) ?? [],
        venue: game.venues?.name ?? game.custom_venue_name ?? undefined,
      },
    });
  };

  // Opens that sport's own New Match screen with names/roster/venue
  // pre-filled and locked (or reopens Live Scoring if already started).
  const handleGoToScorecard = () => {
    if (!match?.team_a || !match?.team_b) return;
    const prefill: ScorecardPrefill = {
      tournamentMatchId: match.id,
      gameId: game.id,
      teamAName: match.team_a.name,
      teamBName: match.team_b.name,
      teamAPlayers: rosterByTeamId.get(match.team_a.id) ?? [],
      teamBPlayers: rosterByTeamId.get(match.team_b.id) ?? [],
      venue: game.venues?.name ?? game.custom_venue_name ?? undefined,
    };

    if (isCricketSport) {
      if (match.cricket_match_id) navigation.navigate("LiveScoring", { matchId: match.cricket_match_id });
      else navigation.navigate("NewMatch", { prefill });
      return;
    }

    switch (sportName) {
      case "padel":
        if (match.padel_match_id) navigation.navigate("PadelLiveScoring", { matchId: match.padel_match_id });
        else navigation.navigate("PadelNewMatch", { prefill });
        return;
      case "tennis":
        if (match.tennis_match_id) navigation.navigate("TennisLiveScoring", { matchId: match.tennis_match_id });
        else navigation.navigate("TennisNewMatch", { prefill });
        return;
      case "badminton":
        if (match.badminton_match_id) navigation.navigate("BadmintonLiveScoring", { matchId: match.badminton_match_id });
        else navigation.navigate("BadmintonNewMatch", { prefill });
        return;
      case "pickleball":
        if (match.pickleball_match_id) navigation.navigate("PickleballLiveScoring", { matchId: match.pickleball_match_id });
        else navigation.navigate("PickleballNewMatch", { prefill });
        return;
      case "table tennis":
        if (match.table_tennis_match_id) navigation.navigate("TableTennisLiveScoring", { matchId: match.table_tennis_match_id });
        else navigation.navigate("TableTennisNewMatch", { prefill });
        return;
      case "football":
        if (match.football_match_id) navigation.navigate("FootballLiveScoring", { matchId: match.football_match_id });
        else navigation.navigate("FootballNewMatch", { prefill });
        return;
    }
  };

  return (
    <View className="mx-4 mt-4 border border-border rounded-2xl bg-white p-4" style={cardShadow}>
      <Text className="text-ink font-semibold text-sm mb-2">Match</Text>
      <View className="bg-gray-50 rounded-xl px-3 py-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>{teamAName}</Text>
          <Text className="text-muted text-xs mx-2">vs</Text>
          <Text className="text-ink text-sm font-medium flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
        </View>
        {match?.status === "COMPLETED" && (match.is_draw || match.winner_team) ? (
          <Text className="text-primary text-xs font-semibold mt-1.5">
            {match.is_draw ? "Draw" : `${match.winner_team?.name} won`}
          </Text>
        ) : null}
        {match ? <LinkedMatchScoreDetails match={match} /> : null}
        {canGoToScorecard && (
          <Pressable onPress={handleGoToScorecard} className="bg-primary rounded-lg py-2 items-center mt-2">
            <Text className="text-white text-xs font-semibold">Go To Scorecard</Text>
          </Pressable>
        )}
        {canGoToScorecard && (
          <Pressable onPress={handleEnterScoreManually} className="border border-primary rounded-lg py-2 items-center mt-2">
            <Text className="text-primary text-xs font-semibold">Enter Score Manually</Text>
          </Pressable>
        )}
      </View>

    </View>
  );
}

export default function TournamentTeamsSection({ game }: { game: GameDetail }) {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const isHost = game.creator_id === userId;
  // A Male/Female Only game or tournament can only have its teams created by
  // a matching user (enforced server-side too — see tournament_teams and
  // squad_fill_tournament_team) — the squad used to fill a team has to match
  // as well, since a Mixed squad's own members aren't guaranteed to.
  const genderMismatch = game.gender !== "mixed" && (!myGender || myGender !== game.gender);
  const gameGenderLabel = game.gender === "male" ? "male" : "female";
  // This section is shared with regular (non-tournament) games that default
  // to 2 teams — everything below works the same either way, only the
  // player-facing copy needs to say "game" instead of "tournament" there.
  const isTournament = game.game_type === "TOURNAMENT";
  const noun: "tournament" | "game" = isTournament ? "tournament" : "game";
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
  const canCreateTeam = !myTeam && requiredTeams > 0 && activeTeams.length < requiredTeams && !genderMismatch;
  // Only reason the top "Create Team" button would otherwise be showing —
  // used to surface an explanation instead of just silently hiding it.
  const hiddenByGenderOnly = !myTeam && requiredTeams > 0 && activeTeams.length < requiredTeams && genderMismatch;
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
            { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not leave.")) }
          ),
      },
    ]);
  };

  const handleApprove = (teamId: string) => {
    approveTeam.mutate(teamId, {
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not approve this team.")),
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
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not reject this team.")),
          }),
      },
    ]);
  };

  return (
    <View>
      {isTournament ? (
        // Groups/Fixtures/Matches/Standings all live on their own screen —
        // a real tournament can have multiple rounds/pools, so this just
        // links out to it rather than trying to fit all of that here.
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
      ) : (
        // A regular game only ever has the one Team A vs Team B match, so
        // it's shown inline here instead of linking out to the tournament's
        // multi-round Matches screen.
        <HeadToHeadMatchCard game={game} isHost={isHost} teams={activeTeams} />
      )}

      <View className="mx-4 mt-4 flex-row items-center justify-between mb-3">
        <Text className="text-ink font-semibold text-sm">
          Teams ({activeTeams.length}/{requiredTeams || "—"})
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          {isHost && (
            <Pressable
              onPress={() => setShowInviteSquadModal(true)}
              className="flex-row items-center rounded-full border border-primary px-3 py-1.5"
              style={{ gap: 4 }}
            >
              <Ionicons name="person-add-outline" size={14} color={colors.primary} />
              <Text className="text-primary text-xs font-semibold">Invite a Squad</Text>
            </Pressable>
          )}
          {canCreateTeam && (
            <Pressable
              onPress={() => setShowCreateModal(true)}
              className="flex-row items-center rounded-full bg-primary px-3 py-1.5"
              style={{ gap: 4 }}
            >
              <Ionicons name="add" size={14} color="white" />
              <Text className="text-white text-xs font-semibold">Create Team</Text>
            </Pressable>
          )}
        </View>
      </View>

      {hiddenByGenderOnly && (
        <Text className="mx-4 -mt-2 mb-3 text-muted text-xs">
          This {noun} is open to {gameGenderLabel} players only, so you can't create a team here.
        </Text>
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
              onLeave={() => handleLeave(team.id)}
              onFillWithSquad={userId ? () => setFillTeamId(team.id) : undefined}
              onApprove={() => handleApprove(team.id)}
              onReject={() => handleReject(team.id)}
              onOpenChat={() => navigation.navigate("TeamChat", { teamId: team.id, teamName: team.name })}
              genderMismatch={genderMismatch}
              gameGenderLabel={gameGenderLabel}
              noun={noun}
              sportName={game.sports?.name}
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
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not create team.")),
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
        gameGender={game.gender}
        onSubmit={(squadId, memberUserIds, teamName) => {
          if (!fillTeamId) return;
          squadFillTeam.mutate(
            { teamId: fillTeamId, squadId, memberUserIds, teamName },
            {
              onSuccess: () => setFillTeamId(null),
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not register team.")),
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
                onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send invite.")),
              }
            );
          }}
        />
      )}
    </View>
  );
}
