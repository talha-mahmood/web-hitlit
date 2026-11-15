import { linkTeamFixtureScorecard, type TeamFixturePrefill } from "@app/lib/api/teamChallenges";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useNetworkStore } from "@app/store/networkStore";
import { useCreatePadelMatch, usePadelMatch, useAddPadelPoint, useDeleteLastPadelPoint, useCompletePadelMatch, usePadelPendingCount } from "@app/hooks/usePadel";
import { useLinkScorecardMatch, useSyncScorecardMatchResult } from "@app/hooks/useTournamentMatches";
import { friendlyPadelError, pointRowToEvent } from "@app/lib/api/padel";
import { replayPadelMatch, formatSetScore, matchResultSummary, type PadelMatchConfig, type MatchFormat, type DeuceType, type Team } from "@app/lib/padelScoring";
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
import { CurrentGameCard, HistoryCard, LiveLoading, RacketCompleteView, RacketLiveView, ScorePills, ServerCard, useLiveMatchChannel, useScoringShortcuts } from "@/components/scorecard/RacketLive";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const META = RACKET_SPORTS.padel;
const HOME = `${paths.scorecard}/padel`;

const FORMAT_OPTIONS: { label: string; value: MatchFormat }[] = [
  { label: "Best of 1 Set", value: "BEST_OF_1" },
  { label: "Best of 3 Sets", value: "BEST_OF_3" },
  { label: "Best of 3 + Match Tiebreak", value: "BEST_OF_3_MATCH_TIEBREAK" },
];
const FORMAT_INFO: Record<MatchFormat, string> = {
  BEST_OF_1: "A single set decides the match.",
  BEST_OF_3: "First pair to win 2 full sets wins the match.",
  BEST_OF_3_MATCH_TIEBREAK:
    "First to win 2 sets wins. If it's 1-1, the decider is a single 10-point Match Tiebreak (win by 2) instead of a third set — the FIP Beyond format.",
};
const DEUCE_OPTIONS: { label: string; value: DeuceType }[] = [
  { label: "Advantage", value: "ADVANTAGE" },
  { label: "Golden Point", value: "GOLDEN_POINT" },
  { label: "Star Point", value: "STAR_POINT" },
];
const DEUCE_INFO: Record<DeuceType, string> = {
  ADVANTAGE: "Traditional scoring — at 40-40, a pair must win two points in a row to take the game.",
  GOLDEN_POINT: "At 40-40, the very next point wins the game outright — no advantage.",
  STAR_POINT: "2026 FIP rule — at 40-40, two rounds of Deuce/Advantage are played; a third deuce becomes a single decisive Star Point.",
};
const STANDARD_GAMES_PER_SET = 6;

// Port of PadelNewMatchScreen.
export function PadelNewMatchPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(HOME);
  const navState = useLocation().state as { prefill?: ScorecardPrefill; teamFixture?: TeamFixturePrefill } | null;
  const prefill = navState?.prefill;
  const teamFixture = navState?.teamFixture;
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreatePadelMatch();
  const linkScorecardMatch = useLinkScorecardMatch(prefill?.gameId ?? "");

  const canOfferDoubles = !prefill || (prefill.teamAPlayers.length >= 2 && prefill.teamBPlayers.length >= 2);
  const playModeOptions = canOfferDoubles ? PLAY_MODE_OPTIONS : PLAY_MODE_OPTIONS.filter((o) => o.value !== "DOUBLES");
  const [playMode, setPlayMode] = useState<PlayMode | null>(teamFixture?.matchFormat === "SINGLES" ? "SINGLES" : teamFixture?.matchFormat === "DOUBLES" ? "DOUBLES" : canOfferDoubles ? "DOUBLES" : "SINGLES");
  const [teamAName, setTeamAName] = useState(prefill?.teamAName ?? teamFixture?.teamAName ?? "");
  const [teamBName, setTeamBName] = useState(prefill?.teamBName ?? teamFixture?.teamBName ?? "");
  const [teamAPlayers, setTeamAPlayers] = useState<PlayerPair>(prefillPair(prefill, "A"));
  const [teamBPlayers, setTeamBPlayers] = useState<PlayerPair>(prefillPair(prefill, "B"));
  const [format, setFormat] = useState<MatchFormat | null>(teamFixture?.matchFormat === "BEST_OF_1" || teamFixture?.matchFormat === "BEST_OF_3" || teamFixture?.matchFormat === "BEST_OF_3_MATCH_TIEBREAK" ? (teamFixture!.matchFormat as MatchFormat) : "BEST_OF_3");
  const [deuceType, setDeuceType] = useState<DeuceType | null>("ADVANTAGE");
  const [firstServerTeam, setFirstServerTeam] = useState<Team | null>(null);
  const [firstServerPlayerIndex, setFirstServerPlayerIndex] = useState<0 | 1 | null>(null);
  const [venue, setVenue] = useState(prefill?.venue ?? teamFixture?.venue ?? "");
  const [gamesPerSet, setGamesPerSet] = useState<string | null>(String(STANDARD_GAMES_PER_SET));

  const isDoubles = playMode === "DOUBLES";
  const doublesPlayersValid = !isDoubles || [...teamAPlayers, ...teamBPlayers].every((p) => p.name.trim().length > 0);
  const serverTeamPlayers: PlayerPair =
    firstServerTeam === "A" ? teamAPlayers : firstServerTeam === "B" ? teamBPlayers : [{ name: "", sourceId: null }, { name: "", sourceId: null }];
  const gamesPerSetNumber = parseInt(gamesPerSet ?? "", 10);
  const isGamesPerSetValid = !!gamesPerSet && gamesPerSetNumber > 0;

  const validationReason =
    (!teamAName.trim() ? `Enter a name for ${isDoubles ? "Team A" : "Player A"}.` : null) ??
    (!teamBName.trim() ? `Enter a name for ${isDoubles ? "Team B" : "Player B"}.` : null) ??
    (namesClash(teamAName, teamBName) ? `${isDoubles ? "Team A and Team B" : "Player A and Player B"} can't have the same name.` : null) ??
    (!doublesPlayersValid ? "Enter both players' names for each doubles team." : null) ??
    (isDoubles && hasBlockingDuplicateNames([...teamAPlayers, ...teamBPlayers]) ? DUPLICATE_PLAYERS_REASON : null) ??
    (!playMode ? "Pick Singles or Doubles." : null) ??
    (!format ? "Pick a match format." : null) ??
    (!deuceType ? "Pick a deuce rule." : null) ??
    (!firstServerTeam ? "Pick who serves first." : null) ??
    (isDoubles && firstServerPlayerIndex === null ? "Pick which player serves first." : null) ??
    (!isGamesPerSetValid ? "Set games per set." : null);
  const isValid = !validationReason;

  const handleCreate = () => {
    if (!isValid || !userId || !format || !deuceType || !firstServerTeam || !playMode) return;
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
        format,
        deuceType,
        firstServerTeam,
        firstServerPlayerIndex: isDoubles ? (firstServerPlayerIndex ?? 0) : 0,
        gamesPerSet: gamesPerSetNumber,
        playMode,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: async ({ matchId }) => {
          try {
            if (prefill) await linkScorecardMatch.mutateAsync({ matchId: prefill.tournamentMatchId, sport: "padel", scorecardMatchId: matchId });
            if (teamFixture) await linkTeamFixtureScorecard(teamFixture.fixtureId, matchId, "padel_matches");
          } catch (e) {
            Alert.alert("Match created", e instanceof Error ? e.message : "The scorecard was created but could not be linked to its fixture.");
          }
          navigate(paths.match("padel", matchId), { replace: true });
        },
        onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not create match.")),
      }
    );
  };

  return (
    <div className="mx-auto max-w-3xl pb-16 lg:px-8">
      <SportNewMatchHeader sport="padel" title="New Match" subtitle="Set up your match details" onBack={goBack} />
      <div className="px-5 pt-1 lg:px-0">
        {prefill && <InfoBox text={PREFILL_LOCK_NOTE} />}
        <div className={prefill ? "mt-4" : ""}>
          <CardSection icon="people-outline" title="Play Mode">
            <PillRow options={playModeOptions} value={playMode} onChange={(v) => (setPlayMode(v), setFirstServerPlayerIndex(null))} />
            {!canOfferDoubles && <InfoBox text="Doubles isn't available here — this tournament team only has one registered player." />}
          </CardSection>
        </div>

        {playMode && (
          <div className="md:grid md:grid-cols-2 md:gap-4">
            <TeamCard letter="A" name={teamAName} onNameChange={setTeamAName} playMode={playMode} players={teamAPlayers} onPlayersChange={setTeamAPlayers} locked={!!prefill} otherTeamName={teamBName} otherTeamPlayers={teamBPlayers} namePlaceholder="e.g. Smashers" player2Placeholder="e.g. Sam" />
            <TeamCard letter="B" name={teamBName} onNameChange={setTeamBName} playMode={playMode} players={teamBPlayers} onPlayersChange={setTeamBPlayers} locked={!!prefill} otherTeamName={teamAName} otherTeamPlayers={teamAPlayers} namePlaceholder="e.g. Net Ninjas" player2Placeholder="e.g. Sam" />
          </div>
        )}

        <CardSection icon="location-outline" title="Venue">
          <FieldInput value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Padel Club Karachi" maxLength={60} disabled={!!prefill} aria-label="Venue" containerClassName={prefill ? LOCKED_FIELD : ""} />
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

        <CardSection icon="albums-outline" title="Deuce Rule">
          <PillRow options={DEUCE_OPTIONS} value={deuceType} onChange={setDeuceType} />
          {deuceType && <InfoBox text={DEUCE_INFO[deuceType]} />}
        </CardSection>

        <CardSection icon="tennisball-outline" title="First Server">
          <p className="mb-2 text-xs font-semibold text-muted">Serving Team</p>
          <PillRow
            options={[
              { label: teamAName.trim() || "Team A", value: "A" as const },
              { label: teamBName.trim() || "Team B", value: "B" as const },
            ]}
            value={firstServerTeam}
            onChange={(v) => (setFirstServerTeam(v), setFirstServerPlayerIndex(null))}
          />
          {firstServerTeam && isDoubles && (
            <>
              <p className="mb-2 mt-4 text-xs font-semibold text-muted">Serving Player</p>
              <PillRow
                options={([0, 1] as const).filter((i) => serverTeamPlayers[i].name.trim().length > 0).map((i) => ({ label: serverTeamPlayers[i].name.trim(), value: String(i) as "0" | "1" }))}
                value={firstServerPlayerIndex === null ? null : (String(firstServerPlayerIndex) as "0" | "1")}
                onChange={(v) => setFirstServerPlayerIndex(v === "0" ? 0 : 1)}
              />
            </>
          )}
        </CardSection>

        <StartMatchButton valid={isValid} pending={createMatch.isPending} reason={validationReason} onPress={handleCreate} />
      </div>
    </div>
  );
}

// Port of PadelLiveScoringScreen.
export function PadelLivePage() {
  const { matchId = "" } = useParams();
  const back = useGoBack(HOME);
  const { data: match, isLoading } = usePadelMatch(matchId);
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const isScorer = !!currentUserId && !!match && currentUserId === match.user_id;
  useLiveMatchChannel(matchId, "padel_matches", "padel_points", "padelMatch");
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingCount = usePadelPendingCount(matchId);
  const addPoint = useAddPadelPoint(matchId);
  const deleteLastPoint = useDeleteLastPadelPoint(matchId);
  const completeMatch = useCompletePadelMatch();
  const syncTournamentResult = useSyncScorecardMatchResult();
  const [receivingSide, setReceivingSide] = useState<"RIGHT" | "LEFT">("RIGHT");
  const profile = useProfileStore((s) => s.profile);
  const [generatingReport, setGeneratingReport] = useState(false);

  const points = useMemo(() => (match ? [...match.padel_points].sort((a, b) => a.seq - b.seq).map(pointRowToEvent) : []), [match]);
  const config: PadelMatchConfig | null = match
    ? {
        format: match.format as PadelMatchConfig["format"],
        deuceType: match.deuce_type as PadelMatchConfig["deuceType"],
        firstServerTeam: match.first_server_team as Team,
        firstServerPlayerIndex: match.first_server_player_index as 0 | 1,
        gamesPerSet: match.games_per_set,
      }
    : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = useMemo(() => (config ? replayPadelMatch(points, config) : null), [points, match?.format, match?.deuce_type, match?.first_server_team, match?.first_server_player_index, match?.games_per_set]);

  // The point log itself decides the match — persist the result the moment it does.
  useEffect(() => {
    if (!match || !state) return;
    if (state.isComplete && state.winner && match.status === "IN_PROGRESS" && !completeMatch.isPending) {
      const summary = matchResultSummary(match.team_a_name, match.team_b_name, state);
      completeMatch.mutate(
        { matchId: match.id, winnerTeam: state.winner, resultSummary: summary },
        {
          onSuccess: () => syncTournamentResult.mutate({ sport: "padel", scorecardMatchId: match.id, teamAWon: state.winner === "A" }),
          onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not save the match result.")),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, state?.isComplete, state?.winner]);

  useEffect(() => setReceivingSide("RIGHT"), [state?.currentGame.isDecisivePoint]);

  const live = !!match && !!state && !state.isComplete;
  const handlePoint = (winner: Team) => {
    if (!state || state.isComplete || addPoint.isPending) return;
    addPoint.mutate({ seq: points.length + 1, winner }, { onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not record point.")) });
  };
  const handleUndo = () => {
    if (points.length === 0) return;
    const last = points[points.length - 1];
    Alert.alert("Undo Last Point", "Remove the most recent point?", [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => deleteLastPoint.mutate(last.seq, { onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not undo.")) }) },
    ]);
  };
  useScoringShortcuts(isScorer && live, handlePoint, handleUndo);

  if (isLoading || !match || !state) return <LiveLoading />;

  const isDoubles = match.play_mode === "DOUBLES";
  const teamAPlayerNames = match.team_a_players.length > 0 ? match.team_a_players : ["Player A1", "Player A2"];
  const teamBPlayerNames = match.team_b_players.length > 0 ? match.team_b_players : ["Player B1", "Player B2"];
  const serverName = isDoubles
    ? state.server.team === "A"
      ? (teamAPlayerNames[state.server.playerIndex] ?? teamAPlayerNames[0])
      : (teamBPlayerNames[state.server.playerIndex] ?? teamBPlayerNames[0])
    : state.server.team === "A"
      ? match.team_a_name
      : match.team_b_name;
  const receiverNames = state.server.team === "A" ? teamBPlayerNames : teamAPlayerNames;
  const receivingLabel = isDoubles ? receiverNames.filter(Boolean).join(" / ") : state.server.team === "A" ? match.team_b_name : match.team_a_name;
  const plain = /^(\S+) - (\S+)$/.exec(state.currentGame.display);

  const handleReport = async () => {
    setGeneratingReport(true);
    try {
      const html = buildGenericMatchReportHtml({
        sportLabel: "Padel",
        teamAName: match.team_a_name,
        teamBName: match.team_b_name,
        finalScoreA: `${state.setsWonA} sets`,
        finalScoreB: `${state.setsWonB} sets`,
        resultSummary: match.result_summary,
        venue: match.venue,
        createdAt: match.created_at,
        playMode: isDoubles ? "Doubles" : "Singles",
        formatLabel: `${match.format === "BEST_OF_3" ? "Best of 3" : match.format} sets`,
        organiserName: profile?.full_name ?? "—",
        breakdownTitle: "Set-by-Set",
        breakdown: state.sets.map((set, i) => ({ label: set.isMatchTiebreak ? "Match Tiebreak" : `Set ${i + 1}`, scoreA: formatSetScore(set, "A"), scoreB: formatSetScore(set, "B") })),
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
        sportLabel="Padel"
        crestIcon={META.crestIcon}
        aName={match.team_a_name}
        bName={match.team_b_name}
        winner={state.winner}
        wonA={state.setsWonA}
        wonB={state.setsWonB}
        tallyLabel="SETS"
        breakdown={state.sets.map((set, i) => ({ label: set.isMatchTiebreak ? "MATCH TIEBREAK" : `SET ${i + 1}`, score: `${formatSetScore(set, "A")} - ${formatSetScore(set, "B")}` }))}
        onBack={back}
        onReport={handleReport}
        generatingReport={generatingReport}
      />
    );
  }

  const g = state.currentGame;
  return (
    <RacketLiveView
      sportLabel="Padel"
      aName={match.team_a_name}
      bName={match.team_b_name}
      isDoubles={isDoubles}
      aPlayers={teamAPlayerNames}
      bPlayers={teamBPlayerNames}
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
      columns={state.sets.map((set, i) => ({ head: set.isMatchTiebreak ? "MTB" : String(i + 1), a: formatSetScore(set, "A"), b: formatSetScore(set, "B") }))}
      currentCard={
        <CurrentGameCard sportImageKey="padel" label={g.isMatchTiebreak ? "MATCH TIEBREAK" : g.isTiebreak ? "TIEBREAK" : "CURRENT GAME"}>
          {g.isTiebreak ? (
            <ScorePills a={g.pointsA} b={g.pointsB} gap={20} />
          ) : plain ? (
            <ScorePills a={plain[1]} b={plain[2]} />
          ) : ["DEUCE", "GOLDEN POINT", "STAR POINT"].includes(g.display) || g.display.startsWith("ADVANTAGE") ? (
            <div className="flex flex-col items-center">
              {g.display === "STAR POINT" && <span className="text-[22px]">⭐</span>}
              <p className="text-center text-[22px] font-extrabold text-primary-dark">{g.display}</p>
            </div>
          ) : (
            <p className="text-4xl font-extrabold text-ink">{g.display}</p>
          )}
          {g.isDecisivePoint && (
            <div className="mt-4 flex flex-col items-center">
              <p className="mb-2 text-xs font-semibold text-muted">{state.server.team === "A" ? match.team_b_name : match.team_a_name} receiving — choose side</p>
              <div className="flex gap-2">
                {(["RIGHT", "LEFT"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={receivingSide === side}
                    onClick={() => setReceivingSide(side)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold ${receivingSide === side ? "bg-brand text-white" : "bg-gray-100 text-ink"}`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CurrentGameCard>
      }
      serverCard={
        <>
          <ServerCard label="SERVER" value={isDoubles ? `${serverName} (${state.server.team === "A" ? match.team_a_name : match.team_b_name})` : serverName} />
          <p className="mb-4 mt-1 text-center text-xs text-muted">Receiving: {receivingLabel}</p>
        </>
      }
      history={<HistoryCard title="POINT HISTORY" history={points.map((p) => ({ winner: p.winner }))} />}
      isScorer={isScorer}
      onPoint={handlePoint}
      pointPending={addPoint.isPending}
      onUndo={handleUndo}
      undoDisabled={points.length === 0 || deleteLastPoint.isPending}
      watermarkIcon={META.watermarkIcon}
    />
  );
}
