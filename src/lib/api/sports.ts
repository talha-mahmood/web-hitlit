import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

export type Sport = Database["public"]["Tables"]["sports"]["Row"];

// The order the app wants sport filters/tiles shown in everywhere — not
// alphabetical, this is a deliberate, requested sequence. Any sport not
// listed here (e.g. one added later) falls back to alphabetical, after
// all the named ones.
const SPORT_ORDER = ["Hard Ball", "Tape Ball", "Padel", "Football", "Badminton", "Pickleball", "Tennis"];

// "Hard Ball" and "Tape Ball" are both cricket under the hood — same
// scoring rules, same minimum team size — just two separate `sports` rows
// so they can be filtered independently everywhere a sport filter shows up.
// "cricket" stays in the list too as a safety net for any sport named that
// directly (e.g. a fresh seed, or before this split existed).
const CRICKET_FAMILY_NAMES = ["cricket", "hard ball", "tape ball"];

export function isCricketFamily(sportName: string | null | undefined): boolean {
  return CRICKET_FAMILY_NAMES.includes((sportName ?? "").trim().toLowerCase());
}

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
