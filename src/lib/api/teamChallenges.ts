import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type ChallengeRow = Database["public"]["Tables"]["team_challenges"]["Row"];
type FixtureRow = Database["public"]["Tables"]["team_fixtures"]["Row"];

export type TeamChallengeFormat =
  | "5v5" | "7v7" | "11v11"
  | "T10" | "T20" | "ODI" | "Club"
  | "SINGLES" | "DOUBLES"
  | "BEST_OF_1" | "BEST_OF_3" | "BEST_OF_3_MATCH_TIEBREAK";
export type TeamChallengeStatus = "pending" | "accepted" | "declined" | "cancelled";
export type TeamChallengeTeam = {
  id: string;
  name: string;
  icon_url: string | null;
  location: string | null;
  squad_owner_id: string;
  group_type: string;
  sport_id: string | null;
  deleted_at: string | null;
  sports: { id: string; name: string } | null;
};

export type TeamChallenge = ChallengeRow & {
  sender: TeamChallengeTeam;
  receiver: TeamChallengeTeam;
  fixture: FixtureRow | null;
};

export type TeamFixture = FixtureRow & {
  home: Pick<TeamChallengeTeam, "id" | "name" | "icon_url">;
  away: Pick<TeamChallengeTeam, "id" | "name" | "icon_url">;
  sportName: string;
};

export type CreateTeamChallengeInput = {
  senderSquadId: string;
  receiverSquadId: string;
  venue: string;
  scheduledAt: string;
  matchFormat: TeamChallengeFormat;
  sportId: string;
  idempotencyKey: string;
  totalPlayers: number;
};

export type TeamFixturePrefill = {
  fixtureId: string;
  sportId: string;
  sportName: string;
  matchFormat: TeamChallengeFormat;
  teamAName: string;
  teamBName: string;
  venue: string;
};

export async function fetchTeamChallenges(managerSquadIds: string[]): Promise<TeamChallenge[]> {
  const squadIds = [...new Set(managerSquadIds)];
  if (squadIds.length === 0) return [];

  const [sentResult, receivedResult] = await Promise.all([
    supabase.from("team_challenges").select("*").in("sender_squad_id", squadIds),
    supabase.from("team_challenges").select("*").in("receiver_squad_id", squadIds),
  ]);
  if (sentResult.error) throw new Error(sentResult.error.message);
  if (receivedResult.error) throw new Error(receivedResult.error.message);

  const rows = new Map<string, ChallengeRow>();
  for (const row of [...(sentResult.data ?? []), ...(receivedResult.data ?? [])]) rows.set(row.id, row);
  const challenges = [...rows.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  if (challenges.length === 0) return [];

  const relatedSquadIds = [...new Set(challenges.flatMap((c) => [c.sender_squad_id, c.receiver_squad_id]))];
  const [squadsResult, fixturesResult] = await Promise.all([
    supabase
      .from("squads")
      .select("id, name, icon_url, location, squad_owner_id, group_type, sport_id, deleted_at, sports(id, name)")
      .in("id", relatedSquadIds),
    supabase.from("team_fixtures").select("*").in("challenge_id", challenges.map((c) => c.id)),
  ]);
  if (squadsResult.error) throw new Error(squadsResult.error.message);
  if (fixturesResult.error) throw new Error(fixturesResult.error.message);

  const squads = new Map(
    ((squadsResult.data ?? []) as unknown as TeamChallengeTeam[]).map((squad) => [squad.id, squad])
  );
  const fixtures = new Map((fixturesResult.data ?? []).map((fixture) => [fixture.challenge_id, fixture]));
  return challenges.flatMap((challenge) => {
    const sender = squads.get(challenge.sender_squad_id);
    const receiver = squads.get(challenge.receiver_squad_id);
    if (!sender || !receiver) return [];
    return [{ ...challenge, sender, receiver, fixture: fixtures.get(challenge.id) ?? null }];
  });
}

export async function fetchTeamFixtures(squadIds: string[]): Promise<TeamFixture[]> {
  const ids = [...new Set(squadIds)];
  if (ids.length === 0) return [];
  const [homeResult, awayResult] = await Promise.all([
    supabase.from("team_fixtures").select("*").in("home_squad_id", ids),
    supabase.from("team_fixtures").select("*").in("away_squad_id", ids),
  ]);
  if (homeResult.error) throw new Error(homeResult.error.message);
  if (awayResult.error) throw new Error(awayResult.error.message);
  const rows = new Map<string, FixtureRow>();
  for (const fixture of [...(homeResult.data ?? []), ...(awayResult.data ?? [])]) rows.set(fixture.id, fixture);
  const fixtures = [...rows.values()].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  if (fixtures.length === 0) return [];
  const relatedIds = [...new Set(fixtures.flatMap((fixture) => [fixture.home_squad_id, fixture.away_squad_id]))];
  const sportIds = [...new Set(fixtures.map((fixture) => fixture.sport_id))];
  const [squadsResult, sportsResult] = await Promise.all([
    supabase.from("squads").select("id, name, icon_url").in("id", relatedIds),
    supabase.from("sports").select("id, name").in("id", sportIds),
  ]);
  if (squadsResult.error) throw new Error(squadsResult.error.message);
  if (sportsResult.error) throw new Error(sportsResult.error.message);
  const squads = new Map(((squadsResult.data ?? []) as { id: string; name: string; icon_url: string | null }[]).map((squad) => [squad.id, squad]));
  const sports = new Map((sportsResult.data ?? []).map((sport) => [sport.id, sport.name]));
  return fixtures.flatMap((fixture) => {
    const home = squads.get(fixture.home_squad_id);
    const away = squads.get(fixture.away_squad_id);
    const sportName = sports.get(fixture.sport_id);
    return home && away && sportName ? [{ ...fixture, home, away, sportName }] : [];
  });
}

export async function fetchTeamFixture(fixtureId: string): Promise<TeamFixture> {
  const { data, error } = await supabase.from("team_fixtures").select("*").eq("id", fixtureId).single();
  if (error) throw new Error(error.message);
  const [squadsResult, sportResult] = await Promise.all([
    supabase.from("squads").select("id, name, icon_url").in("id", [data.home_squad_id, data.away_squad_id]),
    supabase.from("sports").select("name").eq("id", data.sport_id).single(),
  ]);
  if (squadsResult.error) throw new Error(squadsResult.error.message);
  if (sportResult.error) throw new Error(sportResult.error.message);
  const squads = new Map(((squadsResult.data ?? []) as { id: string; name: string; icon_url: string | null }[]).map((squad) => [squad.id, squad]));
  const home = squads.get(data.home_squad_id);
  const away = squads.get(data.away_squad_id);
  if (!home || !away) throw new Error("The teams for this fixture are unavailable.");
  return { ...data, home, away, sportName: sportResult.data.name };
}

export async function createTeamChallenge(input: CreateTeamChallengeInput): Promise<string> {
  const { data, error } = await supabase.rpc("send_team_challenge", {
    p_sender_squad_id: input.senderSquadId,
    p_receiver_squad_id: input.receiverSquadId,
    p_venue: input.venue.trim(),
    p_scheduled_at: input.scheduledAt,
    p_match_format: input.matchFormat,
    p_sport_id: input.sportId,
    p_idempotency_key: input.idempotencyKey,
    p_total_players: input.totalPlayers,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function respondToTeamChallenge(challengeId: string, accept: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc("respond_to_team_challenge", {
    p_challenge_id: challengeId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelTeamChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_team_challenge", { p_challenge_id: challengeId });
  if (error) throw new Error(error.message);
}

export async function linkTeamFixtureScorecard(fixtureId: string, scorecardMatchId: string, scorecardTable: string): Promise<void> {
  const { error } = await supabase.rpc("link_team_fixture_scorecard_sport", {
    p_fixture_id: fixtureId,
    p_scorecard_match_id: scorecardMatchId,
    p_scorecard_table: scorecardTable,
  });
  if (error) throw new Error(error.message);
}
