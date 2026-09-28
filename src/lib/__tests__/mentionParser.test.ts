import {
  findActiveMentionTrigger,
  insertMention,
  computeMentions,
  splitTextWithMentions,
  rankByQuery,
  type Mention,
  type MentionCandidate,
} from "../mentionParser";

describe("findActiveMentionTrigger", () => {
  it("detects a trigger right at the start of the message", () => {
    expect(findActiveMentionTrigger("@John", 5)).toEqual({ atIndex: 0, query: "John" });
  });

  it("detects a trigger after whitespace", () => {
    const text = "Great goal by @John";
    expect(findActiveMentionTrigger(text, text.length)).toEqual({ atIndex: 14, query: "John" });
  });

  it("supports a multi-word query as the user keeps typing a name", () => {
    const text = "Amazing win for @United Warriors";
    expect(findActiveMentionTrigger(text, text.length)).toEqual({ atIndex: 16, query: "United Warriors" });
  });

  it("does not trigger inside a word (e.g. an email address)", () => {
    const text = "email@domain.com";
    expect(findActiveMentionTrigger(text, text.length)).toBeNull();
  });

  it("returns null when there is no @ before the cursor", () => {
    expect(findActiveMentionTrigger("no mention here", 5)).toBeNull();
  });

  it("only considers text up to the cursor, not the whole message", () => {
    // Cursor sits right after "@John", before " scored..." — a mention typed
    // earlier and then the user moved the cursor back to it must still work.
    const text = "@John scored a goal";
    expect(findActiveMentionTrigger(text, 5)).toEqual({ atIndex: 0, query: "John" });
  });

  it("abandons the trigger on a newline", () => {
    const text = "@John\nSmith";
    expect(findActiveMentionTrigger(text, text.length)).toBeNull();
  });

  it("abandons the trigger on a double space (user gave up mentioning)", () => {
    const text = "@John  Smith";
    expect(findActiveMentionTrigger(text, text.length)).toBeNull();
  });

  it("abandons the trigger once a second @ appears", () => {
    const text = "@John and @Jane";
    // Cursor at the end should key off the second "@", not the first.
    expect(findActiveMentionTrigger(text, text.length)).toEqual({ atIndex: 10, query: "Jane" });
  });

  it("abandons an unreasonably long, unmatched query", () => {
    const text = "@" + "a".repeat(41);
    expect(findActiveMentionTrigger(text, text.length)).toBeNull();
  });
});

describe("insertMention", () => {
  it("replaces the live query with the picked display name and a trailing space", () => {
    const text = "Great goal by @Joh";
    const trigger = { atIndex: 14, query: "Joh" };
    const candidate: MentionCandidate = { entityType: "player", entityId: "p1", displayName: "John Smith" };
    const result = insertMention(text, trigger, text.length, candidate);
    expect(result.text).toBe("Great goal by @John Smith ");
    expect(result.cursor).toBe(result.text.length);
  });

  it("preserves text typed after the cursor", () => {
    const text = "Shoutout to @Jo for the win!";
    const trigger = { atIndex: 12, query: "Jo" };
    const cursor = 15; // right after "Jo"
    const candidate: MentionCandidate = { entityType: "squad", entityId: "s1", displayName: "United Warriors" };
    const result = insertMention(text, trigger, cursor, candidate);
    expect(result.text).toBe("Shoutout to @United Warriors  for the win!");
  });
});

describe("computeMentions", () => {
  it("returns nothing when no mentions were confirmed", () => {
    expect(computeMentions("just plain text", [])).toEqual([]);
  });

  it("finds a single confirmed mention", () => {
    const text = "Great goal by @John Smith today!";
    const confirmed: MentionCandidate[] = [{ entityType: "player", entityId: "p1", displayName: "John Smith" }];
    expect(computeMentions(text, confirmed)).toEqual([
      { entityType: "player", entityId: "p1", displayName: "John Smith", startIndex: 14, endIndex: 25 },
    ]);
  });

  it("handles multiple different mentions in one message", () => {
    const text = "@John Smith scored in @Champions League Final for @United Warriors!";
    const confirmed: MentionCandidate[] = [
      { entityType: "player", entityId: "p1", displayName: "John Smith" },
      { entityType: "game", entityId: "g1", displayName: "Champions League Final" },
      { entityType: "squad", entityId: "s1", displayName: "United Warriors" },
    ];
    const result = computeMentions(text, confirmed);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.entityId)).toEqual(["p1", "g1", "s1"]);
    expect(result.map((m) => text.slice(m.startIndex, m.endIndex))).toEqual([
      "@John Smith",
      "@Champions League Final",
      "@United Warriors",
    ]);
  });

  it("finds the same entity mentioned twice", () => {
    const text = "@John Smith passed to John, then @John Smith scored!";
    const confirmed: MentionCandidate[] = [{ entityType: "player", entityId: "p1", displayName: "John Smith" }];
    const result = computeMentions(text, confirmed);
    expect(result).toHaveLength(2);
    expect(result[0].startIndex).toBe(0);
    expect(result[1].startIndex).toBe(text.lastIndexOf("@John Smith"));
  });

  it("drops a mention whose text was edited away", () => {
    // User picked "John Smith" then deleted part of it — no exact "@John
    // Smith" substring remains, so it must not produce a broken mention.
    const text = "Great goal by @John today!";
    const confirmed: MentionCandidate[] = [{ entityType: "player", entityId: "p1", displayName: "John Smith" }];
    expect(computeMentions(text, confirmed)).toEqual([]);
  });

  it("prefers the longer, more specific name when one is a prefix of another", () => {
    const text = "@John Smith is playing";
    const confirmed: MentionCandidate[] = [
      { entityType: "player", entityId: "p2", displayName: "John" },
      { entityType: "player", entityId: "p1", displayName: "John Smith" },
    ];
    const result = computeMentions(text, confirmed);
    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe("p1");
    expect(text.slice(result[0].startIndex, result[0].endIndex)).toBe("@John Smith");
  });

  it("deduplicates identical confirmed tokens picked more than once", () => {
    const text = "@John Smith and @John Smith";
    const confirmed: MentionCandidate[] = [
      { entityType: "player", entityId: "p1", displayName: "John Smith" },
      { entityType: "player", entityId: "p1", displayName: "John Smith" },
    ];
    expect(computeMentions(text, confirmed)).toHaveLength(2);
  });

  it("handles a display name containing special characters", () => {
    const text = "Big win for @Team #1 (2026)!";
    const confirmed: MentionCandidate[] = [{ entityType: "squad", entityId: "s1", displayName: "Team #1 (2026)" }];
    const result = computeMentions(text, confirmed);
    expect(result).toHaveLength(1);
    expect(text.slice(result[0].startIndex, result[0].endIndex)).toBe("@Team #1 (2026)");
  });
});

describe("splitTextWithMentions", () => {
  it("returns the whole body as one text segment when there are no mentions", () => {
    expect(splitTextWithMentions("hello world", [])).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("splits plain text around a single mention", () => {
    const body = "Great goal by @John Smith today!";
    const mentions: Mention[] = [
      { entityType: "player", entityId: "p1", displayName: "John Smith", startIndex: 14, endIndex: 25 },
    ];
    expect(splitTextWithMentions(body, mentions)).toEqual([
      { type: "text", text: "Great goal by " },
      { type: "mention", text: "@John Smith", mention: mentions[0] },
      { type: "text", text: " today!" },
    ]);
  });

  it("handles multiple mentions mixed with normal text", () => {
    const body = "@John Smith scored for @United Warriors";
    const squadStart = body.indexOf("@United Warriors");
    const mentions: Mention[] = [
      { entityType: "player", entityId: "p1", displayName: "John Smith", startIndex: 0, endIndex: 11 },
      { entityType: "squad", entityId: "s1", displayName: "United Warriors", startIndex: squadStart, endIndex: squadStart + "@United Warriors".length },
    ];
    const segments = splitTextWithMentions(body, mentions);
    expect(segments.map((s) => s.text).join("")).toBe(body);
    expect(segments.filter((s) => s.type === "mention")).toHaveLength(2);
  });

  it("silently drops a mention with out-of-range indices instead of throwing", () => {
    const body = "short";
    const mentions: Mention[] = [
      { entityType: "player", entityId: "p1", displayName: "Way too long a name", startIndex: 0, endIndex: 999 },
    ];
    expect(() => splitTextWithMentions(body, mentions)).not.toThrow();
    expect(splitTextWithMentions(body, mentions)).toEqual([{ type: "text", text: "short" }]);
  });

  it("drops an overlapping mention rather than mis-rendering", () => {
    const body = "@John Smith";
    const mentions: Mention[] = [
      { entityType: "player", entityId: "p1", displayName: "John Smith", startIndex: 0, endIndex: 11 },
      { entityType: "player", entityId: "p2", displayName: "John", startIndex: 0, endIndex: 5 },
    ];
    const segments = splitTextWithMentions(body, mentions);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: "mention", text: "@John Smith" });
  });

  it("tolerates a null/undefined mentions array (old data before this feature existed)", () => {
    expect(splitTextWithMentions("hello", null)).toEqual([{ type: "text", text: "hello" }]);
    expect(splitTextWithMentions("hello", undefined)).toEqual([{ type: "text", text: "hello" }]);
  });
});

describe("rankByQuery", () => {
  const items = [
    { displayName: "Johnathan" },
    { displayName: "John Smith" },
    { displayName: "John" },
    { displayName: "Big John" },
    { displayName: "Someone Else" },
  ];

  it("puts an exact match first", () => {
    const ranked = rankByQuery(items, "John");
    expect(ranked[0].displayName).toBe("John");
  });

  it("puts prefix matches before contains-anywhere matches", () => {
    const ranked = rankByQuery(items, "John");
    const names = ranked.map((r) => r.displayName);
    expect(names.indexOf("John Smith")).toBeLessThan(names.indexOf("Big John"));
  });

  it("excludes items that don't match at all", () => {
    const ranked = rankByQuery(items, "John");
    expect(ranked.map((r) => r.displayName)).not.toContain("Someone Else");
  });

  it("is case-insensitive", () => {
    const ranked = rankByQuery(items, "john");
    expect(ranked[0].displayName).toBe("John");
  });

  it("returns the original list unchanged for an empty query", () => {
    expect(rankByQuery(items, "")).toEqual(items);
  });
});
