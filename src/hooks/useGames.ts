import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGames,
  fetchGameDetail,
  createGame,
  joinGame,
  leaveGame,
  cancelGame,
} from "../lib/api/games";
import { useAuthStore } from "../store/authStore";

export function useGames(filters: { sportId?: string } = {}) {
  return useQuery({
    queryKey: ["games", filters],
    queryFn: () => fetchGames(filters),
    staleTime: 30_000,
  });
}

export function useGameDetail(gameId: string) {
  return useQuery({
    queryKey: ["game", gameId],
    queryFn: () => fetchGameDetail(gameId),
    staleTime: 30_000,
    retry: 1,
  });
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

export function useJoinGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, userId }: { gameId: string; userId: string }) =>
      joinGame(gameId, userId),
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

export function useMyGameStatus(gameId: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: game } = useGameDetail(gameId);
  if (!userId || !game) return null;
  return (
    game.game_players.find((p) => p.user_id === userId && p.status === "JOINED") ?? null
  );
}
