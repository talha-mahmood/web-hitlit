import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createGameInvite,
  createSquadInvite,
  createTeamInvite,
  fetchMyPendingGameInvite,
  fetchMyPendingSquadInvite,
  fetchMyPendingTeamInvite,
  fetchPendingTeamInviteCount,
  acceptGameInvite,
  declineGameInvite,
  acceptSquadInvite,
  declineSquadInvite,
  acceptTeamInvite,
  declineTeamInvite,
  fetchTeamInviteStatuses,
  fetchSquadInviteStatuses,
} from "../lib/api/invites";
import { searchUsers } from "../lib/api/users";

export function useUserSearch(term: string, excludeIds: string[]) {
  return useQuery({
    queryKey: ["userSearch", term, excludeIds],
    queryFn: () => searchUsers(term, excludeIds),
    enabled: term.trim().length > 0,
    staleTime: 10_000,
  });
}

export function useCreateGameInvite(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invitedUserId, invitedBy }: { invitedUserId: string; invitedBy: string }) =>
      createGameInvite(gameId, invitedUserId, invitedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gameInvite", gameId] });
    },
  });
}

export function useCreateSquadInvite(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invitedUserId, invitedBy }: { invitedUserId: string; invitedBy: string }) =>
      createSquadInvite(squadId, invitedUserId, invitedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squadInvite", squadId] });
    },
  });
}

export function useMyPendingGameInvite(gameId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["gameInvite", gameId, userId],
    queryFn: () => fetchMyPendingGameInvite(gameId, userId as string),
    enabled: !!gameId && !!userId,
    staleTime: 15_000,
  });
}

// Drives the same kind of "you're invited" banner on the game/tournament
// detail screen that game/squad invites already get — see
// useAcceptTeamInvite/useDeclineTeamInvite below for why those now take an
// optional gameId too.
export function useMyPendingTeamInvite(gameId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["teamInvite", gameId, userId],
    queryFn: () => fetchMyPendingTeamInvite(gameId, userId as string),
    enabled: !!gameId && !!userId,
    staleTime: 15_000,
  });
}

export function useMyPendingSquadInvite(squadId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["squadInvite", squadId, userId],
    queryFn: () => fetchMyPendingSquadInvite(squadId, userId as string),
    enabled: !!squadId && !!userId,
    staleTime: 15_000,
  });
}

export function useAcceptGameInvite(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => acceptGameInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gameInvite", gameId] });
      qc.invalidateQueries({ queryKey: ["game", gameId] });
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useDeclineGameInvite(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => declineGameInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gameInvite", gameId] });
    },
  });
}

export function useAcceptSquadInvite(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => acceptSquadInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squadInvite", squadId] });
      qc.invalidateQueries({ queryKey: ["squad", squadId] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useDeclineSquadInvite(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => declineSquadInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squadInvite", squadId] });
    },
  });
}

// Sent from a team card's "Invite a Player"/"Fill with my Squad" — one row
// per invited player, so a squad-fill selection of several members just
// calls this once per person (see FillTeamWithSquadModal).
export function useCreateTeamInvite(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, invitedUserId, invitedBy }: { teamId: string; invitedUserId: string; invitedBy: string }) =>
      createTeamInvite(teamId, invitedUserId, invitedBy),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
      qc.invalidateQueries({ queryKey: ["pendingTeamInviteCount", teamId] });
    },
  });
}

// Shown on a team card so whoever's been inviting players can see how many
// invites are still outstanding (see fetchPendingTeamInviteCount — RLS
// scopes this per-viewer automatically).
export function usePendingTeamInviteCount(teamId: string) {
  return useQuery({
    queryKey: ["pendingTeamInviteCount", teamId],
    queryFn: () => fetchPendingTeamInviteCount(teamId),
    staleTime: 15_000,
  });
}

// The actual current status (pending/accepted/declined) of a batch of team
// or squad invites, by id — lets the Notifications screen show "Approved"/
// "Declined" in place of the buttons for an invite that's already been
// resolved, even after the screen remounts (see fetchTeamInviteStatuses).
export function useTeamInviteStatuses(inviteIds: string[]) {
  const key = [...inviteIds].sort();
  return useQuery({
    queryKey: ["teamInviteStatuses", key],
    queryFn: () => fetchTeamInviteStatuses(key),
    enabled: key.length > 0,
  });
}

export function useSquadInviteStatuses(inviteIds: string[]) {
  const key = [...inviteIds].sort();
  return useQuery({
    queryKey: ["squadInviteStatuses", key],
    queryFn: () => fetchSquadInviteStatuses(key),
    enabled: key.length > 0,
  });
}

// Acted on either from the Notifications screen's inline Approve/Decline
// (no gameId — the notification's own `data` already carries gameId/teamId)
// or from the "you're invited" banner on that specific game/tournament's
// detail screen (gameId passed so its own teamInvite query refreshes too,
// alongside the broader invalidation both call sites need).
export function useAcceptTeamInvite(gameId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => acceptTeamInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["teamInviteStatuses"] });
      if (gameId) qc.invalidateQueries({ queryKey: ["teamInvite", gameId] });
    },
  });
}

export function useDeclineTeamInvite(gameId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => declineTeamInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["teamInviteStatuses"] });
      if (gameId) qc.invalidateQueries({ queryKey: ["teamInvite", gameId] });
    },
  });
}

// Same "acted on from Notifications, not a specific squad screen" shape as
// useAcceptTeamInvite/useDeclineTeamInvite above — used for a squad_invite
// notification's inline Approve/Decline.
export function useAcceptSquadInviteFromNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => acceptSquadInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squads"] });
      qc.invalidateQueries({ queryKey: ["squadInvite"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["squadInviteStatuses"] });
    },
  });
}

export function useDeclineSquadInviteFromNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => declineSquadInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["squadInviteStatuses"] });
    },
  });
}
