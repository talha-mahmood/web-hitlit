// Shared by every sport's New Match screen: a match can't have two players
// (or two teams) that are indistinguishable from each other once scoring
// starts — e.g. "who just scored, Ali or Ali?" has no good answer. Matching
// is trimmed + case-insensitive, so "Ali" and " ali " are the same name.

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// True if `name` already appears in `others` (itself excluded by the
// caller — pass the list of *other* names, not including this one).
export function isDuplicateName(name: string, others: string[]): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  return others.some((other) => normalizeName(other) === normalized);
}

// True if two single names (team names, or two player names) clash.
export function namesClash(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return !!na && !!nb && na === nb;
}

// True if any two names in the list collide — used as a submit-time safety
// net alongside the entry-time checks (e.g. SportFillModal/prefill data
// where entry-time prevention doesn't apply).
export function hasDuplicateNames(names: string[]): boolean {
  const seen = new Set<string>();
  for (const raw of names) {
    const n = normalizeName(raw);
    if (!n) continue;
    if (seen.has(n)) return true;
    seen.add(n);
  }
  return false;
}
