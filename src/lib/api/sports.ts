import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

export type Sport = Database["public"]["Tables"]["sports"]["Row"];

// The order the app wants sport filters/tiles shown in everywhere — not
// alphabetical, this is a deliberate, requested sequence. Any sport not
// listed here (e.g. one added later) falls back to alphabetical, after
// all the named ones.
const SPORT_ORDER = ["Cricket", "Padel", "Football", "Badminton", "Pickleball", "Tennis"];

export async function fetchSports(): Promise<Sport[]> {
  const { data, error } = await supabase
    .from("sports")
    .select("*")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  const sports = data ?? [];

  return sports.sort((a, b) => {
    const ai = SPORT_ORDER.indexOf(a.name);
    const bi = SPORT_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
