import { supabase } from "../supabase";
import { isUniqueViolation } from "../nameValidation";
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
    user_id: string;
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
    tournament_team_members: { status: string; user_id: string }[];
  }[];
};

export type GameDetail = GameRow & {
  sports: { id: string; name: string } | null;
  venues: { id: string; name: string; city: string | null } | null;
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  game_players: (Pick<
    GamePlayerRow,
    "id" | "status" | "user_id" | "joined_at" | "payment_status" | "skill_level" | "location"
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
  "*, sports(id, name), venues(id, name, city, address, latitude, longitude), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id, profiles(avatar, full_name)), tournament_teams(id, name, status, sort_order, tournament_team_members(status, user_id))";

const DETAIL_SELECT =
  "*, sports(id, name), venues(id, name, city), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id, joined_at, payment_status, skill_level, location, profiles(id, full_name, avatar))";

// Games are stored as separate DATE + TIME columns with no timezone; the app is
// Pakistan-only (see GameDetailScreen's time formatting), so treat them as +05:00.
// A multi-day TOURNAMENT's real finish line is end_date (its last day), not
// game_date (its first day) — regular games leave end_date null.
function hasGameEnded(gameDate: string, endDate: string | null, endTime: string): boolean {
  return new Date(`${endDate ?? gameDate}T${endTime}+05:00`).getTime() < Date.now();
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
  const today = new Date().toISOString().split("T")[0];
  let query = supabase
    .from("games")
    .select(LIST_SELECT)
    .eq("visibility", "public")
    .in("status", ["OPEN", "FULL"])
    .is("deleted_at", null)
    .gte("game_date", today)
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
  // Belt-and-suspenders: the DB-side cron job (expire_past_games) archives and
  // hard-deletes ended games every 10 minutes, but this filters out any that
  // ended within that window so the list never shows something unjoinable.
  return ((data ?? []) as GameListItem[]).filter((g) => !hasGameEnded(g.game_date, g.end_date, g.end_time));
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

// Links a completed venue booking back to the tournament that sent the host
// there — this is how the "Book Venue" button on the tournament detail
// screen knows to flip to "Venue Booked" afterward. Host-only (games_update_own).
export async function linkGameBooking(gameId: string, bookingId: string): Promise<void> {
  const { error } = await supabase.from("games").update({ booking_id: bookingId }).eq("id", gameId);
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
      bring_equipment: false,
      cost_shared: false,
      pay_and_join: params.entryFee > 0,
    })
    .select()
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error(
        `A ${params.gameType === "TOURNAMENT" ? "tournament" : "game"} with this title already exists. Please choose a different title.`
      );
    }
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
    if (isUniqueViolation(error)) {
      throw new Error("Another game already uses this title. Please choose a different title.");
    }
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
