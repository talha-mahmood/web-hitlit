import { useState } from "react";
import { useParams } from "react-router";
import { colors } from "@app/constants/theme";
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
} from "@app/hooks/useSquads";
import { useSquadChatUnreadCount } from "@app/hooks/useSquadMessages";
import { usePendingSquadInvites, useRespondToSquadInvite } from "@app/hooks/useSquadTeamFill";
import { useMyPendingSquadInvite, useCreateSquadInvite, useAcceptSquadInvite, useDeclineSquadInvite } from "@app/hooks/useInvites";
import { useDismissedInvites } from "@app/lib/useDismissedInvites";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { SQUAD_SKILL_COLORS } from "@app/lib/badgeColors";
import { getSportIcon } from "@app/lib/sportIcons";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { BlinkingEyeIcon, ChatIcon, WaveDivider } from "@/components/ui/Decor";
import { StickyActionBar } from "@/components/booking/BookingParts";
import { JoinRequestModal } from "@/components/games/JoinSheets";
import { InviteUsersModal } from "@/components/games/GameModals";
import { InfoRow, InviteBanner } from "@/components/games/DetailParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import { classifySportKind } from "@app/lib/genericSportStats";
import { AddMemberByIdModal } from "@/components/squads/AddMemberById";
import {
  SquadTeamTabBar,
  SquadTeamOverview,
  SquadTeamPlayers,
  SquadTeamMatches,
  SquadTeamTournaments,
  SquadTeamStatistics,
  SquadTeamCompare,
  type SquadTeamTab,
} from "@/components/squads/SquadTeamTabs";

function skillLabel(skill: string | null): string {
  if (!skill) return "Any Level";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

function MemberAvatar({ name, avatar, isOwner, isHost, onOpenMenu, onPressAvatar }: { name: string | null; avatar: string | null; isOwner: boolean; isHost?: boolean; onOpenMenu?: () => void; onPressAvatar?: () => void }) {
  return (
    <div className="flex w-16 flex-col items-center">
      <div className="relative">
        <button type="button" onClick={onPressAvatar} disabled={!onPressAvatar} aria-label={name ?? "Member"}>
          <Avatar url={avatar} name={name} size={48} />
        </button>
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label={`Manage ${name ?? "member"}`}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface shadow-[0_2px_3px_rgba(15,23,42,0.12)] hover:bg-gray-50"
          >
            <Ionicon name="ellipsis-vertical" size={11} color={colors.ink} />
          </button>
        )}
      </div>
      {isOwner ? (
        <span className="mt-1 rounded-full bg-brand px-1.5 py-0.5 text-xs font-medium text-white">Captain</span>
      ) : isHost ? (
        <span className="mt-1 rounded-full bg-brand px-1.5 py-0.5 text-xs font-medium text-white">Host</span>
      ) : null}
      <span className="mt-1 w-full truncate text-center text-xs text-muted">{(name ?? "Member").split(" ")[0]}</span>
    </div>
  );
}

// The owner/host's "Block New Users" toggle glyph: a person with a small
// ban badge (red while open, green once blocked).
function BlockGlyph({ blocked }: { blocked: boolean }) {
  const tone = blocked ? colors.primary : colors.danger;
  return (
    <span className="relative inline-block h-[13px] w-[13px]">
      <Ionicon name="person" size={13} color={tone} />
      <span className={`absolute -bottom-[3px] -right-[3px] flex h-[9px] w-[9px] items-center justify-center rounded-full border border-white ${blocked ? "bg-brand" : "bg-danger"}`}>
        <Ionicon name="ban" size={6} color="white" />
      </span>
    </span>
  );
}

// Port of SquadDetailScreen: hero (sport pill, Block/Unblock New Users,
// Full, chat), invite banner, collapsible Group Details, About, members
// (Captain/Host badges, manage menu, open slots), game invites and join
// requests for the captain/hosts, Captained by, Delete / Leave, and the
// non-member's Request to Join / Cancel Request bar.
export default function SquadDetailPage() {
  const { squadId = "" } = useParams();
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.squads);
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [codeCopied, setCodeCopied] = useState(false);
  const [modal, setModal] = useState<null | "join" | "invite" | "addById">(null);
  const [teamTab, setTeamTab] = useState<SquadTeamTab>("detail");
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const { data: squad, isLoading, error } = useSquadDetail(squadId);
  const { data: chatUnreadCount } = useSquadChatUnreadCount(squad?.id, userId);
  const joinSquad = useJoinSquad();
  const leaveSquad = useLeaveSquad();
  const disbandSquad = useDisbandSquad();
  const approveMember = useApproveMember(squadId);
  const rejectMember = useRejectMember(squadId);
  const removeMember = useRemoveMember(squadId);
  const setMemberHost = useSetMemberHost(squadId);
  const setJoinBlocked = useSetSquadJoinBlocked();
  const { data: mySquadInvite } = useMyPendingSquadInvite(squadId, userId);
  const { isDismissed, dismiss } = useDismissedInvites();
  const createInvite = useCreateSquadInvite(squadId);
  const acceptInvite = useAcceptSquadInvite(squadId);
  const declineInvite = useDeclineSquadInvite(squadId);
  const { data: gameInvites } = usePendingSquadInvites(squadId);
  const respondToGameInvite = useRespondToSquadInvite(squadId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 lg:px-8 lg:pt-6">
        <SkeletonDetailHeader />
      </div>
    );
  }
  if (error || !squad) {
    return (
      <div className="flex flex-col items-center px-6 pt-32 text-center">
        <p className="mb-2 text-base font-semibold text-ink">Squad not found</p>
        <button type="button" onClick={goBack} className="font-medium text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const activeMembers = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const emptySlots = squad.max_players ? Math.max(0, squad.max_players - activeMembers.length) : 0;
  const isFull = !!squad.max_players && activeMembers.length >= squad.max_players;
  const isClosedToJoins = isFull || squad.join_requests_blocked;
  const isOwner = squad.squad_owner_id === userId;
  const myMemberRecord = userId ? squad.squad_members.find((m) => m.user_id === userId && m.status === "ACTIVE") : null;
  const isHost = myMemberRecord?.role === "host";
  const canManage = isOwner || isHost;
  const hasJoined = !!myMemberRecord;
  const hasRequested = !!userId && squad.squad_members.some((m) => m.user_id === userId && m.status === "PENDING");
  const isGenderRestricted = squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;
  const pendingRequests = squad.squad_members.filter((m) => m.status === "PENDING");
  const isBusy = joinSquad.isPending || leaveSquad.isPending || disbandSquad.isPending;
  const isApprovingOrRejecting = approveMember.isPending || rejectMember.isPending || removeMember.isPending;
  const squadSkillColor = squad.skill_level ? SQUAD_SKILL_COLORS[squad.skill_level] : colors.muted;
  const genderLabel = squad.gender === "male" ? "Male Only" : squad.gender === "female" ? "Female Only" : "Everyone";
  const genderPillColor = squad.gender === "male" ? "#2563EB" : squad.gender === "female" ? "#EC4899" : colors.primary;
  const sportIcon = squad.sports?.name ? getSportIcon(squad.sports.name) : null;
  // A team-type squad gains the tab suite; other types render as before.
  const isTeamGroup = squad.group_type === "team";
  const teamSportKind = isTeamGroup ? classifySportKind(squad.sports?.name) : null;
  const err = (fallback: string) => (e: unknown) => Alert.alert("Error", getFriendlyErrorMessage(e, fallback));
  const confirm = (title: string, message: string, cancel: string, ok: string, run: () => void, destructive = true) =>
    Alert.alert(title, message, [
      { text: cancel, style: "cancel" },
      { text: ok, style: destructive ? "destructive" : "default", onPress: run },
    ]);

  const toggleJoinBlocked = () => {
    const next = !squad.join_requests_blocked;
    confirm(
      next ? "Block New Join Requests?" : "Unblock New Join Requests?",
      next ? "No one will be able to request to join this squad until you unblock it." : "Players will be able to request to join this squad again.",
      "Cancel",
      next ? "Block" : "Unblock",
      () => setJoinBlocked.mutate({ squadId: squad.id, blocked: next }, { onError: err("Could not update this setting. Try again.") }),
      next
    );
  };

  const remove = (id: string, name: string | null) =>
    confirm("Remove Member", `Remove ${name ?? "this member"} from the squad? They won't be able to rejoin without sending a new request.`, "Cancel", "Remove", () =>
      removeMember.mutate(id, { onError: err("Could not remove member.") })
    );

  const manageHost = (id: string, name: string | null, currentlyHost: boolean) => {
    const label = name ?? "this member";
    confirm(
      currentlyHost ? "Remove as Host?" : "Make Squad Host?",
      currentlyHost ? `${label} will lose host privileges and go back to being a regular member.` : `${label} will be able to manage members, edit the squad, and everything else a host can do.`,
      "Cancel",
      currentlyHost ? "Remove Host" : "Make Host",
      () => setMemberHost.mutate({ squadMemberId: id, isHost: !currentlyHost }, { onError: err("Could not update host status.") }),
      currentlyHost
    );
  };

  const openMemberMenu = (id: string, name: string | null, currentlyHost: boolean) =>
    Alert.alert(name ?? "Member", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: currentlyHost ? "Remove as Host" : "Make Squad Host", onPress: () => manageHost(id, name, currentlyHost) },
      { text: "Remove Member", style: "destructive", onPress: () => remove(id, name) },
    ]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(squad.squad_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // clipboard blocked — the code is on screen
    }
  };

  return (
    <div className="mx-auto max-w-5xl lg:px-8 lg:pt-6">
      <div className="relative">
        <header className="relative overflow-hidden bg-brand px-4 pb-7 pt-[calc(env(safe-area-inset-top)+10px)] lg:rounded-t-[28px] lg:px-10 lg:pb-12 lg:pt-8">
          {sportIcon && <MCIcon name={sportIcon.icon} size={84} color="white" className="pointer-events-none absolute -bottom-2.5 -right-3.5 opacity-[0.14]" style={{ transform: "rotate(-10deg)" }} />}
          <div className="flex items-center">
            <button type="button" onClick={goBack} aria-label="Back" className="mr-3 flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/30 bg-white/[0.16] hover:bg-white/25">
              <Ionicon name="arrow-back" size={20} color="white" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold text-white sm:text-2xl lg:text-[32px] lg:tracking-tight">{squad.name}</h1>
            {(isOwner || hasJoined) && (
              <button
                type="button"
                aria-label="Open squad chat"
                onClick={() => navigate(paths.squadChat(squad.id), { state: { squadName: squad.name } })}
                className="ml-3 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
              >
                <ChatIcon size={23} unreadCount={chatUnreadCount} />
              </button>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {sportIcon && squad.sports?.name && (
              <span className="flex items-center gap-[5px] rounded-full bg-surface px-2.5 py-[5px] text-xs font-bold" style={{ color: sportIcon.fg }}>
                <MCIcon name={sportIcon.icon} size={13} color={sportIcon.fg} />
                {squad.sports.name}
              </span>
            )}
            {canManage && (
              <button
                type="button"
                onClick={toggleJoinBlocked}
                disabled={setJoinBlocked.isPending}
                className="flex items-center gap-[5px] rounded-full bg-surface px-2.5 py-[5px] text-xs font-bold hover:bg-gray-50"
                style={{ color: squad.join_requests_blocked ? colors.primary : colors.danger }}
              >
                {setJoinBlocked.isPending ? (
                  <Spinner size={14} color={squad.join_requests_blocked ? colors.primary : colors.danger} />
                ) : (
                  <>
                    <BlockGlyph blocked={squad.join_requests_blocked} />
                    {squad.join_requests_blocked ? "Unblock New Users" : "Block New Users"}
                  </>
                )}
              </button>
            )}
            {isClosedToJoins && <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-orange-600">Full</span>}
          </div>
        </header>
        <WaveDivider color={colors.background} height={22} />
      </div>

      {isTeamGroup && <SquadTeamTabBar value={teamTab} onChange={setTeamTab} showStatistics={teamSportKind === "cricket"} />}

      {isTeamGroup && teamTab !== "detail" && (
        <div className="px-5 pb-12 lg:px-0">
          {teamTab === "overview" && <SquadTeamOverview squad={squad} />}
          {teamTab === "players" && <SquadTeamPlayers squad={squad} isCricket={teamSportKind === "cricket"} />}
          {teamTab === "matches" && <SquadTeamMatches squad={squad} />}
          {teamTab === "tournaments" && <SquadTeamTournaments squad={squad} />}
          {teamTab === "statistics" && teamSportKind === "cricket" && <SquadTeamStatistics squad={squad} />}
          {teamTab === "compare" && <SquadTeamCompare squad={squad} />}
        </div>
      )}

      {(!isTeamGroup || teamTab === "detail") && (
      <>
      <div className={hasJoined ? "pb-10" : "pb-4"}>
        {mySquadInvite && !isDismissed(mySquadInvite.id) && (
          <InviteBanner
            text={`${mySquadInvite.profiles?.full_name ?? "The owner"} invited you to this squad`}
            sub="Accept to join instantly — no approval needed."
            onDismiss={() => dismiss(mySquadInvite.id)}
            busy={declineInvite.isPending || acceptInvite.isPending}
            accepting={acceptInvite.isPending}
            onAccept={() => acceptInvite.mutate(mySquadInvite.id, { onError: err("Could not accept invite.") })}
            onDecline={() => confirm("Decline Invite", `Decline the invite to "${squad.name}"?`, "Cancel", "Decline", () => declineInvite.mutate(mySquadInvite.id, { onError: err("Could not decline invite.") }))}
          />
        )}

        <div className="mt-5 grid gap-6 px-3.5 lg:grid-cols-2 lg:px-0">
          <div className="self-start rounded-2xl bg-surface px-4 shadow-card">
            <button type="button" onClick={() => setDetailsExpanded((v) => !v)} aria-expanded={detailsExpanded} className="flex w-full items-center gap-3 py-4 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="document-text-outline" size={19} color={colors.primaryDark} />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-1.5 text-base font-bold text-ink">
                  Squad Details
                  <BlinkingEyeIcon size={16} />
                </span>
                <span className="mt-0.5 block text-xs text-muted">View complete squad information</span>
              </span>
              <Ionicon name={detailsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </button>
            {detailsExpanded && (
              <div className="border-t border-border pb-1">
                {(isOwner || hasJoined) && (
                  <InfoRow
                    icon="pricetag-outline"
                    label="Squad ID"
                    value={squad.squad_code}
                    action={
                      <button type="button" onClick={copyCode} className={`flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium ${codeCopied ? "text-primary" : "text-muted"}`}>
                        <Ionicon name={codeCopied ? "checkmark" : "copy-outline"} size={14} color={codeCopied ? colors.primary : colors.muted} />
                        {codeCopied ? "Copied" : "Copy"}
                      </button>
                    }
                  />
                )}
                {squad.sports && <InfoRow icon="football-outline" label="Sport" value={squad.sports.name} />}
                <InfoRow icon="speedometer-outline" label="Skill Level" value={skillLabel(squad.skill_level)} pillColor={squadSkillColor} />
                <InfoRow icon="location-outline" label="Location" value={squad.location ?? "Not set"} />
                <InfoRow icon="people-outline" label="Open To" value={genderLabel} pillColor={genderPillColor} divider={false} />
              </div>
            )}
          </div>

          {!!squad.description && (
            <div className="flex items-center gap-3 self-start rounded-2xl bg-surface p-4 shadow-card">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="megaphone-outline" size={19} color={colors.primaryDark} />
              </span>
              <div className="flex-1">
                <p className="mb-1 text-base font-bold text-ink">About this squad</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{squad.description}</p>
              </div>
            </div>
          )}
        </div>

        <section className="mt-6 px-3.5 lg:px-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              Members ({activeMembers.length}
              {squad.max_players ? `/${squad.max_players}` : ""})
            </h2>
            {!!squad.max_players &&
              (emptySlots > 0 ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-primary">
                  {emptySlots} spot{emptySlots !== 1 ? "s" : ""} left
                </span>
              ) : (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Full</span>
              ))}
          </div>
          {(canManage || isOwner || hasJoined) && (
            <div className="mb-3 flex items-center justify-end gap-2">
              {canManage && (
                <button type="button" onClick={() => setModal("addById")} className="flex items-center gap-[5px] rounded-full border border-primary px-3 py-[9px] text-xs font-bold text-primary hover:bg-primary-light">
                  <Ionicon name="key-outline" size={14} color={colors.primary} />
                  Add by ID
                </button>
              )}
              {(isOwner || hasJoined) && (
                <button type="button" onClick={() => setModal("invite")} className="press flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-cta">
                  <Ionicon name="person-add-outline" size={16} color="white" />
                  Invite Players
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {activeMembers.map((m) => {
              const rowIsOwner = m.user_id === squad.squad_owner_id;
              const name = m.profiles?.full_name ?? null;
              return (
                <MemberAvatar
                  key={m.id}
                  name={name}
                  avatar={m.profiles?.avatar ?? null}
                  isOwner={rowIsOwner}
                  isHost={m.role === "host"}
                  onOpenMenu={canManage && !rowIsOwner && !isApprovingOrRejecting ? () => openMemberMenu(m.id, name, m.role === "host") : undefined}
                  onPressAvatar={() => navigate(paths.player(m.user_id))}
                />
              );
            })}
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

        {canManage && (gameInvites?.length ?? 0) > 0 && (
          <section className="mt-6 px-3.5 lg:px-0">
            <h2 className="mb-1 text-sm font-semibold text-ink">Game Invites ({gameInvites!.length})</h2>
            <p className="mb-2 text-xs text-muted">A host invited your squad to join their game or tournament.</p>
            {gameInvites!.map((invite) => (
              <div key={invite.id} className="mb-2 flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{invite.games?.title ?? "Game"}</p>
                  <p className="mt-0.5 text-xs text-muted">{invite.games?.game_type === "TOURNAMENT" ? "Tournament" : "Game"}</p>
                </div>
                <button
                  type="button"
                  disabled={respondToGameInvite.isPending}
                  onClick={() => respondToGameInvite.mutate({ inviteId: invite.id, accept: false }, { onError: err("Could not respond to invite.") })}
                  className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-muted hover:bg-gray-200"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={respondToGameInvite.isPending}
                  onClick={() => respondToGameInvite.mutate({ inviteId: invite.id, accept: true }, { onError: err("Could not respond to invite.") })}
                  className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-cta"
                >
                  Accept
                </button>
              </div>
            ))}
          </section>
        )}

        {canManage && pendingRequests.length > 0 && (
          <section className="mt-6 px-3.5 lg:px-0">
            <h2 className="mb-1 text-sm font-semibold text-ink">Join Requests ({pendingRequests.length})</h2>
            <p className="mb-2 text-xs text-muted">Approve members before they're added to the squad.</p>
            {pendingRequests.map((m) => {
              const name = m.profiles?.full_name ?? null;
              const disabled = isApprovingOrRejecting || isFull;
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-border py-3">
                  <button type="button" onClick={() => navigate(paths.player(m.user_id))} aria-label={name ?? "Player"}>
                    <Avatar url={m.profiles?.avatar} name={name} size={40} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{name ?? "Player"}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {skillLabel(m.skill_level ?? m.profiles?.skill_level ?? null)} · {m.location ?? m.profiles?.city ?? "Location not set"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => confirm("Reject Request", `Reject ${name ?? "this player"}'s request to join?`, "Cancel", "Reject", () => rejectMember.mutate(m.id, { onError: err("Could not reject request.") }))}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => approveMember.mutate(m.id, { onError: err(`Could not approve ${name ?? "member"}.`) })}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              );
            })}
            {isFull && <p className="mt-2 text-xs text-orange-600">Squad is full — reject remaining requests or remove a member to approve more.</p>}
          </section>
        )}

        <div className="mt-6 flex items-center gap-3 px-3.5 lg:px-0">
          <button type="button" onClick={() => squad.profiles?.id && navigate(paths.player(squad.profiles.id))} disabled={!squad.profiles?.id} aria-label={squad.profiles?.full_name ?? "Captain"}>
            <Avatar url={squad.profiles?.avatar} name={squad.profiles?.full_name} size={40} />
          </button>
          <div>
            <p className="text-xs text-muted">Captained by</p>
            <p className="text-sm font-semibold text-ink">{squad.profiles?.full_name ?? "Unknown"}</p>
          </div>
        </div>

        {(canManage || (hasJoined && !isOwner)) && (
          <div className="mt-4 flex flex-col gap-2 px-3.5 lg:max-w-md lg:px-0">
            {canManage &&
              (disbandSquad.isPending ? (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    confirm("Disband Squad", "This will permanently disband the squad for everyone. This cannot be undone.", "Keep", "Disband", () =>
                      disbandSquad.mutate(squad.id, { onSuccess: goBack, onError: err("Could not disband.") })
                    )
                  }
                  className="w-full rounded-xl border border-danger py-4 font-semibold text-danger hover:bg-red-50"
                >
                  Delete This Squad
                </button>
              ))}
            {hasJoined &&
              !isOwner &&
              (leaveSquad.isPending ? (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    userId && confirm("Leave Squad", "Are you sure you want to leave?", "Stay", "Leave", () => leaveSquad.mutate({ squadId: squad.id, userId }, { onError: err("Could not leave. Try again.") }))
                  }
                  className="w-full rounded-xl border border-danger py-4 font-semibold text-danger hover:bg-red-50"
                >
                  Leave Squad
                </button>
              ))}
          </div>
        )}
      </div>

      {!hasJoined && (
        <StickyActionBar>
          {isBusy ? (
            <div className="flex justify-center py-2">
              <Spinner />
            </div>
          ) : hasRequested ? (
            <div className="flex flex-col gap-2">
              <p className="rounded-xl bg-orange-50 py-3 text-center font-semibold text-orange-600">Request Sent — Awaiting Captain Approval</p>
              <button
                type="button"
                onClick={() =>
                  userId &&
                  confirm("Cancel Request", "Withdraw your request to join this squad?", "Keep Request", "Withdraw", () =>
                    leaveSquad.mutate({ squadId: squad.id, userId }, { onError: err("Could not withdraw. Try again.") })
                  )
                }
                className="w-full rounded-xl border border-danger py-3 font-semibold text-danger hover:bg-red-50"
              >
                Cancel Request
              </button>
            </div>
          ) : isClosedToJoins ? (
            <p className="rounded-xl bg-gray-100 py-4 text-center font-semibold text-muted">Squad is Full</p>
          ) : isGenderRestricted ? (
            <p className="rounded-xl bg-gray-100 px-6 py-4 text-center font-semibold text-muted">
              This squad is open to {squad.gender === "male" ? "male" : "female"} players only, so you can't request to join.
            </p>
          ) : (
            <button type="button" onClick={() => userId && setModal("join")} className="press w-full rounded-xl bg-brand py-4 text-base font-semibold text-white shadow-cta">
              Request to Join
            </button>
          )}
        </StickyActionBar>
      )}
      </>
      )}

      <JoinRequestModal
        open={modal === "join"}
        onClose={() => setModal(null)}
        submitting={joinSquad.isPending}
        title="Request to Join"
        subtitle="The captain must approve your request before you're added."
        onSubmit={(skillLevel, location) =>
          userId && joinSquad.mutate({ squadId: squad.id, userId, skillLevel, location }, { onSuccess: () => setModal(null), onError: err("Could not send request. Try again.") })
        }
      />
      <AddMemberByIdModal
        open={modal === "addById"}
        onClose={() => setModal(null)}
        squadId={squad.id}
        excludeUserIds={[squad.squad_owner_id, ...squad.squad_members.map((m) => m.user_id)]}
        disabledReason={isFull ? "This squad is full." : undefined}
      />
      <InviteUsersModal
        open={modal === "invite"}
        onClose={() => setModal(null)}
        title={`Invite Players · ${squad.name}`}
        excludeIds={[squad.squad_owner_id, ...squad.squad_members.map((m) => m.user_id)]}
        onInvite={async (user) => {
          if (!userId) return;
          await createInvite.mutateAsync({ invitedUserId: user.id, invitedBy: userId });
        }}
      />
    </div>
  );
}
