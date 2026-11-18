import { useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useGameDetail } from "@app/hooks/useGames";
import { useTournamentTeams, useSetTeamManualStatus } from "@app/hooks/useTournamentTeams";
import {
  useAddManualMatch,
  useUpdateManualMatchTeams,
  useDeleteManualMatch,
  useTournamentMatches,
  useTournamentNRR,
  useLiveCricketMatches,
  useGenerateMatches,
  useGenerateNextRound,
  useGeneratePoolMatches,
  useSetMatchScorer,
  useUpdateMatchSchedule,
} from "@app/hooks/useTournamentMatches";
import { useTournamentPools, useAssignTeamToPool } from "@app/hooks/useTournamentPools";
import { useCricketMatch } from "@app/hooks/useCricket";
import { ballRowToEvent } from "@app/lib/api/cricket";
import { computeRunRate } from "@app/lib/cricketScoring";
import { useAuthStore } from "@app/store/authStore";
import { manualSportForName } from "@app/lib/manualScore";
import { isCricketFamily } from "@app/lib/api/sports";
import type { Database } from "@app/types/database.types";
import type { TournamentTeam } from "@app/lib/api/tournamentTeams";
import { soloAwareTeamName, type TournamentMatch, type ScorecardPrefill, type ScorecardPrefillPlayer } from "@app/lib/api/tournamentMatches";
import { disambiguateRoster } from "@app/lib/matchNameValidation";
import type { TournamentPool } from "@app/lib/api/tournamentPools";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { getSportIcon } from "@app/lib/sportIcons";
import { computeFixtures, computeStandings, applyHeadToHeadTiebreak, knockoutRoundLabel, getRoundWinners, TOURNAMENT_FORMAT_LABEL } from "@app/lib/tournamentFixtures";
import { Alert } from "@/lib/alert";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import PlainHeader from "@/components/ui/PlainHeader";
import FieldInput from "@/components/ui/FieldInput";
import Modal from "@/components/ui/Modal";
import { LinkedMatchScoreDetails } from "@/components/games/MatchScoreDetails";
import { useGoToScorecard } from "@/components/games/TournamentTeamsSection";
import { SelectScorerModal, SetMatchTimeModal, type ScorerCandidate } from "@/components/games/FixtureModals";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

type Format = Database["public"]["Enums"]["tournament_format_type"];
type TeamStatus = Database["public"]["Enums"]["tournament_team_status_type"];
type StatusFilter = "ALL" | "UPCOMING" | "COMPLETED";

const err = (fallback: string) => (e: unknown) => Alert.alert("Error", getFriendlyErrorMessage(e, fallback));

function Card({ children }: { children: ReactNode }) {
  return <section className="mx-4 mt-4 rounded-2xl bg-surface p-4 shadow-card lg:mx-0">{children}</section>;
}

function CardHeader({ icon, title, subtitle, badge }: { icon: string; title: string; subtitle?: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
        <Ionicon name={icon} size={19} color={colors.primaryDark} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {badge && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{badge}</span>}
    </div>
  );
}

function GenerateButton({ busy, icon, label, onPress }: { busy: boolean; icon: string; label: string; onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} disabled={busy} className="press mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-white first:mt-0">
      {busy ? <Spinner size={18} color="white" /> : (
        <>
          <Ionicon name={icon} size={16} color="white" />
          {label}
        </>
      )}
    </button>
  );
}

function TeamStatusIcon({ status }: { status: TeamStatus | undefined }) {
  const pending = status !== "APPROVED";
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: pending ? "rgb(var(--jz-orange-100))" : "rgb(var(--jz-blue-100))" }}>
      <Ionicon name={pending ? "hourglass" : "person"} size={14} color={pending ? "#C2410C" : "#2563EB"} />
    </span>
  );
}

function VsRow({ a, b, aStatus, bStatus, dim, vsBg = "bg-gray-200" }: { a: string; b: string; aStatus?: TeamStatus; bStatus?: TeamStatus | null; dim?: boolean; vsBg?: string }) {
  const text = dim ? "text-muted" : "text-ink";
  return (
    <div className="flex items-center gap-2.5">
      {aStatus === undefined && dim ? <span className="w-7" /> : <TeamStatusIcon status={aStatus} />}
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${text}`}>{a}</span>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-muted ${vsBg}`}>VS</span>
      <span className={`min-w-0 flex-1 truncate text-right text-sm font-medium ${text}`}>{b}</span>
      {bStatus === null || (bStatus === undefined && dim) ? <span className="w-7" /> : <TeamStatusIcon status={bStatus} />}
    </div>
  );
}

function formatMatchSchedule(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-PK", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

function StatusPill({ completed, live }: { completed: boolean; live?: boolean }) {
  const [label, color, bg] = completed ? ["Completed", colors.primaryDark, colors.primaryLight] : live ? ["Live", "#DC2626", "rgb(var(--jz-red-100))"] : ["Upcoming", "#2563EB", "rgb(var(--jz-blue-50))"];
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  );
}

function MatchRunRates({ cricketMatchId }: { cricketMatchId: string }) {
  const { data: m } = useCricketMatch(cricketMatchId);
  if (!m) return null;
  const rates = m.cricket_innings.map((inn) => {
    const balls = inn.cricket_balls.map(ballRowToEvent);
    const runs = balls.reduce((s, b) => s + b.runsBatted + b.extraRuns, 0);
    const legal = balls.filter((b) => b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY").length;
    return { side: inn.batting_team as "A" | "B", rate: computeRunRate(runs, legal), hasBalls: legal > 0 };
  });
  const a = rates.find((r) => r.side === "A" && r.hasBalls);
  const b = rates.find((r) => r.side === "B" && r.hasBalls);
  if (!a && !b) return null;
  return (
    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
      <span className="truncate">{a ? `${m.team_a_name} RR: ${a.rate.toFixed(2)}` : ""}</span>
      <span className="truncate">{b ? `${m.team_b_name} RR: ${b.rate.toFixed(2)}` : ""}</span>
    </div>
  );
}

function MatchNetRunRates({ aId, bId, aName, bName, nrr }: { aId?: string | null; bId?: string | null; aName: string; bName: string; nrr?: Map<string, number> }) {
  const a = aId ? nrr?.get(aId) : undefined;
  const b = bId ? nrr?.get(bId) : undefined;
  if (a === undefined && b === undefined) return null;
  const f = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(3)}`;
  return (
    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
      <span className="truncate">{a !== undefined ? `${aName} NRR: ${f(a)}` : ""}</span>
      <span className="truncate">{b !== undefined ? `${bName} NRR: ${f(b)}` : ""}</span>
    </div>
  );
}

function computeBracketPreviewRounds(teamsIn: number) {
  const rounds: { label: string; matchCount: number }[] = [];
  let t = teamsIn;
  while (t >= 2) {
    const n = Math.floor(t / 2);
    rounds.push({ label: knockoutRoundLabel(t), matchCount: n });
    t = n;
  }
  return rounds;
}

function BracketPreviewRounds({ rounds }: { rounds: { label: string; matchCount: number }[] }) {
  return (
    <>
      {rounds.map((r) => (
        <div key={r.label} className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted">{r.label} · Upcoming</p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: r.matchCount }, (_, i) => (
              <div key={i} className="rounded-2xl bg-gray-50 px-3 py-2.5 opacity-65">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted">Match {i + 1}</span>
                  <StatusPill completed={false} />
                </div>
                <VsRow a="TBD" b="TBD" dim />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

type RowHandlers = {
  isHost: boolean;
  currentUserId?: string;
  nrrByTeam?: Map<string, number>;
  teamStatusById: Map<string, TeamStatus>;
  liveCricketMatchIds: Set<string>;
  getScorerName: (m: TournamentMatch) => string | null;
  onGoToScorecard: (m: TournamentMatch) => void;
  onEnterScoreManually: (m: TournamentMatch) => void;
  onSelectScorer: (m: TournamentMatch) => void;
  onSetTime: (m: TournamentMatch) => void;
  onViewDetails: (m: TournamentMatch) => void;
  onWatchScorecard: (m: TournamentMatch) => void;
};

function MatchRow({ match, matchNumber, h }: { match: TournamentMatch; matchNumber: number; h: RowHandlers }) {
  const aName = match.team_a?.name ?? "TBD";
  const bName = match.team_b?.name ?? "Bye";
  const isEligible = !!match.team_a && !!match.team_b;
  const isScorer = !!h.currentUserId && match.scorer_user_id === h.currentUserId;
  const showScoring = isEligible && isScorer;
  const showSelectScorer = isEligible && h.isHost;
  const isReady = isEligible && (isScorer || h.isHost);
  const canWatch = !!match.cricket_match_id;
  const isLive = !!match.cricket_match_id && h.liveCricketMatchIds.has(match.cricket_match_id);
  const aStatus = match.team_a ? h.teamStatusById.get(match.team_a.id) : undefined;
  const bStatus = match.team_b ? h.teamStatusById.get(match.team_b.id) : null;
  const scorerName = h.getScorerName(match);

  const ghost = (label: string, onClick: () => void, primary = false) => (
    <button type="button" onClick={onClick} className={`mt-2 w-full rounded-2xl border-[1.5px] py-2.5 text-xs font-semibold first:mt-0 sm:text-sm ${primary ? "border-primary text-primary" : "border-border text-ink"}`}>
      {label}
    </button>
  );

  if (match.status === "COMPLETED") {
    const result = match.is_draw ? "Draw" : match.winner_team ? `${match.winner_team.name} won` : match.team_b ? "—" : `${aName} advances`;
    return (
      <div className="rounded-2xl bg-surface px-3 py-2.5 shadow-card">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted">
            Match {matchNumber}
            {match.scheduled_at ? ` · ${formatMatchSchedule(match.scheduled_at)}` : ""}
          </span>
          <StatusPill completed />
        </div>
        <VsRow a={aName} b={bName} aStatus={aStatus} bStatus={bStatus} />
        <p className="mt-1.5 text-xs font-semibold text-primary">{result}</p>
        {match.cricket_match_id && !match.manual_score && <MatchNetRunRates aId={match.team_a?.id} bId={match.team_b?.id} aName={aName} bName={bName} nrr={h.nrrByTeam} />}
        <LinkedMatchScoreDetails match={match} />
        {canWatch && <div className="mt-2">{ghost("View Scorecard", () => h.onWatchScorecard(match))}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface px-3 py-2.5 shadow-card">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: isReady ? colors.primaryDark : colors.muted }}>
          Match {matchNumber}
        </span>
        <StatusPill completed={false} live={isLive} />
      </div>
      {match.scheduled_at ? (
        <p className="mb-1.5 text-xs text-muted">{formatMatchSchedule(match.scheduled_at)}</p>
      ) : h.isHost ? (
        <button type="button" onClick={() => h.onSetTime(match)} className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <Ionicon name="calendar-outline" size={12} color={colors.primary} />
          Set time
        </button>
      ) : (
        <p className="mb-1.5 text-xs text-muted">Not scheduled yet</p>
      )}
      <VsRow a={aName} b={bName} aStatus={aStatus} bStatus={bStatus} />
      {match.cricket_match_id && !match.manual_score && <MatchRunRates cricketMatchId={match.cricket_match_id} />}
      <LinkedMatchScoreDetails match={match} />
      {isReady ? (
        <div className="mt-3 flex flex-col gap-2">
          {showScoring && (
            <>
              <button type="button" onClick={() => h.onGoToScorecard(match)} className="press flex items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-sm font-bold text-white shadow-card">
                <span className="flex items-center gap-2">
                  <Ionicon name="clipboard-outline" size={17} color="white" />
                  Go To Scorecard
                </span>
                <Ionicon name="chevron-forward" size={16} color="white" />
              </button>
              <button type="button" onClick={() => h.onEnterScoreManually(match)} className="flex items-center justify-between rounded-2xl border border-primary bg-surface px-4 py-3.5 text-sm font-bold text-primary">
                <span className="flex items-center gap-2">
                  <Ionicon name="pencil-outline" size={17} color={colors.primary} />
                  Enter Score Manually
                </span>
                <Ionicon name="chevron-forward" size={16} color={colors.primary} />
              </button>
            </>
          )}
          {showSelectScorer && (
            <button type="button" onClick={() => h.onSelectScorer(match)} className="flex items-center justify-between rounded-2xl border border-primary bg-surface px-4 py-3.5 text-sm font-bold text-primary">
              <span className="flex min-w-0 items-center gap-2">
                <Ionicon name="person-add-outline" size={17} color={colors.primary} />
                <span className="truncate">{scorerName ? `Scorer: ${scorerName}` : "Select Scorer"}</span>
              </span>
              <Ionicon name="chevron-forward" size={16} color={colors.primary} />
            </button>
          )}
          {!showScoring && canWatch && ghost("Watch Live", () => h.onWatchScorecard(match), true)}
        </div>
      ) : canWatch ? (
        <div className="mt-3">{ghost("Watch Live", () => h.onWatchScorecard(match), true)}</div>
      ) : (
        <div className="mt-3">{ghost("View match details", () => h.onViewDetails(match))}</div>
      )}
    </div>
  );
}

function roundLabel(format: Format, round: number, roundMatches: TournamentMatch[]) {
  if (format === "MANUAL") return roundMatches[0]?.manual_stage_name || `Round ${round}`;
  if (format === "LEAGUE" && round === 1) return "League Stage";
  const ids = new Set<string>();
  for (const m of roundMatches) {
    if (m.team_a_id) ids.add(m.team_a_id);
    if (m.team_b_id) ids.add(m.team_b_id);
  }
  return knockoutRoundLabel(ids.size);
}

const passes = (m: TournamentMatch, f: StatusFilter) => f === "ALL" || (f === "COMPLETED" ? m.status === "COMPLETED" : m.status !== "COMPLETED");
const rankStandings = (teams: { id: string; name: string }[], matches: TournamentMatch[], nrr?: Map<string, number>) => applyHeadToHeadTiebreak(computeStandings(teams, matches, nrr), matches);

// Renders a set of rounds (or pools) of matches with the active filters.
function RoundsList({ groups, h, statusFilter }: { groups: { key: string; label: string; matches: TournamentMatch[] }[]; h: RowHandlers; statusFilter: StatusFilter }) {
  let shown = 0;
  return (
    <>
      {groups.map((g) => {
        const visible = g.matches.filter((m) => passes(m, statusFilter));
        if (visible.length === 0) return null;
        return (
          <div key={g.key} className={shown++ > 0 ? "mt-4" : undefined}>
            <p className="mb-2 text-xs font-semibold text-ink">{g.label}</p>
            <div className="grid gap-2 xl:grid-cols-2">
              {visible.map((m, i) => (
                <MatchRow key={m.id} match={m} matchNumber={i + 1} h={h} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Champion({ name }: { name: string }) {
  return <p className="mt-4 rounded-xl bg-primary-light py-3 text-center text-xs font-semibold text-primary-dark">🏆 Champion: {name}</p>;
}

function MatchesPanel({ gameId, format, approvedTeams, requiredTeams, h, statusFilter, stageFilter }: { gameId: string; format: Format; approvedTeams: { id: string; name: string }[]; requiredTeams: number; h: RowHandlers; statusFilter: StatusFilter; stageFilter: string | null }) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generateMatches = useGenerateMatches(gameId);
  const generateNextRound = useGenerateNextRound(gameId);
  if (isLoading) return null;
  const all = matches ?? [];
  const canGenerate = requiredTeams > 0 && approvedTeams.length === requiredTeams;

  if (all.length === 0) {
    if (!h.isHost) return null;
    return (
      <Card>
        <CardHeader
          icon="git-network-outline"
          title="Matches"
          subtitle={canGenerate ? "All teams are approved — generate the matchups" : `Waiting on team approvals (${approvedTeams.length}/${requiredTeams || "—"})`}
        />
        {canGenerate ? (
          <GenerateButton busy={generateMatches.isPending} icon="git-network-outline" label="Generate Matches" onPress={() => generateMatches.mutate({ format, teams: approvedTeams }, { onError: err("Could not generate matches.") })} />
        ) : (
          <p className="text-xs text-muted">
            Matches will be available once all {requiredTeams || "—"} teams are approved ({approvedTeams.length}/{requiredTeams || "—"} so far).
          </p>
        )}
      </Card>
    );
  }

  const rounds = [...new Set(all.map((m) => m.round))].sort((a, b) => a - b);
  const latest = rounds[rounds.length - 1];
  const latestMatches = all.filter((m) => m.round === latest);
  const leagueStage = format === "LEAGUE" && latest === 1;
  const winners = !leagueStage ? getRoundWinners(latestMatches) : null;
  const groupDone = leagueStage && latestMatches.every((m) => m.status === "COMPLETED");
  const standings = groupDone ? rankStandings(approvedTeams, all, h.nrrByTeam) : [];
  const playoffSize = approvedTeams.length >= 4 ? 4 : Math.min(2, approvedTeams.length);
  const playoffTeams = standings.slice(0, playoffSize).map((s) => ({ id: s.teamId, name: s.name }));
  const groups = rounds
    .map((r) => {
      const ms = all.filter((m) => m.round === r);
      return { key: String(r), label: roundLabel(format, r, ms), matches: ms };
    })
    .filter((g) => stageFilter === null || g.label === stageFilter);

  return (
    <Card>
      <CardHeader icon="git-network-outline" title="Matches" badge={TOURNAMENT_FORMAT_LABEL[format]} />
      <RoundsList groups={groups} h={h} statusFilter={statusFilter} />
      <BracketPreviewRounds rounds={!leagueStage && statusFilter !== "COMPLETED" ? computeBracketPreviewRounds(latestMatches.length) : []} />
      {h.isHost && winners && winners.length > 1 && (
        <div className="mt-4">
          <GenerateButton
            busy={generateNextRound.isPending}
            icon="git-network-outline"
            label={`Generate ${knockoutRoundLabel(winners.length)} Matches`}
            onPress={() => generateNextRound.mutate({ round: latest + 1, teams: winners }, { onError: err("Could not generate the next round.") })}
          />
        </div>
      )}
      {h.isHost && groupDone && playoffTeams.length >= 2 && (
        <div className="mt-4">
          <GenerateButton
            busy={generateNextRound.isPending}
            icon="trophy-outline"
            label={`Generate ${knockoutRoundLabel(playoffTeams.length)} Playoffs (Top ${playoffTeams.length})`}
            onPress={() => generateNextRound.mutate({ round: 2, teams: playoffTeams }, { onError: err("Could not generate the playoffs.") })}
          />
        </div>
      )}
      {winners && winners.length === 1 && <Champion name={winners[0].name} />}
    </Card>
  );
}

function StandingsPanel({ teams, matches, label = "Standings", nrrByTeam, showNRR }: { teams: { id: string; name: string }[]; matches: TournamentMatch[]; label?: string; nrrByTeam?: Map<string, number>; showNRR?: boolean }) {
  const standings = rankStandings(teams, matches, nrrByTeam);
  if (standings.length === 0 || standings.every((s) => s.played === 0)) return null;
  const col = "w-7 text-center";
  return (
    <Card>
      <CardHeader icon="stats-chart-outline" title={label} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="pb-2 text-left font-semibold">Team</th>
            {["P", "W", "D", "L"].map((c) => (
              <th key={c} className={`${col} pb-2 font-semibold`}>
                {c}
              </th>
            ))}
            <th className="w-8 pb-2 text-center font-bold">Pts</th>
            {showNRR && <th className="w-[50px] pb-2 text-center font-semibold">NRR</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.teamId} className="border-b border-border text-ink">
              <td className="max-w-0 truncate py-2">{s.name}</td>
              <td className={col}>{s.played}</td>
              <td className={col}>{s.won}</td>
              <td className={col}>{s.drawn}</td>
              <td className={col}>{s.lost}</td>
              <td className="w-8 text-center font-bold">{s.points}</td>
              {showNRR && <td className="w-[50px] text-center">{s.nrr === null ? "—" : `${s.nrr > 0 ? "+" : ""}${s.nrr.toFixed(3)}`}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function GroupsPanel({ gameId, pools, teams, requiredTeams, isHost }: { gameId: string; pools: TournamentPool[]; teams: TournamentTeam[]; requiredTeams: number; isHost: boolean }) {
  const assign = useAssignTeamToPool(gameId);
  const unassigned = teams.filter((t) => !t.pool_id);
  const perGroup = pools.length > 0 ? requiredTeams / pools.length : 0;
  return (
    <Card>
      <CardHeader icon="people-outline" title="Groups" />
      <div className="grid gap-3 sm:grid-cols-2">
        {pools.map((pool) => {
          const inPool = teams.filter((t) => t.pool_id === pool.id);
          return (
            <div key={pool.id}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">{pool.name}</span>
                {perGroup > 0 && (
                  <span className="text-muted">
                    {inPool.length}/{perGroup}
                  </span>
                )}
              </div>
              {inPool.length === 0 ? <p className="text-xs text-muted">No teams assigned yet.</p> : inPool.map((t) => <p key={t.id} className="text-sm text-ink">{t.name}</p>)}
            </div>
          );
        })}
      </div>
      {isHost && unassigned.length > 0 && (
        <div className="mt-2 border-t border-border pt-3">
          <p className="mb-3 text-xs font-semibold text-ink">Assign Teams to a Group</p>
          <div className="no-scrollbar flex gap-4 overflow-x-auto pr-1">
            {unassigned.map((t) => (
              <div key={t.id} className="w-[220px] shrink-0 rounded-2xl border border-border bg-gray-50 p-4">
                <p className="mb-3 truncate text-base font-bold text-ink">{t.name}</p>
                <div className="flex flex-wrap gap-2">
                  {pools.map((pool) => {
                    const full = perGroup > 0 && teams.filter((tt) => tt.pool_id === pool.id).length >= perGroup;
                    return (
                      <button
                        key={pool.id}
                        type="button"
                        disabled={assign.isPending || full}
                        onClick={() =>
                          Alert.alert("Assign to Group", `Add "${t.name}" to ${pool.name}?`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Assign", onPress: () => assign.mutate({ teamId: t.id, poolId: pool.id }, { onError: err("Could not assign team.") }) },
                          ])
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${full ? "border border-border bg-gray-100 text-muted" : "border border-primary text-primary hover:bg-primary-light"}`}
                      >
                        {pool.name}
                        {full ? " · Full" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function PoolMatchesPanel({ gameId, pools, teams, requiredTeams, h, statusFilter, stageFilter }: { gameId: string; pools: TournamentPool[]; teams: TournamentTeam[]; requiredTeams: number; h: RowHandlers; statusFilter: StatusFilter; stageFilter: string | null }) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generatePoolMatches = useGeneratePoolMatches(gameId);
  if (isLoading) return null;
  const all = matches ?? [];
  const unassigned = teams.filter((t) => !t.pool_id);
  const canGenerate = pools.length > 0 && requiredTeams > 0 && teams.length === requiredTeams && unassigned.length === 0;

  if (all.length === 0) {
    if (!h.isHost) return null;
    return (
      <Card>
        <CardHeader icon="git-network-outline" title="Matches" subtitle={canGenerate ? "Every approved team has a group — generate the group-stage matchups" : undefined} />
        {canGenerate ? (
          <GenerateButton
            busy={generatePoolMatches.isPending}
            icon="git-network-outline"
            label="Generate Group Matches"
            onPress={() =>
              generatePoolMatches.mutate(
                pools.map((p) => ({ poolId: p.id, teams: teams.filter((t) => t.pool_id === p.id).map((t) => ({ id: t.id, name: t.name })) })),
                { onError: err("Could not generate the group matches.") }
              )
            }
          />
        ) : (
          <p className="text-xs text-muted">
            {teams.length < requiredTeams
              ? `Matches will be available once all ${requiredTeams} teams are approved (${teams.length}/${requiredTeams} so far).`
              : unassigned.length > 0
                ? `Assign all approved teams to a group first (${unassigned.length} left).`
                : "Matches will be available once teams are approved and assigned to groups."}
          </p>
        )}
      </Card>
    );
  }

  const groups = pools
    .filter((p) => stageFilter === null || stageFilter === p.name)
    .map((p) => ({ key: p.id, label: p.name, matches: all.filter((m) => m.pool_id === p.id) }));
  return (
    <Card>
      <CardHeader icon="git-network-outline" title="Matches" badge="Pool" />
      <RoundsList groups={groups} h={h} statusFilter={statusFilter} />
    </Card>
  );
}

function PoolPlayoffPanel({ gameId, pools, teams, requiredTeams, h, statusFilter, stageFilter, qualifiersPerGroup }: { gameId: string; pools: TournamentPool[]; teams: TournamentTeam[]; requiredTeams: number; h: RowHandlers; statusFilter: StatusFilter; stageFilter: string | null; qualifiersPerGroup: number }) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const generateNextRound = useGenerateNextRound(gameId);
  if (isLoading) return null;
  const all = matches ?? [];
  const groupMatches = all.filter((m) => m.pool_id !== null);
  const playoff = all.filter((m) => m.pool_id === null);
  const groupStageDone =
    pools.length > 0 &&
    requiredTeams > 0 &&
    teams.length === requiredTeams &&
    teams.every((t) => t.pool_id) &&
    pools.every((p) => {
      const ms = groupMatches.filter((m) => m.pool_id === p.id);
      return ms.length > 0 && ms.every((m) => m.status === "COMPLETED");
    });
  if (!groupStageDone) return null;

  if (playoff.length === 0) {
    const poolStandings = pools.map((p) =>
      rankStandings(teams.filter((t) => t.pool_id === p.id).map((t) => ({ id: t.id, name: t.name })), groupMatches.filter((m) => m.pool_id === p.id), h.nrrByTeam)
    );
    const qualifiers: { id: string; name: string }[] = [];
    for (let rank = 0; rank < qualifiersPerGroup; rank++) {
      for (const st of poolStandings) if (st[rank]) qualifiers.push({ id: st[rank].teamId, name: st[rank].name });
    }
    if (qualifiers.length < 2) return null;
    const label = knockoutRoundLabel(qualifiers.length);
    return (
      <Card>
        <CardHeader icon="trophy-outline" title="Playoffs" subtitle={`Every group is done — generate the ${label.toLowerCase()}${qualifiers.length > 2 ? "s" : ""} from the group standings`} />
        {h.isHost && (
          <GenerateButton
            busy={generateNextRound.isPending}
            icon="trophy-outline"
            label={`Generate ${label}${qualifiers.length > 2 ? "s" : ""}`}
            onPress={() => generateNextRound.mutate({ round: 2, teams: qualifiers }, { onError: err("Could not generate the playoffs.") })}
          />
        )}
        {statusFilter !== "COMPLETED" && <BracketPreviewRounds rounds={computeBracketPreviewRounds(qualifiers.length)} />}
      </Card>
    );
  }

  const rounds = [...new Set(playoff.map((m) => m.round))].sort((a, b) => a - b);
  const latest = rounds[rounds.length - 1];
  const latestMatches = playoff.filter((m) => m.round === latest);
  const winners = getRoundWinners(latestMatches);
  const groups = rounds
    .map((r) => {
      const ms = playoff.filter((m) => m.round === r);
      return { key: String(r), label: roundLabel("KNOCKOUT", r, ms), matches: ms };
    })
    .filter((g) => stageFilter === null || g.label === stageFilter);

  return (
    <Card>
      <CardHeader icon="trophy-outline" title="Playoffs" />
      <RoundsList groups={groups} h={h} statusFilter={statusFilter} />
      <BracketPreviewRounds rounds={statusFilter !== "COMPLETED" ? computeBracketPreviewRounds(latestMatches.length) : []} />
      {h.isHost && winners && winners.length > 1 && (
        <div className="mt-4">
          <GenerateButton
            busy={generateNextRound.isPending}
            icon="git-network-outline"
            label={`Generate ${knockoutRoundLabel(winners.length)} Matches`}
            onPress={() => generateNextRound.mutate({ round: latest + 1, teams: winners }, { onError: err("Could not generate the next round.") })}
          />
        </div>
      )}
      {winners && winners.length === 1 && <Champion name={winners[0].name} />}
    </Card>
  );
}

// Port of TournamentMatchesScreen ("Tournament Dashboard"): stats strip,
// Matches / Points Table tabs, Live Now, status + stage filters, fixture
// preview, generated rounds with scoring / scorer / schedule actions,
// knockout and playoff generation, groups (pool) assignment and standings.
export default function TournamentMatchesPage() {
  const { gameId = "" } = useParams();
  const navigate = useAppNavigate();
  const goToScorecard = useGoToScorecard();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: game, isLoading: gameLoading } = useGameDetail(gameId);
  const { data: teamsData, isLoading: teamsLoading } = useTournamentTeams(gameId);
  const { data: matches } = useTournamentMatches(gameId);
  const { data: nrrByTeam } = useTournamentNRR(gameId, matches);
  const linkedCricketIds = (matches ?? []).filter((m) => m.cricket_match_id).map((m) => m.cricket_match_id as string);
  const { data: liveRaw } = useLiveCricketMatches(linkedCricketIds);
  const completedCricketIds = new Set((matches ?? []).filter((m) => m.status === "COMPLETED" && m.cricket_match_id).map((m) => m.cricket_match_id as string));
  const liveMatches = (liveRaw ?? []).filter((lm) => !completedCricketIds.has(lm.id));
  const liveIds = new Set(liveMatches.map((lm) => lm.id));
  const { data: pools } = useTournamentPools(gameId);
  const setMatchScorer = useSetMatchScorer(gameId);
  const updateSchedule = useUpdateMatchSchedule(gameId);
  const [scorerMatchId, setScorerMatchId] = useState<string | null>(null);
  const [scheduleMatchId, setScheduleMatchId] = useState<string | null>(null);
  const [tab, setTab] = useState<"MATCHES" | "POINTS">("MATCHES");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  if (gameLoading || teamsLoading || !game) {
    return (
      <div className="flex justify-center pt-32">
        <Spinner />
      </div>
    );
  }

  const isHost = game.creator_id === userId || (!!userId && (game.co_host_ids ?? []).includes(userId));
  const teams = (teamsData ?? []).map((t) => ({ ...t, name: soloAwareTeamName(t.name, t.tournament_team_members.map((m) => ({ status: m.status, full_name: m.profiles?.full_name }))) }));
  const approvedFull = teams.filter((t) => t.status === "APPROVED");
  const approved = approvedFull.map((t) => ({ id: t.id, name: t.name }));
  const active = teams.filter((t) => t.status !== "REJECTED");
  const teamStatusById = new Map(teams.map((t) => [t.id, t.status]));
  const requiredTeams = game.number_of_teams ?? 0;
  const all = matches ?? [];
  const isPool = game.tournament_format === "POOL";
  const sportName = (game.sports?.name ?? "").trim().toLowerCase();
  const isCricket = isCricketFamily(sportName);
  const played = all.filter((m) => m.status === "COMPLETED").length;
  const nonPool = all.filter((m) => !isPool || m.pool_id === null);
  const nonPoolRounds = [...new Set(nonPool.map((m) => m.round))].sort((a, b) => a - b);
  const stageOptions = isPool
    ? [...(pools ?? []).map((p) => p.name), ...nonPoolRounds.map((r) => roundLabel("KNOCKOUT", r, nonPool.filter((m) => m.round === r)))]
    : nonPoolRounds.map((r) => roundLabel(game.tournament_format ?? "KNOCKOUT", r, nonPool.filter((m) => m.round === r)));

  const roster = new Map<string, ScorecardPrefillPlayer[]>();
  for (const t of teams) roster.set(t.id, t.tournament_team_members.filter((m) => m.status === "JOINED").map((m) => ({ name: m.profiles?.full_name ?? m.manual_name ?? "Player", userId: m.user_id })));

  const rawCandidates: ScorerCandidate[] = active.flatMap((t) =>
    t.tournament_team_members.filter((m) => m.status === "JOINED" && m.user_id).map((m) => ({ id: m.user_id as string, name: m.profiles?.full_name ?? "Player", teamName: t.name }))
  );
  if (game.creator_id) rawCandidates.push({ id: game.creator_id, name: game.profiles?.full_name ?? "Host", teamName: "Tournament Host" });
  for (const host of game.hosts ?? []) if (host.id !== game.creator_id) rawCandidates.push({ id: host.id, name: host.full_name ?? "Host", teamName: "Game Host" });
  const candidates = [...new Map(rawCandidates.map((c) => [c.id, c])).values()].map((c) =>
    c.id === game.creator_id || (game.co_host_ids ?? []).includes(c.id) ? { ...c, name: `${c.name} (Host)` } : c
  );
  const manualTeams = active.map((t) => ({ id: t.id, name: t.name, manualStatus: t.manual_status }));
  const scorerNameById = new Map(candidates.map((c) => [c.id, c.name]));

  const buildPrefill = (m: TournamentMatch): ScorecardPrefill | null => {
    if (!m.team_a || !m.team_b) return null;
    const rawA = roster.get(m.team_a.id) ?? [];
    const rawB = roster.get(m.team_b.id) ?? [];
    const { teamANames, teamBNames } = disambiguateRoster(rawA.map((p) => ({ name: p.name, sourceId: p.userId })), rawB.map((p) => ({ name: p.name, sourceId: p.userId })));
    return {
      tournamentMatchId: m.id,
      gameId,
      teamAName: m.team_a.name,
      teamBName: m.team_b.name,
      teamAPlayers: rawA.map((p, i) => ({ ...p, name: teamANames[i] })),
      teamBPlayers: rawB.map((p, i) => ({ ...p, name: teamBNames[i] })),
      venue: game.venues?.name ?? game.custom_venue_name ?? undefined,
      sportId: game.sports?.id,
    };
  };

  const teamsReady = (m: TournamentMatch) => !!m.team_a && !!m.team_b && teamStatusById.get(m.team_a.id) === "APPROVED" && teamStatusById.get(m.team_b.id) === "APPROVED";
  const requireReady = (m: TournamentMatch) => {
    if (teamsReady(m)) return true;
    Alert.alert("Complete the team members", "Both teams in this match need their full roster filled and approved before you can start scoring it.");
    return false;
  };

  const h: RowHandlers = {
    isHost,
    currentUserId: userId,
    nrrByTeam,
    teamStatusById,
    liveCricketMatchIds: liveIds,
    getScorerName: (m) => (m.scorer_user_id ? (scorerNameById.get(m.scorer_user_id) ?? null) : null),
    onGoToScorecard: (m) => {
      if (!requireReady(m)) return;
      const prefill = buildPrefill(m);
      if (prefill) goToScorecard(sportName, m, prefill);
    },
    onEnterScoreManually: (m) => {
      if (!requireReady(m)) return;
      const prefill = buildPrefill(m);
      const manualSport = manualSportForName(sportName);
      if (!prefill || !manualSport) return;
      const allowDraw = !!m.pool_id || (game.tournament_format === "LEAGUE" && m.round === 1);
      navigate(paths.manualScore, { state: { tab: "community", params: { sport: manualSport, allowDraw, prefill } } });
    },
    onSelectScorer: (m) => setScorerMatchId(m.id),
    onSetTime: (m) => setScheduleMatchId(m.id),
    onViewDetails: (m) => {
      const ready = teamsReady(m);
      const reason = !m.team_a || !m.team_b ? "Waiting for both teams to be decided." : !ready ? "Waiting for both teams' rosters to be filled and approved." : "Waiting for a scorer to be assigned.";
      Alert.alert(`${m.team_a?.name ?? "TBD"} vs ${m.team_b?.name ?? "Bye"}`, [m.scheduled_at ? formatMatchSchedule(m.scheduled_at) : "Not scheduled yet", reason].join("\n"));
    },
    onWatchScorecard: (m) => {
      if (isCricket && m.cricket_match_id) navigate(paths.match("cricket", m.cricket_match_id), { state: { tab: "scorecard" } });
    },
  };

  const scorerMatch = all.find((m) => m.id === scorerMatchId) ?? null;
  const scheduleMatch = all.find((m) => m.id === scheduleMatchId) ?? null;

  return (
    <div className="relative mx-auto max-w-5xl overflow-hidden pb-10 lg:px-8 lg:pt-6">
      <PlainHeader
        wide
        title={
          <>
            <span className="block text-[11px] font-bold tracking-wide text-muted">TOURNAMENT DASHBOARD</span>
            <span className="block truncate text-[22px]">{game.title}</span>
          </>
        }
        subtitle={
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-overlay px-2.5 py-1 text-xs font-semibold text-ink">{game.tournament_format ? TOURNAMENT_FORMAT_LABEL[game.tournament_format] : "—"}</span>
            <span className="text-xs text-muted">
              {approvedFull.length} teams · {all.length} matches
            </span>
          </span>
        }
        backFallback={paths.game(gameId)}
      />

      <div className="relative flex items-center gap-3 px-4 py-4 lg:px-0">
        {[
          [approvedFull.length, "Teams"],
          [`${played}/${all.length}`, "Played"],
          [all.length - played, "Remaining"],
        ].map(([v, l]) => (
          <div key={l} className="flex flex-1 flex-col items-center">
            <span className="text-[22px] font-extrabold text-ink">{v}</span>
            <span className="mt-0.5 text-xs text-muted">{l}</span>
          </div>
        ))}
      </div>

      <div className="relative flex gap-6 border-b border-border px-4 lg:px-0" role="tablist">
        {(
          [
            ["MATCHES", "Matches"],
            ["POINTS", "Points Table"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className="pb-3 text-sm font-semibold" style={{ color: tab === key ? colors.primaryDark : colors.muted }}>
            {label}
            <span className={`mt-1.5 block h-[2.5px] rounded-sm ${tab === key ? "bg-primary" : "bg-transparent"}`} />
          </button>
        ))}
      </div>

      {tab === "MATCHES" && (
        <div className="relative">
          {liveMatches.length > 0 && (
            <div className="mx-4 mt-3 rounded-2xl border border-red-300 bg-red-50 p-4 lg:mx-0">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-surface" />
                  LIVE
                </span>
                <span className="text-sm font-bold text-red-800">Live Now</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {liveMatches.map((lm) => (
                  <button key={lm.id} type="button" onClick={() => navigate(paths.match("cricket", lm.id), { state: { tab: "scorecard" } })} className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-3 text-left shadow-card">
                    <span className="truncate text-sm font-semibold text-ink">
                      {lm.team_a_name} vs {lm.team_b_name}
                    </span>
                    <Ionicon name="chevron-forward" size={16} color={colors.muted} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 px-4 py-3 lg:px-0">
            {(["ALL", "UPCOMING", "COMPLETED"] as const).map((f) => {
              const sel = statusFilter === f;
              return (
                <button key={f} type="button" aria-pressed={sel} onClick={() => setStatusFilter(sel && f !== "ALL" ? "ALL" : f)} className={`rounded-full px-4 py-2 text-xs font-bold ${sel ? "bg-brand text-white" : "bg-gray-100 text-muted hover:text-ink"}`}>
                  {f === "ALL" ? "All" : f === "UPCOMING" ? "Upcoming" : "Completed"}
                </button>
              );
            })}
          </div>
          {stageOptions.length > 0 && (
            <>
              <p className="mb-2 px-4 text-sm font-bold text-ink lg:px-0">Tournament stages</p>
              <div className="flex flex-wrap gap-2 px-4 pb-2 lg:px-0">
                {stageOptions.map((stage) => {
                  const sel = stageFilter === stage;
                  return (
                    <button key={stage} type="button" aria-pressed={sel} onClick={() => setStageFilter(sel ? null : stage)} className={`rounded-full px-4 py-2 text-xs font-bold ${sel ? "border-[1.5px] border-primary bg-primary-light text-primary-dark" : "bg-gray-100 text-muted"}`}>
                      {stage}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div className="relative">
        {tab === "POINTS" ? (
          isPool ? (
            (pools ?? []).map((pool) => (
              <StandingsPanel
                key={pool.id}
                teams={approvedFull.filter((t) => t.pool_id === pool.id).map((t) => ({ id: t.id, name: t.name }))}
                matches={all.filter((m) => m.pool_id === pool.id)}
                label={`${pool.name} Standings`}
                nrrByTeam={nrrByTeam}
                showNRR={isCricket}
              />
            ))
          ) : game.tournament_format === "LEAGUE" || game.tournament_format === "MANUAL" ? (
            <StandingsPanel teams={approved} matches={all} nrrByTeam={nrrByTeam} showNRR={isCricket} />
          ) : (
            <p className="mt-16 px-6 text-center text-sm text-muted">A points table only applies to a league or group stage — Knockout advances by result alone.</p>
          )
        ) : isPool ? (
          <>
            <GroupsPanel gameId={game.id} pools={pools ?? []} teams={active} requiredTeams={requiredTeams} isHost={isHost} />
            <PoolMatchesPanel gameId={game.id} pools={pools ?? []} teams={active} requiredTeams={requiredTeams} h={h} statusFilter={statusFilter} stageFilter={stageFilter} />
            <PoolPlayoffPanel
              gameId={game.id}
              pools={pools ?? []}
              teams={active}
              requiredTeams={requiredTeams}
              h={h}
              statusFilter={statusFilter}
              stageFilter={stageFilter}
              qualifiersPerGroup={game.pool_qualifiers_per_group ?? ((pools ?? []).length === 2 ? 2 : 1)}
            />
          </>
        ) : (
          <>
            {game.tournament_format && game.tournament_format !== "MANUAL" && all.length === 0 && (
              <Card>
                <CardHeader icon="calendar-outline" title="Fixtures" subtitle="Tournament matchups" badge={TOURNAMENT_FORMAT_LABEL[game.tournament_format]} />
                <div className="grid gap-2 xl:grid-cols-2">
                  {computeFixtures(game.tournament_format, active.map((t) => t.name)).map((f, i) => {
                    const statusByName = new Map(active.map((t) => [t.name, t.status]));
                    return (
                      <div key={i} className="rounded-xl bg-gray-50 px-3 py-2.5">
                        <VsRow a={f.teamA} b={f.teamB ?? "Bye"} aStatus={statusByName.get(f.teamA)} bStatus={f.teamB ? statusByName.get(f.teamB) : null} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {game.tournament_format === "MANUAL" ? (
              <>
                <ManualTeamsPanel gameId={game.id} teams={manualTeams} isHost={isHost} />
                <ManualMatchesPanel gameId={game.id} teams={manualTeams} isHost={isHost} h={h} statusFilter={statusFilter} stageFilter={stageFilter} />
              </>
            ) : game.tournament_format && (
              <MatchesPanel gameId={game.id} format={game.tournament_format} approvedTeams={active.map((t) => ({ id: t.id, name: t.name }))} requiredTeams={requiredTeams} h={h} statusFilter={statusFilter} stageFilter={stageFilter} />
            )}
          </>
        )}
      </div>

      <SelectScorerModal
        open={!!scorerMatchId}
        onClose={() => setScorerMatchId(null)}
        members={candidates}
        currentScorerId={scorerMatch?.scorer_user_id ?? null}
        submitting={setMatchScorer.isPending}
        onSelect={(uid) => scorerMatchId && setMatchScorer.mutate({ matchId: scorerMatchId, scorerUserId: uid }, { onSuccess: () => setScorerMatchId(null), onError: err("Could not assign scorer.") })}
      />
      <SetMatchTimeModal
        open={!!scheduleMatchId}
        onClose={() => setScheduleMatchId(null)}
        initialIso={scheduleMatch?.scheduled_at ?? null}
        submitting={updateSchedule.isPending}
        onConfirm={(iso) => scheduleMatchId && updateSchedule.mutate({ matchId: scheduleMatchId, scheduledAt: iso }, { onSuccess: () => setScheduleMatchId(null), onError: err("Could not set match time.") })}
      />
    </div>
  );
}

type ManualTeamStatus = Database["public"]["Enums"]["tournament_team_manual_status_type"];
type PickTeam = { id: string; name: string };
type ManualTeam = PickTeam & { manualStatus: ManualTeamStatus };

const MANUAL_STATUS_META: Record<ManualTeamStatus, { label: string; pill: string; text: string; icon: string; iconColor: string }> = {
  PENDING: { label: "Pending", pill: "bg-gray-100", text: "text-muted", icon: "time-outline", iconColor: colors.muted },
  QUALIFIED: { label: "Qualified", pill: "bg-green-50", text: "text-primary", icon: "checkmark-circle", iconColor: colors.primary },
  KNOCKED_OUT: { label: "Knocked Out", pill: "bg-red-50", text: "text-red-600", icon: "close-circle", iconColor: "#DC2626" },
  CHAMPION: { label: "Champion", pill: "bg-amber-50", text: "text-amber-700", icon: "trophy", iconColor: colors.warning },
};
const MANUAL_STAGE_PRESETS = ["Round of 16", "Quarter-Final", "Semi-Final", "Final", "Third Place"];

function SelectMatchTeamSheet({ open, onClose, teams, excludeId, onSelect }: { open: boolean; onClose: () => void; teams: PickTeam[]; excludeId?: string | null; onSelect: (t: PickTeam) => void }) {
  const selectable = teams.filter((t) => t.id !== excludeId);
  return (
    <Modal open={open} onClose={onClose} title="Select Team">
      {selectable.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No eligible teams available.</p>
      ) : (
        selectable.map((t) => (
          <button key={t.id} type="button" onClick={() => onSelect(t)} className="mb-2 block w-full truncate rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3 text-left text-sm font-semibold text-ink hover:border-primary/40">
            {t.name}
          </button>
        ))
      )}
    </Modal>
  );
}

function TeamVsTeamPicker({ teams, teamA, teamB, onPickA, onPickB }: { teams: PickTeam[]; teamA: PickTeam | null; teamB: PickTeam | null; onPickA: (t: PickTeam) => void; onPickB: (t: PickTeam) => void }) {
  const [side, setSide] = useState<"A" | "B" | null>(null);
  const slot = (label: string, team: PickTeam | null, onPress: () => void) => (
    <button type="button" onClick={onPress} className={`min-w-0 flex-1 rounded-xl border-[1.5px] bg-surface px-3 py-2.5 text-left ${team ? "border-primary" : "border-border"}`}>
      <span className="block text-xs text-muted">{label}</span>
      <span className="block truncate text-sm font-semibold text-ink">{team?.name ?? "Pick a team"}</span>
    </button>
  );
  return (
    <>
      <div className="flex items-center gap-2.5">
        {slot("Team A", teamA, () => setSide("A"))}
        <span className="text-xs font-bold text-muted">VS</span>
        {slot("Team B", teamB, () => setSide("B"))}
      </div>
      <SelectMatchTeamSheet
        open={side !== null}
        onClose={() => setSide(null)}
        teams={teams}
        excludeId={side === "A" ? teamB?.id : teamA?.id}
        onSelect={(t) => {
          if (side === "A") onPickA(t);
          else onPickB(t);
          setSide(null);
        }}
      />
    </>
  );
}

function ManualTeamsPanel({ gameId, teams, isHost }: { gameId: string; teams: ManualTeam[]; isHost: boolean }) {
  const setStatus = useSetTeamManualStatus(gameId);
  const [target, setTarget] = useState<ManualTeam | null>(null);
  if (teams.length === 0) return null;
  const champion = teams.find((t) => t.manualStatus === "CHAMPION");
  const choose = (status: ManualTeamStatus) => {
    if (!target) return;
    const proceed = () => setStatus.mutate({ teamId: target.id, manualStatus: status }, { onSuccess: () => setTarget(null), onError: err("Could not update the team's status.") });
    if (status === "KNOCKED_OUT" || status === "CHAMPION") {
      Alert.alert(
        status === "CHAMPION" ? "Mark as Champion?" : "Knock Out This Team?",
        status === "CHAMPION" ? `${target.name} will be shown as the Tournament Champion.` : `${target.name} won't be selectable for future matches, unless you reverse this later.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: proceed },
        ]
      );
    } else proceed();
  };
  return (
    <Card>
      <CardHeader icon="people-outline" title="Teams" subtitle={isHost ? "Tap a team to set its status" : undefined} />
      {champion && <p className="mb-3 rounded-xl bg-primary-light py-3 text-center text-xs font-semibold text-primary-dark">🏆 Tournament Champion: {champion.name}</p>}
      <div className="flex flex-col gap-2">
        {teams.map((t) => {
          const meta = MANUAL_STATUS_META[t.manualStatus];
          return (
            <button key={t.id} type="button" disabled={!isHost} onClick={() => setTarget(t)} className="flex items-center justify-between gap-2.5 rounded-2xl bg-surface px-3 py-2.5 text-left enabled:hover:bg-gray-50">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.name}</span>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.pill} ${meta.text}`}>
                <Ionicon name={meta.icon} size={12} color={meta.iconColor} />
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>
      <Modal open={!!target} onClose={() => setTarget(null)} title={target?.name} subtitle="Set this team's tournament status">
        <div className="flex flex-col gap-2 pb-2">
          {(["PENDING", "QUALIFIED", "KNOCKED_OUT", "CHAMPION"] as ManualTeamStatus[]).map((opt) => {
            const meta = MANUAL_STATUS_META[opt];
            const current = opt === target?.manualStatus;
            return (
              <button
                key={opt}
                type="button"
                disabled={setStatus.isPending}
                onClick={() => choose(opt)}
                className={`flex items-center gap-2.5 rounded-2xl border-[1.5px] px-4 py-3 text-left ${current ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/40"}`}
              >
                <Ionicon name={meta.icon} size={18} color={current ? colors.primaryDark : meta.iconColor} />
                <span className={`flex-1 text-sm font-semibold ${current ? "text-primary-dark" : "text-ink"}`}>{meta.label}</span>
                {current && <Ionicon name="checkmark" size={16} color={colors.primaryDark} />}
              </button>
            );
          })}
        </div>
      </Modal>
    </Card>
  );
}

function ManualMatchesPanel({ gameId, teams, isHost, h, statusFilter, stageFilter }: { gameId: string; teams: ManualTeam[]; isHost: boolean; h: RowHandlers; statusFilter: StatusFilter; stageFilter: string | null }) {
  const { data: matches, isLoading } = useTournamentMatches(gameId);
  const addManualMatch = useAddManualMatch(gameId);
  const updateTeams = useUpdateManualMatchTeams(gameId);
  const deleteMatch = useDeleteManualMatch(gameId);
  const [draftA, setDraftA] = useState<PickTeam | null>(null);
  const [draftB, setDraftB] = useState<PickTeam | null>(null);
  const [targetRound, setTargetRound] = useState<number | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [editing, setEditing] = useState<TournamentMatch | null>(null);
  const [editA, setEditA] = useState<PickTeam | null>(null);
  const [editB, setEditB] = useState<PickTeam | null>(null);
  if (isLoading) return null;

  const pickable = teams.filter((t) => t.manualStatus !== "KNOCKED_OUT").map((t) => ({ id: t.id, name: t.name }));
  const champion = teams.find((t) => t.manualStatus === "CHAMPION") ?? null;
  const all = matches ?? [];
  const canAdd = isHost && !champion && pickable.length >= 2;
  const rounds = [...new Set(all.map((m) => m.round))].sort((a, b) => a - b);
  const latestRound = rounds.length ? rounds[rounds.length - 1] : 0;
  const effectiveRound = targetRound ?? (latestRound || 1);
  const newRoundNumber = latestRound + 1;
  const isNewStage = effectiveRound === newRoundNumber;
  const existingStageName = all.find((m) => m.round === effectiveRound)?.manual_stage_name ?? null;
  const finalHasMatch = all.some((m) => (m.manual_stage_name ?? "").trim().toLowerCase() === "final");
  const targetStageName = (isNewStage ? newStageName : (existingStageName ?? "")).trim();
  const finalLimitReached = targetStageName.toLowerCase() === "final" && finalHasMatch;
  const addDisabled = !draftA || !draftB || (isNewStage && !newStageName.trim());

  const add = () => {
    if (!draftA || !draftB) return;
    const stageName = isNewStage ? newStageName.trim() : existingStageName || `Round ${effectiveRound}`;
    if (isNewStage && !stageName) return;
    if (stageName.toLowerCase() === "final" && finalHasMatch) return Alert.alert("Final Stage Full", "Only one match can be added to the Final stage.");
    const sortOrder = all.filter((m) => m.round === effectiveRound).length;
    addManualMatch.mutate({ round: effectiveRound, stageName, sortOrder, teamAId: draftA.id, teamBId: draftB.id }, { onSuccess: () => (setDraftA(null), setDraftB(null)), onError: err("Could not add the match.") });
  };
  const remove = (m: TournamentMatch) =>
    Alert.alert("Remove Match", "Remove this match? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteMatch.mutate(m.id, { onError: err("Could not remove the match.") }) },
    ]);
  const chip = (key: string | number, label: string, selected: boolean, onPress: () => void, extra?: { icon?: string; disabled?: boolean }) => (
    <button
      key={key}
      type="button"
      disabled={extra?.disabled}
      onClick={onPress}
      className={`flex shrink-0 items-center gap-1 rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold disabled:opacity-40 ${selected ? "border-primary bg-primary-light text-primary-dark" : "border-border bg-surface text-muted"}`}
    >
      {extra?.icon && <Ionicon name={extra.icon} size={14} color={selected ? colors.primaryDark : colors.muted} />}
      {label}
    </button>
  );

  const addForm = canAdd ? (
    <div>
      {rounds.length > 0 && (
        <div className="no-scrollbar mb-2.5 flex gap-1.5 overflow-x-auto">
          {rounds.map((r) => chip(r, all.find((m) => m.round === r)?.manual_stage_name || `Round ${r}`, effectiveRound === r, () => setTargetRound(r)))}
          {chip("new", "New Stage", isNewStage, () => setTargetRound(newRoundNumber), { icon: "add" })}
        </div>
      )}
      {isNewStage && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold text-ink">Name this stage</p>
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
            {MANUAL_STAGE_PRESETS.map((preset) => chip(preset, preset, newStageName === preset, () => setNewStageName(preset), { disabled: preset.toLowerCase() === "final" && finalHasMatch }))}
          </div>
          <FieldInput value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="Or type a custom stage name" aria-label="Stage name" />
        </div>
      )}
      {finalLimitReached ? (
        <p className="rounded-xl border-[1.5px] border-border bg-surface px-3.5 py-3 text-xs text-muted">Only one match is allowed in the Final stage, and it's already been added. Pick a different stage to add more matches.</p>
      ) : (
        <>
          <TeamVsTeamPicker teams={pickable} teamA={draftA} teamB={draftB} onPickA={setDraftA} onPickB={setDraftB} />
          <button
            type="button"
            onClick={add}
            disabled={addDisabled || addManualMatch.isPending}
            className="press mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-white"
            style={{ opacity: addDisabled ? 0.5 : 1 }}
          >
            {addManualMatch.isPending ? (
              <Spinner size={16} color="white" />
            ) : (
              <>
                <Ionicon name="add-circle-outline" size={16} color="white" />
                Add to {isNewStage ? newStageName.trim() || "New Stage" : existingStageName || `Round ${effectiveRound}`}
              </>
            )}
          </button>
        </>
      )}
    </div>
  ) : null;

  if (all.length === 0) {
    if (!isHost) return null;
    return (
      <Card>
        <CardHeader icon="git-network-outline" title="Matches" subtitle="Add this tournament's first match by hand" />
        {canAdd ? addForm : <p className="text-xs text-muted">Add at least 2 eligible teams to this tournament before creating matches.</p>}
      </Card>
    );
  }

  let shown = 0;
  return (
    <Card>
      <CardHeader icon="git-network-outline" title="Matches" badge={TOURNAMENT_FORMAT_LABEL.MANUAL} />
      {rounds.map((round) => {
        const roundMatches = all.filter((m) => m.round === round);
        const label = roundLabel("MANUAL", round, roundMatches);
        if (stageFilter !== null && stageFilter !== label) return null;
        const visible = roundMatches.filter((m) => passes(m, statusFilter));
        if (visible.length === 0) return null;
        return (
          <div key={round} className={shown++ > 0 ? "mt-4" : undefined}>
            <p className="mb-2 text-xs font-semibold text-ink">{label}</p>
            <div className="grid gap-2 xl:grid-cols-2">
              {visible.map((m, i) => (
                <div key={m.id}>
                  {isHost && m.status !== "COMPLETED" && (
                    <div className="mb-1 flex justify-end gap-3.5 text-xs font-semibold">
                      <button type="button" onClick={() => (setEditing(m), setEditA(m.team_a), setEditB(m.team_b))} className="flex items-center gap-1 text-muted hover:underline">
                        <Ionicon name="pencil-outline" size={14} color={colors.muted} />
                        Edit
                      </button>
                      <button type="button" onClick={() => remove(m)} className="flex items-center gap-1 text-[#DC2626] hover:underline">
                        <Ionicon name="trash-outline" size={14} color="#DC2626" />
                        Remove
                      </button>
                    </div>
                  )}
                  <MatchRow match={m} matchNumber={i + 1} h={h} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {champion ? (
        <p className="mt-4 rounded-xl bg-primary-light py-3 text-center text-xs font-semibold text-primary-dark">🏆 {champion.name} won the Final — tournament complete, no further matches can be added</p>
      ) : (
        canAdd && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-ink">Add a Match</p>
            {addForm}
          </div>
        )
      )}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Match"
        footer={
          <button
            type="button"
            disabled={!editA || !editB || updateTeams.isPending}
            onClick={() =>
              editing && editA && editB && updateTeams.mutate({ matchId: editing.id, teamAId: editA.id, teamBId: editB.id }, { onSuccess: () => setEditing(null), onError: err("Could not update the match.") })
            }
            className="press flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-white"
            style={{ opacity: !editA || !editB ? 0.5 : 1 }}
          >
            {updateTeams.isPending ? <Spinner size={16} color="white" /> : "Save Changes"}
          </button>
        }
      >
        <div className="pb-2">
          <TeamVsTeamPicker teams={pickable} teamA={editA} teamB={editB} onPickA={setEditA} onPickB={setEditB} />
        </div>
      </Modal>
    </Card>
  );
}
