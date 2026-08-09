import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];

export type GameListItem = GameRow & {
  sports: { id: string; name: string } | null;
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  game_players: { id: string; status: GamePlayerRow["status"]; user_id: string }[];
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
  venueId: string | null;
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
};

// Sport is intentionally excluded — changing it post-creation would strand
// players who joined expecting a specific sport, so it's fixed after creation.
export type UpdateGameParams = {
  gameId: string;
  title: string;
  venueId: string | null;
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
};

const LIST_SELECT =
  "*, sports(id, name), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id)";

const DETAIL_SELECT =
  "*, sports(id, name), venues(id, name, city), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id, joined_at, payment_status, skill_level, location, profiles(id, full_name, avatar))";

// Games are stored as separate DATE + TIME columns with no timezone; the app is
// Pakistan-only (see GameDetailScreen's time formatting), so treat them as +05:00.
function hasGameEnded(gameDate: string, endTime: string): boolean {
  return new Date(`${gameDate}T${endTime}+05:00`).getTime() < Date.now();
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
  return ((data ?? []) as GameListItem[]).filter((g) => !hasGameEnded(g.game_date, g.end_time));
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

export async function createGame(params: CreateGameParams): Promise<GameRow> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      creator_id: params.creatorId,
      title: params.title,
      sport_id: params.sportId,
      venue_id: params.venueId,
      game_date: params.gameDate,
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
      bring_equipment: false,
      cost_shared: false,
      pay_and_join: params.entryFee > 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

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
      title: params.title,
      venue_id: params.venueId,
      game_date: params.gameDate,
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
  if (error) throw new Error(error.message);
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
