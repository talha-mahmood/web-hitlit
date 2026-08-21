import { supabase } from "../supabase";

export type UserSearchResult = {
  id: string;
  full_name: string | null;
  avatar: string | null;
  email: string | null;
};

// PostgREST's .or() filter string treats `,`, `(`, `)` as syntax, so a search
// term containing them would otherwise malform the request — strip them.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

// Used by the host "invite players" flow — profiles are publicly readable
// (see profiles_select_all) so any authenticated user can already look
// anyone up by name or email; this just adds a proper multi-result search
// on top of the exact-match lookup superadmin screens use.
export async function searchUsers(term: string, excludeIds: string[] = []): Promise<UserSearchResult[]> {
  const trimmed = sanitizeSearchTerm(term);
  if (!trimmed) return [];
  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar, email")
    .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    .limit(20);
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
