// Shared by the Games/Tournaments and Squads list screens' location filter.
// Client-side (not a server query) since "location" for a game spans several
// joined/free-text fields (venue name/city/address, or a custom venue name)
// that don't reduce to one column PostgREST can filter cleanly — and at this
// app's scale, filtering the already-fetched list is simplest and correct.
//
// `query` can be a single string or several (multi-select cities/manual
// entries) — an item matches if ANY candidate field contains ANY query.
export function matchesLocationQuery(
  candidates: (string | null | undefined)[],
  query: string | string[]
): boolean {
  const queries = (Array.isArray(query) ? query : [query]).map((q) => q.trim().toLowerCase()).filter(Boolean);
  if (queries.length === 0) return true;
  return candidates.some((c) => {
    if (!c) return false;
    const lower = c.toLowerCase();
    return queries.some((q) => lower.includes(q));
  });
}
