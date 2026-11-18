// Basic client-side content filter — required by App Store guideline 1.2
// ("a method for filtering objectionable content"). Deliberately simple: a
// normalized substring match against a small embedded keyword list, not a
// full profanity-detection library (none is installed). This is a
// first-line deterrent at the point of sending, not the app's only
// safeguard — report/block (showReportBlockActions) and the superadmin
// Reports screen (AdminModerationScreen) remain the backstop for anything
// this list misses.
const BLOCKED_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "whore",
  "slut",
  "faggot",
  "fag",
  "nigger",
  "nigga",
  "retard",
  "rape",
  "molest",
  "kill yourself",
  "kys",
];

// Strips anything that isn't a letter/digit so simple obfuscations like
// "f.u.c.k", "f_u_c_k", or "f u c k" still match the plain keyword.
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function containsObjectionableContent(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return BLOCKED_WORDS.some((word) => normalized.includes(normalize(word)));
}
