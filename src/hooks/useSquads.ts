import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSquads,
  fetchSquadDetail,
  createSquad,
  updateSquad,
  joinSquad,
  leaveSquad,
  disbandSquad,
  approveMember,
  rejectMember,
  removeMember,
} from "../lib/api/squads";

export function useSquads(filters: { search?: string } = {}) {
  return useQuery({
    queryKey: ["squads", filters],
    queryFn: () => fetchSquads(filters),
    staleTime: 30_000,
  });
}

export function useSquadDetail(squadId: string) {
  return useQuery({
    queryKey: ["squad", squadId],
    queryFn: () => fetchSquadDetail(squadId),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSquad,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useUpdateSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSquad,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["squad", data.id] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useJoinSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, userId }: { squadId: string; userId: string }) =>
      joinSquad(squadId, userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["squad", vars.squadId] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useLeaveSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, userId }: { squadId: string; userId: string }) =>
      leaveSquad(squadId, userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["squad", vars.squadId] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useDisbandSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (squadId: string) => disbandSquad(squadId),
    onSuccess: (_, squadId) => {
      qc.invalidateQueries({ queryKey: ["squad", squadId] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useApproveMember(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (squadMemberId: string) => approveMember(squadMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squad", squadId] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useRejectMember(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (squadMemberId: string) => rejectMember(squadMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squad", squadId] });
    },
  });
}

export function useRemoveMember(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (squadMemberId: string) => removeMember(squadMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squad", squadId] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}
