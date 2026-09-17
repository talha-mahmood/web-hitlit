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

export function getFriendlyErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
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
  if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
    return "Network error — please check your connection and try again.";
  }
  return message;
}
