import { useState } from "react";
import { colors } from "@app/constants/theme";
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
} from "@app/hooks/useTournamentTeams";
import { usePlayerTeamSquads } from "@app/hooks/useSquads";
import { useCreateTeamInvite, usePendingTeamInviteCount } from "@app/hooks/useInvites";
import { useTeamChatUnreadCount } from "@app/hooks/useTeamMessages";
import { useSetMatchScorer, useTournamentMatches } from "@app/hooks/useTournamentMatches";
import { manualSportForName } from "@app/lib/manualScore";
import { isCricketFamily } from "@app/lib/api/sports";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import type { GameDetail } from "@app/lib/api/games";
import type { TournamentTeam } from "@app/lib/api/tournamentTeams";
import { soloAwareTeamName, type ScorecardPrefill, type ScorecardPrefillPlayer } from "@app/lib/api/tournamentMatches";
import { disambiguateRoster } from "@app/lib/matchNameValidation";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { useAppNavigate } from "@/routes/navigation";
import { paths, type MatchSport } from "@/routes/paths";
import manualAvatar from "@/assets/web/avatar.webp";
import { Ionicon } from "../icons/Icon";
import Spinner from "../ui/Spinner";
import { ChatIcon, WaveDivider } from "../ui/Decor";
import { LinkedMatchScoreDetails } from "./MatchScoreDetails";
import { SelectJoinTeamModal, type JoinableTeam } from "./JoinSheets";
import { AddManualMemberModal, CreateTeamModal, InviteUsersModal, RenameTeamModal } from "./GameModals";
import { SelectScorerModal, type ScorerCandidate } from "./FixtureModals";
import { SkeletonCardRows } from "../ui/Skeleton";

const TEAM_STATUS_META: Record<string, { label: string; iconColor: string }> = {
  FORMING: { label: "Recruiting", iconColor: "#D97706" },
  PENDING_HOST_APPROVAL: { label: "Awaiting Approval", iconColor: "#D97706" },
  APPROVED: { label: "Full", iconColor: colors.primaryDark },
  REJECTED: { label: "Removed", iconColor: colors.danger },
};
const MEMBER_COLORS = ["#7C3AED", "#16A34A", "#D97706", "#DB2777", "#0891B2", "#4F46E5", "#65A30D", "#DC2626"];

// Sport name → the scorecard pages' sport key.
export function scorecardSportFor(sportName: string): MatchSport | null {
  const n = sportName.trim().toLowerCase();
  if (isCricketFamily(n)) return "cricket";
  const map: Record<string, MatchSport> = { padel: "padel", tennis: "tennis", badminton: "badminton", pickleball: "pickleball", "table tennis": "table_tennis", football: "football" };
  return map[n] ?? null;
}

// Linked scorecard id on a fixture for that sport, if it's been started.
export function linkedScorecardId(
  sport: MatchSport,
  m: { cricket_match_id?: string | null; padel_match_id: string | null; tennis_match_id: string | null; badminton_match_id: string | null; pickleball_match_id: string | null; table_tennis_match_id: string | null; football_match_id: string | null }
): string | null {
  const ids: Record<MatchSport, string | null | undefined> = {
    cricket: m.cricket_match_id,
    padel: m.padel_match_id,
    tennis: m.tennis_match_id,
    badminton: m.badminton_match_id,
    pickleball: m.pickleball_match_id,
    table_tennis: m.table_tennis_match_id,
    football: m.football_match_id,
  };
  return ids[sport] ?? null;
}

function MemberAvatar({ name, avatar, colorIndex, isManual, onRemove, onPressAvatar }: { name: string | null; avatar: string | null; colorIndex: number; isManual?: boolean; onRemove?: () => void; onPressAvatar?: () => void }) {
  return (
    <div className="flex w-14 flex-col items-center">
      <div className="relative">
        <button type="button" onClick={onPressAvatar} disabled={!onPressAvatar} aria-label={name ?? "Player"}>
          {isManual ? (
            <img src={manualAvatar} alt="" className="h-10 w-10 rounded-full bg-gray-200 object-cover" />
          ) : avatar ? (
            <img src={avatar} alt="" className="h-10 w-10 rounded-full bg-primary-light object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: MEMBER_COLORS[colorIndex % MEMBER_COLORS.length] }}>
              {(name ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        <span className="absolute -bottom-px -right-px h-3 w-3 rounded-full border-2 border-white bg-[#22C55E]" />
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name ?? "player"}`} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-danger">
            <Ionicon name="close" size={11} color="white" />
          </button>
        )}
      </div>
      <span className="mt-1 w-full truncate text-center text-xs text-muted">{(name ?? "Player").split(" ")[0]}</span>
    </div>
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
  noun,
}: {
  team: TournamentTeam;
  requiredSize: number;
  userId?: string;
  isHost: boolean;
  disabled: boolean;
  hasActiveTeamElsewhere: boolean;
  isVenueBooked: boolean;
  onLeave: () => void;
  onApprove: () => void;
  onReject: () => void;
  onOpenChat: () => void;
  onInvitePlayer?: () => void;
  onAddTeam?: () => void;
  onAddManually?: () => void;
  onJoinTeam?: () => void;
  onRemoveMember?: (memberId: string, name: string | null) => void;
  genderMismatch: boolean;
  noun: "tournament" | "game";
}) {
  const navigate = useAppNavigate();
  const joined = team.tournament_team_members.filter((m) => m.status === "JOINED");
  const myMembership = userId ? team.tournament_team_members.find((m) => m.user_id === userId) : undefined;
  const isTeamFull = requiredSize > 0 && joined.length >= requiredSize;
  const isRosterEditable = team.status === "FORMING";
  const isPendingApproval = team.status === "PENDING_HOST_APPROVAL";
  const playersNeeded = Math.max(requiredSize - joined.length, 0);
  const badge = TEAM_STATUS_META[team.status];
  const statusIcon = team.status === "APPROVED" ? "trophy" : team.status === "REJECTED" ? "close-circle" : "hourglass";
  const isJoinedMember = myMembership?.status === "JOINED";
  const { data: chatUnread } = useTeamChatUnreadCount(isJoinedMember ? team.id : undefined, userId);
  const { data: pendingInviteCount } = usePendingTeamInviteCount(team.id);
  const updateTeamName = useUpdateTeamName(team.game_id);
  const [renameOpen, setRenameOpen] = useState(false);
  const canEditName = isHost && !isTeamFull;
  const activeStatus = team.status === "FORMING" || team.status === "PENDING_HOST_APPROVAL" || team.status === "APPROVED";
  const canLeave = activeStatus && !isVenueBooked;
  const canManageRecruiting = isRosterEditable && !isTeamFull && (isHost || isJoinedMember);
  // A squad-filled team only takes joins from members of that squad.
  const { data: myTeamSquads } = usePlayerTeamSquads(userId);
  const belongsToFillingSquad = !team.filled_by_squad_id || (myTeamSquads ?? []).some((sq) => sq.id === team.filled_by_squad_id);
  const isEmpty = joined.length === 0;
  const canJoin = isRosterEditable && !isTeamFull && !hasActiveTeamElsewhere && !isJoinedMember && !genderMismatch && belongsToFillingSquad;
  const canHostRemove = isHost && activeStatus && !isVenueBooked;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="relative bg-gradient-to-br from-primary-dark to-primary p-4 pb-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface">
            <Ionicon name={statusIcon} size={19} color={badge?.iconColor ?? colors.primaryDark} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-bold text-white">{team.name}</p>
              {canEditName && (
                <button type="button" aria-label="Rename team" onClick={() => setRenameOpen(true)}>
                  <Ionicon name="pencil" size={14} color="rgba(255,255,255,0.85)" />
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-white/75">
              {joined.length}/{requiredSize || "—"} players
              {!!pendingInviteCount && ` · ${pendingInviteCount} invited`}
            </p>
          </div>
          {badge && <span className="rounded-full bg-white/[0.22] px-3 py-1 text-xs font-bold text-white">{badge.label}</span>}
          {isJoinedMember && (
            <button type="button" onClick={onOpenChat} aria-label="Team chat" className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface">
              <ChatIcon size={16} unreadCount={chatUnread} />
            </button>
          )}
        </div>
        <WaveDivider color="white" height={22} />
      </div>

      <div className="p-4 pt-1">
        {joined.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2.5">
            {joined.map((m, i) => (
              <MemberAvatar
                key={m.id}
                name={m.profiles?.full_name ?? m.manual_name ?? null}
                avatar={m.profiles?.avatar ?? null}
                isManual={!m.user_id}
                colorIndex={i}
                onRemove={canHostRemove && m.user_id !== userId && onRemoveMember ? () => onRemoveMember(m.id, m.profiles?.full_name ?? m.manual_name ?? null) : undefined}
                onPressAvatar={m.user_id ? () => navigate(paths.player(m.user_id as string)) : undefined}
              />
            ))}
          </div>
        )}

        {team.status === "REJECTED" && <p className="mt-2 text-xs text-danger">Removed from the {noun} by the host.</p>}

        {isPendingApproval && (
          <div className="mt-4">
            {isHost ? (
              <>
                <p className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2.5 text-xs font-semibold text-amber-800">
                  <Ionicon name="information-circle" size={16} color="#D97706" />
                  Waiting for your approval to join this team.
                </p>
                <div className="mt-3 flex gap-2.5">
                  <button type="button" onClick={onReject} disabled={disabled} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-danger py-3 text-sm font-bold text-danger hover:bg-red-50">
                    <Ionicon name="close" size={16} color={colors.danger} />
                    Reject
                  </button>
                  <button type="button" onClick={onApprove} disabled={disabled} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-3 text-sm font-bold text-white">
                    <Ionicon name="checkmark" size={16} color="white" />
                    Approve
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-xl bg-amber-50 py-2.5 text-center text-xs font-semibold text-amber-700">Sent to the host for approval</p>
            )}
          </div>
        )}

        {isRosterEditable && (
          <div className="mt-4">
            {isJoinedMember && (
              <p className={`rounded-xl py-2.5 text-center text-xs font-semibold ${isTeamFull ? "bg-green-50 text-green-700" : "bg-gray-100 text-muted"}`}>
                {isTeamFull ? `Team full — joining ${noun}…` : `${joined.length}/${requiredSize || "—"} Players — Need ${playersNeeded} More`}
              </p>
            )}
            {!isHost && canJoin && onJoinTeam && (
              <button type="button" onClick={onJoinTeam} disabled={disabled} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-bold text-white">
                <Ionicon name="add" size={17} color="white" />
                Join Team
              </button>
            )}
          </div>
        )}

        {isJoinedMember && canLeave && (
          <button type="button" onClick={onLeave} disabled={disabled} className="mt-3 w-full rounded-full border border-danger py-3 text-sm font-bold text-danger hover:bg-red-50">
            Leave Team
          </button>
        )}

        {canManageRecruiting && (onInvitePlayer || (isEmpty && onAddTeam)) && (
          <div className="mt-3 flex gap-2">
            {onInvitePlayer && (
              <button type="button" onClick={onInvitePlayer} disabled={disabled} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-primary py-3 text-xs font-bold text-primary hover:bg-primary-light">
                <Ionicon name="person-add-outline" size={15} color={colors.primary} />
                Invite a Player
              </button>
            )}
            {isEmpty && onAddTeam && (
              <button type="button" onClick={onAddTeam} disabled={disabled} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-3 text-xs font-bold text-white">
                <Ionicon name="people-outline" size={15} color="white" />
                Add Team
              </button>
            )}
          </div>
        )}
        {isHost && canManageRecruiting && onAddManually && (
          <button type="button" onClick={onAddManually} disabled={disabled} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-border py-3 text-xs font-bold text-muted hover:bg-gray-50">
            <Ionicon name="person-add-outline" size={15} color={colors.muted} />
            Add Player Manually
          </button>
        )}
      </div>

      {canEditName && (
        <RenameTeamModal
          open={renameOpen}
          initialName={team.name}
          onClose={() => setRenameOpen(false)}
          submitting={updateTeamName.isPending}
          onSubmit={(name) =>
            updateTeamName.mutate(
              { teamId: team.id, name },
              { onSuccess: () => setRenameOpen(false), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not rename team.")) }
            )
          }
        />
      )}
    </div>
  );
}

// Fixture → per-sport new-match / live-scoring page (shared with the
// tournament fixtures list).
export function useGoToScorecard() {
  const navigate = useAppNavigate();
  return (sportName: string, match: Parameters<typeof linkedScorecardId>[1], prefill: ScorecardPrefill) => {
    const sport = scorecardSportFor(sportName);
    if (!sport) return;
    const existing = linkedScorecardId(sport, match);
    if (existing) navigate(paths.match(sport, existing), { state: { tab: "scorecard" } });
    else navigate(paths.newMatch(sport), { state: { tab: "scorecard", prefill } });
  };
}

function HeadToHeadMatchCard({ game, isHost, teams }: { game: GameDetail; isHost: boolean; teams: TournamentTeam[] }) {
  const navigate = useAppNavigate();
  const goToScorecard = useGoToScorecard();
  const { data: matches } = useTournamentMatches(game.id);
  const setMatchScorer = useSetMatchScorer(game.id);
  const currentUserId = useAuthStore((st) => st.session?.user.id);
  const [scorerOpen, setScorerOpen] = useState(false);
  const match = (matches ?? [])[0] ?? null;
  const displayName = (t: TournamentTeam | undefined, fallback: string) =>
    t ? soloAwareTeamName(t.name, t.tournament_team_members.map((m) => ({ status: m.status, full_name: m.profiles?.full_name }))) : fallback;
  const sportName = (game.sports?.name ?? "").trim().toLowerCase();
  // Scorer candidates: every joined member plus the host(s).
  const rawCandidates: ScorerCandidate[] = teams.flatMap((t) =>
    t.tournament_team_members.filter((m) => m.status === "JOINED" && m.user_id).map((m) => ({ id: m.user_id as string, name: m.profiles?.full_name ?? "Player", teamName: t.name }))
  );
  if (game.creator_id) rawCandidates.push({ id: game.creator_id, name: game.profiles?.full_name ?? "Host", teamName: "Game Host" });
  for (const host of game.hosts ?? []) if (host.id !== game.creator_id) rawCandidates.push({ id: host.id, name: host.full_name ?? "Host", teamName: "Game Host" });
  const scorerCandidates = Array.from(new Map(rawCandidates.map((c) => [c.id, c])).values()).map((c) =>
    c.id === game.creator_id || (game.co_host_ids ?? []).includes(c.id) ? { ...c, name: `${c.name} (Host)` } : c
  );
  const scorerName = match?.scorer_user_id ? (scorerCandidates.find((c) => c.id === match.scorer_user_id)?.name ?? "Assigned scorer") : null;
  const isAssignedScorer = !!currentUserId && match?.scorer_user_id === currentUserId;
  const sport = scorecardSportFor(sportName);
  const linkedId = match && sport ? linkedScorecardId(sport, match) : null;
  const isLive = !!linkedId && match?.status !== "COMPLETED";
  const canScore = isAssignedScorer && !!match?.team_a && !!match?.team_b && match.status !== "COMPLETED";
  const canSelectScorer = isHost && !!match?.team_a && !!match?.team_b && match.status !== "COMPLETED";
  const watch = () => linkedId && sport && navigate(paths.match(sport, linkedId), { state: { tab: "scorecard" } });

  const roster = new Map<string, ScorecardPrefillPlayer[]>();
  for (const t of teams) {
    roster.set(t.id, t.tournament_team_members.filter((m) => m.status === "JOINED").map((m) => ({ name: m.profiles?.full_name ?? m.manual_name ?? "Player", userId: m.user_id })));
  }
  const rawA = match?.team_a ? (roster.get(match.team_a.id) ?? []) : [];
  const rawB = match?.team_b ? (roster.get(match.team_b.id) ?? []) : [];
  const { teamANames, teamBNames } = disambiguateRoster(
    rawA.map((p) => ({ name: p.name, sourceId: p.userId })),
    rawB.map((p) => ({ name: p.name, sourceId: p.userId }))
  );
  const teamAPlayers = rawA.map((p, i) => ({ ...p, name: teamANames[i] }));
  const teamBPlayers = rawB.map((p, i) => ({ ...p, name: teamBNames[i] }));
  const venue = game.venues?.name ?? game.custom_venue_name ?? undefined;

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-border bg-surface p-4 shadow-card lg:mx-0">
      <div
        role={linkedId ? "button" : undefined}
        tabIndex={linkedId ? 0 : undefined}
        onClick={linkedId ? watch : undefined}
        onKeyDown={(e) => linkedId && e.key === "Enter" && watch()}
        aria-label={linkedId ? `${displayName(teams[0], "Team A")} versus ${displayName(teams[1], "Team B")}, ${isLive ? "live" : "completed"}. Open scorecard` : undefined}
        className={linkedId ? "cursor-pointer" : ""}
      >
        <p className="mb-2 text-sm font-semibold text-ink">Match</p>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="flex-1 truncate text-sm font-medium text-ink">{displayName(teams[0], "Team A")}</span>
            <span className="mx-2 text-xs text-muted">vs</span>
            <span className="flex-1 truncate text-right text-sm font-medium text-ink">{displayName(teams[1], "Team B")}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">{match?.scheduled_at ? new Date(match.scheduled_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }) : "Head-to-head"}</span>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                backgroundColor: match?.status === "COMPLETED" ? colors.primaryLight : isLive ? colors.dangerLight : colors.infoLight,
                color: match?.status === "COMPLETED" ? colors.primaryDark : isLive ? "#DC2626" : "#2563EB",
              }}
            >
              {match?.status === "COMPLETED" ? "Completed" : isLive ? "LIVE" : "Upcoming"}
            </span>
          </div>
          {match?.status === "COMPLETED" && (match.is_draw || match.winner_team) ? (
            <p className="mt-1.5 text-xs font-semibold text-primary">{match.is_draw ? "Draw" : `${match.winner_team?.name} won`}</p>
          ) : null}
          {match ? <LinkedMatchScoreDetails match={match} /> : null}
        </div>
      </div>
      {canSelectScorer && (
        <button
          type="button"
          onClick={() => setScorerOpen(true)}
          disabled={setMatchScorer.isPending}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-primary px-3 py-2 text-left hover:bg-primary-light"
        >
          <span className="flex items-center gap-[7px] text-xs font-semibold text-primary">
            <Ionicon name="person-add-outline" size={15} color={colors.primary} />
            {scorerName ? `Scorer: ${scorerName}` : "Select Scorer"}
          </span>
          <Ionicon name="chevron-forward" size={15} color={colors.primary} />
        </button>
      )}
      <div>
        {canScore && match && (
          <>
            <button
              type="button"
              onClick={() =>
                goToScorecard(sportName, match, {
                  tournamentMatchId: match.id,
                  gameId: game.id,
                  teamAName: match.team_a!.name,
                  teamBName: match.team_b!.name,
                  teamAPlayers,
                  teamBPlayers,
                  venue,
                  sportId: game.sports?.id,
                })
              }
              className="press mt-2 w-full rounded-lg bg-brand py-2 text-xs font-semibold text-white"
            >
              Go To Scorecard
            </button>
            <button
              type="button"
              onClick={() => {
                const manualSport = manualSportForName(sportName);
                if (!manualSport) return;
                navigate(paths.manualScore, {
                  state: {
                    tab: "community",
                    params: {
                      sport: manualSport,
                      allowDraw: true,
                      prefill: { tournamentMatchId: match.id, gameId: game.id, teamAName: match.team_a!.name, teamBName: match.team_b!.name, teamAPlayers, teamBPlayers, venue },
                    },
                  },
                });
              }}
              className="mt-2 w-full rounded-lg border border-primary py-2 text-xs font-semibold text-primary hover:bg-primary-light"
            >
              Enter Score Manually
            </button>
          </>
        )}
        {linkedId && !isAssignedScorer && (
          <button type="button" onClick={watch} className="mt-2 w-full rounded-lg border border-primary py-2 text-xs font-semibold text-primary hover:bg-primary-light">
            {isLive ? "Watch Live" : "View Scorecard"}
          </button>
        )}
      </div>
      <SelectScorerModal
        open={scorerOpen}
        onClose={() => setScorerOpen(false)}
        members={scorerCandidates}
        currentScorerId={match?.scorer_user_id ?? null}
        submitting={setMatchScorer.isPending}
        contextLabel="game"
        onSelect={(scorerUserId) =>
          match &&
          setMatchScorer.mutate({ matchId: match.id, scorerUserId }, { onSuccess: () => setScorerOpen(false), onError: (e) => Alert.alert("Error", getFriendlyErrorMessage(e, "Could not assign scorer.")) })
        }
      />
    </div>
  );
}

// Port of TournamentTeamsSection: matches link (tournament) or the single
// head-to-head match card (team-based game), then the team cards with every
// roster action (create / join / add myself / invite / add team /
// add manually / rename / approve / reject / remove / leave / team chat).
export default function TournamentTeamsSection({ game, isGameHost }: { game: GameDetail; isGameHost?: boolean }) {
  const navigate = useAppNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const isHost = isGameHost ?? (game.creator_id === userId || (!!userId && (game.co_host_ids ?? []).includes(userId)));
  const genderMismatch = game.gender !== "mixed" && (!myGender || myGender !== game.gender);
  const gameGenderLabel = game.gender === "male" ? "male" : "female";
  const isTournament = game.game_type === "TOURNAMENT";
  const noun: "tournament" | "game" = isTournament ? "tournament" : "game";
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [invitePlayerTeamId, setInvitePlayerTeamId] = useState<string | null>(null);
  const [addingManually, setAddingManually] = useState(false);
  const [addManuallyTeamId, setAddManuallyTeamId] = useState<string | null>(null);

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
    return (
      <div className="mt-4">
        <SkeletonCardRows count={2} />
      </div>
    );
  }

  const teams = teamsData ?? [];
  const requiredSize = game.players_per_team ?? 0;
  const requiredTeams = game.number_of_teams ?? 0;
  const activeTeams = teams.filter((t) => t.status !== "REJECTED");
  const myTeam = userId ? teams.find((t) => t.status !== "REJECTED" && t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED")) : undefined;
  const canCreateTeam = !myTeam && requiredTeams > 0 && activeTeams.length < requiredTeams && !genderMismatch;
  const hiddenByGenderOnly = !myTeam && requiredTeams > 0 && activeTeams.length < requiredTeams && genderMismatch;
  const isPoolFormat = game.tournament_format === "POOL";
  const isVenueBooked = game.venue_id ? !!game.booking_id || game.venue_contacted : !!game.custom_venue_name;
  const disabled = createTeam.isPending || requestToJoinTeam.isPending || leaveTeam.isPending || approveTeam.isPending || rejectPendingTeam.isPending || removeTeamMember.isPending;
  const invitePlayerTeam = invitePlayerTeamId ? teams.find((t) => t.id === invitePlayerTeamId) : undefined;
  const addManuallyTeam = teams.find((t) => t.id === addManuallyTeamId) ?? null;
  const addManuallyRemainingSlots = addManuallyTeam && requiredSize > 0 ? Math.max(0, requiredSize - addManuallyTeam.tournament_team_members.filter((m) => m.status === "JOINED").length) : null;
  const joinedElsewhere = activeTeams.flatMap((t) => t.tournament_team_members.filter((m) => m.status === "JOINED" && m.user_id).map((m) => m.user_id as string));
  const joinableTeams: JoinableTeam[] = activeTeams
    .map((t) => ({ id: t.id, name: t.name, joinedCount: t.tournament_team_members.filter((m) => m.status === "JOINED").length, requiredSize }))
    .filter((t) => requiredSize <= 0 || t.joinedCount < requiredSize);
  const err = (fallback: string) => (e: unknown) => Alert.alert("Error", getFriendlyErrorMessage(e, fallback));

  return (
    <div>
      {isTournament ? (
        <button
          type="button"
          onClick={() => navigate(paths.tournamentMatches(game.id))}
          className="press mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-card hover:shadow-hero lg:mx-0 lg:w-full"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
            <Ionicon name="list-outline" size={19} color={colors.primaryDark} />
          </span>
          <span className="flex-1">
            <span className="block text-base font-bold text-ink">{isPoolFormat ? "Groups & Matches List" : "Matches List"}</span>
            <span className="mt-0.5 block text-xs text-muted">View all upcoming and past matches</span>
          </span>
          <Ionicon name="chevron-forward" size={18} color={colors.muted} />
        </button>
      ) : (
        <HeadToHeadMatchCard game={game} isHost={isHost} teams={activeTeams} />
      )}

      <div className="mx-4 mb-3 mt-4 flex flex-wrap items-center justify-between gap-2 lg:mx-0">
        <h2 className="text-base font-bold text-ink">
          Teams ({activeTeams.length}/{requiredTeams || "—"})
        </h2>
        <div className="flex gap-2">
          {isHost && !myTeam && (
            <button type="button" onClick={() => setShowJoinTeam(true)} className="press flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary-dark to-primary px-4 py-2.5 text-sm font-bold text-white shadow-cta">
              <Ionicon name="person-add-outline" size={16} color="white" />
              Add Myself
            </button>
          )}
          {canCreateTeam && (
            <button type="button" onClick={() => setShowCreate(true)} className="press flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white">
              <Ionicon name="add" size={14} color="white" />
              Create Team
            </button>
          )}
        </div>
      </div>

      {hiddenByGenderOnly && (
        <p className="mx-4 -mt-2 mb-3 text-xs text-muted lg:mx-0">
          This {noun} is open to {gameGenderLabel} players only, so you can't create or join a team here.
        </p>
      )}

      <div className="mx-4 grid gap-3 md:grid-cols-2 lg:mx-0">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-6 md:col-span-2">
            <Ionicon name="people-outline" size={32} color={colors.border} />
            <p className="mt-2 text-center text-sm text-muted">No teams yet. Be the first to create one!</p>
          </div>
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
              onLeave={() =>
                userId &&
                Alert.alert("Leave Team", "Are you sure you want to leave this team?", [
                  { text: "Stay", style: "cancel" },
                  { text: "Leave", style: "destructive", onPress: () => leaveTeam.mutate({ teamId: team.id, userId }, { onError: err("Could not leave.") }) },
                ])
              }
              onApprove={() => approveTeam.mutate(team.id, { onError: err("Could not approve this team.") })}
              onReject={() =>
                Alert.alert("Reject Team", "This will clear the pending roster and reopen this slot. Continue?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reject", style: "destructive", onPress: () => rejectPendingTeam.mutate(team.id, { onError: err("Could not reject this team.") }) },
                ])
              }
              onOpenChat={() => navigate(paths.teamChat(team.id), { state: { teamName: team.name, sportName: game.sports?.name } })}
              onInvitePlayer={userId ? () => setInvitePlayerTeamId(team.id) : undefined}
              onAddTeam={
                userId
                  ? () =>
                      navigate(paths.addTeam(game.id), {
                        state: { addTeam: { gameId: game.id, teamId: team.id, requiredSize, excludeUserIds: joinedElsewhere, gameGender: game.gender } },
                      })
                  : undefined
              }
              onAddManually={userId ? () => setAddManuallyTeamId(team.id) : undefined}
              onJoinTeam={userId ? () => requestToJoinTeam.mutate({ teamId: team.id, userId }, { onError: err("Could not join this team.") }) : undefined}
              onRemoveMember={(memberId, name) =>
                Alert.alert("Remove Player", `Remove ${name ?? "this player"} from this team?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Remove", style: "destructive", onPress: () => removeTeamMember.mutate(memberId, { onError: err("Could not remove this player.") }) },
                ])
              }
              genderMismatch={genderMismatch}
              noun={noun}
            />
          ))
        )}
      </div>

      <CreateTeamModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        submitting={createTeam.isPending}
        onSubmit={(name) => userId && createTeam.mutate({ creatorId: userId, name }, { onSuccess: () => setShowCreate(false), onError: err("Could not create team.") })}
      />
      {isHost && (
        <SelectJoinTeamModal
          open={showJoinTeam}
          onClose={() => setShowJoinTeam(false)}
          teams={joinableTeams}
          submitting={requestToJoinTeam.isPending}
          onSelect={(teamId) => userId && requestToJoinTeam.mutate({ teamId, userId }, { onSuccess: () => setShowJoinTeam(false), onError: err("Could not join this team.") })}
        />
      )}
      <InviteUsersModal
        open={!!invitePlayerTeamId}
        onClose={() => setInvitePlayerTeamId(null)}
        title={`Invite a Player · ${invitePlayerTeam?.name ?? ""}`}
        excludeIds={joinedElsewhere}
        onInvite={async (user) => {
          if (!userId || !invitePlayerTeamId) return;
          await createTeamInvite.mutateAsync({ teamId: invitePlayerTeamId, invitedUserId: user.id, invitedBy: userId });
        }}
      />
      <AddManualMemberModal
        open={!!addManuallyTeamId}
        onClose={() => setAddManuallyTeamId(null)}
        submitting={addingManually}
        maxPlayers={addManuallyRemainingSlots}
        onSubmit={async (names) => {
          if (!addManuallyTeamId) return;
          setAddingManually(true);
          let added = 0;
          try {
            for (const name of names) {
              await addManualMember.mutateAsync({ teamId: addManuallyTeamId, name });
              added++;
            }
            setAddManuallyTeamId(null);
          } catch (e) {
            if (added > 0) {
              Alert.alert("Some Players Weren't Added", `Added ${added} of ${names.length} player(s). ${getFriendlyErrorMessage(e, "Could not add the rest.")}`);
              setAddManuallyTeamId(null);
            } else Alert.alert("Error", getFriendlyErrorMessage(e, "Could not add the player(s)."));
          } finally {
            setAddingManually(false);
          }
        }}
      />
    </div>
  );
}
