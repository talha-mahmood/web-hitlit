import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSquads,
  fetchSquadDetail,
  createSquad,
  updateSquad,
  setSquadJoinBlocked,
  joinSquad,
  leaveSquad,
  disbandSquad,
  approveMember,
  rejectMember,
  removeMember,
} from "../lib/api/squads";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
import type { Database } from "../types/database.types";

export function useSquads(filters: { search?: string; sportId?: string } = {}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squads", filters],
    queryFn: () => fetchSquads(filters),
    staleTime: 30_000,
  });

  // A squad being created or disbanded should show up (or disappear)
  // immediately for anyone browsing — without this the list only updates
  // on pull-to-refresh or the 30s staleTime.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName("squads:list"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "squads" },
        () => {
          qc.invalidateQueries({ queryKey: ["squads"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useSquadDetail(squadId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squad", squadId],
    queryFn: () => fetchSquadDetail(squadId),
    staleTime: 30_000,
    retry: 1,
  });

  // A join request, approval, the squad itself being edited/disbanded, etc.
  // — all row changes made by someone else's device. Without this the
  // viewer only sees it after manually leaving and re-entering the screen.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName(`squad_members:${squadId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "squad_members", filter: `squad_id=eq.${squadId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["squad", squadId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "squads", filter: `id=eq.${squadId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["squad", squadId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [squadId, qc]);

  return query;
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

export function useSetSquadJoinBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, blocked }: { squadId: string; blocked: boolean }) =>
      setSquadJoinBlocked(squadId, blocked),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["squad", vars.squadId] });
      qc.invalidateQueries({ queryKey: ["squads"] });
    },
  });
}

export function useJoinSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      squadId,
      userId,
      skillLevel,
      location,
    }: {
      squadId: string;
      userId: string;
      skillLevel: Database["public"]["Enums"]["skill_level_type"];
      location: string;
    }) => joinSquad(squadId, userId, skillLevel, location),
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
