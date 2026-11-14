import { usePadelMatch } from "@app/hooks/usePadel";
import { useTennisMatch } from "@app/hooks/useTennis";
import { useBadmintonMatch } from "@app/hooks/useBadminton";
import { usePickleballMatch } from "@app/hooks/usePickleball";
import { useTableTennisMatch } from "@app/hooks/useTableTennis";
import { useFootballMatch } from "@app/hooks/useFootball";
import { formatSetScore as formatPadelSet } from "@app/lib/padelScoring";
import { formatSetScore as formatTennisSet } from "@app/lib/tennisScoring";
import { computeScoreSummary, computePenaltyShootoutState, type Phase } from "@app/lib/footballScoring";
import { goalRowToEvent, penaltyKickRowToEvent } from "@app/lib/api/football";
import type { ScorecardSport } from "@app/lib/api/tournamentMatches";
import { manualDetailText, manualRunRate, parseManualScore } from "@app/lib/manualScore";
import { computeBadmintonState, computePadelState, computePickleballState, computeTableTennisState, computeTennisState } from "@/lib/matchState";

// Port of MatchScoreDetails: one muted line of per-sport score detail
// (sets / games / goals, HT, pens) under a fixture, or a manual score's own.
function DetailLine({ text }: { text: string }) {
  return <p className="mt-1 line-clamp-2 text-xs text-muted">{text}</p>;
}

function PadelDetails({ id }: { id: string }) {
  const { data: match } = usePadelMatch(id);
  if (!match) return null;
  const played = computePadelState(match).sets.filter((s) => s.winner || s.gamesA > 0 || s.gamesB > 0);
  return played.length ? <DetailLine text={`Sets: ${played.map((s) => `${formatPadelSet(s, "A")}-${formatPadelSet(s, "B")}`).join(", ")}`} /> : null;
}

function TennisDetails({ id }: { id: string }) {
  const { data: match } = useTennisMatch(id);
  if (!match) return null;
  const played = computeTennisState(match).sets.filter((s) => s.winner || s.gamesA > 0 || s.gamesB > 0);
  return played.length ? <DetailLine text={`Sets: ${played.map((s) => `${formatTennisSet(s, "A")}-${formatTennisSet(s, "B")}`).join(", ")}`} /> : null;
}

function GamesLine({ games }: { games: { scoreA: number; scoreB: number }[] }) {
  const played = games.filter((g) => g.scoreA > 0 || g.scoreB > 0);
  return played.length ? <DetailLine text={`Games: ${played.map((g) => `${g.scoreA}-${g.scoreB}`).join(", ")}`} /> : null;
}

function BadmintonDetails({ id }: { id: string }) {
  const { data: match } = useBadmintonMatch(id);
  return match ? <GamesLine games={computeBadmintonState(match).games} /> : null;
}
function PickleballDetails({ id }: { id: string }) {
  const { data: match } = usePickleballMatch(id);
  return match ? <GamesLine games={computePickleballState(match).games} /> : null;
}
function TableTennisDetails({ id }: { id: string }) {
  const { data: match } = useTableTennisMatch(id);
  return match ? <GamesLine games={computeTableTennisState(match).games} /> : null;
}

function FootballDetails({ id }: { id: string }) {
  const { data: match } = useFootballMatch(id);
  if (!match) return null;
  const goals = [...match.football_goals].sort((a, b) => a.seq - b.seq).map(goalRowToEvent);
  const summary = computeScoreSummary(goals, match.phase as Phase, !!match.extra_time_first_kickoff_at);
  const parts = [`Score: ${summary.current.a}-${summary.current.b}`];
  if (summary.halfTime.a + summary.halfTime.b > 0 || match.phase !== "FIRST_HALF") parts.push(`HT ${summary.halfTime.a}-${summary.halfTime.b}`);
  if (match.phase === "PENALTIES" || match.phase === "COMPLETE") {
    const kicks = [...match.football_penalty_kicks].sort((a, b) => a.seq - b.seq).map(penaltyKickRowToEvent);
    if (kicks.length > 0) {
      const s = computePenaltyShootoutState(kicks);
      parts.push(`Pens ${s.scoreA}-${s.scoreB}`);
    }
  }
  return <DetailLine text={parts.join(" · ")} />;
}

export default function MatchScoreDetails({ sport, scorecardMatchId }: { sport: ScorecardSport; scorecardMatchId: string }) {
  switch (sport) {
    case "padel":
      return <PadelDetails id={scorecardMatchId} />;
    case "tennis":
      return <TennisDetails id={scorecardMatchId} />;
    case "badminton":
      return <BadmintonDetails id={scorecardMatchId} />;
    case "pickleball":
      return <PickleballDetails id={scorecardMatchId} />;
    case "table_tennis":
      return <TableTennisDetails id={scorecardMatchId} />;
    case "football":
      return <FootballDetails id={scorecardMatchId} />;
    default:
      return null;
  }
}

type LinkedIds = {
  padel_match_id: string | null;
  tennis_match_id: string | null;
  badminton_match_id: string | null;
  pickleball_match_id: string | null;
  table_tennis_match_id: string | null;
  football_match_id: string | null;
  manual_score: unknown;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
};

function ManualScoreDetails({ raw, teamAName, teamBName }: { raw: unknown; teamAName: string; teamBName: string }) {
  const score = parseManualScore(raw);
  if (!score) return null;
  if (score.sport === "cricket") {
    const rateFor = (side: "A" | "B") => {
      const innings = score.innings.find((i) => i.team === side);
      const rate = innings ? manualRunRate(innings) : null;
      return rate === null ? "" : `${side === "A" ? teamAName : teamBName} RR: ${rate.toFixed(2)}`;
    };
    return (
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">{rateFor("A")}</span>
        <span className="truncate">{rateFor("B")}</span>
      </div>
    );
  }
  const text = manualDetailText(score);
  return text ? <DetailLine text={text} /> : null;
}

export function LinkedMatchScoreDetails({ match }: { match: LinkedIds }) {
  if (match.manual_score) return <ManualScoreDetails raw={match.manual_score} teamAName={match.team_a?.name ?? "Team A"} teamBName={match.team_b?.name ?? "Team B"} />;
  if (match.padel_match_id) return <MatchScoreDetails sport="padel" scorecardMatchId={match.padel_match_id} />;
  if (match.tennis_match_id) return <MatchScoreDetails sport="tennis" scorecardMatchId={match.tennis_match_id} />;
  if (match.badminton_match_id) return <MatchScoreDetails sport="badminton" scorecardMatchId={match.badminton_match_id} />;
  if (match.pickleball_match_id) return <MatchScoreDetails sport="pickleball" scorecardMatchId={match.pickleball_match_id} />;
  if (match.table_tennis_match_id) return <MatchScoreDetails sport="table_tennis" scorecardMatchId={match.table_tennis_match_id} />;
  if (match.football_match_id) return <MatchScoreDetails sport="football" scorecardMatchId={match.football_match_id} />;
  return null;
}
