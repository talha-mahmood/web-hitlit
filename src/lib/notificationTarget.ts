/**
 * The destination encoded in a notification's existing data payload.
 * Kept independent from React Navigation so inbox rows, foreground banners,
 * and OS notification taps all interpret the same payload consistently.
 */
export type NotificationTarget =
  | { screen: "TeamFixtureDetails"; params: { fixtureId: string } }
  | { screen: "TeamChallengeDetails"; params: { challengeId: string } }
  | { screen: "GameDetail"; params: { gameId: string } }
  | { screen: "SquadDetail"; params: { squadId: string } }
  | { screen: "CommentThread"; params: { rootId: string; highlightId?: string } }
  | { screen: "EventDetail"; params: { eventId: string } }
  | { screen: "VenueDetail"; params: { venueId: string } }
  | { screen: "VenueBookings"; params: { venueId: string } };

function stringValue(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function resolveNotificationTarget(
  payload: unknown,
  options: { isAdmin?: boolean } = {},
): NotificationTarget | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const outer = payload as Record<string, unknown>;
  const nestedData = outer.data;
  const data = nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
    ? { ...outer, ...(nestedData as Record<string, unknown>) }
    : outer;

  // Accepted challenges also carry challengeId. Prefer the fixture so both
  // teams land on the confirmed match rather than its request record.
  const fixtureId = stringValue(data, "fixtureId", "fixture_id");
  if (fixtureId) return { screen: "TeamFixtureDetails", params: { fixtureId } };

  const challengeId = stringValue(data, "challengeId", "challenge_id");
  if (challengeId) return { screen: "TeamChallengeDetails", params: { challengeId } };

  const gameId = stringValue(data, "gameId", "game_id");
  if (gameId) return { screen: "GameDetail", params: { gameId } };

  const squadId = stringValue(data, "squadId", "squad_id");
  if (squadId) return { screen: "SquadDetail", params: { squadId } };

  const commentId = stringValue(data, "commentId", "comment_id", "rootId", "root_id");
  if (commentId) {
    const highlightId = stringValue(data, "highlightId", "highlight_id");
    return { screen: "CommentThread", params: { rootId: commentId, ...(highlightId ? { highlightId } : {}) } };
  }

  const eventId = stringValue(data, "eventId", "event_id");
  if (eventId) return { screen: "EventDetail", params: { eventId } };

  const venueId = stringValue(data, "venueId", "venue_id");
  if (venueId) {
    return options.isAdmin
      ? { screen: "VenueBookings", params: { venueId } }
      : { screen: "VenueDetail", params: { venueId } };
  }

  return undefined;
}

/** A push may carry only the database notification ID; use it to fetch its target. */
export function resolveNotificationRecordId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const outer = payload as Record<string, unknown>;
  const nestedData = outer.data;
  const data = nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
    ? { ...outer, ...(nestedData as Record<string, unknown>) }
    : outer;
  return stringValue(data, "notificationId", "notification_id");
}
