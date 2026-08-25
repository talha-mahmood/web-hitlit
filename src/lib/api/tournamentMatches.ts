import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import { pairTeamsForFixtures } from "../tournamentFixtures";

type MatchRow = Database["public"]["Tables"]["tournament_matches"]["Row"];
type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

export type TournamentMatch = MatchRow & {
  team_a: { id: string; name: string } | null;
  team_b: { id: string; name: string } | null;
  winner_team: { id: string; name: string } | null;
};

const MATCH_SELECT =
  "*, team_a:tournament_teams!tournament_matches_team_a_id_fkey(id, name), team_b:tournament_teams!tournament_matches_team_b_id_fkey(id, name), winner_team:tournament_teams!tournament_matches_winner_team_id_fkey(id, name)";

export async function fetchMatchesForTournament(gameId: string): Promise<TournamentMatch[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(MATCH_SELECT)
    .eq("game_id", gameId)
    .order("round", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TournamentMatch[];
}

// Shared by every round's generation — a bye (no second team) is inserted
// already COMPLETED with team_a as the winner, so it never blocks the round
// from being considered "decided" and doesn't need a manual result.
async function insertRound(
  gameId: string,
  round: number,
  pairs: { teamA: { id: string }; teamB: { id: string } | null }[],
  poolId: string | null = null
): Promise<void> {
  if (pairs.length === 0) return;
  const { error } = await supabase.from("tournament_matches").insert(
    pairs.map((p, i) => ({
      game_id: gameId,
      round,
      pool_id: poolId,
      team_a_id: p.teamA.id,
      team_b_id: p.teamB?.id ?? null,
      sort_order: i,
      ...(p.teamB
        ? {}
        : { status: "COMPLETED" as const, winner_team_id: p.teamA.id, played_at: new Date().toISOString() }),
    }))
  );
  if (error) throw new Error(error.message);
}

// Host-only, and only meant to be called once the tournament's team slots
// are full — round 1, paired according to the tournament's actual format
// (round-robin for LEAGUE, single-elimination for KNOCKOUT).
export async function generateMatches(
  gameId: string,
  format: TournamentFormat,
  teams: { id: string; name: string }[]
): Promise<void> {
  await insertRound(gameId, 1, pairTeamsForFixtures(format, teams));
}

// Host-only: the next bracket round, seeded from whichever teams are
// advancing (knockout winners, or a league's top standings for playoffs).
// Always knockout-paired — a semi-final/final stage is inherently
// single-elimination even inside a league tournament.
export async function generateNextRound(
  gameId: string,
  round: number,
  teams: { id: string; name: string }[]
): Promise<void> {
  await insertRound(gameId, round, pairTeamsForFixtures("KNOCKOUT", teams));
}

// Host-only, and only meant to be called once every approved team has been
// assigned to a group — round-robin *within* each pool separately (teams in
// different pools never play each other in the group stage).
export async function generatePoolMatches(
  gameId: string,
  pools: { poolId: string; teams: { id: string; name: string }[] }[]
): Promise<void> {
  for (const pool of pools) {
    await insertRound(gameId, 1, pairTeamsForFixtures("LEAGUE", pool.teams), pool.poolId);
  }
}

export async function enterMatchResult(
  matchId: string,
  result: { winnerTeamId: string | null; isDraw: boolean }
): Promise<void> {
  const { error } = await supabase
    .from("tournament_matches")
    .update({
      status: "COMPLETED",
      winner_team_id: result.isDraw ? null : result.winnerTeamId,
      is_draw: result.isDraw,
      played_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// Lets the host correct a mis-entered result without deleting the match.
export async function resetMatchResult(matchId: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_matches")
    .update({ status: "PENDING", winner_team_id: null, is_draw: false, played_at: null })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}
