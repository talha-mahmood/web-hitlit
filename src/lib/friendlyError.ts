// Postgres/PostgREST error text ("duplicate key value violates unique
// constraint ...", "violates row-level security policy", etc.) is never
// something a user should see — this maps the telltale raw-database
// phrasing (plus a few specific constraint names worth a tailored message)
// to plain language, and falls back to the caller's own fallback text for
// anything else unrecognized. Errors thrown deliberately elsewhere in the
// app (e.g. "Team names must be unique...") already read fine and pass
// through untouched.
const KNOWN_CONSTRAINT_MESSAGES: Record<string, string> = {
  tournament_teams_name_unique_per_game:
    "A team with this name is already registered in this tournament. Please choose a different name.",
  games_time_check: "End time must be after the start time. Please check the times and try again.",
};

// Every way "no internet" shows up as a thrown error across iOS, Android
// and web — React Native's fetch ("Network request failed"), Safari/WebKit
// ("Load failed"), Node-style DNS/socket errors Supabase's client can
// surface (getaddrinfo ENOTFOUND, ECONNREFUSED, ECONNRESET), a request that
// never got a response (timeout/AbortError), and the plain-English iOS
// message. Checked first, and before anything else gets a chance to leak a
// raw Supabase/Postgres error — a dropped connection is by far the most
// common reason any request fails, and users should never see "fetch
// failed" or a database error for what's just their own internet being off.
// Exported so the sport-specific friendly-error helpers (cricket.ts,
// football.ts, etc. — they each add one scoring-specific message on top of
// the same base checks as this file) catch the same offline cases.
export const OFFLINE_PATTERN =
  /network request failed|fetch failed|failed to fetch|load failed|network error|the internet connection appears to be offline|could not connect to the server|no internet|is offline|getaddrinfo|econnrefused|econnreset|enotfound|etimedout|request timed out|timed out|aborterror/i;

export function getFriendlyErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const name = err instanceof Error ? err.name : "";
  if (!message && !name) return fallback;

  if (OFFLINE_PATTERN.test(message) || OFFLINE_PATTERN.test(name)) {
    return "You're offline — please check your internet connection and try again.";
  }
  if (!message) return fallback;

  for (const constraint in KNOWN_CONSTRAINT_MESSAGES) {
    if (message.includes(constraint)) return KNOWN_CONSTRAINT_MESSAGES[constraint];
  }

  if (/duplicate key value|violates unique constraint/i.test(message)) {
    return "That already exists — please use a different name and try again.";
  }
  if (/violates row-level security policy|permission denied/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (
    /violates|constraint|relation .* does not exist|column .* does not exist|syntax error|JWT|PGRST\d/i.test(
      message
    )
  ) {
    return fallback;
  }
  return message;
}
