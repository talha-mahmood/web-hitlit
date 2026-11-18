// Shared rule for every "name"/"title" field in the app (game/tournament
// title, squad name, team name, full name): must be at least 3 characters
// (after trimming) and start with a capital letter.
export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 3 && /^[A-Z]/.test(trimmed);
}

export const NAME_REQUIREMENT_HINT = "at least 3 letters long, starting with a capital letter";

// Postgres/PostgREST report a unique-index violation as SQLSTATE 23505 —
// used to turn a raw "duplicate key value violates unique constraint ..."
// error into a message that actually tells the user what to do.
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

// Postgres reports an exclusion-constraint violation (e.g. the overlapping-
// bookings guard) as SQLSTATE 23P01.
export function isExclusionViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23P01";
}
