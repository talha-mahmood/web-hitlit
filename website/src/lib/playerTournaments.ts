import { supabase } from "@app/lib/supabase";

export type PlayerTournamentEntry = { gameId: string; title: string; iconUrl: string | null; gameDate: string | null };

// Same query the app's PlayerCricketTournaments / PlayerSportTournaments run:
// scored matches → their tournament_matches link (via the sport's match-id
// column) → the tournament games the viewer is allowed to see (RLS).
export async function fetchTournamentsForMatches(matchIdColumn: string, matchIds: string[]): Promise<PlayerTournamentEntry[]> {
  if (matchIds.length === 0) return [];
  const { data: tms, error: tmError } = await supabase
    .from("tournament_matches")
    .select("game_id")
    .in(matchIdColumn as "cricket_match_id", matchIds);
  if (tmError) throw new Error(tmError.message);
  const gameIds = Array.from(new Set((tms ?? []).map((t) => t.game_id)));
  if (gameIds.length === 0) return [];
  const { data: games, error } = await supabase.from("games").select("id, title, icon_url, game_date").in("id", gameIds);
  if (error) throw new Error(error.message);
  return (games ?? []).map((g) => ({ gameId: g.id, title: g.title ?? "Tournament", iconUrl: g.icon_url, gameDate: g.game_date }));
}
