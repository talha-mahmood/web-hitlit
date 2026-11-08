import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import Image from "../../components/images/OptimizedImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import WaveDivider from "../../components/WaveDivider";
import {
  useTournamentTeams,
  useCreateTeam,
  useRequestToJoinTeam,
  useAddManualTeamMember,
  useLeaveTeam,
  useApproveTeam,
  useRejectPendingTeam,
  useRemoveTeamMember,
  useUpdateTeamName,
} from "../../hooks/useTournamentTeams";
import { useCreateTeamInvite, usePendingTeamInviteCount } from "../../hooks/useInvites";
import { useTeamChatUnreadCount } from "../../hooks/useTeamMessages";
import { manualSportForName } from "../../lib/manualScore";
import { isCricketFamily } from "../../lib/api/sports";
import { LinkedMatchScoreDetails } from "../../components/MatchScoreDetails";
import { useTournamentMatches } from "../../hooks/useTournamentMatches";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import CreateTeamModal from "../../components/CreateTeamModal";
import RenameTeamModal from "../../components/RenameTeamModal";
import SelectJoinTeamModal, { type JoinableTeam } from "../../components/SelectJoinTeamModal";
import InviteUsersModal from "../../components/InviteUsersModal";
import AddManualMemberModal from "../../components/AddManualMemberModal";
import ChatIcon from "../../components/ChatIcon";
import { SkeletonCardRows } from "../../components/Skeleton";
import type { GameDetail } from "../../lib/api/games";
import type { TournamentTeam } from "../../lib/api/tournamentTeams";
import { soloAwareTeamName, type ScorecardPrefill, type ScorecardPrefillPlayer } from "../../lib/api/tournamentMatches";
import { disambiguateRoster } from "../../lib/matchNameValidation";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GradientFill from "../../components/GradientFill";

type Nav = NativeStackNavigationProp<GamesStackParamList>;

const TEAM_STATUS_META: Record<
  string,
  { bg: string; text: string; label: string; iconBg: string; iconColor: string }
> = {
  FORMING: { bg: "bg-amber-50", text: "text-amber-700", label: "Recruiting", iconBg: colors.warningLight, iconColor: "#D97706" },
  PENDING_HOST_APPROVAL: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Awaiting Approval",
    iconBg: colors.warningLight,
    iconColor: "#D97706",
  },
  APPROVED: { bg: "bg-green-50", text: "text-green-700", label: "Full", iconBg: colors.primaryLight, iconColor: colors.primaryDark },
  REJECTED: { bg: "bg-red-50", text: "text-red-600", label: "Removed", iconBg: colors.dangerLight, iconColor: colors.danger },
};

// A rotating palette so a team's member circles aren't all the same flat
// green — purely cosmetic (index-based, not tied to any real per-user color).
const MEMBER_COLORS = ["#7C3AED", "#16A34A", "#D97706", "#DB2777", "#0891B2", "#4F46E5", "#65A30D", "#DC2626"];

function MemberAvatar({
  name,
  avatar,
  colorIndex,
  isManual,
  onRemove,
  onPressAvatar,
}: {
  name: string | null;
  avatar: string | null;
  colorIndex: number;
  // A host-entered player with no app account — shown with the app's
  // default avatar image instead of a colored-initial circle, so it's
  // visually distinct from a real member.
  isManual?: boolean;
  onRemove?: () => void;
  onPressAvatar?: () => void;
}) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length];
  return (
    <View className="items-center" style={{ width: 56 }}>
      <View style={{ position: "relative" }}>
        <Pressable onPress={onPressAvatar} disabled={!onPressAvatar}>
          {isManual ? (
            <Image source={require("../../../assets/avatar.png")} className="w-10 h-10 rounded-full bg-gray-200" />
          ) : avatar ? (
            <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
          ) : (
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <Text className="text-jazba-white font-bold text-sm">{initials}</Text>
            </View>
          )}
        </Pressable>
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
  isVenueBooked,
  onLeave,
  onApprove,
  onReject,
  onOpenChat,
  onInvitePlayer,
  onAddTeam,
  onAddManually,
  onJoinTeam,
  onRemoveMember,
  genderMismatch,
  gameGenderLabel,
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
  // Once the venue is actually booked, the roster is fully locked — a
  // joined member can no longer leave (see enforce_team_roster_rules).
  isVenueBooked: boolean;
  onLeave: () => void;
  onApprove: () => void;
  onReject: () => void;
  onOpenChat: () => void;
  // "Invite a Player" — search one user, available to the host or anyone
  // already on this team, while it still has an open slot.
  onInvitePlayer?: () => void;
  // "Add Team" — claim this still-empty slot with one of my own team-type
  // groups, filled to the exact required headcount (AddTeamScreen). Only
  // offered while the team has zero joined members — the RPC it ends in
  // (squad_fill_tournament_team) only ever claims a genuinely empty team.
  onAddTeam?: () => void;
  // Host-only: add a player with no app account — lands as JOINED
  // immediately, shown with the app's default avatar everywhere.
  onAddManually?: () => void;
  // A non-host, teamless user's plain individual join — see canJoinTeam.
  onJoinTeam?: () => void;
  // Host-only: pull one specific joined member off this team.
  onRemoveMember?: (memberId: string, name: string | null) => void;
  // True when this game/tournament is restricted to one gender and the
  // current user (or, more precisely, any squad they could use) doesn't
  // match it — hides "Create Team" in favor of an explanation.
  genderMismatch: boolean;
  gameGenderLabel: string;
  // This section is also reused for regular (non-tournament) games that
  // default to 2 teams — copy that mentions "the tournament" needs to say
  // "the game" there instead.
  noun: "tournament" | "game";
}) {
  const navigation = useNavigation<Nav>();
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
      : team.status === "REJECTED"
        ? "close-circle"
        : "hourglass"; // FORMING (still recruiting) and PENDING_HOST_APPROVAL both read as "not completed yet"
  // The "Create Team" squad-registration CTA only makes sense on a genuinely
  // empty team — the server only allows it there too.
  const isEmpty = joinedMembers.length === 0;
  const isJoinedMember = myMembership?.status === "JOINED";
  const { data: teamChatUnread } = useTeamChatUnreadCount(isJoinedMember ? team.id : undefined, userId);
  const { data: pendingInviteCount } = usePendingTeamInviteCount(team.id);
  const updateTeamName = useUpdateTeamName(team.game_id);
  const [renameOpen, setRenameOpen] = useState(false);
  // Host-only, and only while this specific team still has open slots —
  // once it's full its roster (and name) is settled.
  const canEditTeamName = isHost && !isTeamFull;
  // A joined member can leave a team that's still FORMING, or even one
  // that's already PENDING_HOST_APPROVAL/APPROVED — but only before the
  // venue is actually booked (see enforce_team_roster_rules); once booked,
  // the roster is fully locked.
  const canLeaveTeam =
    (team.status === "FORMING" || team.status === "PENDING_HOST_APPROVAL" || team.status === "APPROVED") &&
    !isVenueBooked;
  // "Invite a Player"/"Fill with my Squad" — recruiting into an open slot,
  // available to the host or anyone already on this specific team.
  const canManageRecruiting = isRosterEditable && !isTeamFull && (isHost || isJoinedMember);
  // "Join Team" — a non-host without a team of their own yet can join any
  // open (not full) team directly, same one-tap mechanic as the host's own
  // "Add Myself", just inline on the card instead of behind a picker.
  const canJoinTeam =
    isRosterEditable && !isTeamFull && !hasActiveTeamElsewhere && !isJoinedMember && !genderMismatch;
  // Host can pull a member off the roster under the same pre-venue-booked
  // window a member can leave under themselves (see enforce_team_roster_rules).
  const canHostRemoveMembers =
    isHost &&
    (team.status === "FORMING" || team.status === "PENDING_HOST_APPROVAL" || team.status === "APPROVED") &&
    !isVenueBooked;

  const chatButton = isJoinedMember ? (
    <Pressable
      onPress={onOpenChat}
      hitSlop={8}
      className="items-center justify-center rounded-full"
      style={{ width: 32, height: 32, backgroundColor: colors.surface, marginLeft: 8 }}
    >
      <ChatIcon size={16} unreadCount={teamChatUnread} />
    </Pressable>
  ) : null;

  return (
    <View className="border border-border rounded-2xl bg-surface" style={{ ...cardShadow, overflow: "hidden" }}>
      <View style={{ position: "relative" }}>
        <LinearGradient
          colors={[colors.primaryDark, "#18C66A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16, paddingBottom: 28 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <View
              className="items-center justify-center rounded-xl bg-surface"
              style={{ width: 40, height: 40 }}
            >
              <Ionicons name={statusIcon} size={19} color={badge?.iconColor ?? colors.primaryDark} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-jazba-white font-bold text-base flex-shrink" numberOfLines={1}>{team.name}</Text>
                {canEditTeamName && (
                  <Pressable onPress={() => setRenameOpen(true)} hitSlop={8}>
                    <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.85)" />
                  </Pressable>
                )}
              </View>
              <Text className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                {joinedMembers.length}/{requiredSize || "—"} players
                {!!pendingInviteCount && ` · ${pendingInviteCount} invited`}
              </Text>
            </View>
            {badge && (
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.22)" }}>
                <Text className="text-xs font-bold text-jazba-white">{badge.label}</Text>
              </View>
            )}
            {chatButton}
          </View>
        </LinearGradient>
        <WaveDivider color={colors.surface} height={22} />
      </View>

      <View className="p-4" style={{ paddingTop: 4 }}>

      {joinedMembers.length > 0 && (
        <View className="flex-row flex-wrap mt-1" style={{ gap: 10 }}>
          {joinedMembers.map((m, i) => (
            <MemberAvatar
              key={m.id}
              name={m.profiles?.full_name ?? m.manual_name ?? null}
              avatar={m.profiles?.avatar ?? null}
              isManual={!m.user_id}
              colorIndex={i}
              onRemove={
                canHostRemoveMembers && m.user_id !== userId && onRemoveMember
                  ? () => onRemoveMember(m.id, m.profiles?.full_name ?? m.manual_name ?? null)
                  : undefined
              }
              onPressAvatar={
                m.user_id ? () => navigation.navigate("PlayerProfile", { userId: m.user_id as string }) : undefined
              }
            />
          ))}
        </View>
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
                style={{ backgroundColor: colors.warningLight, gap: 8 }}
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
                <Pressable onPress={onApprove} disabled={disabled} className="flex-1">
                  <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 6 }}>
                    <Ionicons name="checkmark" size={16} color="white" />
                    <Text className="text-jazba-white font-bold text-sm">Approve</Text>
                  </GradientFill>
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
          member just gets a progress readout, and anyone else can register a
          whole squad via Create Team. A team moves on automatically the
          instant it's full (see auto_approve_full_team). */}
      {isRosterEditable && (
        <View className="mt-4">
          {isJoinedMember && (
            <View className={`rounded-xl py-2.5 items-center ${isTeamFull ? "bg-green-50" : "bg-gray-100"}`}>
              <Text className={`text-xs font-semibold ${isTeamFull ? "text-green-700" : "text-muted"}`}>
                {isTeamFull
                  ? `Team full — joining ${noun}…`
                  : `${joinedMembers.length}/${requiredSize || "—"} Players — Need ${playersNeeded} More`}
              </Text>
            </View>
          )}
          {/* The tournament host no longer gets a per-card "Create Team"
              here — they use "Add Myself" in the header (any non-full team,
              picked from one dropdown) instead of a bulk squad-register
              button on every empty card. */}
          {/* A non-host without a team of their own gets a plain, instant
              individual join instead — on every open (not full) team card,
              not just an empty one. Hidden the moment they're on any team in
              this tournament, and back once they leave it. */}
          {!isHost && canJoinTeam && onJoinTeam && (
            <Pressable onPress={onJoinTeam} disabled={disabled} className="mt-3">
              <GradientFill className="flex-row items-center justify-center rounded-full py-3.5" style={{ gap: 8 }}>
                <Ionicons name="add" size={17} color="white" />
                <Text className="text-jazba-white font-bold text-sm">Join Team</Text>
              </GradientFill>
            </Pressable>
          )}
        </View>
      )}

      {/* Leave Team is independent of isRosterEditable — a joined member can
          still back out of a PENDING_HOST_APPROVAL/APPROVED team too, as
          long as the venue isn't booked yet (see canLeaveTeam). */}
      {isJoinedMember && canLeaveTeam && (
        <Pressable
          onPress={onLeave}
          disabled={disabled}
          className="rounded-full border border-danger py-3 items-center mt-3"
        >
          <Text className="text-danger font-bold text-sm">Leave Team</Text>
        </Pressable>
      )}

      {/* Recruiting into this team's open slot — a single searched player
          (instant invite, approved from their Notifications), or (only
          while the team is still completely empty) claiming the whole slot
          at once with one of my own team-type groups. */}
      {canManageRecruiting && (onInvitePlayer || (isEmpty && onAddTeam)) && (
        <View className="flex-row mt-3" style={{ gap: 8 }}>
          {onInvitePlayer && (
            <Pressable
              onPress={onInvitePlayer}
              disabled={disabled}
              className="flex-1 flex-row items-center justify-center rounded-full border border-primary py-3"
              style={{ gap: 6 }}
            >
              <Ionicons name="person-add-outline" size={15} color={colors.primary} />
              <Text className="text-primary font-bold text-xs">Invite a Player</Text>
            </Pressable>
          )}
          {isEmpty && onAddTeam && (
            <Pressable onPress={onAddTeam} disabled={disabled} className="flex-1">
              <GradientFill className="flex-row items-center justify-center rounded-full py-3" style={{ gap: 6 }}>
                <Ionicons name="people-outline" size={15} color="white" />
                <Text className="text-jazba-white font-bold text-xs">Add Team</Text>
              </GradientFill>
            </Pressable>
          )}
        </View>
      )}
      {/* Host-only — a player without an app account, added straight to
          the roster (no approval, no invite to accept). */}
      {isHost && canManageRecruiting && onAddManually && (
        <Pressable
          onPress={onAddManually}
          disabled={disabled}
          className="flex-row items-center justify-center rounded-full border border-border py-3 mt-2"
          style={{ gap: 6 }}
        >
          <Ionicons name="person-add-outline" size={15} color={colors.muted} />
          <Text className="text-muted font-bold text-xs">Add Player Manually</Text>
        </Pressable>
      )}
      </View>
      {canEditTeamName && (
        <RenameTeamModal
          visible={renameOpen}
          initialName={team.name}
          onClose={() => setRenameOpen(false)}
          onSubmit={(name) =>
            updateTeamName.mutate(
              { teamId: team.id, name },
              {
                onSuccess: () => setRenameOpen(false),
                onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not rename team.")),
              }
            )
          }
          submitting={updateTeamName.isPending}
        />
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

  const sportName = (game.sports?.name ?? "").trim().toLowerCase();
  const isCricketSport = isCricketFamily(sportName);
  // Once the match has a result (scored live or entered by hand) there's
  // nothing left to score, so neither scoring button is offered. Scoring no
  // longer waits on the venue being booked — a host can start scoring as
  // soon as both teams are set, same as the button itself only ever
  // appearing once the match row exists.
  const canGoToScorecard = isHost && !!match?.team_a && !!match?.team_b && match.status !== "COMPLETED";

  const rosterByTeamId = new Map<string, ScorecardPrefillPlayer[]>();
  for (const t of teams) {
    rosterByTeamId.set(
      t.id,
      t.tournament_team_members
        .filter((m) => m.status === "JOINED")
        .map((m) => ({ name: m.profiles?.full_name ?? m.manual_name ?? "Player", userId: m.user_id }))
    );
  }

  // Manually-typed names (no account to tell them apart) can collide —
  // two different players both entered as "Ali" — and since the New Match
  // screen locks a prefilled roster's names, that collision would otherwise
  // leave the Start button permanently disabled with no way to fix it.
  // Suffix duplicates ("Ali (2)") here, before the roster ever reaches that
  // screen.
  const rawTeamAPlayers = match?.team_a ? rosterByTeamId.get(match.team_a.id) ?? [] : [];
  const rawTeamBPlayers = match?.team_b ? rosterByTeamId.get(match.team_b.id) ?? [] : [];
  const { teamANames, teamBNames } = disambiguateRoster(
    rawTeamAPlayers.map((p) => ({ name: p.name, sourceId: p.userId })),
    rawTeamBPlayers.map((p) => ({ name: p.name, sourceId: p.userId }))
  );
  const teamAPlayers = rawTeamAPlayers.map((p, i) => ({ ...p, name: teamANames[i] }));
  const teamBPlayers = rawTeamBPlayers.map((p, i) => ({ ...p, name: teamBNames[i] }));

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
        teamAPlayers,
        teamBPlayers,
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
      teamAPlayers,
      teamBPlayers,
      venue: game.venues?.name ?? game.custom_venue_name ?? undefined,
      sportId: game.sports?.id,
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
    <View className="mx-4 mt-4 border border-border rounded-2xl bg-surface p-4" style={cardShadow}>
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
          <Pressable onPress={handleGoToScorecard} className="mt-2">
            <GradientFill className="rounded-lg py-2 items-center">
              <Text className="text-jazba-white text-xs font-semibold">Go To Scorecard</Text>
            </GradientFill>
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
  const [showJoinTeamModal, setShowJoinTeamModal] = useState(false);
  const [invitePlayerTeamId, setInvitePlayerTeamId] = useState<string | null>(null);
  const [addManuallyTeamId, setAddManuallyTeamId] = useState<string | null>(null);
  const [addingManually, setAddingManually] = useState(false);

  const { data: teamsData, isLoading } = useTournamentTeams(game.id);
  const createTeam = useCreateTeam(game.id);
  const requestToJoinTeam = useRequestToJoinTeam(game.id);
  const leaveTeam = useLeaveTeam(game.id);
  const approveTeam = useApproveTeam(game.id);
  const rejectPendingTeam = useRejectPendingTeam(game.id);
  const removeTeamMember = useRemoveTeamMember(game.id);
  const createTeamInvite = useCreateTeamInvite(game.id);
  const addManualMember = useAddManualTeamMember(game.id);

  if (isLoading) {
    return <View className="mt-4"><SkeletonCardRows count={2} /></View>;
  }

  const teams = teamsData ?? [];
  const requiredSize = game.players_per_team ?? 0;
  const requiredTeams = game.number_of_teams ?? 0;

  // How many more players the "Add Players Manually" sheet can queue up for
  // whichever team it's currently open for — caps the modal's row count so
  // the host can't stage more names than the team actually has open slots.
  const addManuallyTeam = teams.find((t) => t.id === addManuallyTeamId) ?? null;
  const addManuallyRemainingSlots =
    addManuallyTeam && requiredSize > 0
      ? Math.max(0, requiredSize - addManuallyTeam.tournament_team_members.filter((m) => m.status === "JOINED").length)
      : null;

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
  // Same "Book Venue"/"Go To Scorecard" rule used everywhere else — a real
  // (dropdown-picked) venue counts as booked once there's either an actual
  // booking or the host has contacted the venue, a manually typed one is
  // treated as already settled the moment it's set. Once booked, a joined
  // member can no longer leave their team (see TeamCard's canLeaveTeam).
  const isVenueBooked = game.venue_id ? !!game.booking_id || game.venue_contacted : !!game.custom_venue_name;

  const disabled =
    createTeam.isPending ||
    requestToJoinTeam.isPending ||
    leaveTeam.isPending ||
    approveTeam.isPending ||
    rejectPendingTeam.isPending ||
    removeTeamMember.isPending;

  const invitePlayerTeam = invitePlayerTeamId ? teams.find((t) => t.id === invitePlayerTeamId) : undefined;
  // A squad can fill more than one team here (its owner just repeats
  // "Create Team" on another card with a different subset of members), but
  // never with the same player on two teams — this is every player already
  // JOINED anywhere else, so AddTeamScreen can hide them from the picker.
  const joinedElsewhereUserIds = activeTeams.flatMap((t) =>
    t.tournament_team_members
      .filter((m) => m.status === "JOINED" && m.user_id)
      .map((m) => m.user_id as string)
  );
  // "Add Myself" — every active team with an open slot, offered to the host
  // only while they don't already have a team of their own in this
  // tournament (see myTeam above; leaving one makes this available again).
  const joinableTeams: JoinableTeam[] = activeTeams
    .filter((t) => {
      const joinedCount = t.tournament_team_members.filter((m) => m.status === "JOINED").length;
      return requiredSize <= 0 || joinedCount < requiredSize;
    })
    .map((t) => ({
      id: t.id,
      name: t.name,
      joinedCount: t.tournament_team_members.filter((m) => m.status === "JOINED").length,
      requiredSize,
    }));

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

  const handleRemoveMember = (memberId: string, name: string | null) => {
    Alert.alert(
      "Remove Player",
      `Remove ${name ?? "this player"} from this team?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            removeTeamMember.mutate(memberId, {
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove this player.")),
            }),
        },
      ]
    );
  };

  const handleAddMyself = (teamId: string) => {
    if (!userId) return;
    requestToJoinTeam.mutate(
      { teamId, userId },
      {
        onSuccess: () => setShowJoinTeamModal(false),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not join this team.")),
      }
    );
  };

  // A non-host's plain "Join Team" tap, straight from that team's own card
  // (no picker needed — the card it's on is the team being joined).
  const handleJoinTeam = (teamId: string) => {
    if (!userId) return;
    requestToJoinTeam.mutate(
      { teamId, userId },
      { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not join this team.")) }
    );
  };

  return (
    <View>
      {isTournament ? (
        // Groups/Fixtures/Matches/Standings all live on their own screen —
        // a real tournament can have multiple rounds/pools, so this just
        // links out to it rather than trying to fit all of that here.
        <Pressable
          onPress={() => navigation.navigate("TournamentMatches", { gameId: game.id })}
          className="mx-4 mt-4 flex-row items-center border border-border rounded-2xl bg-surface p-4"
          style={{ ...cardShadow, gap: 12 }}
        >
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="list-outline" size={19} color={colors.primaryDark} />
          </View>
          <View className="flex-1">
            <Text className="text-ink font-bold text-base">
              {isPoolFormat ? "Groups & Matches List" : "Matches List"}
            </Text>
            <Text className="text-muted text-xs mt-0.5">View all upcoming and past matches</Text>
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
        <Text className="text-ink font-bold text-base">
          Teams ({activeTeams.length}/{requiredTeams || "—"})
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          {/* The host can add themselves straight onto any existing,
              not-yet-full team — hidden again once they're already on one
              (see myTeam); leaving that team brings this back. */}
          {isHost && !myTeam && (
            <Pressable onPress={() => setShowJoinTeamModal(true)} style={primaryButtonShadow}>
              <LinearGradient
                colors={[colors.primaryDark, "#18C66A"]}
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
                <Text className="text-jazba-white text-sm font-bold">Add Myself</Text>
              </LinearGradient>
            </Pressable>
          )}
          {canCreateTeam && (
            <Pressable onPress={() => setShowCreateModal(true)}>
              <GradientFill className="flex-row items-center rounded-full px-3 py-1.5" style={{ gap: 4 }}>
                <Ionicons name="add" size={14} color="white" />
                <Text className="text-jazba-white text-xs font-semibold">Create Team</Text>
              </GradientFill>
            </Pressable>
          )}
        </View>
      </View>

      {hiddenByGenderOnly && (
        <Text className="mx-4 -mt-2 mb-3 text-muted text-xs">
          This {noun} is open to {gameGenderLabel} players only, so you can't create or join a team here.
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
              isVenueBooked={isVenueBooked}
              onLeave={() => handleLeave(team.id)}
              onApprove={() => handleApprove(team.id)}
              onReject={() => handleReject(team.id)}
              onOpenChat={() => navigation.navigate("TeamChat", { teamId: team.id, teamName: team.name, sportName: game.sports?.name })}
              onInvitePlayer={userId ? () => setInvitePlayerTeamId(team.id) : undefined}
              onAddTeam={
                userId
                  ? () =>
                      navigation.navigate("AddTeam", {
                        gameId: game.id,
                        teamId: team.id,
                        requiredSize,
                        excludeUserIds: joinedElsewhereUserIds,
                        gameGender: game.gender,
                      })
                  : undefined
              }
              onAddManually={userId ? () => setAddManuallyTeamId(team.id) : undefined}
              onJoinTeam={userId ? () => handleJoinTeam(team.id) : undefined}
              onRemoveMember={handleRemoveMember}
              genderMismatch={genderMismatch}
              gameGenderLabel={gameGenderLabel}
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
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not create team.")),
            }
          );
        }}
      />

      {isHost && (
        <SelectJoinTeamModal
          visible={showJoinTeamModal}
          onClose={() => setShowJoinTeamModal(false)}
          teams={joinableTeams}
          submitting={requestToJoinTeam.isPending}
          onSelect={handleAddMyself}
        />
      )}

      <InviteUsersModal
        visible={!!invitePlayerTeamId}
        onClose={() => setInvitePlayerTeamId(null)}
        title={`Invite a Player · ${invitePlayerTeam?.name ?? ""}`}
        excludeIds={joinedElsewhereUserIds}
        onInvite={async (user) => {
          if (!userId || !invitePlayerTeamId) return;
          await createTeamInvite.mutateAsync({ teamId: invitePlayerTeamId, invitedUserId: user.id, invitedBy: userId });
        }}
      />

      <AddManualMemberModal
        visible={!!addManuallyTeamId}
        onClose={() => setAddManuallyTeamId(null)}
        submitting={addingManually}
        maxPlayers={addManuallyRemainingSlots}
        onSubmit={async (names) => {
          if (!addManuallyTeamId) return;
          setAddingManually(true);
          let addedCount = 0;
          try {
            for (const name of names) {
              await addManualMember.mutateAsync({ teamId: addManuallyTeamId, name });
              addedCount++;
            }
            setAddManuallyTeamId(null);
          } catch (err) {
            if (addedCount > 0) {
              Alert.alert(
                "Some Players Weren't Added",
                `Added ${addedCount} of ${names.length} player(s). ${getFriendlyErrorMessage(err, "Could not add the rest.")}`
              );
              setAddManuallyTeamId(null);
            } else {
              Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add the player(s)."));
            }
          } finally {
            setAddingManually(false);
          }
        }}
      />
    </View>
  );
}
