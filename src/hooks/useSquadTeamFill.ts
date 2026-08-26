import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMyOwnedSquads } from "../lib/api/squads";
import {
  squadFillTournamentTeam,
  squadFillGameSlots,
  sendGameSquadInvite,
  fetchGameSquadInvitesForGame,
  fetchPendingSquadInvites,
  respondToSquadInvite,
} from "../lib/api/squadTeamFill";

export function useMyOwnedSquads(ownerId: string | undefined) {
  return useQuery({
    queryKey: ["myOwnedSquads", ownerId],
    queryFn: () => fetchMyOwnedSquads(ownerId as string),
    enabled: !!ownerId,
  });
}

export function useSquadFillTournamentTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, squadId, memberUserIds }: { teamId: string; squadId: string; memberUserIds: string[] }) =>
      squadFillTournamentTeam(teamId, squadId, memberUserIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] }),
  });
}

export function useSquadFillGameSlots(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, memberUserIds }: { squadId: string; memberUserIds: string[] }) =>
      squadFillGameSlots(gameId, squadId, memberUserIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game", gameId] }),
  });
}

export function useSendGameSquadInvite(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, invitedBy }: { squadId: string; invitedBy: string }) =>
      sendGameSquadInvite(gameId, squadId, invitedBy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gameSquadInvites", gameId] }),
  });
}

export function useGameSquadInvitesForGame(gameId: string) {
  return useQuery({
    queryKey: ["gameSquadInvites", gameId],
    queryFn: () => fetchGameSquadInvitesForGame(gameId),
    enabled: !!gameId,
  });
}

export function usePendingSquadInvites(squadId: string) {
  return useQuery({
    queryKey: ["pendingSquadInvites", squadId],
    queryFn: () => fetchPendingSquadInvites(squadId),
    enabled: !!squadId,
  });
}

export function useRespondToSquadInvite(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      respondToSquadInvite(inviteId, accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pendingSquadInvites", squadId] }),
  });
}
