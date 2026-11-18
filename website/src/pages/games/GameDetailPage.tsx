import { useState } from "react";
import { useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useGameDetail, useJoinGame, useLeaveGame, useCancelGame, useApprovePlayer, useRejectPlayer, useRemovePlayer, useAddManualGamePlayer } from "@app/hooks/useGames";
import { useGameChatUnreadCount } from "@app/hooks/useGameMessages";
import { useTournamentTeams } from "@app/hooks/useTournamentTeams";
import { useMyPendingGameInvite, useCreateGameInvite, useAcceptGameInvite, useDeclineGameInvite, useMyPendingTeamInvite, useAcceptTeamInvite, useDeclineTeamInvite } from "@app/hooks/useInvites";
import { useSquadFillGameSlots, useSendGameSquadInvite, useGameSquadInvitesForGame } from "@app/hooks/useSquadTeamFill";
import { useDismissedInvites } from "@app/lib/useDismissedInvites";
import { useAuthStore } from "@app/store/authStore";
import { getSportIcon } from "@app/lib/sportIcons";
import { GAME_SKILL_COLORS, timeBadgeColor, dayLabel } from "@app/lib/badgeColors";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { addMinutesWithOverflow } from "@app/lib/gameFormHelpers";
import { Alert } from "@/lib/alert";
import manualAvatar from "@/assets/web/avatar.webp";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { BlinkingEyeIcon, ChatIcon, WaveDivider } from "@/components/ui/Decor";
import { StickyActionBar } from "@/components/booking/BookingParts";
import { JoinRequestModal } from "@/components/games/JoinSheets";
import { AddManualMemberModal, InviteSquadModal, InviteUsersModal, SquadFillModal } from "@/components/games/GameModals";
import TournamentTeamsSection from "@/components/games/TournamentTeamsSection";
import { InfoRow, InviteBanner } from "@/components/games/DetailParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

function formatDateFull(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function formatTime(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr}+05:00`).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true });
}
function formatDateRangeFull(gameDate: string, endDate: string) {
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-PK", { month: "long", day: "numeric", year: "numeric" });
  };
  return `${fmt(gameDate)} – ${fmt(endDate)}`;
}

function PlayerAvatar({ name, avatar, isCreator, isManual, onRemove, onPressAvatar }: { name: string | null; avatar: string | null; isCreator: boolean; isManual?: boolean; onRemove?: () => void; onPressAvatar?: () => void }) {
  return (
    <div className="flex w-16 flex-col items-center">
      <div className="relative">
        <button type="button" onClick={onPressAvatar} disabled={!onPressAvatar} aria-label={name ?? "Player"}>
          {isManual ? <img src={manualAvatar} alt="" className="h-12 w-12 rounded-full bg-gray-200 object-cover" /> : <Avatar url={avatar} name={name} size={48} />}
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name ?? "player"}`} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-danger">
            <Ionicon name="close" size={11} color="white" />
          </button>
        )}
      </div>
      {isCreator && <span className="mt-1 rounded-full bg-brand px-1.5 py-0.5 text-xs font-medium text-white">Host</span>}
      <span className="mt-1 w-full truncate text-center text-xs text-muted">{(name ?? "Player").split(" ")[0]}</span>
    </div>
  );
}

// Port of GameDetailScreen: hero (sport + tournament badges, status,
// invite shortcuts, chat), host/team invite banners, collapsible details,
// description, players (flat games) or teams (team-based games and
// tournaments), join requests, host, host actions (Book Venue / Cancel) and
// the joiner's Request / Leave / Withdraw bar.
export default function GameDetailPage() {
  const { gameId = "" } = useParams();
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.games());
  const userId = useAuthStore((s) => s.session?.user.id);
  const [codeCopied, setCodeCopied] = useState(false);
  const [modal, setModal] = useState<null | "join" | "invite" | "squadFill" | "manual" | "inviteSquad">(null);
  const [addingManual, setAddingManual] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const squadFillSlots = useSquadFillGameSlots(gameId);
  const sendSquadInvite = useSendGameSquadInvite(gameId);
  const { data: squadInvites } = useGameSquadInvitesForGame(gameId);
  const { data: game, isLoading, error } = useGameDetail(gameId);
  const { data: tournamentTeams } = useTournamentTeams(game?.number_of_teams != null ? gameId : "");
  const { data: chatUnread } = useGameChatUnreadCount(game?.id, userId);
  const joinGame = useJoinGame();
  const leaveGame = useLeaveGame();
  const cancelGame = useCancelGame();
  const approvePlayer = useApprovePlayer(gameId);
  const addManualPlayer = useAddManualGamePlayer(gameId);
  const rejectPlayer = useRejectPlayer(gameId);
  const removePlayer = useRemovePlayer(gameId);
  const { data: myGameInvite } = useMyPendingGameInvite(gameId, userId);
  const createInvite = useCreateGameInvite(gameId);
  const acceptInvite = useAcceptGameInvite(gameId);
  const declineInvite = useDeclineGameInvite(gameId);
  const { data: myTeamInvite } = useMyPendingTeamInvite(gameId, userId);
  const acceptTeamInvite = useAcceptTeamInvite(gameId);
  const declineTeamInvite = useDeclineTeamInvite(gameId);
  const { isDismissed, dismiss } = useDismissedInvites();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 lg:px-8 lg:pt-6">
        <SkeletonDetailHeader />
      </div>
    );
  }
  if (error || !game) {
    return (
      <div className="flex flex-col items-center px-6 pt-32 text-center">
        <p className="mb-2 text-base font-semibold text-ink">Game not found</p>
        <button type="button" onClick={goBack} className="font-medium text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const joined = game.game_players.filter((p) => p.status === "JOINED");
  const emptySlots = Math.max(0, game.max_players - joined.length);
  const isFull = game.status === "FULL" || joined.length >= game.max_players;
  const isCreator = game.creator_id === userId || (!!userId && (game.co_host_ids ?? []).includes(userId));
  const hostIds = [...new Set([game.creator_id, ...(game.co_host_ids ?? [])])];
  const hosts = game.hosts?.length ? game.hosts : game.profiles ? [game.profiles] : [];
  const hasJoined = !!userId && game.game_players.some((p) => p.user_id === userId && p.status === "JOINED");
  const hasRequested = !!userId && game.game_players.some((p) => p.user_id === userId && p.status === "PENDING");
  const hasEnded = new Date(`${game.end_date ?? game.game_date}T${game.end_time}+05:00`).getTime() < Date.now();
  const isOpen = (game.status === "OPEN" || game.status === "FULL") && !hasEnded;
  const isCancelled = game.status === "CANCELLED";
  const pending = game.game_players.filter((p) => p.status === "PENDING");
  const isTournament = game.game_type === "TOURNAMENT";
  const isTeamBased = game.number_of_teams != null;
  const onTeam = (approvedOnly: boolean) =>
    isTeamBased && !!userId && (tournamentTeams ?? []).some((t) => (approvedOnly ? t.status === "APPROVED" : t.status !== "REJECTED") && t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED"));
  const isTeamMember = onTeam(false);
  const isApprovedParticipant = onTeam(true);
  const hasLinkedVenue = !!game.venue_id;
  const hasCustomVenue = !!game.custom_venue_name;
  const isVenueBooked = hasLinkedVenue ? !!game.booking_id || game.venue_contacted : hasCustomVenue;
  const showBookVenue = isTeamBased && isCreator && (hasLinkedVenue || hasCustomVenue);
  const showsBottomBar = isOpen && !isCreator && !isTeamBased;
  const skillLabel = !game.skill_level ? "Any Level" : { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced", PRO: "Pro" }[game.skill_level] ?? "Pro";
  const skillColor = game.skill_level ? GAME_SKILL_COLORS[game.skill_level] : colors.muted;
  const genderLabel = game.gender === "male" ? "Male Only" : game.gender === "female" ? "Female Only" : "Everyone";
  const genderColor = game.gender === "male" ? "#2563EB" : game.gender === "female" ? "#EC4899" : colors.primary;
  const sportIcon = game.sports?.name ? getSportIcon(game.sports.name) : null;
  const busy = joinGame.isPending || leaveGame.isPending || cancelGame.isPending;
  const approving = approvePlayer.isPending || rejectPlayer.isPending || removePlayer.isPending;
  const noun = isTournament ? "tournament" : "game";
  const Noun = isTournament ? "Tournament" : "Game";
  const err = (fallback: string) => (e: unknown) => Alert.alert("Error", getFriendlyErrorMessage(e, fallback));
  const joinSubtitle = game.entry_fee > 0 ? `Entry fee: Rs ${game.entry_fee.toLocaleString()} (pay at the venue). The host must approve your request before you're added.` : "The host must approve your request before you're added.";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(game.game_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // clipboard blocked — the code is on screen
    }
  };

  const confirm = (title: string, message: string, cancel: string, ok: string, run: () => void) =>
    Alert.alert(title, message, [
      { text: cancel, style: "cancel" },
      { text: ok, style: "destructive", onPress: run },
    ]);

  return (
    <div className="mx-auto max-w-5xl lg:px-8 lg:pt-6">
      <div className="relative">
        <header className="relative overflow-hidden bg-brand px-4 pb-7 pt-[calc(env(safe-area-inset-top)+10px)] lg:rounded-t-[28px] lg:px-10 lg:pb-12 lg:pt-8">
          {sportIcon && <MCIcon name={sportIcon.icon} size={84} color="white" className="pointer-events-none absolute -bottom-2.5 -right-3.5 opacity-[0.14]" style={{ transform: "rotate(-10deg)" }} />}
          <div className="flex items-center">
            <button type="button" onClick={goBack} aria-label="Back" className="mr-3 flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/30 bg-white/[0.16] hover:bg-white/25">
              <Ionicon name="arrow-back" size={20} color="white" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold text-white sm:text-2xl lg:text-[32px] lg:tracking-tight">{game.title}</h1>
            {(isCreator || hasJoined || isApprovedParticipant) && (
              <button
                type="button"
                aria-label="Open chat"
                onClick={() => navigate(paths.gameChat(game.id), { state: { gameTitle: game.title, isTournament, sportName: game.sports?.name } })}
                className="ml-3 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
              >
                <ChatIcon size={23} unreadCount={chatUnread} />
              </button>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {sportIcon && game.sports?.name && (
              <span className="flex items-center gap-[5px] rounded-full bg-surface px-2.5 py-[5px] text-xs font-bold" style={{ color: sportIcon.fg }}>
                <MCIcon name={sportIcon.icon} size={13} color={sportIcon.fg} />
                {game.sports.name}
              </span>
            )}
            {isTournament && (
              <span className="flex items-center gap-[5px] rounded-full bg-black/[0.22] px-2.5 py-[5px] text-xs font-semibold text-white">
                <Ionicon name="trophy" size={12} color="white" />
                Tournament
              </span>
            )}
            {isCreator && !isTeamBased && !isCancelled && !hasEnded && (
              <>
                <button type="button" title="Invite players" aria-label="Invite players" onClick={() => setModal("invite")} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.16] hover:bg-white/25">
                  <Ionicon name="person-add-outline" size={14} color="white" />
                </button>
                <button type="button" title="Invite a group" aria-label="Invite a group" onClick={() => setModal("inviteSquad")} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.16] hover:bg-white/25">
                  <Ionicon name="people-outline" size={14} color="white" />
                </button>
              </>
            )}
            {isCancelled && <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-red-600">Cancelled</span>}
            {!isCancelled && hasEnded && <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-muted">Ended</span>}
            {!isCancelled && !hasEnded && isFull && <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-orange-600">Full</span>}
          </div>
        </header>
        <WaveDivider color={colors.background} height={22} />
      </div>

      <div className="pb-10">
        {myGameInvite && !isDismissed(myGameInvite.id) && (
          <InviteBanner
            text={`${myGameInvite.profiles?.full_name ?? "The host"} invited you to ${isTournament ? "this tournament" : "this game"}`}
            sub={isTeamBased ? "Accept to let them know you're in, then join a team below." : "Accept to join instantly — no approval needed."}
            onDismiss={() => dismiss(myGameInvite.id)}
            busy={declineInvite.isPending || acceptInvite.isPending}
            accepting={acceptInvite.isPending}
            onAccept={() => acceptInvite.mutate(myGameInvite.id, { onError: err("Could not accept invite.") })}
            onDecline={() => confirm("Decline Invite", `Decline the invite to "${game.title}"?`, "Cancel", "Decline", () => declineInvite.mutate(myGameInvite.id, { onError: err("Could not decline invite.") }))}
          />
        )}
        {myTeamInvite && !isDismissed(myTeamInvite.id) && (
          <InviteBanner
            text={`${myTeamInvite.profiles?.full_name ?? "A host"} invited you to join team "${myTeamInvite.tournament_teams?.name ?? "a team"}" in this ${noun}`}
            sub="Accept to join the team instantly — no approval needed."
            onDismiss={() => dismiss(myTeamInvite.id)}
            busy={declineTeamInvite.isPending || acceptTeamInvite.isPending}
            accepting={acceptTeamInvite.isPending}
            onAccept={() => acceptTeamInvite.mutate(myTeamInvite.id, { onError: err("Could not accept invite.") })}
            onDecline={() =>
              confirm("Decline Invite", `Decline the invite to join team "${myTeamInvite.tournament_teams?.name ?? ""}"?`, "Cancel", "Decline", () =>
                declineTeamInvite.mutate(myTeamInvite.id, { onError: err("Could not decline invite.") })
              )
            }
          />
        )}

        <div className="mt-5 grid gap-6 px-3.5 lg:grid-cols-2 lg:px-0">
          <div className="rounded-2xl bg-surface px-4 shadow-card">
            <button type="button" onClick={() => setDetailsExpanded((v) => !v)} aria-expanded={detailsExpanded} className="flex w-full items-center gap-3 py-4 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="document-text-outline" size={19} color={colors.primaryDark} />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-1.5 text-base font-bold text-ink">
                  {Noun} Details
                  <BlinkingEyeIcon size={16} />
                </span>
                <span className="mt-0.5 block text-xs text-muted">View {isTournament ? "complete tournament information" : "complete game information"}</span>
              </span>
              <Ionicon name={detailsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </button>
            {detailsExpanded && (
              <div className="border-t border-border pb-1">
                {(isCreator || hasJoined || isTeamMember) && (
                  <InfoRow
                    icon="pricetag-outline"
                    label={`${Noun} ID`}
                    value={game.game_code}
                    action={
                      <button type="button" onClick={copyCode} className={`flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium ${codeCopied ? "text-primary" : "text-muted"}`}>
                        <Ionicon name={codeCopied ? "checkmark" : "copy-outline"} size={14} color={codeCopied ? colors.primary : colors.muted} />
                        {codeCopied ? "Copied" : "Copy"}
                      </button>
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
                    <InfoRow icon="calendar-outline" label="Date" value={formatDateFull(game.game_date)} badge={{ label: dayLabel(game.game_date), color: timeBadgeColor(game.start_time) }} />
                    <InfoRow icon="time-outline" label="Time" value={`${formatTime(game.game_date, game.start_time)} – ${formatTime(game.game_date, game.end_time)}`} />
                  </>
                )}
                {(game.venues || game.custom_venue_name) && (
                  <InfoRow icon="location-outline" label="Venue" value={game.venues ? `${game.venues.name}${game.venues.city ? `, ${game.venues.city}` : ""}` : (game.custom_venue_name as string)} />
                )}
                <InfoRow icon="speedometer-outline" label="Skill Level" value={skillLabel} pillColor={skillColor} />
                <InfoRow icon="people-outline" label="Open To" value={genderLabel} pillColor={genderColor} />
                {!isTeamBased && <InfoRow icon="person-outline" label="Team Size" value={`${Math.floor(game.max_players / 2)} players per team (2 teams)`} />}
                <InfoRow
                  icon="cash-outline"
                  label={isTournament ? "Entry Fee Per Team" : "Entry Fee Per Person"}
                  value={game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()} (pay at venue)` : "Free"}
                  pillColor={game.entry_fee > 0 ? undefined : colors.primary}
                  divider={false}
                />
              </div>
            )}
          </div>

          {!!game.description && (
            <div className="flex items-center gap-3 self-start rounded-2xl bg-surface p-4 shadow-card">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="megaphone-outline" size={19} color={colors.primaryDark} />
              </span>
              <div className="flex-1">
                <p className="mb-1 text-base font-bold text-ink">About this {noun}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{game.description}</p>
              </div>
            </div>
          )}
        </div>

        {isTeamBased ? (
          <div className="lg:mt-2">
            <TournamentTeamsSection game={game} isGameHost={isCreator} />
          </div>
        ) : (
          <>
            <section className="mt-6 px-3.5 lg:px-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">
                  Players ({joined.length}/{game.max_players})
                </h2>
                {emptySlots > 0 ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-primary">
                    {emptySlots} spot{emptySlots !== 1 ? "s" : ""} left
                  </span>
                ) : (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Full</span>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {emptySlots > 0 && !isCancelled && !hasEnded && (
                  <button type="button" onClick={() => setModal("squadFill")} className="flex-1 rounded-lg border border-primary py-2 text-xs font-semibold text-primary hover:bg-primary-light">
                    Fill Open Spots With My Squad
                  </button>
                )}
                {isCreator && emptySlots > 0 && !isCancelled && !hasEnded && (
                  <button type="button" onClick={() => setModal("manual")} className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-muted hover:bg-gray-50">
                    Add Player Manually
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {joined.map((p) => (
                  <PlayerAvatar
                    key={p.id}
                    name={p.profiles?.full_name ?? p.manual_name ?? null}
                    avatar={p.profiles?.avatar ?? null}
                    isManual={!p.user_id}
                    isCreator={!!p.user_id && hostIds.includes(p.user_id)}
                    onRemove={
                      isCreator && (!p.user_id || !hostIds.includes(p.user_id)) && !approving
                        ? () =>
                            confirm(
                              "Remove Player",
                              `Remove ${p.profiles?.full_name ?? p.manual_name ?? "this player"} from the game? They won't be able to rejoin without sending a new request.`,
                              "Cancel",
                              "Remove",
                              () => removePlayer.mutate(p.id, { onError: err("Could not remove player.") })
                            )
                        : undefined
                    }
                    onPressAvatar={p.user_id ? () => navigate(paths.player(p.user_id as string)) : undefined}
                  />
                ))}
                {Array.from({ length: Math.min(emptySlots, 8) }).map((_, i) => (
                  <div key={`e${i}`} className="flex w-16 flex-col items-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border">
                      <Ionicon name="add" size={20} color={colors.border} />
                    </span>
                    <span className="mt-1 text-xs text-border">Open</span>
                  </div>
                ))}
              </div>
            </section>

            {isCreator && pending.length > 0 && (
              <section className="mt-6 px-3.5 lg:px-0">
                <h2 className="mb-1 text-sm font-semibold text-ink">Join Requests ({pending.length})</h2>
                <p className="mb-2 text-xs text-muted">Approve players before they're added to the game.</p>
                {pending.map((p) => {
                  const name = p.profiles?.full_name ?? null;
                  const skill = p.skill_level ? p.skill_level.charAt(0).toUpperCase() + p.skill_level.slice(1) : "Not specified";
                  return (
                    <div key={p.id} className="flex items-center gap-3 border-b border-border py-3">
                      <button type="button" onClick={() => p.user_id && navigate(paths.player(p.user_id))} disabled={!p.user_id}>
                        <Avatar url={p.profiles?.avatar} name={name} size={40} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{name ?? "Player"}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {skill} · {p.location ?? "Location not specified"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={approving}
                        onClick={() => confirm("Reject Request", `Reject ${name ?? "this player"}'s request to join?`, "Cancel", "Reject", () => rejectPlayer.mutate(p.id, { onError: err("Could not reject request.") }))}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-gray-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={approving || isFull || isCancelled || hasEnded}
                        onClick={() => approvePlayer.mutate(p.id, { onError: err(`Could not approve ${name ?? "player"}.`) })}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                  );
                })}
                {isFull && <p className="mt-2 text-xs text-orange-600">Game is full — reject remaining requests or remove a player to approve more.</p>}
                {!isFull && (isCancelled || hasEnded) && <p className="mt-2 text-xs text-orange-600">This game has ended — you can no longer approve new players, but you can still reject requests.</p>}
              </section>
            )}
          </>
        )}

        <div className="mt-6 flex items-center gap-3 px-3.5 lg:px-0">
          <div className="flex items-center gap-1.5">
            {hosts.map((host) => (
              <button key={host.id} type="button" onClick={() => navigate(paths.player(host.id))} aria-label={host.full_name ?? "Host"}>
                <Avatar url={host.avatar} name={host.full_name} size={40} />
              </button>
            ))}
          </div>
          <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold text-ink">
            <span className="text-muted">Hosted by: </span>
            {hosts.map((h) => h.full_name ?? "Unknown").join(", ") || "Unknown"}
          </p>
        </div>

        {isCreator && isOpen && (showBookVenue || !isVenueBooked) && (
          <div className="mt-4 px-3.5 lg:max-w-md lg:px-0">
            {cancelGame.isPending ? (
              <div className="flex justify-center">
                <Spinner />
              </div>
            ) : (
              <>
                {showBookVenue && (
                  <button
                    type="button"
                    disabled={isVenueBooked}
                    onClick={() => !isVenueBooked && navigate(paths.venue(game.venue_id!, { forGameId: game.id }))}
                    className={`mb-3 w-full rounded-xl py-4 text-base font-semibold ${isVenueBooked ? "bg-gray-100 text-muted" : "press bg-brand text-white shadow-cta"}`}
                  >
                    {isVenueBooked ? "Venue Booked" : "Book Venue"}
                  </button>
                )}
                {!isVenueBooked && (
                  <button
                    type="button"
                    onClick={() =>
                      confirm(`Cancel ${Noun}`, `This will cancel the ${noun} for all ${isTournament ? "teams" : "players"}. This cannot be undone.`, "Keep", `Cancel ${Noun}`, () =>
                        cancelGame.mutate(game.id, { onSuccess: goBack, onError: err("Could not cancel.") })
                      )
                    }
                    className="w-full rounded-xl border border-danger py-4 font-semibold text-danger hover:bg-red-50"
                  >
                    Cancel This {Noun}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showsBottomBar && (
        <StickyActionBar>
          {busy ? (
            <div className="flex justify-center py-2">
              <Spinner />
            </div>
          ) : hasJoined ? (
            <button
              type="button"
              onClick={() => userId && confirm("Leave Game", "Are you sure you want to leave?", "Stay", "Leave", () => leaveGame.mutate({ gameId: game.id, userId }, { onError: err("Could not leave. Try again.") }))}
              className="w-full rounded-xl border border-danger py-4 font-semibold text-danger hover:bg-red-50"
            >
              Leave Game
            </button>
          ) : hasRequested ? (
            <div className="flex flex-col gap-2">
              <p className="rounded-xl bg-orange-50 py-3 text-center font-semibold text-orange-600">Request Sent — Awaiting Host Approval</p>
              <button
                type="button"
                onClick={() =>
                  userId &&
                  confirm("Cancel Request", "Withdraw your request to join this game?", "Keep Request", "Withdraw", () =>
                    leaveGame.mutate({ gameId: game.id, userId }, { onError: err("Could not withdraw. Try again.") })
                  )
                }
                className="w-full rounded-xl border border-danger py-3 font-semibold text-danger hover:bg-red-50"
              >
                Cancel Request
              </button>
            </div>
          ) : isFull ? (
            <p className="rounded-xl bg-gray-100 py-4 text-center font-semibold text-muted">Game is Full</p>
          ) : (
            <button type="button" onClick={() => setModal("join")} className="press w-full rounded-xl bg-brand py-4 text-base font-semibold text-white shadow-cta">
              {game.entry_fee > 0 ? `Request to Join · Rs ${game.entry_fee.toLocaleString()}` : "Request to Join"}
            </button>
          )}
        </StickyActionBar>
      )}

      <JoinRequestModal
        open={modal === "join"}
        onClose={() => setModal(null)}
        submitting={joinGame.isPending}
        title="Request to Join"
        subtitle={joinSubtitle}
        onSubmit={(skillLevel, location) =>
          userId && joinGame.mutate({ gameId: game.id, userId, skillLevel, location }, { onSuccess: () => setModal(null), onError: err("Could not send request. Try again.") })
        }
      />
      {!isTeamBased && (
        <>
          <InviteUsersModal
            open={modal === "invite"}
            onClose={() => setModal(null)}
            title={`Invite Players · ${game.title}`}
            excludeIds={[...hostIds, ...game.game_players.map((p) => p.user_id).filter((id): id is string => !!id)]}
            onInvite={async (user) => {
              if (!userId) return;
              await createInvite.mutateAsync({ invitedUserId: user.id, invitedBy: userId });
            }}
          />
          <SquadFillModal
            open={modal === "squadFill"}
            onClose={() => setModal(null)}
            userId={userId}
            requiredCount={emptySlots}
            submitting={squadFillSlots.isPending}
            title="Fill Open Spots With Your Squad"
            onSubmit={(squadId, memberUserIds) => squadFillSlots.mutate({ squadId, memberUserIds }, { onSuccess: () => setModal(null), onError: err("Could not join the game.") })}
          />
        </>
      )}
      {isCreator && !isTeamBased && (
        <>
          <AddManualMemberModal
            open={modal === "manual"}
            onClose={() => setModal(null)}
            submitting={addingManual}
            maxPlayers={emptySlots}
            onSubmit={async (names) => {
              // No bulk insert: add one by one and report partial success.
              setAddingManual(true);
              let added = 0;
              try {
                for (const name of names) {
                  await addManualPlayer.mutateAsync(name);
                  added++;
                }
                setModal(null);
              } catch (e) {
                if (added > 0) {
                  Alert.alert("Some Players Weren't Added", `Added ${added} of ${names.length} player(s). ${getFriendlyErrorMessage(e, "Could not add the rest.")}`);
                  setModal(null);
                } else Alert.alert("Error", getFriendlyErrorMessage(e, "Could not add the player(s)."));
              } finally {
                setAddingManual(false);
              }
            }}
          />
          <InviteSquadModal
            open={modal === "inviteSquad"}
            onClose={() => setModal(null)}
            submitting={sendSquadInvite.isPending}
            alreadyInvitedSquadIds={(squadInvites ?? []).map((i) => i.squad_id)}
            onInvite={(squadId, squadName) =>
              userId &&
              sendSquadInvite.mutate({ squadId, invitedBy: userId }, { onSuccess: () => Alert.alert("Invited", `Invite sent to "${squadName}".`), onError: err("Could not send invite.") })
            }
          />
        </>
      )}
    </div>
  );
}
