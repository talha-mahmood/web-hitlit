import { Text, View } from "react-native";
import { usePadelMatch } from "../hooks/usePadel";
import { useTennisMatch } from "../hooks/useTennis";
import { useBadmintonMatch } from "../hooks/useBadminton";
import { usePickleballMatch } from "../hooks/usePickleball";
import { useTableTennisMatch } from "../hooks/useTableTennis";
import { useFootballMatch } from "../hooks/useFootball";
import { formatSetScore as formatPadelSet } from "../lib/padelScoring";
import { formatSetScore as formatTennisSet } from "../lib/tennisScoring";
import { computeScoreSummary, computePenaltyShootoutState, type Phase } from "../lib/footballScoring";
import { goalRowToEvent, penaltyKickRowToEvent } from "../lib/api/football";
import { computeMatchState as computePadelState } from "../screens/scorecard/PadelHomeScreen";
import { computeMatchState as computeTennisState } from "../screens/scorecard/TennisHomeScreen";
import { computeMatchState as computeBadmintonState } from "../screens/scorecard/BadmintonHomeScreen";
import { computeMatchState as computePickleballState } from "../screens/scorecard/PickleballHomeScreen";
import { computeMatchState as computeTableTennisState } from "../screens/scorecard/TableTennisHomeScreen";
import type { ScorecardSport } from "../lib/api/tournamentMatches";

// The point-by-point detail line shown under a tournament match's result —
// what cricket's run rates are for a cricket match: sets/games/goals scored,
// in the same team order as the row above it (team A first).
function DetailLine({ text }: { text: string }) {
  return (
    <View className="mt-1">
      <Text className="text-muted text-xs" numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function PadelDetails({ id }: { id: string }) {
  const { data: match } = usePadelMatch(id);
  if (!match) return null;
  const state = computePadelState(match);
  const played = state.sets.filter((s) => s.winner || s.gamesA > 0 || s.gamesB > 0);
  if (played.length === 0) return null;
  return <DetailLine text={`Sets: ${played.map((s) => `${formatPadelSet(s, "A")}-${formatPadelSet(s, "B")}`).join(", ")}`} />;
}

function TennisDetails({ id }: { id: string }) {
  const { data: match } = useTennisMatch(id);
  if (!match) return null;
  const state = computeTennisState(match);
  const played = state.sets.filter((s) => s.winner || s.gamesA > 0 || s.gamesB > 0);
  if (played.length === 0) return null;
  return <DetailLine text={`Sets: ${played.map((s) => `${formatTennisSet(s, "A")}-${formatTennisSet(s, "B")}`).join(", ")}`} />;
}

function GamesLine({ games }: { games: { scoreA: number; scoreB: number }[] }) {
  const played = games.filter((g) => g.scoreA > 0 || g.scoreB > 0);
  if (played.length === 0) return null;
  return <DetailLine text={`Games: ${played.map((g) => `${g.scoreA}-${g.scoreB}`).join(", ")}`} />;
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
  if (summary.halfTime.a + summary.halfTime.b > 0 || match.phase !== "FIRST_HALF") {
    parts.push(`HT ${summary.halfTime.a}-${summary.halfTime.b}`);
  }
  if (match.phase === "PENALTIES" || match.phase === "COMPLETE") {
    const kicks = [...match.football_penalty_kicks].sort((a, b) => a.seq - b.seq).map(penaltyKickRowToEvent);
    if (kicks.length > 0) {
      const shootout = computePenaltyShootoutState(kicks);
      parts.push(`Pens ${shootout.scoreA}-${shootout.scoreB}`);
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
  }
}

type LinkedIds = {
  padel_match_id: string | null;
  tennis_match_id: string | null;
  badminton_match_id: string | null;
  pickleball_match_id: string | null;
  table_tennis_match_id: string | null;
  football_match_id: string | null;
};

// For a tournament match row: shows the score detail of whichever scorecard
// (if any) was started from it via "Go To Scorecard".
export function LinkedMatchScoreDetails({ match }: { match: LinkedIds }) {
  if (match.padel_match_id) return <MatchScoreDetails sport="padel" scorecardMatchId={match.padel_match_id} />;
  if (match.tennis_match_id) return <MatchScoreDetails sport="tennis" scorecardMatchId={match.tennis_match_id} />;
  if (match.badminton_match_id) return <MatchScoreDetails sport="badminton" scorecardMatchId={match.badminton_match_id} />;
  if (match.pickleball_match_id) return <MatchScoreDetails sport="pickleball" scorecardMatchId={match.pickleball_match_id} />;
  if (match.table_tennis_match_id) return <MatchScoreDetails sport="table_tennis" scorecardMatchId={match.table_tennis_match_id} />;
  if (match.football_match_id) return <MatchScoreDetails sport="football" scorecardMatchId={match.football_match_id} />;
  return null;
}
