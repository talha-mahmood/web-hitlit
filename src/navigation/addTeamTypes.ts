import type { Database } from "../types/database.types";
import type { SquadGroupType } from "../lib/api/squads";

// Carried from TournamentTeamsSection's "Add Team" button through to
// CreateSquadScreen (if the player has no team-type group yet) and back to
// AddTeamScreen once the new group exists — see addTeamTypes' README-style
// comment on AddTeamParams below for the full round trip.
export type AddTeamReturnTo = {
  gameId: string;
  teamId: string;
  requiredSize: number;
  excludeUserIds: string[];
  gameGender: Database["public"]["Enums"]["game_gender_type"];
};

// squadId is omitted on first entry (from the match card's "Add Team"
// button) and present when arriving back from CreateSquadScreen's
// returnTo — AddTeamScreen shows its own squad picker in the first case and
// skips straight to the add-players flow in the second.
export type AddTeamParams = AddTeamReturnTo & { squadId?: string };

export type CreateSquadRouteParams =
  | { presetType?: SquadGroupType; lockType?: boolean; presetSportId?: string; lockSport?: boolean; returnTo?: AddTeamReturnTo }
  | undefined;
