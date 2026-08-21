// Shared by the Games/Tournaments and Squads list screens' location filter.
// Client-side (not a server query) since "location" for a game spans several
// joined/free-text fields (venue name/city/address, or a custom venue name)
// that don't reduce to one column PostgREST can filter cleanly — and at this
// app's scale, filtering the already-fetched list is simplest and correct.
export function matchesLocationQuery(candidates: (string | null | undefined)[], query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return candidates.some((c) => !!c && c.toLowerCase().includes(trimmed));
}
