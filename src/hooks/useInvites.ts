import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createGameInvite,
  createSquadInvite,
  createTeamInvite,
  fetchMyPendingGameInvite,
  fetchMyPendingSquadInvite,
  acceptGameInvite,
  declineGameInvite,
  acceptSquadInvite,
  declineSquadInvite,
  acceptTeamInvite,
  declineTeamInvite,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

// Unlike game/squad invites (surfaced as a banner on that specific detail
// screen), a team invite is only ever acted on from the Notifications
// screen's inline Approve/Decline — the notification's own `data` already
// carries gameId/teamId, so accepting/declining here just needs the invite
// id and invalidates broadly rather than being scoped to one game/team.
export function useAcceptTeamInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => acceptTeamInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeclineTeamInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => declineTeamInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
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
    },
  });
}

export function useDeclineSquadInviteFromNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => declineSquadInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
