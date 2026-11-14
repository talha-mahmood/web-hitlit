import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useNetworkStore } from "@app/store/networkStore";
import { useCreatePickleballMatch, usePickleballMatch, useAddPickleballRally, useDeleteLastPickleballRally, useCompletePickleballMatch, usePickleballPendingCount } from "@app/hooks/usePickleball";
import { useLinkScorecardMatch, useSyncScorecardMatchResult } from "@app/hooks/useTournamentMatches";
import { friendlyPickleballError, rallyRowToEvent } from "@app/lib/api/pickleball";
import { replayPickleballMatch, formatTraditionalDoublesScore, matchResultSummary, type PickleballMatchConfig, type ScoringMode, type Team, type Indicator } from "@app/lib/pickleballScoring";
import { namesClash, hasBlockingDuplicateNames, disambiguateRoster } from "@app/lib/matchNameValidation";
import type { ScorecardPrefill } from "@app/lib/api/tournamentMatches";
import { buildGenericMatchReportHtml } from "@app/lib/matchReport/genericMatchReport";
import { generateAndShareMatchReport } from "@app/lib/matchReport/pdfShare";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { RACKET_SPORTS } from "@/lib/racketSports";
import FieldInput from "@/components/ui/FieldInput";
import { PillRow } from "@/components/forms/FormControls";
import SportNewMatchHeader from "@/components/scorecard/SportNewMatchHeader";
import {
  CardSection,
  InfoBox,
  TeamCard,
  NumberPresetSection,
  StartMatchButton,
  standardPresets,
  prefillPair,
  PLAY_MODE_OPTIONS,
  LOCKED_FIELD,
  PREFILL_LOCK_NOTE,
  DUPLICATE_PLAYERS_REASON,
  type PlayMode,
  type PlayerPair,
} from "@/components/scorecard/NewMatchParts";
import { CurrentGameCard, HistoryCard, IndicatorPill, LiveLoading, RacketCompleteView, RacketLiveView, ScorePills, ServerCard, useLiveMatchChannel, useScoringShortcuts } from "@/components/scorecard/RacketLive";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const META = RACKET_SPORTS.pickleball;
const HOME = `${paths.scorecard}/pickleball`;

const SCORING_MODE_OPTIONS: { label: string; value: ScoringMode }[] = [
  { label: "Side-Out Scoring", value: "SIDE_OUT" },
  { label: "Rally Scoring", value: "RALLY" },
];
const SCORING_MODE_INFO: Record<ScoringMode, string> = {
  SIDE_OUT: "Traditional rules — only the serving side can score. The receiving side winning a rally just gains the serve.",
  RALLY: "Every rally scores a point for whoever wins it, regardless of who's serving.",
};
const STANDARD_POINTS_TO_WIN = 11;
const GAMES_TO_WIN_PRESETS = [
  { label: "Best of 1", value: "1" },
  { label: "Best of 3", value: "2" },
  { label: "Best of 5", value: "3" },
];
const STANDARD_GAMES_TO_WIN = 2;
const INDICATOR_LABEL: Record<Exclude<Indicator, null>, string> = { GAME_POINT: "GAME POINT", MATCH_POINT: "MATCH POINT" };

// Port of PickleballNewMatchScreen.
export function PickleballNewMatchPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(HOME);
  const prefill = (useLocation().state as { prefill?: ScorecardPrefill } | null)?.prefill;
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreatePickleballMatch();
  const linkScorecardMatch = useLinkScorecardMatch(prefill?.gameId ?? "");

  const [teamAName, setTeamAName] = useState(prefill?.teamAName ?? "");
  const [teamBName, setTeamBName] = useState(prefill?.teamBName ?? "");
  const [teamAPlayers, setTeamAPlayers] = useState<PlayerPair>(prefillPair(prefill, "A"));
  const [teamBPlayers, setTeamBPlayers] = useState<PlayerPair>(prefillPair(prefill, "B"));
  const canOfferDoubles = !prefill || (prefill.teamAPlayers.length >= 2 && prefill.teamBPlayers.length >= 2);
  const playModeOptions = canOfferDoubles ? PLAY_MODE_OPTIONS : PLAY_MODE_OPTIONS.filter((o) => o.value !== "DOUBLES");
  const [playMode, setPlayMode] = useState<PlayMode | null>(canOfferDoubles ? "DOUBLES" : "SINGLES");
  const [scoringMode, setScoringMode] = useState<ScoringMode | null>("SIDE_OUT");
  const [firstServingTeam, setFirstServingTeam] = useState<Team | null>(null);
  const [venue, setVenue] = useState(prefill?.venue ?? "");
  const [pointsToWin, setPointsToWin] = useState<string | null>(String(STANDARD_POINTS_TO_WIN));
  const [gamesToWin, setGamesToWin] = useState<string | null>(String(STANDARD_GAMES_TO_WIN));

  const isDoubles = playMode === "DOUBLES";
  const doublesPlayersValid = !isDoubles || [...teamAPlayers, ...teamBPlayers].every((p) => p.name.trim().length > 0);
  const pointsToWinNumber = parseInt(pointsToWin ?? "", 10);
  const isPointsToWinValid = !!pointsToWin && pointsToWinNumber > 0;
  const gamesToWinNumber = parseInt(gamesToWin ?? "", 10);
  const isGamesToWinValid = !!gamesToWin && gamesToWinNumber > 0;

  const validationReason =
    (!teamAName.trim() ? `Enter a name for ${isDoubles ? "Team A" : "Player A"}.` : null) ??
    (!teamBName.trim() ? `Enter a name for ${isDoubles ? "Team B" : "Player B"}.` : null) ??
    (namesClash(teamAName, teamBName) ? `${isDoubles ? "Team A and Team B" : "Player A and Player B"} can't have the same name.` : null) ??
    (!doublesPlayersValid ? "Enter both players' names for each doubles team." : null) ??
    (isDoubles && hasBlockingDuplicateNames([...teamAPlayers, ...teamBPlayers]) ? DUPLICATE_PLAYERS_REASON : null) ??
    (!playMode ? "Pick Singles or Doubles." : null) ??
    (!scoringMode ? "Pick a scoring mode." : null) ??
    (!firstServingTeam ? "Pick who serves first." : null) ??
    (!isPointsToWinValid ? "Set the points needed to win a game." : null) ??
    (!isGamesToWinValid ? "Set the games needed to win the match." : null);
  const isValid = !validationReason;

  const handleCreate = () => {
    if (!isValid || !userId || !playMode || !scoringMode || !firstServingTeam) return;
    const { teamANames, teamBNames } = disambiguateRoster(
      teamAPlayers.map((p) => ({ name: p.name.trim(), sourceId: p.sourceId })),
      teamBPlayers.map((p) => ({ name: p.name.trim(), sourceId: p.sourceId }))
    );
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers: isDoubles ? teamANames.filter(Boolean) : [],
        teamBPlayers: isDoubles ? teamBNames.filter(Boolean) : [],
        scoringMode,
        playMode,
        firstServingTeam,
        pointsToWin: pointsToWinNumber,
        gamesToWin: gamesToWinNumber,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => {
          if (prefill) linkScorecardMatch.mutate({ matchId: prefill.tournamentMatchId, sport: "pickleball", scorecardMatchId: matchId });
          navigate(paths.match("pickleball", matchId), { replace: true });
        },
        onError: (err) => Alert.alert("Error", friendlyPickleballError(err, "Could not create match.")),
      }
    );
  };

  return (
    <div className="mx-auto max-w-3xl pb-16 lg:px-8">
      <SportNewMatchHeader sport="pickleball" title="New Pickleball Match" subtitle="Set up players and match rules" onBack={goBack} />
      <div className="px-5 pt-1 lg:px-0">
        {prefill && <InfoBox text={PREFILL_LOCK_NOTE} />}
        <div className={prefill ? "mt-4" : ""}>
          <CardSection icon="people-outline" title="Play Mode">
            <PillRow options={playModeOptions} value={playMode} onChange={setPlayMode} />
            {!canOfferDoubles && <InfoBox text="Doubles isn't available here — this tournament team only has one registered player." />}
          </CardSection>
        </div>

        {playMode && (
          <div className="md:grid md:grid-cols-2 md:gap-4">
            <TeamCard letter="A" name={teamAName} onNameChange={setTeamAName} playMode={playMode} players={teamAPlayers} onPlayersChange={setTeamAPlayers} locked={!!prefill} otherTeamName={teamBName} otherTeamPlayers={teamBPlayers} namePlaceholder="e.g. Alex" player2Placeholder="e.g. Jo" />
            <TeamCard letter="B" name={teamBName} onNameChange={setTeamBName} playMode={playMode} players={teamBPlayers} onPlayersChange={setTeamBPlayers} locked={!!prefill} otherTeamName={teamAName} otherTeamPlayers={teamAPlayers} namePlaceholder="e.g. Sam" player2Placeholder="e.g. Jo" />
          </div>
        )}

        <CardSection icon="location-outline" title="Venue">
          <FieldInput value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Pickleball Club Karachi" maxLength={60} disabled={!!prefill} aria-label="Venue" containerClassName={prefill ? LOCKED_FIELD : ""} />
        </CardSection>

        <CardSection icon="options-outline" title="Scoring Mode">
          <PillRow options={SCORING_MODE_OPTIONS} value={scoringMode} onChange={setScoringMode} />
          {scoringMode && <InfoBox text={SCORING_MODE_INFO[scoringMode]} />}
        </CardSection>

        <NumberPresetSection
          icon="flag-outline"
          title="Points To Win a Game"
          presets={standardPresets(["5", "7", "9", "11"], STANDARD_POINTS_TO_WIN)}
          value={pointsToWin}
          onChange={setPointsToWin}
          customLabel="Or enter a custom target"
          placeholder="e.g. 11"
          maxDigits={2}
          info={isPointsToWinValid ? `First to ${pointsToWinNumber} points, win by 2 clear, wins the game.` : "Enter how many points win a game."}
        />

        <NumberPresetSection
          icon="trophy-outline"
          title="Match Length"
          presets={GAMES_TO_WIN_PRESETS}
          value={gamesToWin}
          onChange={setGamesToWin}
          customLabel="Or enter a custom games-to-win"
          placeholder="e.g. 2"
          maxDigits={1}
          info={isGamesToWinValid ? `First to win ${gamesToWinNumber} game${gamesToWinNumber === 1 ? "" : "s"} (best of ${gamesToWinNumber * 2 - 1}) wins the match.` : "Enter how many games are needed to win the match."}
        />

        <CardSection icon="tennisball-outline" title={isDoubles ? "First Serving Team" : "First Server"}>
          <PillRow
            options={[
              { label: teamAName.trim() || (isDoubles ? "Team A" : "Player A"), value: "A" as const },
              { label: teamBName.trim() || (isDoubles ? "Team B" : "Player B"), value: "B" as const },
            ]}
            value={firstServingTeam}
            onChange={setFirstServingTeam}
          />
        </CardSection>

        <StartMatchButton valid={isValid} pending={createMatch.isPending} reason={validationReason} onPress={handleCreate} />
      </div>
    </div>
  );
}

// Port of PickleballLiveScoringScreen.
export function PickleballLivePage() {
  const { matchId = "" } = useParams();
  const back = useGoBack(HOME);
  const { data: match, isLoading } = usePickleballMatch(matchId);
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  useLiveMatchChannel(matchId, "pickleball_matches", "pickleball_rallies", "pickleballMatch");
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingCount = usePickleballPendingCount(matchId);
  const addRally = useAddPickleballRally(matchId);
  const deleteLastRally = useDeleteLastPickleballRally(matchId);
  const completeMatch = useCompletePickleballMatch();
  const syncTournamentResult = useSyncScorecardMatchResult();
  const profile = useProfileStore((s) => s.profile);
  const [generatingReport, setGeneratingReport] = useState(false);

  const rallies = useMemo(() => (match ? [...match.pickleball_rallies].sort((a, b) => a.seq - b.seq).map(rallyRowToEvent) : []), [match]);
  const config: PickleballMatchConfig | null = match
    ? {
        scoringMode: match.scoring_mode as PickleballMatchConfig["scoringMode"],
        playMode: match.play_mode as PickleballMatchConfig["playMode"],
        firstServingTeam: match.first_serving_team as Team,
        pointsToWin: match.points_to_win,
        gamesToWin: match.games_to_win,
      }
    : null;
  const configKey = JSON.stringify(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = useMemo(() => (config ? replayPickleballMatch(rallies, config) : null), [rallies, configKey]);

  useEffect(() => {
    if (!match || !state) return;
    if (state.isComplete && state.winner && match.status === "IN_PROGRESS" && !completeMatch.isPending) {
      const summary = matchResultSummary(match.team_a_name, match.team_b_name, state);
      completeMatch.mutate(
        { matchId: match.id, winnerTeam: state.winner, resultSummary: summary },
        {
          onSuccess: () => syncTournamentResult.mutate({ sport: "pickleball", scorecardMatchId: match.id, teamAWon: state.winner === "A" }),
          onError: (err) => Alert.alert("Error", friendlyPickleballError(err, "Could not save the match result.")),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  const live = !!match && !!state && !state.isComplete;
  const handleRally = (winner: Team) => {
    if (!state || state.isComplete || addRally.isPending) return;
    addRally.mutate({ seq: rallies.length + 1, winner }, { onError: (err) => Alert.alert("Error", friendlyPickleballError(err, "Could not record rally.")) });
  };
  const handleUndo = () => {
    if (rallies.length === 0) return;
    const last = rallies[rallies.length - 1];
    Alert.alert("Undo Last Point", "Remove the most recent point?", [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => deleteLastRally.mutate(last.seq, { onError: (err) => Alert.alert("Error", friendlyPickleballError(err, "Could not undo.")) }) },
    ]);
  };
  useScoringShortcuts(isScorer && live, handleRally, handleUndo);

  if (isLoading || !match || !state || !config) return <LiveLoading />;

  const isDoubles = config.playMode === "DOUBLES";
  const aPlayers = match.team_a_players.length > 0 ? match.team_a_players : [match.team_a_name];
  const bPlayers = match.team_b_players.length > 0 ? match.team_b_players : [match.team_b_name];
  const servingTeamName = state.server.servingTeam === "A" ? match.team_a_name : match.team_b_name;
  const servingPlayerName = isDoubles ? ((state.server.servingTeam === "A" ? aPlayers : bPlayers)[state.server.serverNumber - 1] ?? servingTeamName) : servingTeamName;
  const traditionalScore = formatTraditionalDoublesScore(state, config);
  const currentGame = state.games[state.games.length - 1];

  const handleReport = async () => {
    setGeneratingReport(true);
    try {
      const html = buildGenericMatchReportHtml({
        sportLabel: "Pickleball",
        teamAName: match.team_a_name,
        teamBName: match.team_b_name,
        finalScoreA: `${state.gamesWonA} games`,
        finalScoreB: `${state.gamesWonB} games`,
        resultSummary: match.result_summary,
        venue: match.venue,
        createdAt: match.created_at,
        playMode: isDoubles ? "Doubles" : "Singles",
        formatLabel: `Best of ${match.games_to_win * 2 - 1} games, ${match.points_to_win} points (${match.scoring_mode === "RALLY" ? "Rally" : "Side-out"} scoring)`,
        organiserName: profile?.full_name ?? "—",
        breakdownTitle: "Game-by-Game",
        breakdown: state.games.map((game, i) => ({ label: `Game ${i + 1}`, scoreA: String(game.scoreA), scoreB: String(game.scoreB) })),
        appName: "HitLit",
      });
      await generateAndShareMatchReport(html);
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not generate the match report."));
    } finally {
      setGeneratingReport(false);
    }
  };

  if (state.isComplete && state.winner) {
    return (
      <RacketCompleteView
        sportLabel="Pickleball"
        crestIcon={META.crestIcon}
        aName={match.team_a_name}
        bName={match.team_b_name}
        winner={state.winner}
        wonA={state.gamesWonA}
        wonB={state.gamesWonB}
        tallyLabel="GAMES"
        breakdown={state.games.map((g, i) => ({ label: `GAME ${i + 1}`, score: `${g.scoreA} - ${g.scoreB}` }))}
        onBack={back}
        onReport={handleReport}
        generatingReport={generatingReport}
      />
    );
  }

  return (
    <RacketLiveView
      sportLabel="Pickleball"
      aName={match.team_a_name}
      bName={match.team_b_name}
      isDoubles={isDoubles}
      aPlayers={aPlayers}
      bPlayers={bPlayers}
      scoringCode={match.scoring_code}
      onBack={back}
      isOnline={isOnline}
      pendingCount={pendingCount}
      unit="rally"
      summaryLabel="GAMES"
      wonA={state.gamesWonA}
      wonB={state.gamesWonB}
      firstToText={`First to ${config.gamesToWin} game${config.gamesToWin === 1 ? "" : "s"}`}
      tableHeader={`GAME ${state.games.length}`}
      columns={state.games.map((g, i) => ({ head: String(i + 1), a: g.scoreA, b: g.scoreB }))}
      currentCard={
        <CurrentGameCard sportImageKey="pickleball" label="CURRENT GAME">
          <ScorePills a={currentGame.scoreA} b={currentGame.scoreB} />
          {traditionalScore && <span className="mt-3 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-ink">{traditionalScore}</span>}
          {state.indicator && <IndicatorPill label={INDICATOR_LABEL[state.indicator]} forName={state.indicatorFor ? (state.indicatorFor === "A" ? match.team_a_name : match.team_b_name) : null} />}
        </CurrentGameCard>
      }
      serverCard={
        <div className="mb-4">
          <ServerCard label="SERVING" value={servingTeamName} sub={isDoubles ? `Server ${state.server.serverNumber} — ${servingPlayerName}` : `Serving from the ${state.server.servingSide}`} />
        </div>
      }
      history={
        <HistoryCard
          title="RALLY HISTORY"
          history={rallies.map((r, i) => ({ winner: r.winner, dot: !!state.history[i]?.wasSideOut }))}
          footer={<p className="mt-2 text-xs text-muted">Amber dot = side-out</p>}
        />
      }
      isScorer={isScorer}
      onPoint={handleRally}
      pointPending={addRally.isPending}
      onUndo={handleUndo}
      undoDisabled={rallies.length === 0 || deleteLastRally.isPending}
      watermarkIcon={META.watermarkIcon}
    />
  );
}
