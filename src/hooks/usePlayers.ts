import { useQuery } from "@tanstack/react-query";
import { fetchTopPlayers, fetchPlayerPublicProfile } from "../lib/api/players";

export function useTopPlayers(sportId?: string) {
  return useQuery({
    queryKey: ["topPlayers", sportId ?? "all"],
    queryFn: () => fetchTopPlayers(sportId),
    staleTime: 60_000,
  });
}

export function usePlayerPublicProfile(userId: string | undefined, sportId?: string) {
  return useQuery({
    queryKey: ["playerPublicProfile", userId, sportId ?? "all"],
    queryFn: () => fetchPlayerPublicProfile(userId as string, sportId),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
