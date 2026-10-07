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

// A player added by hand (typed free text) has no way to prove it refers to
// a different real person than an identical-looking name elsewhere — so
// that case still blocks. A player added from the "Add From a Group" picker
// is backed by a real account (sourceId = that account's squad_members row
// id), so two picks that happen to share a display name are fine as long as
// they're genuinely different people — only the exact same account picked
// twice (same sourceId) is still a real duplicate.
export type NamedEntry = { name: string; sourceId: string | null };

export function hasBlockingDuplicateNames(entries: NamedEntry[]): boolean {
  const byName = new Map<string, NamedEntry[]>();
  for (const entry of entries) {
    const n = normalizeName(entry.name);
    if (!n) continue;
    const list = byName.get(n) ?? [];
    list.push(entry);
    byName.set(n, list);
  }
  for (const list of byName.values()) {
    if (list.length < 2) continue;
    const ids = list.map((e) => e.sourceId);
    const allHaveIds = ids.every((id) => id !== null);
    const allDistinct = new Set(ids).size === ids.length;
    if (!allHaveIds || !allDistinct) return true;
  }
  return false;
}

// Whether a single new entry would collide with anything already present —
// same "fine if both have distinct real ids" rule as above, used for the
// per-field / per-add live checks (as you type, or right before an "add"
// commits) rather than re-scanning the whole roster each time.
export function entryCollides(entry: NamedEntry, others: NamedEntry[]): boolean {
  if (!normalizeName(entry.name)) return false;
  const matches = others.filter((o) => namesClash(o.name, entry.name));
  if (matches.length === 0) return false;
  if (!entry.sourceId) return true;
  return matches.some((o) => !o.sourceId || o.sourceId === entry.sourceId);
}
