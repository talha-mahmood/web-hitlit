import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

export type Sport = Database["public"]["Tables"]["sports"]["Row"];

export async function fetchSports(): Promise<Sport[]> {
  const { data, error } = await supabase
    .from("sports")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
