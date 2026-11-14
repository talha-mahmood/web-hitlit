import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@app/lib/supabase";
import { uniqueChannelName } from "@app/lib/realtimeChannel";
import { fetchPlayerCricketMatches, computePlayerFigures } from "@app/lib/playerCricketStats";
import { fetchGenericMatches, fetchPlayerGenericFigures, type GenericSport } from "@app/lib/genericSportStats";

// These hooks live inside the app's PlayerCricketOverview / PlayerSportOverview
// UI files (which import React Native), so they're mirrored here with the
// same query keys, fetchers and realtime behaviour.

export function usePlayerCricketMatches(fullName: string | null | undefined, sportId?: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["playerCricketMatches", fullName, sportId ?? null],
    queryFn: () => fetchPlayerCricketMatches(fullName as string, sportId),
    enabled: !!fullName,
    staleTime: 60_000,
  });

  // Players are matched by name inside text[] columns, which realtime can't
  // filter on — subscribe broadly and invalidate this player's variants.
  useEffect(() => {
    if (!fullName) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["playerCricketMatches", fullName] });
    const channel = supabase
      .channel(uniqueChannelName(`playerCricketMatches:${fullName}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_matches" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_innings" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_balls" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fullName, qc]);

  return query;
}

export function usePlayerCricketFigures(fullName: string | null | undefined, sportId?: string | null) {
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName, sportId);
  const figures = useMemo(() => (matches && fullName ? computePlayerFigures(matches, fullName) : undefined), [matches, fullName]);
  return { data: figures, isLoading };
}

export function usePlayerGenericMatches(sport: GenericSport | null, fullName: string | null | undefined) {
  return useQuery({
    queryKey: ["playerGenericMatches", sport, fullName],
    queryFn: () => fetchGenericMatches(sport as GenericSport, fullName as string),
    enabled: !!sport && !!fullName,
    staleTime: 60_000,
  });
}

export function usePlayerGenericFigures(sport: GenericSport | null, fullName: string | null | undefined) {
  return useQuery({
    queryKey: ["playerGenericFigures", sport, fullName],
    queryFn: () => fetchPlayerGenericFigures(sport as GenericSport, fullName as string),
    enabled: !!sport && !!fullName,
    staleTime: 60_000,
  });
}
