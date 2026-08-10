// Shared rule for every "name"/"title" field in the app (game/tournament
// title, squad name, team name, full name): must be at least 3 characters
// (after trimming) and start with a capital letter.
export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 3 && /^[A-Z]/.test(trimmed);
}

export const NAME_REQUIREMENT_HINT = "at least 3 letters long, starting with a capital letter";
