import { useState } from "react";
import { Navigate, useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useAuthStore } from "@app/store/authStore";
import { useMyPadelMatches, useDeletePadelMatch } from "@app/hooks/usePadel";
import { useMyTennisMatches, useDeleteTennisMatch } from "@app/hooks/useTennis";
import { useMyPickleballMatches, useDeletePickleballMatch } from "@app/hooks/usePickleball";
import { useMyBadmintonMatches, useDeleteBadmintonMatch } from "@app/hooks/useBadminton";
import { useMyTableTennisMatches, useDeleteTableTennisMatch } from "@app/hooks/useTableTennis";
import { findPadelMatchByCode, friendlyPadelError } from "@app/lib/api/padel";
import { findTennisMatchByCode, friendlyTennisError } from "@app/lib/api/tennis";
import { findPickleballMatchByCode, friendlyPickleballError } from "@app/lib/api/pickleball";
import { findBadmintonMatchByCode, friendlyBadmintonError } from "@app/lib/api/badminton";
import { findTableTennisMatchByCode, friendlyTableTennisError } from "@app/lib/api/tableTennis";
import { formatSetScore as padelSetScore } from "@app/lib/padelScoring";
import { formatSetScore as tennisSetScore } from "@app/lib/tennisScoring";
import { computeBadmintonState, computePadelState, computePickleballState, computeTableTennisState, computeTennisState } from "@/lib/matchState";
import { RACKET_SPORTS, isRacketSport, type RacketSportKey } from "@/lib/racketSports";
import { useMyFootballMatches, useDeleteFootballMatch } from "@app/hooks/useFootball";
import { findFootballMatchByCode, friendlyFootballError, goalRowToEvent } from "@app/lib/api/football";
import { computeScoreSummary, type Phase } from "@app/lib/footballScoring";
import { useMyCricketMatches, useDeleteCricketMatch } from "@app/hooks/useCricket";
import { ballRowToEvent, findCricketMatchByCode, friendlyCricketError } from "@app/lib/api/cricket";
import { replayInnings, formatOvers } from "@app/lib/cricketScoring";
import { Alert } from "@/lib/alert";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import { CornerAccents, LiveBadge, TeamCrest, TEAM_A_COLOR, TEAM_B_COLOR, ViewScoringPanel } from "@/components/scorecard/ScorecardParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths, type MatchSport } from "@/routes/paths";

type TabKey = "all" | "live" | "completed" | "view";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Matches" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "view", label: "View Scoring" },
];

// What one sport's list card needs, already computed from its match row.
type CardModel = {
  id: string;
  live: boolean;
  completed: boolean;
  aName: string;
  bName: string;
  tally: string;
  breakdown?: string;
  // right-hand label on the card header (Singles/Doubles, or a football phase)
  tag: string | null;
  tagChevron: boolean;
  // cricket: the match format (T20 / OD / …) under the score
  formatPill?: string;
  resultSummary: string | null;
  createdAt: string;
  venue: string | null;
};

function MatchCard({ m, crestIcon, onPress, onDelete }: { m: CardModel; crestIcon: string; onPress: () => void; onDelete: () => void }) {
  const dateLabel = new Date(m.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => e.key === "Enter" && onPress()}
      onContextMenu={(e) => (e.preventDefault(), onDelete())}
      className="press group relative cursor-pointer overflow-hidden rounded-[20px] bg-surface shadow-card transition-shadow hover:shadow-hero"
    >
      <CornerAccents />
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <LiveBadge live={m.live} />
        {(m.tag || m.tagChevron) && (
          <span className="flex items-center gap-1 text-sm text-muted">
            {m.tag}
            {m.tagChevron && <Ionicon name="chevron-forward" size={16} color={colors.muted} />}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-6 pb-3">
        <div className="flex w-[76px] flex-col items-center">
          <TeamCrest color={TEAM_A_COLOR} size={52} icon={crestIcon} />
          <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{m.aName}</p>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <p className="text-[30px] font-extrabold text-ink">{m.tally}</p>
          {m.breakdown !== undefined && <p className="mt-0.5 text-center text-xs text-muted">{m.breakdown}</p>}
          {m.formatPill && <span className="mt-1.5 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-bold text-primary-dark">{m.formatPill}</span>}
        </div>
        <div className="flex w-[76px] flex-col items-center">
          <TeamCrest color={TEAM_B_COLOR} size={52} icon={crestIcon} />
          <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{m.bName}</p>
        </div>
      </div>
      {!m.live && m.resultSummary ? <p className="truncate px-4 pb-2 text-center text-xs font-semibold text-primary">{m.resultSummary}</p> : null}
      <div className="h-px bg-border" />
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
        <Ionicon name="calendar-outline" size={15} color={colors.muted} />
        {dateLabel}
        {m.venue ? (
          <>
            <span className="h-3.5 w-px bg-border" />
            <Ionicon name="location-outline" size={15} color={colors.muted} />
            <span className="flex-1 truncate">{m.venue}</span>
          </>
        ) : null}
        <button
          type="button"
          aria-label={`Delete ${m.aName} vs ${m.bName}`}
          title="Delete match"
          onClick={(e) => (e.stopPropagation(), onDelete())}
          className="ml-auto rounded-full p-1 opacity-60 transition hover:bg-red-50 hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <Ionicon name="trash-outline" size={16} color={colors.danger} />
        </button>
      </div>
    </div>
  );
}

type HomeMeta = { title: string; crestIcon: string; emptyIcon: string };

// Port of the {Sport}HomeScreen lists (five racket sports + football): All /
// Live / Completed / View Scoring tabs, match cards (tap to open, delete),
// New Match.
function RacketHomeView({
  sport,
  meta: metaOverride,
  matches,
  isLoading,
  onDelete,
  findByCode,
}: {
  sport: MatchSport;
  meta?: HomeMeta;
  matches: CardModel[];
  isLoading: boolean;
  onDelete: (m: CardModel) => void;
  findByCode: (code: string) => Promise<{ id: string } | null>;
}) {
  const meta: HomeMeta = metaOverride ?? RACKET_SPORTS[sport as RacketSportKey];
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.scorecard);
  const [tab, setTab] = useState<TabKey>("all");
  const filtered = matches.filter((m) => (tab === "live" ? m.live : tab === "completed" ? m.completed : true));
  const newMatch = () => navigate(paths.newMatch(sport));

  return (
    <div className="mx-auto max-w-5xl pb-8 lg:px-8">
      <div className="mb-4 flex items-center gap-2 px-3.5 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-0 lg:pt-6">
        <button type="button" onClick={goBack} aria-label="Back" className="rounded-full p-1 hover:bg-gray-100">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-ink">{meta.title}</h1>
          <p className="mt-0.5 text-sm text-muted">Track and manage matches</p>
        </div>
        <button type="button" onClick={newMatch} className="press flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-cta">
          <Ionicon name="add" size={18} color="white" />
          New Match
        </button>
      </div>

      <div className="mb-4 px-3.5 lg:px-0">
        <div role="tablist" className="flex items-center rounded-2xl bg-surface p-1.5 shadow-card lg:max-w-xl">
          {TABS.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-[5px] truncate rounded-xl py-2 text-xs ${selected ? "bg-primary-light font-bold text-primary-dark" : "font-medium text-muted hover:text-ink"}`}
              >
                {t.key === "live" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
                <span className="truncate">{t.label}</span>
                {t.key === "all" && matches.length > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-[3px] text-[10px] font-bold text-white">{matches.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "view" ? (
        <ViewScoringPanel
          onLookup={async (code) => {
            const result = await findByCode(code);
            if (result) navigate(paths.match(sport, result.id));
            return result?.id ?? null;
          }}
        />
      ) : isLoading ? (
        <div className="mt-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="px-5 lg:px-0">
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <MatchCard key={`${m.id}:${m.live}`} m={m} crestIcon={meta.crestIcon} onPress={() => navigate(paths.match(sport, m.id))} onDelete={() => onDelete(m)} />
            ))}
          </div>
          <div className={`flex flex-col items-center gap-1 text-center ${filtered.length > 0 ? "mt-6" : "mt-16"}`}>
            <span className="relative flex h-[200px] w-[200px] items-center justify-center rounded-full bg-primary-light/50">
              <span className="absolute left-[46px] top-[34px] opacity-70">
                <Ionicon name="sparkles" size={16} color={colors.primaryDark} />
              </span>
              <span className="absolute bottom-[46px] right-10 opacity-60">
                <Ionicon name="sparkles" size={12} color={colors.primaryDark} />
              </span>
              <MCIcon name={meta.emptyIcon} size={110} color={colors.primaryDark} style={{ opacity: 0.85, transform: "rotate(-12deg)" }} />
            </span>
            <p className="mt-2 text-lg font-bold text-ink">No more matches yet</p>
            <p className="whitespace-pre-line px-10 text-sm text-muted">{"Create a new match to start keeping score\nand track your games here."}</p>
            <button type="button" onClick={newMatch} className="press mt-3 flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-cta">
              <Ionicon name="add" size={18} color="white" />
              New Match
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function confirmDelete(m: CardModel, run: () => void) {
  Alert.alert("Delete Match", `Delete the scorecard for ${m.aName} vs ${m.bName}? This can't be undone.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: run },
  ]);
}

const common = (m: { id: string; status: string; result_summary: string | null; created_at: string; venue: string | null; play_mode: string }) => ({
  id: m.id,
  live: m.status === "IN_PROGRESS",
  completed: m.status === "COMPLETED",
  resultSummary: m.result_summary,
  createdAt: m.created_at,
  venue: m.venue,
  tag: m.play_mode === "DOUBLES" ? "Doubles" : "Singles",
  tagChevron: true,
});

function PadelHome() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data, isLoading } = useMyPadelMatches(userId);
  const del = useDeletePadelMatch();
  const matches = (data ?? []).map((m): CardModel => {
    const s = computePadelState(m);
    return { ...common(m), aName: m.team_a_name, bName: m.team_b_name, tally: `${s.setsWonA} - ${s.setsWonB}`, breakdown: s.sets.map((x) => `${padelSetScore(x, "A")}-${padelSetScore(x, "B")}`).join("  ") };
  });
  return (
    <RacketHomeView
      sport="padel"
      matches={matches}
      isLoading={isLoading}
      findByCode={findPadelMatchByCode}
      onDelete={(m) => confirmDelete(m, () => del.mutate(m.id, { onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not delete match.")) }))}
    />
  );
}

function TennisHome() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data, isLoading } = useMyTennisMatches(userId);
  const del = useDeleteTennisMatch();
  const matches = (data ?? []).map((m): CardModel => {
    const s = computeTennisState(m);
    return { ...common(m), aName: m.player_a_name, bName: m.player_b_name, tally: `${s.setsWonA} - ${s.setsWonB}`, breakdown: s.sets.map((x) => `${tennisSetScore(x, "A")}-${tennisSetScore(x, "B")}`).join("  ") };
  });
  return (
    <RacketHomeView
      sport="tennis"
      matches={matches}
      isLoading={isLoading}
      findByCode={findTennisMatchByCode}
      onDelete={(m) => confirmDelete(m, () => del.mutate(m.id, { onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not delete match.")) }))}
    />
  );
}

const gamesTally = (s: { gamesWonA: number; gamesWonB: number; games: { scoreA: number; scoreB: number }[] }) => ({
  tally: `${s.gamesWonA} - ${s.gamesWonB}`,
  breakdown: s.games.map((g) => `${g.scoreA}-${g.scoreB}`).join("  "),
});

function PickleballHome() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data, isLoading } = useMyPickleballMatches(userId);
  const del = useDeletePickleballMatch();
  const matches = (data ?? []).map((m): CardModel => ({ ...common(m), aName: m.team_a_name, bName: m.team_b_name, ...gamesTally(computePickleballState(m)) }));
  return (
    <RacketHomeView
      sport="pickleball"
      matches={matches}
      isLoading={isLoading}
      findByCode={findPickleballMatchByCode}
      onDelete={(m) => confirmDelete(m, () => del.mutate(m.id, { onError: (err) => Alert.alert("Error", friendlyPickleballError(err, "Could not delete match.")) }))}
    />
  );
}

function BadmintonHome() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data, isLoading } = useMyBadmintonMatches(userId);
  const del = useDeleteBadmintonMatch();
  const matches = (data ?? []).map((m): CardModel => ({ ...common(m), aName: m.team_a_name, bName: m.team_b_name, ...gamesTally(computeBadmintonState(m)) }));
  return (
    <RacketHomeView
      sport="badminton"
      matches={matches}
      isLoading={isLoading}
      findByCode={findBadmintonMatchByCode}
      onDelete={(m) => confirmDelete(m, () => del.mutate(m.id, { onError: (err) => Alert.alert("Error", friendlyBadmintonError(err, "Could not delete match.")) }))}
    />
  );
}

function TableTennisHome() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data, isLoading } = useMyTableTennisMatches(userId);
  const del = useDeleteTableTennisMatch();
  const matches = (data ?? []).map((m): CardModel => ({ ...common(m), aName: m.team_a_name, bName: m.team_b_name, ...gamesTally(computeTableTennisState(m)) }));
  return (
    <RacketHomeView
      sport="table_tennis"
      matches={matches}
      isLoading={isLoading}
      findByCode={findTableTennisMatchByCode}
      onDelete={(m) => confirmDelete(m, () => del.mutate(m.id, { onError: (err) => Alert.alert("Error", friendlyTableTennisError(err, "Could not delete match.")) }))}
    />
  );
}

const FOOTBALL_PHASE_SHORT: Partial<Record<Phase, string>> = {
  FIRST_HALF: "1st Half",
  HALF_TIME: "Half-Time",
  SECOND_HALF: "2nd Half",
  FULL_TIME: "Full-Time",
  EXTRA_TIME_FIRST: "Extra Time",
  EXTRA_TIME_BREAK: "Extra Time",
  EXTRA_TIME_SECOND: "Extra Time",
  EXTRA_TIME_FULL_TIME: "Extra Time",
  PENALTIES: "Penalties",
};

// Port of FootballHomeScreen (same list, phase label instead of play mode).
export function FootballHomePage() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data, isLoading } = useMyFootballMatches(userId);
  const del = useDeleteFootballMatch();
  const matches = (data ?? []).map((m): CardModel => {
    const goals = [...m.football_goals].sort((a, b) => a.seq - b.seq).map(goalRowToEvent);
    const score = computeScoreSummary(goals, m.phase as Phase, !!m.extra_time_first_kickoff_at).current;
    const live = m.status === "IN_PROGRESS";
    return {
      id: m.id,
      live,
      completed: m.status === "COMPLETED",
      aName: m.team_a_name,
      bName: m.team_b_name,
      tally: `${score.a} - ${score.b}`,
      tag: live ? (FOOTBALL_PHASE_SHORT[m.phase as Phase] ?? "") : null,
      tagChevron: false,
      resultSummary: m.result_summary,
      createdAt: m.created_at,
      venue: m.venue,
    };
  });
  return (
    <RacketHomeView
      sport="football"
      meta={{ title: "Football", crestIcon: "soccer", emptyIcon: "soccer" }}
      matches={matches}
      isLoading={isLoading}
      findByCode={findFootballMatchByCode}
      onDelete={(m) => confirmDelete(m, () => del.mutate(m.id, { onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not delete match.")) }))}
    />
  );
}

// Port of CricketScorecardHomeScreen: score of the latest innings, overs
// bowled and the format tag.
export function CricketHomePage() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data, isLoading } = useMyCricketMatches(userId);
  const del = useDeleteCricketMatch();
  const matches = (data ?? []).map((m): CardModel => {
    let score: { runs: number; wickets: number; oversLabel: string } | null = null;
    if (m.cricket_innings.length > 0) {
      const inn = [...m.cricket_innings].sort((a, b) => a.innings_number - b.innings_number).at(-1)!;
      const balls = [...inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
      const team = inn.batting_team as "A" | "B";
      const total = (team === "A" ? m.team_a_players.length : m.team_b_players.length) || 11;
      const st = replayInnings(balls, team, m.overs_limit, total, balls[0]?.strikerName ?? "", balls[0]?.nonStrikerName ?? "", 0, m.last_man_stand);
      score = { runs: st.runs, wickets: st.wickets, oversLabel: formatOvers(st.legalBalls) };
    }
    return {
      id: m.id,
      live: m.status === "IN_PROGRESS",
      completed: m.status === "COMPLETED",
      aName: m.team_a_name,
      bName: m.team_b_name,
      tally: score ? `${score.runs} - ${score.wickets}` : "0 - 0",
      breakdown: score ? `${score.oversLabel} overs` : "0.0 overs",
      formatPill: m.format === "ODI" ? "OD" : m.format,
      tag: `${m.overs_limit} overs`,
      tagChevron: true,
      resultSummary: m.result_summary,
      createdAt: m.created_at,
      venue: m.venue,
    };
  });
  return (
    <RacketHomeView
      sport="cricket"
      meta={{ title: "Cricket", crestIcon: "cricket", emptyIcon: "cricket" }}
      matches={matches}
      isLoading={isLoading}
      findByCode={findCricketMatchByCode}
      onDelete={(m) => confirmDelete(m, () => del.mutate(m.id, { onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not delete match.")) }))}
    />
  );
}

const HOMES: Record<RacketSportKey, () => React.JSX.Element> = {
  padel: PadelHome,
  tennis: TennisHome,
  pickleball: PickleballHome,
  badminton: BadmintonHome,
  table_tennis: TableTennisHome,
};

export default function RacketHomePage() {
  const { sport } = useParams();
  if (!isRacketSport(sport)) return <Navigate to={paths.scorecard} replace />;
  const Home = HOMES[sport];
  return <Home key={sport} />;
}
