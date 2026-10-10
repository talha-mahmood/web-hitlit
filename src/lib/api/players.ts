import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

// "Games played" everywhere in the app means *scored* games only — a match with
// a recorded result, whether scored through a scorecard or entered manually.
// The database still returns every game a player joined as games_played (used
// only to decide who shows up on the list); the mappers below use
// matches_played instead.
export type TopPlayer = {
  userId: string;
  fullName: string | null;
  avatar: string | null;
  city: string | null;
  skillLevel: SkillLevel | null;
  gamesPlayedTotal: number;
  tournamentsPlayedTotal: number;
  gamesHostedTotal: number;
  matchesPlayedTotal: number;
  matchesWonTotal: number;
  hoursPlayedTotal: number;
  followerCount: number;
};

// Reads via a SECURITY DEFINER RPC (get_top_players) since the underlying
// game_history table is locked to `user_id = auth.uid()` by RLS — this
// aggregates every player's counts without exposing raw per-game rows.
export async function fetchTopPlayers(sportId?: string): Promise<TopPlayer[]> {
  const { data, error } = await supabase.rpc("get_top_players", {
    p_sport_id: sportId ?? undefined,
  });
  if (error) throw new Error(error.message);
  // One grouped query for every listed player's follower count.
  const ids = (data ?? []).map((row) => row.user_id);
  const followerCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: counts, error: countsError } = await supabase.rpc("get_follower_counts", { p_user_ids: ids });
    if (countsError) throw new Error(countsError.message);
    for (const c of counts ?? []) followerCounts.set(c.user_id, c.follower_count);
  }
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    avatar: row.avatar,
    city: row.city,
    skillLevel: row.skill_level,
    gamesPlayedTotal: row.matches_played,
    tournamentsPlayedTotal: row.tournaments_played,
    gamesHostedTotal: row.games_hosted,
    matchesPlayedTotal: row.matches_played,
    matchesWonTotal: row.matches_won,
    hoursPlayedTotal: Number(row.hours_played),
    followerCount: followerCounts.get(row.user_id) ?? 0,
  }));
}

export type PlayerSportBreakdownEntry = { sportId: string; sportName: string; count: number };

export type PlayerPublicProfile = {
  id: string;
  fullName: string | null;
  userCode: string | null;
  avatar: string | null;
  city: string | null;
  bio: string | null;
  skillLevel: SkillLevel | null;
  jerseyNumber: number | null;
  gamesPlayedTotal: number;
  tournamentsPlayedTotal: number;
  gamesHostedTotal: number;
  matchesPlayedTotal: number;
  matchesWonTotal: number;
  hoursPlayedTotal: number;
  computedSkillLevel: SkillLevel | null;
  sportBreakdown: PlayerSportBreakdownEntry[];
  // Sport-specific totals — only meaningful (and only ever shown) when the
  // profile is filtered to Cricket/Football respectively; see
  // get_player_public_stats's name-matching caveat.
  totalRuns: number;
  totalGoals: number;
  totalWickets: number;
  // From get_player_extra_stats — the two numbers the Profile-style cards need
  // that the main stats RPC doesn't return.
  activeSquads: number;
  regularGamesPlayed: number;
};

// Basic identity comes straight from `profiles` (publicly readable); the
// activity aggregates come via the same SECURITY DEFINER RPC pattern as
// fetchTopPlayers, scoped to a single player.
// `sportId` narrows every number on the profile to that one sport — used when
// opened from the Top Players list with a sport filter on, so the profile
// matches the row that was tapped.
export async function fetchPlayerPublicProfile(userId: string, sportId?: string): Promise<PlayerPublicProfile> {
  const [profileRes, statsRes, extraRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, user_code, avatar, city, bio, skill_level, jersey_number")
      .eq("id", userId)
      .single(),
    supabase.rpc("get_player_public_stats", { p_user_id: userId, p_sport_id: sportId }).single(),
    supabase.rpc("get_player_extra_stats", { p_user_id: userId, p_sport_id: sportId }).single(),
  ]);
  if (profileRes.error) throw new Error(profileRes.error.message);
  if (statsRes.error) throw new Error(statsRes.error.message);
  if (extraRes.error) throw new Error(extraRes.error.message);

  const profile = profileRes.data;
  const stats = statsRes.data;
  const sportBreakdown = (stats.sport_breakdown as unknown as PlayerSportBreakdownEntry[] | null) ?? [];

  return {
    id: profile.id,
    fullName: profile.full_name,
    userCode: profile.user_code,
    avatar: profile.avatar,
    city: profile.city,
    bio: profile.bio,
    skillLevel: profile.skill_level,
    jerseyNumber: profile.jersey_number,
    gamesPlayedTotal: stats.matches_played,
    tournamentsPlayedTotal: stats.tournaments_played,
    gamesHostedTotal: stats.games_hosted,
    matchesPlayedTotal: stats.matches_played,
    matchesWonTotal: stats.matches_won,
    hoursPlayedTotal: Number(stats.hours_played),
    computedSkillLevel: stats.computed_skill_level,
    sportBreakdown: sportBreakdown.sort((a, b) => b.count - a.count),
    totalRuns: stats.total_runs ?? 0,
    totalGoals: stats.total_goals ?? 0,
    totalWickets: stats.total_wickets ?? 0,
    activeSquads: extraRes.data.active_squads,
    regularGamesPlayed: extraRes.data.regular_games_played,
  };
}
