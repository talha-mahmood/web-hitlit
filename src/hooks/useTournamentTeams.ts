import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTeamsForTournament,
  createTeam,
  requestToJoinTeam,
  approveTeamMember,
  rejectTeamMember,
  removeTeamMember,
  leaveTeam,
  approveTeam,
  rejectTeam,
} from "../lib/api/tournamentTeams";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database.types";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

export function useTournamentTeams(gameId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["tournamentTeams", gameId],
    queryFn: () => fetchTeamsForTournament(gameId),
    staleTime: 15_000,
    enabled: !!gameId,
  });

  useEffect(() => {
    if (!gameId) return;
    // tournament_team_members has no game_id column to filter by directly,
    // so any member change (across all tournaments) triggers a refetch here
    // — a bit coarse, but cheap, and keeps captain/host approval state live.
    const channel = supabase
      .channel(`tournament_teams:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_teams", filter: `game_id=eq.${gameId}` },
        () => qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_team_members" },
        () => qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, qc]);

  return query;
}

export function useCreateTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ captainId, name }: { captainId: string; name: string }) =>
      createTeam(gameId, captainId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useRequestToJoinTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      userId,
      skillLevel,
      location,
    }: {
      teamId: string;
      userId: string;
      skillLevel: SkillLevel;
      location: string;
    }) => requestToJoinTeam(teamId, userId, skillLevel, location),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useApproveTeamMember(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => approveTeamMember(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useRejectTeamMember(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => rejectTeamMember(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useRemoveTeamMember(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeTeamMember(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useLeaveTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      leaveTeam(teamId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useApproveTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => approveTeam(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useRejectTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => rejectTeam(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}
