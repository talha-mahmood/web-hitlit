import { useState } from "react";
import { useParams } from "react-router";
import { colors } from "@app/constants/theme";
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
} from "@app/hooks/useEvents";
import { useEventChatUnreadCount } from "@app/hooks/useEventMessages";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { BlinkingEyeIcon, ChatIcon, WaveDivider } from "@/components/ui/Decor";
import { StickyActionBar } from "@/components/booking/BookingParts";
import { EventJoinRequestModal } from "@/components/games/JoinSheets";
import { BlockGlyph, InfoRow, MemberBubble } from "@/components/games/DetailParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// Port of EventDetailScreen: hero (event type, Block/Unblock New Users,
// Closed, chat), collapsible Event Details, About, members (Host / Co-host
// badges + manage menu), join requests with the requester's location,
// Hosted by, Delete / Leave, and a non-member's Request to Join bar.
export default function EventDetailPage() {
  const { eventId = "" } = useParams();
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.events());
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [codeCopied, setCodeCopied] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const { data: event, isLoading, error } = useEventDetail(eventId);
  const { data: chatUnreadCount } = useEventChatUnreadCount(event?.id, userId);
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();
  const disbandEvent = useDisbandEvent();
  const approveMember = useApproveMember(eventId);
  const rejectMember = useRejectMember(eventId);
  const removeMember = useRemoveMember(eventId);
  const setMemberHost = useSetMemberHost(eventId);
  const setJoinBlocked = useSetEventJoinBlocked();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 lg:px-8">
        <SkeletonDetailHeader />
      </div>
    );
  }
  if (error || !event) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6">
        <p className="mb-2 text-base font-semibold text-ink">Event not found</p>
        <button type="button" onClick={goBack} className="font-medium text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const activeMembers = event.event_members.filter((m) => m.status === "ACTIVE");
  const isClosedToJoins = event.join_requests_blocked;
  const isOwner = event.event_owner_id === userId;
  const myMember = userId ? event.event_members.find((m) => m.user_id === userId && m.status === "ACTIVE") : null;
  const isHost = myMember?.role === "host";
  const canManage = isOwner || isHost;
  const hasJoined = !!myMember;
  const hasRequested = !!(userId && event.event_members.find((m) => m.user_id === userId && m.status === "PENDING"));
  const isGenderRestricted = event.gender !== "mixed" && (!myGender || myGender !== event.gender) && !hasJoined && !hasRequested;
  const pendingRequests = event.event_members.filter((m) => m.status === "PENDING");
  const isBusy = joinEvent.isPending || leaveEvent.isPending || disbandEvent.isPending;
  const isApprovingOrRejecting = approveMember.isPending || rejectMember.isPending || removeMember.isPending;
  const genderLabel = event.gender === "male" ? "Male Only" : event.gender === "female" ? "Female Only" : "Everyone";
  const genderPillColor = event.gender === "male" ? "#2563EB" : event.gender === "female" ? "#EC4899" : colors.primary;
  const err = (fallback: string) => (e: unknown) => Alert.alert("Error", getFriendlyErrorMessage(e, fallback));
  const confirm = (title: string, message: string, cancel: string, ok: string, run: () => void, destructive = true) =>
    Alert.alert(title, message, [
      { text: cancel, style: "cancel" },
      { text: ok, style: destructive ? "destructive" : "default", onPress: run },
    ]);

  const toggleJoinBlocked = () => {
    const next = !event.join_requests_blocked;
    confirm(
      next ? "Block New Join Requests?" : "Unblock New Join Requests?",
      next ? "No one will be able to request to join this event until you unblock it." : "Players will be able to request to join this event again.",
      "Cancel",
      next ? "Block" : "Unblock",
      () => setJoinBlocked.mutate({ eventId: event.id, blocked: next }, { onError: err("Could not update this setting. Try again.") }),
      next
    );
  };
  const manageHost = (id: string, name: string | null, currentlyHost: boolean) => {
    const label = name ?? "this member";
    confirm(
      currentlyHost ? "Remove as Co-host?" : "Make Co-host?",
      currentlyHost ? `${label} will lose co-host privileges and go back to being a regular member.` : `${label} will be able to manage members, edit the event, and everything else a co-host can do.`,
      "Cancel",
      currentlyHost ? "Remove Co-host" : "Make Co-host",
      () => setMemberHost.mutate({ eventMemberId: id, isHost: !currentlyHost }, { onError: err("Could not update co-host status.") }),
      currentlyHost
    );
  };
  const openMemberMenu = (id: string, name: string | null, currentlyHost: boolean) =>
    Alert.alert(name ?? "Member", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: currentlyHost ? "Remove as Co-host" : "Make Co-host", onPress: () => manageHost(id, name, currentlyHost) },
      {
        text: "Remove Member",
        style: "destructive",
        onPress: () =>
          confirm("Remove Member", `Remove ${name ?? "this member"} from the event? They won't be able to rejoin without sending a new request.`, "Cancel", "Remove", () =>
            removeMember.mutate(id, { onError: err("Could not remove member.") })
          ),
      },
    ]);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(event.event_code);
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
          <MCIcon name="calendar-star" size={84} color="white" className="pointer-events-none absolute -bottom-2.5 -right-3.5 opacity-[0.14]" style={{ transform: "rotate(-10deg)" }} />
          <div className="flex items-center">
            <button type="button" onClick={goBack} aria-label="Back" className="mr-3 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/[0.16] hover:bg-white/25">
              <Ionicon name="arrow-back" size={20} color="white" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold text-white sm:text-2xl lg:text-[32px] lg:tracking-tight">{event.name}</h1>
            {(isOwner || hasJoined) && (
              <button
                type="button"
                aria-label="Open event chat"
                onClick={() => navigate(paths.eventChat(event.id), { state: { eventName: event.name } })}
                className="ml-3 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
              >
                <ChatIcon size={23} unreadCount={chatUnreadCount} />
              </button>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-[5px] rounded-full bg-surface px-2.5 py-[5px] text-xs font-bold text-primary">
              <MCIcon name="calendar" size={13} color={colors.primary} />
              {event.event_type}
            </span>
            {canManage && (
              <button
                type="button"
                onClick={toggleJoinBlocked}
                disabled={setJoinBlocked.isPending}
                className="flex items-center gap-[5px] rounded-full bg-surface px-2.5 py-[5px] text-xs font-bold hover:bg-gray-50"
                style={{ color: event.join_requests_blocked ? colors.primary : colors.danger }}
              >
                {setJoinBlocked.isPending ? (
                  <Spinner size={14} color={event.join_requests_blocked ? colors.primary : colors.danger} />
                ) : (
                  <>
                    <BlockGlyph blocked={event.join_requests_blocked} />
                    {event.join_requests_blocked ? "Unblock New Users" : "Block New Users"}
                  </>
                )}
              </button>
            )}
            {isClosedToJoins && <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-orange-600">Closed</span>}
          </div>
        </header>
        <WaveDivider color={colors.background} height={22} />
      </div>

      <div className={hasJoined ? "pb-10" : "pb-4"}>
        <section className="mt-5 px-3.5 lg:px-0">
          <div className="rounded-2xl bg-surface px-4 shadow-card">
            <button type="button" onClick={() => setDetailsExpanded((v) => !v)} aria-expanded={detailsExpanded} className="flex w-full items-center gap-3 py-4 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="document-text-outline" size={19} color={colors.primaryDark} />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-1.5 text-base font-bold text-ink">
                  Event Details
                  <BlinkingEyeIcon size={16} />
                </span>
                <span className="mt-0.5 block text-xs text-muted">View complete event information</span>
              </span>
              <Ionicon name={detailsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </button>
            {detailsExpanded && (
              <div className="border-t border-border pb-1">
                {(isOwner || hasJoined) && (
                  <InfoRow
                    icon="pricetag-outline"
                    label="Event ID"
                    value={event.event_code}
                    action={
                      <button type="button" onClick={copyCode} className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium">
                        <Ionicon name={codeCopied ? "checkmark" : "copy-outline"} size={14} color={codeCopied ? colors.primary : colors.muted} />
                        <span className={codeCopied ? "text-primary" : "text-muted"}>{codeCopied ? "Copied" : "Copy"}</span>
                      </button>
                    }
                  />
                )}
                <InfoRow icon="albums-outline" label="Event Type" value={event.event_type} />
                <InfoRow icon="location-outline" label="Location" value={event.location ?? "Not set"} />
                <InfoRow icon="people-outline" label="Open To" value={genderLabel} pillColor={genderPillColor} divider={false} />
              </div>
            )}
          </div>
        </section>

        {!!event.description && (
          <section className="mt-6 px-3.5 lg:px-0">
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="megaphone-outline" size={19} color={colors.primaryDark} />
              </span>
              <div className="flex-1">
                <p className="mb-1 text-base font-bold text-ink">About this event</p>
                <p className="text-sm leading-relaxed text-muted">{event.description}</p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 px-3.5 lg:px-0">
          <h2 className="mb-3 text-sm font-semibold text-ink">Members ({activeMembers.length})</h2>
          <div className="flex flex-wrap gap-3">
            {activeMembers.map((m) => {
              const rowIsOwner = m.user_id === event.event_owner_id;
              const name = m.profiles?.full_name ?? null;
              return (
                <MemberBubble
                  key={m.id}
                  name={name}
                  avatar={m.profiles?.avatar ?? null}
                  badge={rowIsOwner ? "Host" : m.role === "host" ? "Co-host" : null}
                  onOpenMenu={canManage && !rowIsOwner && !isApprovingOrRejecting ? () => openMemberMenu(m.id, name, m.role === "host") : undefined}
                  onPressAvatar={() => navigate(paths.player(m.user_id))}
                />
              );
            })}
          </div>
        </section>

        {canManage && pendingRequests.length > 0 && (
          <section className="mt-6 px-3.5 lg:px-0">
            <h2 className="mb-1 text-sm font-semibold text-ink">Join Requests ({pendingRequests.length})</h2>
            <p className="mb-2 text-xs text-muted">Approve members before they're added to the event.</p>
            {pendingRequests.map((m) => {
              const name = m.profiles?.full_name ?? null;
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-border py-3">
                  <button type="button" onClick={() => navigate(paths.player(m.user_id))} aria-label={name ?? "Player"}>
                    <Avatar url={m.profiles?.avatar} name={name} size={40} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{name ?? "Player"}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{m.location ?? m.profiles?.city ?? "Location not set"}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isApprovingOrRejecting}
                    onClick={() => confirm("Reject Request", `Reject ${name ?? "this player"}'s request to join?`, "Cancel", "Reject", () => rejectMember.mutate(m.id, { onError: err("Could not reject request.") }))}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                  >
                    Reject
                  </button>
                  <button type="button" disabled={isApprovingOrRejecting} onClick={() => approveMember.mutate(m.id, { onError: err(`Could not approve ${name ?? "member"}.`) })} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
                    Approve
                  </button>
                </div>
              );
            })}
          </section>
        )}

        <section className="mt-6 flex items-center gap-3 px-3.5 lg:px-0">
          <button type="button" onClick={() => event.profiles?.id && navigate(paths.player(event.profiles.id))} disabled={!event.profiles?.id} aria-label="Host profile">
            <Avatar url={event.profiles?.avatar} name={event.profiles?.full_name} size={40} />
          </button>
          <div>
            <p className="text-xs text-muted">Hosted by</p>
            <p className="text-sm font-semibold text-ink">{event.profiles?.full_name ?? "Unknown"}</p>
          </div>
        </section>

        {(canManage || (hasJoined && !isOwner)) && (
          <section className="mt-4 flex flex-col gap-2 px-3.5 lg:px-0">
            {canManage &&
              (disbandEvent.isPending ? (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    confirm("Delete Event", "This will permanently delete the event for everyone. This cannot be undone.", "Keep", "Delete", () =>
                      disbandEvent.mutate(event.id, { onSuccess: () => navigate(paths.events(), { replace: true }), onError: err("Could not delete event.") })
                    )
                  }
                  className="w-full rounded-xl border border-danger py-4 font-semibold text-danger hover:bg-red-50"
                >
                  Delete This Event
                </button>
              ))}
            {hasJoined &&
              !isOwner &&
              (leaveEvent.isPending ? (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => userId && confirm("Leave Event", "Are you sure you want to leave?", "Stay", "Leave", () => leaveEvent.mutate({ eventId: event.id, userId }, { onError: err("Could not leave. Try again.") }))}
                  className="w-full rounded-xl border border-danger py-4 font-semibold text-danger hover:bg-red-50"
                >
                  Leave Event
                </button>
              ))}
          </section>
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
              <p className="rounded-xl bg-orange-50 py-3 text-center font-semibold text-orange-600">Request Sent — Awaiting Host Approval</p>
              <button
                type="button"
                onClick={() => userId && confirm("Cancel Request", "Withdraw your request to join this event?", "Keep Request", "Withdraw", () => leaveEvent.mutate({ eventId: event.id, userId }, { onError: err("Could not withdraw. Try again.") }))}
                className="w-full rounded-xl border border-danger py-3 font-semibold text-danger hover:bg-red-50"
              >
                Cancel Request
              </button>
            </div>
          ) : isClosedToJoins ? (
            <p className="rounded-xl bg-gray-100 py-4 text-center font-semibold text-muted">Event is Closed</p>
          ) : isGenderRestricted ? (
            <p className="rounded-xl bg-gray-100 px-6 py-4 text-center font-semibold text-muted">This event is open to {event.gender === "male" ? "male" : "female"} players only, so you can't request to join.</p>
          ) : (
            <button type="button" onClick={() => userId && setJoinOpen(true)} className="press w-full rounded-xl bg-brand py-4 text-base font-semibold text-white shadow-cta">
              Request to Join
            </button>
          )}
        </StickyActionBar>
      )}

      <EventJoinRequestModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        submitting={joinEvent.isPending}
        title="Request to Join"
        subtitle="The host must approve your request before you're added."
        onSubmit={(location) => userId && joinEvent.mutate({ eventId: event.id, userId, location }, { onSuccess: () => setJoinOpen(false), onError: err("Could not send request. Try again.") })}
      />
    </div>
  );
}
