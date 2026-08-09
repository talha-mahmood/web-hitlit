import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGames,
  fetchGameDetail,
  createGame,
  updateGame,
  joinGame,
  leaveGame,
  cancelGame,
  approvePlayer,
  rejectPlayer,
  removePlayer,
} from "../lib/api/games";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
import type { Database } from "../types/database.types";

export function useGames(
  filters: {
    sportId?: string;
    search?: string;
    gameType?: Database["public"]["Enums"]["game_type_type"];
  } = {}
) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["games", filters],
    queryFn: () => fetchGames(filters),
    staleTime: 30_000,
  });

  // A game being created, cancelled, or expiring off the list (cron
  // hard-delete) should show up immediately for anyone browsing — without
  // this the list only updates on pull-to-refresh or the 30s staleTime.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName("games:list"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => {
          qc.invalidateQueries({ queryKey: ["games"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useGameDetail(gameId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => fetchGameDetail(gameId),
    staleTime: 30_000,
    retry: 1,
  });

  // A join request, approval, the game itself being cancelled/edited/
  // expiring, etc. — all row changes made by someone else's device or the
  // cron job. Without this the viewer only sees it after manually leaving
  // and re-entering the screen (staleTime alone doesn't trigger a refetch).
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName(`game_players:${gameId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["game", gameId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["game", gameId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, qc]);

  return query;
}

export function useCreateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGame,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useUpdateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateGame,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["game", data.id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useJoinGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      gameId,
      userId,
      skillLevel,
      location,
    }: {
      gameId: string;
      userId: string;
      skillLevel: Database["public"]["Enums"]["skill_level_type"];
      location: string;
    }) => joinGame(gameId, userId, skillLevel, location),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["game", vars.gameId] });
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useLeaveGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, userId }: { gameId: string; userId: string }) =>
      leaveGame(gameId, userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["game", vars.gameId] });
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useCancelGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) => cancelGame(gameId),
    onSuccess: (_, gameId) => {
      qc.invalidateQueries({ queryKey: ["game", gameId] });
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useApprovePlayer(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gamePlayerId: string) => approvePlayer(gamePlayerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", gameId] });
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useRejectPlayer(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gamePlayerId: string) => rejectPlayer(gamePlayerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", gameId] });
    },
  });
}

export function useRemovePlayer(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gamePlayerId: string) => removePlayer(gamePlayerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", gameId] });
      qc.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
