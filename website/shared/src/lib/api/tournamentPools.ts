import { supabase } from "../supabase";
import { isUniqueViolation } from "../nameValidation";
import type { Database } from "../../types/database.types";

export type TournamentPool = Database["public"]["Tables"]["tournament_pools"]["Row"];

export async function fetchPoolsForTournament(gameId: string): Promise<TournamentPool[]> {
  const { data, error } = await supabase
    .from("tournament_pools")
    .select("*")
    .eq("game_id", gameId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Host-only, called once at tournament creation — mirrors
// createTournamentTeamPlaceholders' pattern (bulk insert, sort_order
// preserves entry order).
export async function createPools(gameId: string, names: string[]): Promise<TournamentPool[]> {
  const { data, error } = await supabase
    .from("tournament_pools")
    .insert(names.map((name, i) => ({ game_id: gameId, name, sort_order: i })))
    .select();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Group names must be unique within a tournament.");
    }
    throw new Error(error.message);
  }
  return data;
}

// Host-only (enforced by the enforce_pool_assignment DB trigger regardless
// of what the client sends) — assign an approved team to a group.
export async function assignTeamToPool(teamId: string, poolId: string): Promise<void> {
  const { error } = await supabase.from("tournament_teams").update({ pool_id: poolId }).eq("id", teamId);
  if (error) throw new Error(error.message);
}
