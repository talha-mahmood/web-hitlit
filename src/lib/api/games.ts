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
    "id" | "status" | "user_id" | "joined_at" | "payment_status"
  > & {
    profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  })[];
};

export type CreateGameParams = {
  creatorId: string;
  title: string;
  sportId: string;
  gameDate: string;
  startTime: string;
  endTime: string;
  maxPlayers: number;
  skillLevel: Database["public"]["Enums"]["game_skill_level_type"] | null;
  visibility: Database["public"]["Enums"]["game_visibility_type"];
  gender: Database["public"]["Enums"]["game_gender_type"];
  description: string;
  entryFee: number;
};

const LIST_SELECT =
  "*, sports(id, name), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id)";

const DETAIL_SELECT =
  "*, sports(id, name), venues(id, name, city), profiles!games_creator_id_fkey(id, full_name, avatar), game_players(id, status, user_id, joined_at, payment_status, profiles(id, full_name, avatar))";

export async function fetchGames(filters: { sportId?: string } = {}): Promise<GameListItem[]> {
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

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as GameListItem[];
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
      game_type: "REGULAR",
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

export async function joinGame(gameId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("game_players").insert({
    game_id: gameId,
    user_id: userId,
    status: "JOINED",
    joined_at: new Date().toISOString(),
    payment_status: "PENDING",
  });
  if (error) throw new Error(error.message);
}

export async function leaveGame(gameId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ status: "LEFT" })
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .eq("status", "JOINED");
  if (error) throw new Error(error.message);
}

export async function cancelGame(gameId: string): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({ status: "CANCELLED" })
    .eq("id", gameId);
  if (error) throw new Error(error.message);
}
