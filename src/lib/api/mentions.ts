import { supabase } from "../supabase";
import { searchUsers } from "./users";
import { rankByQuery, type MentionCandidate, type MentionEntityType } from "../mentionParser";

// A dropdown row — everything MentionCandidate has, plus what the UI needs
// to show it (a sport/type subtitle, an avatar for players).
export type MentionSuggestion = MentionCandidate & {
  subtitle: string;
  avatar?: string | null;
};

const SUGGESTION_LIMIT = 6;

// player/email search reuses the app's one existing user-search path
// (already excludes admin accounts and private-visibility profiles — see
// searchUsers) rather than duplicating that filtering here.
async function searchPlayers(term: string): Promise<MentionSuggestion[]> {
  const results = await searchUsers(term);
  return results.slice(0, SUGGESTION_LIMIT).map((u) => ({
    entityType: "player" as const,
    entityId: u.id,
    displayName: u.full_name ?? "Player",
    subtitle: "Player",
    avatar: u.avatar,
  }));
}

// Games and tournaments are both rows in `games`, told apart only by
// game_type — same public/not-deleted visibility rule fetchGames already
// uses, just with its own tight limit() since this is an autocomplete, not
// a browsable list.
async function searchGamesOrTournaments(
  term: string,
  gameType: "REGULAR" | "TOURNAMENT"
): Promise<MentionSuggestion[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id, title, sports(name)")
    .eq("game_type", gameType)
    .eq("visibility", "public")
    .is("deleted_at", null)
    .ilike("title", `%${term}%`)
    .limit(SUGGESTION_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => ({
    entityType: (gameType === "TOURNAMENT" ? "tournament" : "game") as MentionEntityType,
    entityId: g.id,
    displayName: g.title,
    subtitle: gameType === "TOURNAMENT" ? `Tournament${g.sports?.name ? ` · ${g.sports.name}` : ""}` : `Game${g.sports?.name ? ` · ${g.sports.name}` : ""}`,
  }));
}

async function searchSquads(term: string): Promise<MentionSuggestion[]> {
  const { data, error } = await supabase
    .from("squads")
    .select("id, name, sports(name)")
    .is("deleted_at", null)
    .ilike("name", `%${term}%`)
    .limit(SUGGESTION_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    entityType: "squad" as const,
    entityId: s.id,
    displayName: s.name,
    subtitle: `Group${s.sports?.name ? ` · ${s.sports.name}` : ""}`,
  }));
}

// One call, every entity type in parallel — a single failed source doesn't
// take down the whole dropdown (Promise.allSettled), it just contributes no
// results. Each source is capped, then the merged, deduped list is
// re-ranked as a whole so an exact match in one category always beats a
// merely-contains match in another, and finally capped again for the UI.
export async function searchMentionCandidates(
  term: string,
  type?: MentionEntityType
): Promise<MentionSuggestion[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const sources: Promise<MentionSuggestion[]>[] = [];
  if (!type || type === "player") sources.push(searchPlayers(trimmed));
  if (!type || type === "game") sources.push(searchGamesOrTournaments(trimmed, "REGULAR"));
  if (!type || type === "tournament") sources.push(searchGamesOrTournaments(trimmed, "TOURNAMENT"));
  if (!type || type === "squad") sources.push(searchSquads(trimmed));

  const settled = await Promise.allSettled(sources);
  const merged = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return rankByQuery(merged, trimmed).slice(0, 20);
}

// Tap-time "does this still exist" check, so an old message's mention never
// navigates into a broken/blank screen — cheap, single-row existence
// queries, only ever run for the one mention actually tapped.
export async function mentionEntityExists(entityType: MentionEntityType, entityId: string): Promise<boolean> {
  const table = entityType === "player" ? "profiles" : entityType === "squad" ? "squads" : "games";
  const { data, error } = await supabase.from(table).select("id").eq("id", entityId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}
