// Pure, framework-free logic for Community Chat's @mention composer and
// renderer — deliberately has zero React/React Native imports so it can be
// unit-tested with plain Jest (see src/lib/__tests__/mentionParser.test.ts)
// and reused identically by both the main feed composer and the reply
// thread composer.

export type MentionEntityType = "player" | "game" | "tournament" | "squad";

// What gets frozen into a comment's `mentions` jsonb column at send/edit
// time — entityId is what navigation and "does this still exist" checks
// use; displayName is what was shown at the time, kept even if the real
// entity is later renamed (see MentionText) or deleted.
export type Mention = {
  entityType: MentionEntityType;
  entityId: string;
  displayName: string;
  startIndex: number; // inclusive, index of the leading "@" in `body`
  endIndex: number; // exclusive
};

// A suggestion the dropdown can offer — not yet attached to any message.
export type MentionCandidate = {
  entityType: MentionEntityType;
  entityId: string;
  displayName: string;
};

// ── trigger detection ───────────────────────────────────────────────────
// While composing, "confirmed" mentions (ones the user actually picked from
// the dropdown) are tracked separately from the raw text — see
// computeMentions below for why. This is what the composer detects to
// decide whether/what to search for.
export type MentionTrigger = {
  // Index of the "@" that started this token.
  atIndex: number;
  // Everything typed after the "@", up to the cursor — the live search query.
  query: string;
};

// An "@" only starts a mention if it's at the very start of the message or
// right after whitespace — "email@domain" never triggers it. The token is
// abandoned (returns null) once it stops looking like something a user
// would still be typing a name into: a newline, a double space, or a
// second "@" all signal they've moved on, and a very long unmatched query
// is almost certainly not a name anymore either.
const MAX_TRIGGER_QUERY_LENGTH = 40;

export function findActiveMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  const upToCursor = text.slice(0, cursor);
  const atIndex = upToCursor.lastIndexOf("@");
  if (atIndex === -1) return null;

  const charBefore = atIndex === 0 ? "" : upToCursor[atIndex - 1];
  if (charBefore && !/\s/.test(charBefore)) return null;

  const query = upToCursor.slice(atIndex + 1);
  if (query.includes("\n")) return null;
  if (query.includes("@")) return null;
  if (query.includes("  ")) return null;
  if (query.length > MAX_TRIGGER_QUERY_LENGTH) return null;

  return { atIndex, query };
}

// Inserts the picked candidate's "@DisplayName" in place of the live
// "@query" token, plus a trailing space so typing continues naturally
// right after it. Returns the new text and where the cursor should land.
export function insertMention(
  text: string,
  trigger: MentionTrigger,
  cursor: number,
  candidate: MentionCandidate
): { text: string; cursor: number } {
  const token = `@${candidate.displayName} `;
  const before = text.slice(0, trigger.atIndex);
  const after = text.slice(cursor);
  const newText = `${before}${token}${after}`;
  return { text: newText, cursor: before.length + token.length };
}

// ── resolving confirmed mentions back to indices ────────────────────────
// Rather than hand-tracking each mention's [start,end) through every single
// keystroke the user makes elsewhere in the message (fragile — an edit
// before a mention would have to shift every later mention's indices, an
// edit *inside* one would have to invalidate it, etc.), the composer just
// remembers *which* entities were picked ("confirmed tokens") and this
// function re-derives their positions from scratch against the message's
// current text whenever it's needed (on every render, and once more right
// before sending). That naturally handles every edit case correctly:
//   - typing before/after a mention shifts its match, which this finds fresh
//   - deleting/retyping part of a mention's text removes that match, so it
//     silently reverts to being plain, unlinked text (never throws)
//   - the same entity confirmed twice (or the same text appearing twice)
//     both get matched, left to right, without overlapping
export function computeMentions(text: string, confirmed: MentionCandidate[]): Mention[] {
  if (confirmed.length === 0) return [];

  // Longer display names first, so e.g. "@John" doesn't grab a match that
  // should belong to "@John Smith" starting at the same position.
  const uniqueByToken = new Map<string, MentionCandidate>();
  for (const c of confirmed) {
    uniqueByToken.set(`${c.entityType}:${c.entityId}:${c.displayName}`, c);
  }
  const tokens = Array.from(uniqueByToken.values()).sort((a, b) => b.displayName.length - a.displayName.length);

  type Candidate = { start: number; end: number; token: MentionCandidate };
  const spans: Candidate[] = [];
  for (const token of tokens) {
    const needle = `@${token.displayName}`;
    let from = 0;
    for (;;) {
      const idx = text.indexOf(needle, from);
      if (idx === -1) break;
      spans.push({ start: idx, end: idx + needle.length, token });
      from = idx + needle.length;
    }
  }

  // Earliest start first; on a tie, the longer (more specific) match wins.
  spans.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const result: Mention[] = [];
  let lastEnd = -1;
  for (const span of spans) {
    if (span.start < lastEnd) continue; // overlaps an already-accepted match
    result.push({
      entityType: span.token.entityType,
      entityId: span.token.entityId,
      displayName: span.token.displayName,
      startIndex: span.start,
      endIndex: span.end,
    });
    lastEnd = span.end;
  }
  return result;
}

// ── rendering ────────────────────────────────────────────────────────────
export type TextSegment =
  | { type: "text"; text: string }
  | { type: "mention"; text: string; mention: Mention };

// Splits a stored comment body into plain-text/mention segments for
// rendering — tolerant of a corrupt/out-of-range mention (an old message
// from before a schema change, a future format, etc.): any mention whose
// indices don't line up with the actual text is simply skipped rather than
// throwing or mis-rendering.
export function splitTextWithMentions(body: string, mentions: Mention[] | null | undefined): TextSegment[] {
  const valid = (mentions ?? [])
    .filter(
      (m) =>
        Number.isInteger(m.startIndex) &&
        Number.isInteger(m.endIndex) &&
        m.startIndex >= 0 &&
        m.endIndex > m.startIndex &&
        m.endIndex <= body.length
    )
    .sort((a, b) => a.startIndex - b.startIndex);

  // Drop any mention that overlaps a previous (already-accepted) one —
  // guards against corrupt data producing overlapping spans.
  const accepted: Mention[] = [];
  let cursor = 0;
  for (const m of valid) {
    if (m.startIndex < cursor) continue;
    accepted.push(m);
    cursor = m.endIndex;
  }

  const segments: TextSegment[] = [];
  let pos = 0;
  for (const m of accepted) {
    if (m.startIndex > pos) {
      segments.push({ type: "text", text: body.slice(pos, m.startIndex) });
    }
    segments.push({ type: "mention", text: body.slice(m.startIndex, m.endIndex), mention: m });
    pos = m.endIndex;
  }
  if (pos < body.length) {
    segments.push({ type: "text", text: body.slice(pos) });
  }
  return segments;
}

// ── suggestion ranking ───────────────────────────────────────────────────
// "Prioritize exact and prefix matches" — exact match first, then
// starts-with, then contains-anywhere; ties broken by shorter name (a
// closer match to a short query) then alphabetically, for stable ordering.
export function rankByQuery<T extends { displayName: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const rank = (name: string): number => {
    const n = name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.includes(q)) return 2;
    return 3;
  };
  return [...items]
    .filter((i) => rank(i.displayName) < 3)
    .sort((a, b) => {
      const ra = rank(a.displayName);
      const rb = rank(b.displayName);
      if (ra !== rb) return ra - rb;
      if (a.displayName.length !== b.displayName.length) return a.displayName.length - b.displayName.length;
      return a.displayName.localeCompare(b.displayName);
    });
}
