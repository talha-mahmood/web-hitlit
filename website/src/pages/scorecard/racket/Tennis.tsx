import { linkTeamFixtureScorecard, type TeamFixturePrefill } from "@app/lib/api/teamChallenges";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useNetworkStore } from "@app/store/networkStore";
import { useCreateTennisMatch, useTennisMatch, useAddTennisPoint, useDeleteLastTennisPoint, useCompleteTennisMatch, useTennisPendingCount } from "@app/hooks/useTennis";
import { useLinkScorecardMatch, useSyncScorecardMatchResult } from "@app/hooks/useTournamentMatches";
import { friendlyTennisError, pointRowToEvent } from "@app/lib/api/tennis";
import { replayTennisMatch, formatSetScore, matchResultSummary, type TennisMatchConfig, type MatchFormat, type Player, type Indicator } from "@app/lib/tennisScoring";
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

const META = RACKET_SPORTS.tennis;
const HOME = `${paths.scorecard}/tennis`;

const FORMAT_OPTIONS: { label: string; value: MatchFormat }[] = [
  { label: "Best of 1 Set", value: "BEST_OF_1" },
  { label: "Best of 3 Sets", value: "BEST_OF_3" },
  { label: "Best of 5 Sets", value: "BEST_OF_5" },
];
const FORMAT_INFO: Record<MatchFormat, string> = {
  BEST_OF_1: "A single set decides the match.",
  BEST_OF_3: "First player to win 2 sets wins the match.",
  BEST_OF_5: "First player to win 3 sets wins the match.",
};
const INDICATOR_LABEL: Record<Exclude<Indicator, null>, string> = {
  GAME_POINT: "GAME POINT",
  BREAK_POINT: "BREAK POINT",
  SET_POINT: "SET POINT",
  MATCH_POINT: "MATCH POINT",
};
const STANDARD_GAMES_PER_SET = 6;

// Port of TennisNewMatchScreen.
export function TennisNewMatchPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(HOME);
  const navState = useLocation().state as { prefill?: ScorecardPrefill; teamFixture?: TeamFixturePrefill } | null;
  const prefill = navState?.prefill;
  const teamFixture = navState?.teamFixture;
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateTennisMatch();
  const linkScorecardMatch = useLinkScorecardMatch(prefill?.gameId ?? "");

  const canOfferDoubles = !prefill || (prefill.teamAPlayers.length >= 2 && prefill.teamBPlayers.length >= 2);
  const playModeOptions = canOfferDoubles ? PLAY_MODE_OPTIONS : PLAY_MODE_OPTIONS.filter((o) => o.value !== "DOUBLES");
  const [playMode, setPlayMode] = useState<PlayMode | null>(teamFixture?.matchFormat === "SINGLES" ? "SINGLES" : teamFixture?.matchFormat === "DOUBLES" ? "DOUBLES" : prefill && canOfferDoubles ? "DOUBLES" : "SINGLES");
  const [playerAName, setPlayerAName] = useState(prefill?.teamAName ?? teamFixture?.teamAName ?? "");
  const [playerBName, setPlayerBName] = useState(prefill?.teamBName ?? teamFixture?.teamBName ?? "");
  const [playerAPlayers, setPlayerAPlayers] = useState<PlayerPair>(prefillPair(prefill, "A"));
  const [playerBPlayers, setPlayerBPlayers] = useState<PlayerPair>(prefillPair(prefill, "B"));
  const [playerAServerIndex, setPlayerAServerIndex] = useState<0 | 1>(0);
  const [playerBServerIndex, setPlayerBServerIndex] = useState<0 | 1>(0);
  const [format, setFormat] = useState<MatchFormat | null>(teamFixture?.matchFormat === "BEST_OF_1" || teamFixture?.matchFormat === "BEST_OF_3" ? (teamFixture!.matchFormat as MatchFormat) : "BEST_OF_3");
  const [firstServer, setFirstServer] = useState<Player | null>(null);
  const [venue, setVenue] = useState(prefill?.venue ?? teamFixture?.venue ?? "");
  const [gamesPerSet, setGamesPerSet] = useState<string | null>(String(STANDARD_GAMES_PER_SET));

  const isDoubles = playMode === "DOUBLES";
  const doublesPlayersValid = !isDoubles || [...playerAPlayers, ...playerBPlayers].every((p) => p.name.trim().length > 0);
  const gamesPerSetNumber = parseInt(gamesPerSet ?? "", 10);
  const isGamesPerSetValid = !!gamesPerSet && gamesPerSetNumber > 0;

  const validationReason =
    (!playerAName.trim() ? `Enter a name for ${isDoubles ? "Team A" : "Player A"}.` : null) ??
    (!playerBName.trim() ? `Enter a name for ${isDoubles ? "Team B" : "Player B"}.` : null) ??
    (namesClash(playerAName, playerBName) ? `${isDoubles ? "Team A and Team B" : "Player A and Player B"} can't have the same name.` : null) ??
    (!doublesPlayersValid ? "Enter both players' names for each doubles team." : null) ??
    (isDoubles && hasBlockingDuplicateNames([...playerAPlayers, ...playerBPlayers]) ? DUPLICATE_PLAYERS_REASON : null) ??
    (!playMode ? "Pick Singles or Doubles." : null) ??
    (!format ? "Pick a match format." : null) ??
    (!firstServer ? "Pick who serves first." : null) ??
    (!isGamesPerSetValid ? "Set games per set." : null);
  const isValid = !validationReason;

  const handleCreate = () => {
    if (!isValid || !userId || !format || !firstServer || !playMode) return;
    const { teamANames, teamBNames } = disambiguateRoster(
      playerAPlayers.map((p) => ({ name: p.name.trim(), sourceId: p.sourceId })),
      playerBPlayers.map((p) => ({ name: p.name.trim(), sourceId: p.sourceId }))
    );
    createMatch.mutate(
      {
        userId,
        playerAName: playerAName.trim(),
        playerBName: playerBName.trim(),
        playerAPlayers: isDoubles ? teamANames.filter(Boolean) : [],
        playerBPlayers: isDoubles ? teamBNames.filter(Boolean) : [],
        format,
        firstServer,
        gamesPerSet: gamesPerSetNumber,
        playMode,
        playerAServerIndex: isDoubles ? playerAServerIndex : 0,
        playerBServerIndex: isDoubles ? playerBServerIndex : 0,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: async ({ matchId }) => {
          try {
            if (prefill) await linkScorecardMatch.mutateAsync({ matchId: prefill.tournamentMatchId, sport: "tennis", scorecardMatchId: matchId });
            if (teamFixture) await linkTeamFixtureScorecard(teamFixture.fixtureId, matchId, "tennis_matches");
          } catch (e) {
            Alert.alert("Match created", e instanceof Error ? e.message : "The scorecard was created but could not be linked to its fixture.");
          }
          navigate(paths.match("tennis", matchId), { replace: true });
        },
        onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not create match.")),
      }
    );
  };

  return (
    <div className="mx-auto max-w-3xl pb-16 lg:px-8">
      <SportNewMatchHeader sport="tennis" title="New Match" subtitle="Set up your match details" onBack={goBack} />
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
            <TeamCard letter="A" name={playerAName} onNameChange={setPlayerAName} playMode={playMode} players={playerAPlayers} onPlayersChange={setPlayerAPlayers} serverIndex={playerAServerIndex} onServerIndexChange={setPlayerAServerIndex} locked={!!prefill} otherTeamName={playerBName} otherTeamPlayers={playerBPlayers} namePlaceholder="e.g. Alex" player2Placeholder="e.g. Jo" />
            <TeamCard letter="B" name={playerBName} onNameChange={setPlayerBName} playMode={playMode} players={playerBPlayers} onPlayersChange={setPlayerBPlayers} serverIndex={playerBServerIndex} onServerIndexChange={setPlayerBServerIndex} locked={!!prefill} otherTeamName={playerAName} otherTeamPlayers={playerAPlayers} namePlaceholder="e.g. Sam" player2Placeholder="e.g. Jo" />
          </div>
        )}

        <CardSection icon="location-outline" title="Venue">
          <FieldInput value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Tennis Club Karachi" maxLength={60} disabled={!!prefill} aria-label="Venue" containerClassName={prefill ? LOCKED_FIELD : ""} />
        </CardSection>

        <CardSection icon="trophy-outline" title="Match Format">
          <PillRow options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
          {format && <InfoBox text={FORMAT_INFO[format]} />}
        </CardSection>

        <NumberPresetSection
          icon="flag-outline"
          title="Games Per Set"
          presets={standardPresets(["3", "4", "6"], STANDARD_GAMES_PER_SET)}
          value={gamesPerSet}
          onChange={setGamesPerSet}
          customLabel="Or enter a custom target"
          placeholder="e.g. 6"
          maxDigits={2}
          info={isGamesPerSetValid ? `First to ${gamesPerSetNumber} games, win by 2 clear, wins the set — tiebreak at ${gamesPerSetNumber}-${gamesPerSetNumber}.` : "Enter how many games win a set."}
        />

        <CardSection icon="tennisball-outline" title={isDoubles ? "First Serving Team" : "First Server"}>
          <PillRow
            options={[
              { label: playerAName.trim() || (isDoubles ? "Team A" : "Player A"), value: "A" as const },
              { label: playerBName.trim() || (isDoubles ? "Team B" : "Player B"), value: "B" as const },
            ]}
            value={firstServer}
            onChange={setFirstServer}
          />
        </CardSection>

        <StartMatchButton valid={isValid} pending={createMatch.isPending} reason={validationReason} onPress={handleCreate} />
      </div>
    </div>
  );
}

// Port of TennisLiveScoringScreen.
export function TennisLivePage() {
  const { matchId = "" } = useParams();
  const back = useGoBack(HOME);
  const { data: match, isLoading } = useTennisMatch(matchId);
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  useLiveMatchChannel(matchId, "tennis_matches", "tennis_points", "tennisMatch");
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingCount = useTennisPendingCount(matchId);
  const addPoint = useAddTennisPoint(matchId);
  const deleteLastPoint = useDeleteLastTennisPoint(matchId);
  const completeMatch = useCompleteTennisMatch();
  const syncTournamentResult = useSyncScorecardMatchResult();
  const profile = useProfileStore((s) => s.profile);
  const [generatingReport, setGeneratingReport] = useState(false);

  const points = useMemo(() => (match ? [...match.tennis_points].sort((a, b) => a.seq - b.seq).map(pointRowToEvent) : []), [match]);
  const config: TennisMatchConfig | null = match
    ? {
        format: match.format as TennisMatchConfig["format"],
        firstServer: match.first_server as Player,
        gamesPerSet: match.games_per_set,
        playMode: match.play_mode as TennisMatchConfig["playMode"],
        playerAServerIndex: match.player_a_server_index as 0 | 1,
        playerBServerIndex: match.player_b_server_index as 0 | 1,
      }
    : null;
  const configKey = JSON.stringify(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = useMemo(() => (config ? replayTennisMatch(points, config) : null), [points, configKey]);

  useEffect(() => {
    if (!match || !state) return;
    if (state.isComplete && state.winner && match.status === "IN_PROGRESS" && !completeMatch.isPending) {
      const summary = matchResultSummary(match.player_a_name, match.player_b_name, state);
      completeMatch.mutate(
        { matchId: match.id, winnerPlayer: state.winner, resultSummary: summary },
        {
          onSuccess: () => syncTournamentResult.mutate({ sport: "tennis", scorecardMatchId: match.id, teamAWon: state.winner === "A" }),
          onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not save the match result.")),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  const live = !!match && !!state && !state.isComplete;
  const handlePoint = (winner: Player) => {
    if (!state || state.isComplete || addPoint.isPending) return;
    addPoint.mutate({ seq: points.length + 1, winner }, { onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not record point.")) });
  };
  const handleUndo = () => {
    if (points.length === 0) return;
    const last = points[points.length - 1];
    Alert.alert("Undo Last Point", "Remove the most recent point?", [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => deleteLastPoint.mutate(last.seq, { onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not undo.")) }) },
    ]);
  };
  useScoringShortcuts(isScorer && live, handlePoint, handleUndo);

  if (isLoading || !match || !state) return <LiveLoading />;

  const isDoubles = match.play_mode === "DOUBLES";
  const aPlayers = match.player_a_players.length > 0 ? match.player_a_players : ["Player A1", "Player A2"];
  const bPlayers = match.player_b_players.length > 0 ? match.player_b_players : ["Player B1", "Player B2"];
  const serverName = isDoubles
    ? state.server.player === "A"
      ? `${aPlayers[state.server.playerIndex] ?? aPlayers[0]} (${match.player_a_name})`
      : `${bPlayers[state.server.playerIndex] ?? bPlayers[0]} (${match.player_b_name})`
    : state.server.player === "A"
      ? match.player_a_name
      : match.player_b_name;
  const plain = /^(\S+) - (\S+)$/.exec(state.currentGame.display);

  const handleReport = async () => {
    setGeneratingReport(true);
    try {
      const html = buildGenericMatchReportHtml({
        sportLabel: "Tennis",
        teamAName: match.player_a_name,
        teamBName: match.player_b_name,
        finalScoreA: `${state.setsWonA} sets`,
        finalScoreB: `${state.setsWonB} sets`,
        resultSummary: match.result_summary,
        venue: match.venue,
        createdAt: match.created_at,
        playMode: isDoubles ? "Doubles" : "Singles",
        formatLabel: `${match.format === "BEST_OF_3" ? "Best of 3" : match.format} sets`,
        organiserName: profile?.full_name ?? "—",
        breakdownTitle: "Set-by-Set",
        breakdown: state.sets.map((set, i) => ({ label: `Set ${i + 1}`, scoreA: formatSetScore(set, "A"), scoreB: formatSetScore(set, "B") })),
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
        sportLabel="Tennis"
        crestIcon={META.crestIcon}
        aName={match.player_a_name}
        bName={match.player_b_name}
        winner={state.winner}
        wonA={state.setsWonA}
        wonB={state.setsWonB}
        tallyLabel="SETS"
        breakdown={state.sets.map((set, i) => ({ label: `SET ${i + 1}`, score: `${formatSetScore(set, "A")} - ${formatSetScore(set, "B")}` }))}
        onBack={back}
        onReport={handleReport}
        generatingReport={generatingReport}
      />
    );
  }

  const g = state.currentGame;
  return (
    <RacketLiveView
      sportLabel="Tennis"
      aName={match.player_a_name}
      bName={match.player_b_name}
      isDoubles={isDoubles}
      aPlayers={aPlayers}
      bPlayers={bPlayers}
      scoringCode={match.scoring_code}
      onBack={back}
      isOnline={isOnline}
      pendingCount={pendingCount}
      unit="point"
      summaryLabel="SETS"
      wonA={state.setsWonA}
      wonB={state.setsWonB}
      firstToText={`First to ${state.setsToWin} set${state.setsToWin === 1 ? "" : "s"}`}
      tableHeader={`SET ${state.sets.length}`}
      columns={state.sets.map((set, i) => ({ head: String(i + 1), a: formatSetScore(set, "A"), b: formatSetScore(set, "B") }))}
      currentCard={
        <CurrentGameCard sportImageKey="tennis" label={g.isTiebreak ? "TIEBREAK" : "CURRENT GAME"}>
          {g.isTiebreak ? (
            <ScorePills a={g.pointsA} b={g.pointsB} gap={20} />
          ) : plain ? (
            <ScorePills a={plain[1]} b={plain[2]} />
          ) : g.display === "DEUCE" || g.display.startsWith("ADVANTAGE") ? (
            <p className="text-center text-[22px] font-extrabold text-primary-dark">{g.display}</p>
          ) : (
            <p className="text-4xl font-extrabold text-ink">{g.display}</p>
          )}
          {state.indicator && <IndicatorPill label={INDICATOR_LABEL[state.indicator]} forName={state.indicatorFor ? (state.indicatorFor === "A" ? match.player_a_name : match.player_b_name) : null} />}
        </CurrentGameCard>
      }
      serverCard={<ServerCard label="SERVER" value={serverName} />}
      history={
        <div className="mt-4">
          <HistoryCard title="POINT HISTORY" history={points.map((p) => ({ winner: p.winner }))} />
        </div>
      }
      isScorer={isScorer}
      onPoint={handlePoint}
      pointPending={addPoint.isPending}
      onUndo={handleUndo}
      undoDisabled={points.length === 0 || deleteLastPoint.isPending}
      watermarkIcon={META.watermarkIcon}
    />
  );
}
