import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfileStats } from "../lib/api/profileStats";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

export function useProfileStats(userId: string | undefined, sportId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["profileStats", userId, sportId ?? "all"],
    queryFn: () => fetchProfileStats(userId as string, sportId),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Joining/leaving a game, squad, or tournament team (from this device or
  // any other) should be reflected here without waiting for staleTime or a
  // manual refresh — these are the only tables the stats are derived from.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`profileStats:${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["profileStats", userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "squad_members", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["profileStats", userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_team_members", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["profileStats", userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_history", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["profileStats", userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorite_venues", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["profileStats", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}
