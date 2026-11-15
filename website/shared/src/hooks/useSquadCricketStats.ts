import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSquadCricketMatches, computeSquadFigures } from "../lib/squadCricketStats";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

// Every cricket match a team's name appears in — same shared-cache/realtime
// shape as usePlayerCricketMatches in PlayerCricketOverview.tsx, just keyed
// on team name instead of player name.
export function useSquadCricketMatches(teamName: string | null | undefined, sportId?: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squadCricketMatches", teamName, sportId ?? null],
    queryFn: () => fetchSquadCricketMatches(teamName as string, sportId),
    enabled: !!teamName,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!teamName) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["squadCricketMatches", teamName] });
    const channel = supabase
      .channel(uniqueChannelName(`squadCricketMatches:${teamName}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_matches" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_innings" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cricket_balls" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamName, qc]);

  return query;
}

export function useSquadCricketFigures(teamName: string | null | undefined, sportId?: string | null) {
  const { data: matches, isLoading } = useSquadCricketMatches(teamName, sportId);
  const figures = useMemo(
    () => (matches && teamName ? computeSquadFigures(matches, teamName) : undefined),
    [matches, teamName]
  );
  return { data: figures, matches, isLoading };
}
