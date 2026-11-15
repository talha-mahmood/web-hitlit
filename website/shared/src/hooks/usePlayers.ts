import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTopPlayers, fetchPlayerPublicProfile } from "../lib/api/players";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

export function useTopPlayers(sportId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["topPlayers", sportId ?? "all"],
    queryFn: () => fetchTopPlayers(sportId),
    staleTime: 60_000,
  });

  // A brand-new signup (profiles insert) or anyone's games_played/matches
  // changing (game_history/match_results) should show up here live, not
  // just after staleTime or a remount — every "topPlayers" query, regardless
  // of which sport it's scoped to, depends on these three tables.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName("topPlayers"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () =>
        qc.invalidateQueries({ queryKey: ["topPlayers"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "game_history" }, () =>
        qc.invalidateQueries({ queryKey: ["topPlayers"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "match_results" }, () =>
        qc.invalidateQueries({ queryKey: ["topPlayers"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function usePlayerPublicProfile(userId: string | undefined, sportId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["playerPublicProfile", userId, sportId ?? "all"],
    queryFn: () => fetchPlayerPublicProfile(userId as string, sportId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Same idea as useProfileStats's own channel, scoped to this one player —
  // a match this player just finished should update their public profile
  // (the one other users see) without the viewer needing to reopen it.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`playerPublicProfile:${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_history", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["playerPublicProfile", userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_results", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["playerPublicProfile", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}
