import { supabase } from "../supabase";
import { diffHours } from "../gameFormHelpers";
import type { Database } from "../../types/database.types";

export type SportBreakdownEntry = { sportId: string; sportName: string; count: number };
export type UpcomingEntry = { id: string; title: string; gameDate: string; startTime: string; sportName: string | null };
export type ActiveSquadEntry = { id: string; name: string };

export type ProfileStats = {
  gamesPlayedTotal: number;
  tournamentsPlayedTotal: number;
  gamesHostedTotal: number;
  hoursPlayedTotal: number;
  sportBreakdown: SportBreakdownEntry[];
  favoriteVenuesCount: number;
  activeSquads: ActiveSquadEntry[];
  upcomingGames: UpcomingEntry[];
  upcomingTournaments: UpcomingEntry[];
  computedSkillLevel: Database["public"]["Enums"]["skill_level_type"] | null;
};

type HistoryRow = {
  sport_id: string | null;
  game_type: Database["public"]["Enums"]["game_type_type"] | null;
  role: string;
  start_time: string | null;
  end_time: string | null;
  sports: { name: string } | null;
};

function mostCommonSkillLevel(
  levels: (Database["public"]["Enums"]["skill_level_type"] | null)[]
): Database["public"]["Enums"]["skill_level_type"] | null {
  const counts = new Map<string, number>();
  for (const level of levels) {
    if (!level) continue;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [level, count] of counts) {
    if (count > bestCount) {
      best = level;
      bestCount = count;
    }
  }
  return best as Database["public"]["Enums"]["skill_level_type"] | null;
}

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const [historyRes, squadsRes, gamesRes, tournamentsRes, favoritesRes, skillLevelsRes] = await Promise.all([
    supabase
      .from("game_history")
      .select("sport_id, game_type, role, start_time, end_time, sports(name)")
      .eq("user_id", userId),
    supabase
      .from("squad_members")
      .select("squad_id, squads(id, name)")
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
    supabase
      .from("game_players")
      .select("games(id, title, game_date, start_time, sports(name))")
      .eq("user_id", userId)
      .eq("status", "JOINED"),
    supabase
      .from("tournament_team_members")
      .select("tournament_teams!inner(status, games(id, title, game_date, start_time, sports(name)))")
      .eq("user_id", userId)
      .eq("status", "JOINED")
      .eq("tournament_teams.status", "APPROVED"),
    supabase.from("favorite_venues").select("venue_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("game_players")
      .select("skill_level")
      .eq("user_id", userId)
      .not("skill_level", "is", null),
  ]);

  if (historyRes.error) throw new Error(historyRes.error.message);
  if (squadsRes.error) throw new Error(squadsRes.error.message);
  if (gamesRes.error) throw new Error(gamesRes.error.message);
  if (tournamentsRes.error) throw new Error(tournamentsRes.error.message);
  if (favoritesRes.error) throw new Error(favoritesRes.error.message);
  if (skillLevelsRes.error) throw new Error(skillLevelsRes.error.message);

  const history = (historyRes.data ?? []) as unknown as HistoryRow[];

  const sportCounts = new Map<string, { sportName: string; count: number }>();
  let hoursPlayedTotal = 0;
  let gamesHostedTotal = 0;
  let tournamentsPlayedTotal = 0;
  for (const row of history) {
    if (row.sport_id) {
      const existing = sportCounts.get(row.sport_id);
      const sportName = row.sports?.name ?? "Other";
      sportCounts.set(row.sport_id, { sportName, count: (existing?.count ?? 0) + 1 });
    }
    if (row.role === "creator") gamesHostedTotal += 1;
    if (row.game_type === "TOURNAMENT") tournamentsPlayedTotal += 1;
    if (row.start_time && row.end_time) {
      hoursPlayedTotal += diffHours(row.start_time.slice(0, 5), row.end_time.slice(0, 5));
    }
  }

  const sportBreakdown: SportBreakdownEntry[] = Array.from(sportCounts.entries())
    .map(([sportId, v]) => ({ sportId, sportName: v.sportName, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const activeSquads: ActiveSquadEntry[] = (squadsRes.data ?? [])
    .map((r) => r.squads)
    .filter((s): s is { id: string; name: string } => !!s);

  const upcomingGames: UpcomingEntry[] = (gamesRes.data ?? [])
    .map((r) => r.games)
    .filter((g): g is NonNullable<typeof g> => !!g)
    .map((g) => ({
      id: g.id,
      title: g.title,
      gameDate: g.game_date,
      startTime: g.start_time,
      sportName: g.sports?.name ?? null,
    }))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.startTime.localeCompare(b.startTime));

  const upcomingTournaments: UpcomingEntry[] = (tournamentsRes.data ?? [])
    .map((r) => r.tournament_teams?.games)
    .filter((g): g is NonNullable<typeof g> => !!g)
    .map((g) => ({
      id: g.id,
      title: g.title,
      gameDate: g.game_date,
      startTime: g.start_time,
      sportName: g.sports?.name ?? null,
    }))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.startTime.localeCompare(b.startTime));

  const computedSkillLevel = mostCommonSkillLevel(
    (skillLevelsRes.data ?? []).map((r) => r.skill_level)
  );

  return {
    gamesPlayedTotal: history.length,
    tournamentsPlayedTotal,
    gamesHostedTotal,
    hoursPlayedTotal: Math.round(hoursPlayedTotal * 10) / 10,
    sportBreakdown,
    favoriteVenuesCount: favoritesRes.count ?? 0,
    activeSquads,
    upcomingGames,
    upcomingTournaments,
    computedSkillLevel,
  };
}
