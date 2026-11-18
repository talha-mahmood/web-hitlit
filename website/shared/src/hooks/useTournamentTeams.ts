import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTeamsForTournament,
  createTeam,
  createTournamentTeamPlaceholders,
  requestToJoinTeam,
  addManualTeamMember,
  leaveTeam,
  removeTeamMember,
  rejectTeam,
  approveTeam,
  rejectPendingTeam,
  updateTeamName,
  setTeamManualStatus,
  type ManualTeamStatus,
} from "../lib/api/tournamentTeams";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
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
    // — a bit coarse, but cheap, and keeps team roster state live.
    const channel = supabase
      .channel(uniqueChannelName(`tournament_teams:${gameId}`))
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
      // The tournament itself being cancelled/edited by the host is a change
      // to `games`, not `tournament_teams` — TournamentTeamsSection only
      // renders game.status via the prop it was given by GameDetailScreen,
      // so without this, someone sitting on the teams section wouldn't see
      // a cancellation until they left and reopened the screen.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => qc.invalidateQueries({ queryKey: ["game", gameId] })
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
    mutationFn: ({ creatorId, name }: { creatorId: string; name: string }) =>
      createTeam(gameId, creatorId, name),
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
      skillLevel?: SkillLevel | null;
      location?: string;
    }) => requestToJoinTeam(teamId, userId, skillLevel, location),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useAddManualTeamMember(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) => addManualTeamMember(teamId, name),
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

export function useUpdateTeamName(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) => updateTeamName(teamId, name),
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

export function useRejectTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => rejectTeam(teamId),
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

export function useRejectPendingTeam(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => rejectPendingTeam(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}

export function useSetTeamManualStatus(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, manualStatus }: { teamId: string; manualStatus: ManualTeamStatus }) =>
      setTeamManualStatus(teamId, manualStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournamentTeams", gameId] });
    },
  });
}
