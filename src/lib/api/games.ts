import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
type TournamentTeamRow = Database["public"]["Tables"]["tournament_teams"]["Row"];

export type GameListItem = GameRow & {
  sports: { id: string; name: string } | null;
  venues: {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  game_players: {
    id: string;
    status: GamePlayerRow["status"];
    user_id: string | null;
    manual_name: string | null;
    profiles: { avatar: string | null; full_name: string | null } | null;
  }[];
  tournament_teams: {
    id: string;
    name: string;
    status: TournamentTeamRow["status"];
    sort_order: number | null;
    // status (to count JOINED members per team for the "N players left"
    // readout, and which teams are still open) + user_id (so the card can
    // tell whether the current viewer is already on one of these teams) —
    // full member profiles aren't needed until the detail screen.
    tournament_team_members: { status: string; user_id: string | null; manual_name: string | null }[];
  }[];
};

export type GameDetail = GameRow & {
  sports: { id: string; name: string } | null;
  venues: { id: string; name: string; city: string | null } | null;
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  game_players: (Pick<
    GamePlayerRow,
    "id" | "status" | "user_id" | "manual_name" | "joined_at" | "payment_status" | "skill_level" | "location"
  > & {
    profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  })[];
};

export type CreateGameParams = {
  creatorId: string;
  title: string;
  sportId: string;
  // Exactly one of these is set (or both null pre-selection) — a real,
  // managed venue vs. free text the host typed because theirs wasn't listed.
  // See games_venue_or_custom_check.
  venueId: string | null;
  customVenueName: string | null;
  // Only ever set alongside customVenueName — the manual-location map
  // picker's pin (null when the host just typed a name with no map pick).
  customVenueLat: number | null;
  customVenueLng: number | null;
  gameDate: string;
  startTime: string;
  endTime: string;
  maxPlayers: number;
  skillLevel: Database["public"]["Enums"]["game_skill_level_type"] | null;
  visibility: Database["public"]["Enums"]["game_visibility_type"];
  gender: Database["public"]["Enums"]["game_gender_type"];
  description: string;
  entryFee: number;
  gameType: Database["public"]["Enums"]["game_type_type"];
  // Only meaningful when gameType is TOURNAMENT.
  numberOfTeams: number | null;
  playersPerTeam: number | null;
  tournamentFormat: Database["public"]["Enums"]["tournament_format_type"] | null;
  endDate: string | null;
  // Tournament-only: hours of play each day, starting from startTime.
  dailyHours: number | null;
  // Groups + Knockout only: how many teams advance out of each group (1 or
  // 2, uniform across all groups) — read back by PoolPlayoffPanel once the
  // group stage finishes.
  poolQualifiersPerGroup: number | null;
};

// Sport is intentionally excluded — changing it post-creation would strand
// players who joined expecting a specific sport, so it's fixed after creation.
export type UpdateGameParams = {
  gameId: string;
  // Undefined leaves the icon untouched; null clears it; a string sets it.
  // Kept optional/tri-state so callers that don't manage the icon (e.g. the
  // rest of the edit form) don't need to pass anything.
  iconUrl?: string | null;
  title: string;
  venueId: string | null;
  customVenueName: string | null;
  gameDate: string;
  startTime: string;
  endTime: string;
  maxPlayers: number;
  skillLevel: Database["public"]["Enums"]["game_skill_level_type"] | null;
  visibility: Database["public"]["Enums"]["game_visibility_type"];
  gender: Database["public"]["Enums"]["game_gender_type"];
  description: string;
  entryFee: number;
  numberOfTeams: number | null;
  playersPerTeam: number | null;
  endDate: string | null;
};

const LIST_SELECT =
  "*, sports(id, name), venues(id, name, city, address, latitude, longitude), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id, manual_name, profiles(avatar, full_name)), tournament_teams(id, name, status, sort_order, tournament_team_members(status, user_id, manual_name))";

const DETAIL_SELECT =
  "*, sports(id, name), venues(id, name, city), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id, manual_name, joined_at, payment_status, skill_level, location, profiles(id, full_name, avatar))";

// Games are stored as separate DATE + TIME columns with no timezone; the app is
// Pakistan-only (see GameDetailScreen's time formatting), so treat them as +05:00.
// A multi-day TOURNAMENT's real finish line is end_date (its last day), not
// game_date (its first day) — regular games leave end_date null.
export function hasGameEnded(gameDate: string, endDate: string | null, endTime: string): boolean {
  return new Date(`${endDate ?? gameDate}T${endTime}+05:00`).getTime() < Date.now();
}

// "Live" = already started and not yet ended — there's no separate status
// value the app actually sets for this (games only ever move OPEN/FULL ->
// COMPLETED or -> CANCELLED), so it's derived purely from game_date/
// start_time/end_time, the same way hasGameEnded already is.
export function isGameLive(
  gameDate: string,
  startTime: string,
  endDate: string | null,
  endTime: string
): boolean {
  const started = new Date(`${gameDate}T${startTime}+05:00`).getTime() <= Date.now();
  return started && !hasGameEnded(gameDate, endDate, endTime);
}

// PostgREST's .or() filter string treats `,`, `(`, `)` as syntax, so a search
// term containing them would otherwise malform the request — strip them.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

export async function fetchGames(
  filters: {
    sportId?: string;
    search?: string;
    gameType?: Database["public"]["Enums"]["game_type_type"];
  } = {}
): Promise<GameListItem[]> {
  let query = supabase
    .from("games")
    .select(LIST_SELECT)
    .eq("visibility", "public")
    .in("status", ["OPEN", "FULL", "COMPLETED"])
    .is("deleted_at", null)
    .order("game_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (filters.sportId) {
    query = query.eq("sport_id", filters.sportId);
  }

  if (filters.gameType) {
    query = query.eq("game_type", filters.gameType);
  }

  const search = filters.search ? sanitizeSearchTerm(filters.search) : "";
  if (search) {
    query = query.or(`title.ilike.%${search}%,game_code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  // Games/tournaments are kept forever (never auto-deleted) and always shown,
  // upcoming/ongoing first (soonest first) then ended ones after (most
  // recently ended first) so the list doesn't bury what's still joinable
  // under old history.
  return ((data ?? []) as GameListItem[]).sort((a, b) => {
    const aEnded = hasGameEnded(a.game_date, a.end_date, a.end_time);
    const bEnded = hasGameEnded(b.game_date, b.end_date, b.end_time);
    if (aEnded !== bEnded) return aEnded ? 1 : -1;
    const aKey = `${a.game_date}T${a.start_time}`;
    const bKey = `${b.game_date}T${b.start_time}`;
    if (aKey === bKey) return 0;
    const ascending = aKey < bKey;
    return aEnded ? (ascending ? 1 : -1) : ascending ? -1 : 1;
  });
}

export async function fetchGameDetail(gameId: string): Promise<GameDetail> {
  const { data, error } = await supabase
    .from("games")
    .select(DETAIL_SELECT)
    .eq("id", gameId)
    .single();
  if (error) throw new Error(error.message);
  return data as GameDetail;
}

export type AllGamesListItem = GameRow & {
  sports: { id: string; name: string } | null;
  profiles: { id: string; full_name: string | null; email: string | null } | null;
};

const SUPERADMIN_LIST_SELECT =
  "*, sports(id, name), profiles!games_creator_id_fkey(id, full_name, email)";

// Superadmin-only: every game/tournament regardless of creator, visibility,
// status or deleted_at — relies on the games_select_superadmin RLS policy
// (is_superadmin()), separate from fetchGames' public/own/invited-only view.
export async function fetchAllGames(search?: string): Promise<AllGamesListItem[]> {
  let query = supabase
    .from("games")
    .select(SUPERADMIN_LIST_SELECT)
    .order("created_at", { ascending: false });

  const term = search ? sanitizeSearchTerm(search) : "";
  if (term) {
    query = query.or(`title.ilike.%${term}%,game_code.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AllGamesListItem[];
}

// Superadmin-only true hard delete (games_delete_superadmin RLS policy) —
// distinct from cancelGame above, which is just a status flip any host can
// already do to their own game. Cascades teams/matches/invites/messages.
export async function deleteGame(gameId: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) throw new Error(error.message);
}

// Links a completed venue booking back to the tournament that sent the host
// there — this is how the "Book Venue" button on the tournament detail
// screen knows to flip to "Venue Booked" afterward. Host-only (games_update_own).
export async function linkGameBooking(gameId: string, bookingId: string): Promise<void> {
  const { error } = await supabase.from("games").update({ booking_id: bookingId }).eq("id", gameId);
  if (error) throw new Error(error.message);
}

// No payment integration yet, so there's no real booking to link — this is
// the stand-in that flips "Book Venue" to "Venue Booked" once the host has
// actually messaged the venue on WhatsApp from the venue detail page.
export async function markGameVenueContacted(gameId: string): Promise<void> {
  const { error } = await supabase.from("games").update({ venue_contacted: true }).eq("id", gameId);
  if (error) throw new Error(error.message);
}

export async function createGame(params: CreateGameParams): Promise<GameRow> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      creator_id: params.creatorId,
      title: params.title,
      sport_id: params.sportId,
      venue_id: params.venueId,
      custom_venue_name: params.customVenueName,
      custom_venue_lat: params.customVenueLat,
      custom_venue_lng: params.customVenueLng,
      game_date: params.gameDate,
      end_date: params.endDate,
      start_time: params.startTime,
      end_time: params.endTime,
      max_players: params.maxPlayers,
      min_players: 2,
      skill_level: params.skillLevel,
      visibility: params.visibility,
      gender: params.gender,
      description: params.description || null,
      entry_fee: params.entryFee,
      status: "OPEN",
      game_type: params.gameType,
      number_of_teams: params.numberOfTeams,
      players_per_team: params.playersPerTeam,
      tournament_format: params.tournamentFormat,
      daily_hours: params.dailyHours,
      pool_qualifiers_per_group: params.poolQualifiersPerGroup,
      bring_equipment: false,
      cost_shared: false,
      pay_and_join: params.entryFee > 0,
    })
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }

  // Creator automatically joins their own game
  const { error: joinError } = await supabase.from("game_players").insert({
    game_id: data.id,
    user_id: params.creatorId,
    status: "JOINED",
    joined_at: new Date().toISOString(),
    payment_status: "PENDING",
  });
  if (joinError) throw new Error(joinError.message);

  return data;
}

export async function updateGame(params: UpdateGameParams): Promise<GameRow> {
  const { data, error } = await supabase
    .from("games")
    .update({
      icon_url: params.iconUrl,
      title: params.title,
      venue_id: params.venueId,
      custom_venue_name: params.customVenueName,
      game_date: params.gameDate,
      end_date: params.endDate,
      start_time: params.startTime,
      end_time: params.endTime,
      max_players: params.maxPlayers,
      skill_level: params.skillLevel,
      visibility: params.visibility,
      gender: params.gender,
      description: params.description || null,
      entry_fee: params.entryFee,
      number_of_teams: params.numberOfTeams,
      players_per_team: params.playersPerTeam,
      pay_and_join: params.entryFee > 0,
    })
    .eq("id", params.gameId)
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function joinGame(
  gameId: string,
  userId: string,
  skillLevel: Database["public"]["Enums"]["skill_level_type"],
  location: string
): Promise<void> {
  const { error } = await supabase.from("game_players").insert({
    game_id: gameId,
    user_id: userId,
    status: "PENDING",
    payment_status: "PENDING",
    skill_level: skillLevel,
    location: location || null,
  });
  if (error) throw new Error(error.message);
}

// Host-only (enforced server-side by the add_manual_game_player RPC —
// every normal INSERT policy on this table requires user_id = auth.uid(),
// which can never be true for a manual, account-less player). Lands as
// JOINED immediately, same as any other host-initiated add.
export async function addManualGamePlayer(gameId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc("add_manual_game_player", { p_game_id: gameId, p_name: name });
  if (error) throw new Error(error.message);
}

export async function approvePlayer(gamePlayerId: string): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ status: "JOINED", joined_at: new Date().toISOString() })
    .eq("id", gamePlayerId);
  if (error) throw new Error(error.message);
}

export async function rejectPlayer(gamePlayerId: string): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ status: "DECLINED" })
    .eq("id", gamePlayerId);
  if (error) throw new Error(error.message);
}

export async function removePlayer(gamePlayerId: string): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ status: "REMOVED" })
    .eq("id", gamePlayerId);
  if (error) throw new Error(error.message);
}

export async function leaveGame(gameId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ status: "LEFT" })
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .in("status", ["JOINED", "PENDING"]);
  if (error) throw new Error(error.message);
}

export async function cancelGame(gameId: string): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({ status: "CANCELLED" })
    .eq("id", gameId);
  if (error) throw new Error(error.message);
}

export async function fetchFavoriteGameIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("favorite_games")
    .select("game_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.game_id));
}

export async function setFavoriteGame(
  userId: string,
  gameId: string,
  isFavorite: boolean
): Promise<void> {
  if (isFavorite) {
    const { error } = await supabase
      .from("favorite_games")
      .insert({ user_id: userId, game_id: gameId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("favorite_games")
      .delete()
      .eq("user_id", userId)
      .eq("game_id", gameId);
    if (error) throw new Error(error.message);
  }
}
