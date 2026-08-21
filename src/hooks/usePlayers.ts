import { useQuery } from "@tanstack/react-query";
import { fetchTopPlayers, fetchPlayerPublicProfile } from "../lib/api/players";

export function useTopPlayers(sportId?: string) {
  return useQuery({
    queryKey: ["topPlayers", sportId ?? "all"],
    queryFn: () => fetchTopPlayers(sportId),
    staleTime: 60_000,
  });
}

export function usePlayerPublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["playerPublicProfile", userId],
    queryFn: () => fetchPlayerPublicProfile(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
