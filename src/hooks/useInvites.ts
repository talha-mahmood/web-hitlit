import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createGameInvite,
  createSquadInvite,
  fetchMyPendingGameInvite,
  fetchMyPendingSquadInvite,
  acceptGameInvite,
  declineGameInvite,
  acceptSquadInvite,
  declineSquadInvite,
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
