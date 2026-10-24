import { supabase } from "../supabase";
import { diffHours } from "../gameFormHelpers";
import type { Database } from "../../types/database.types";

export type SportBreakdownEntry = { sportId: string; sportName: string; count: number };
export type UpcomingEntry = { id: string; title: string; gameDate: string; startTime: string; sportName: string | null };
export type ActiveSquadEntry = { id: string; name: string; sportId: string | null };

export type ProfileStats = {
  // Scored games only: matches with a recorded result (via a scorecard or
  // entered manually) that this user's team took part in.
  gamesPlayedTotal: number;
  // The part of gamesPlayedTotal that came from regular (non-tournament) games.
  regularGamesPlayedTotal: number;
  // Same scored-match count as gamesPlayedTotal, plus how many of them this
  // user's team won — the inputs of the Top Players rating (computeRankingRating).
  matchesPlayedTotal: number;
  matchesWonTotal: number;
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
  game_id: string;
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

// `sportId` narrows every count to that one sport (games, tournaments, hosted,
// hours, scored matches, squads, sport breakdown) — used when the Profile's
// sport filter is on.
export async function fetchProfileStats(userId: string, sportId?: string): Promise<ProfileStats> {
  const [historyRes, squadsRes, gamesRes, tournamentsRes, favoritesRes, skillLevelsRes] = await Promise.all([
    supabase
      .from("game_history")
      .select("game_id, sport_id, game_type, role, start_time, end_time, sports(name)")
      .eq("user_id", userId),
    supabase
      .from("squad_members")
      .select("squad_id, squads(id, name, sport_id)")
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
    supabase
      .from("game_players")
      .select("games(id, title, game_date, start_time, status, sports(name))")
      .eq("user_id", userId)
      .eq("status", "JOINED"),
    supabase
      .from("tournament_team_members")
      .select("tournament_teams!inner(id, status, games(id, title, game_date, start_time, status, sports(name)))")
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

  const allHistory = (historyRes.data ?? []) as unknown as HistoryRow[];
  const history = sportId ? allHistory.filter((r) => r.sport_id === sportId) : allHistory;

  let hoursPlayedTotal = 0;
  let gamesHostedTotal = 0;
  let tournamentsPlayedTotal = 0;
  for (const row of history) {
    if (row.role === "creator") gamesHostedTotal += 1;
    if (row.game_type === "TOURNAMENT") tournamentsPlayedTotal += 1;
    if (row.start_time && row.end_time) {
      hoursPlayedTotal += diffHours(row.start_time.slice(0, 5), row.end_time.slice(0, 5));
    }
  }

  // Only these statuses count as "still upcoming" — matches exactly what
  // expire_past_games() treats as not-yet-expired. COMPLETED/CANCELLED games
  // linger in the games table (the cron never cleans those up), so without
  // this filter they'd wrongly show as something the user can still play.
  const ACTIVE_GAME_STATUSES = new Set(["OPEN", "FULL", "ONGOING"]);

  const activeSquads: ActiveSquadEntry[] = (squadsRes.data ?? [])
    .map((r) => r.squads)
    .filter((s): s is { id: string; name: string; sport_id: string | null } => !!s)
    .filter((s) => !sportId || s.sport_id === sportId)
    .map((s) => ({ id: s.id, name: s.name, sportId: s.sport_id }));

  const upcomingGames: UpcomingEntry[] = (gamesRes.data ?? [])
    .map((r) => r.games)
    .filter((g): g is NonNullable<typeof g> => !!g && ACTIVE_GAME_STATUSES.has(g.status))
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
    .filter((g): g is NonNullable<typeof g> => !!g && ACTIVE_GAME_STATUSES.has(g.status))
    .map((g) => ({
      id: g.id,
      title: g.title,
      gameDate: g.game_date,
      startTime: g.start_time,
      sportName: g.sports?.name ?? null,
    }))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.startTime.localeCompare(b.startTime));

  // Scored games persist independently in match_results — one row per
  // (user, match), written the moment a match is scored — so this survives
  // the game itself being deleted once its time passes (expire_past_games
  // cascade-deletes tournament_matches/tournament_teams/tournament_team_members
  // along with the game, which a live query against those would lose).
  const gameTypeByGameId = new Map<string, string | null>();
  for (const row of history) gameTypeByGameId.set(row.game_id, row.game_type);

  const { data: matchResultRows, error: matchResultsError } = await supabase
    .from("match_results")
    .select("game_id, sport_id, result, sports(name)")
    .eq("user_id", userId);
  if (matchResultsError) throw new Error(matchResultsError.message);
  const allScoredRows = (matchResultRows ?? []) as unknown as {
    game_id: string | null;
    sport_id: string | null;
    result: string;
    sports: { name: string } | null;
  }[];

  // match_results carries its own sport_id directly (populated whether the
  // match came from a booked game or a standalone one, e.g. a quick-
  // scorecard cricket match with no game_id at all) — filtering on that
  // directly, instead of looking the sport up via game_history by game_id,
  // is what lets a standalone match be found even though it has no game_id
  // to look up in the first place.
  const scoredRows = allScoredRows.filter((m) => !sportId || m.sport_id === sportId);
  const scoredGamesTotal = scoredRows.length;
  const scoredWinsTotal = scoredRows.filter((m) => m.result === "WON").length;
  const scoredRegularGamesTotal = scoredRows.filter(
    (m) => (m.game_id ? gameTypeByGameId.get(m.game_id) : undefined) !== "TOURNAMENT"
  ).length;

  // "Sports Played" (the pie chart) needs to reflect every sport this
  // player has actually completed a match in — same match_results source
  // (and the same sport_id-direct grouping) get_player_public_stats already
  // uses for another player's profile, so a standalone-only sport like a
  // quick-scorecard cricket match shows up here too, not just ones tied to
  // a booked game in game_history.
  const sportCounts = new Map<string, { sportName: string; count: number }>();
  for (const row of scoredRows) {
    if (!row.sport_id) continue;
    const existing = sportCounts.get(row.sport_id);
    const sportName = row.sports?.name ?? "Other";
    sportCounts.set(row.sport_id, { sportName, count: (existing?.count ?? 0) + 1 });
  }
  const sportBreakdown: SportBreakdownEntry[] = Array.from(sportCounts.entries())
    .map(([sportId, v]) => ({ sportId, sportName: v.sportName, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const computedSkillLevel = mostCommonSkillLevel(
    (skillLevelsRes.data ?? []).map((r) => r.skill_level)
  );

  return {
    gamesPlayedTotal: scoredGamesTotal,
    regularGamesPlayedTotal: scoredRegularGamesTotal,
    matchesPlayedTotal: scoredGamesTotal,
    matchesWonTotal: scoredWinsTotal,
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
