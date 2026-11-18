import { useEffect, useMemo, useState, type ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { useSquads } from "@app/hooks/useSquads";
import { useMyOwnedSquads } from "@app/hooks/useSquadTeamFill";
import { useSquadCricketFigures, useSquadCricketMatches } from "@app/hooks/useSquadCricketStats";
import { useAuthStore } from "@app/store/authStore";
import { computePlayerFigures, matchTeamScores } from "@app/lib/playerCricketStats";
import {
  computeSquadFigures,
  squadChasedDefended,
  squadMvpPoints,
  squadPartnerships,
  squadPlayerFigures,
  squadRosterAggregates,
  squadRunsWicketsTrend,
  squadTeamOverviewStats,
  squadTopPerformers,
  squadWinLossRecord,
  type RosterAggregateRow,
} from "@app/lib/squadCricketStats";
import { aggregateGeneric, classifySportKind, genericRecentForm, SPORT_CONFIGS, type GenericMatchRow, type GenericSport } from "@app/lib/genericSportStats";
import type { CricketMatchDetail } from "@app/lib/api/cricket";
import type { SquadDetail, SquadListItem } from "@app/lib/api/squads";
import { usePlayerGenericFigures, usePlayerGenericMatches } from "@/hooks/usePlayerSportStats";
import { fetchTournamentsForMatches, type PlayerTournamentEntry } from "@/lib/playerTournaments";
import { Ionicon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import FieldInput from "@/components/ui/FieldInput";
import Modal from "@/components/ui/Modal";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import { EntityCard, TeamCrest } from "@/components/players/PlayerTabParts";
import { useAppNavigate } from "@/routes/navigation";
import { paths, type MatchSport } from "@/routes/paths";

export type SquadTeamTab = "detail" | "overview" | "players" | "matches" | "tournaments" | "statistics" | "compare";

// A gradient pill when selected, a muted pill otherwise (the app's tab-bar look).
function Pill({ selected, onPress, children, className = "rounded-full px-4 py-2" }: { selected: boolean; onPress: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPress}
      className={`shrink-0 text-xs font-bold ${selected ? "bg-brand text-white" : "bg-border text-ink-secondary hover:brightness-95"} ${className}`}
    >
      {children}
    </button>
  );
}

// Port of SquadTeamTabBar.
export function SquadTeamTabBar({ value, onChange, showStatistics }: { value: SquadTeamTab; onChange: (v: SquadTeamTab) => void; showStatistics: boolean }) {
  const tabs: [SquadTeamTab, string][] = [
    ["detail", "Squad Detail"],
    ["overview", "Team Overview"],
    ["players", "Players"],
    ["matches", "Matches"],
    ["tournaments", "Tournaments"],
    ...(showStatistics ? ([["statistics", "Statistics"]] as [SquadTeamTab, string][]) : []),
    ["compare", "Compare"],
  ];
  return (
    <div role="group" aria-label="Squad sections" className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3.5 lg:px-0">
      {tabs.map(([key, label]) => (
        <Pill key={key} selected={value === key} onPress={() => onChange(key)}>
          {label}
        </Pill>
      ))}
    </div>
  );
}

function SegmentBar<T extends string>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className="flex overflow-hidden rounded-xl bg-surface-overlay">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className={`flex-1 py-2.5 text-xs font-bold ${value === o ? "bg-brand text-white" : "text-muted"}`}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 mt-6">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
    </div>
  );
}

const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`rounded-2xl bg-surface-overlay p-4 ${className}`}>{children}</div>;
const Loading = () => (
  <div className="mt-4">
    <SkeletonCardRows count={3} />
  </div>
);

function BarChart({ data, color }: { data: { matchId: string; value: number }[]; color: string }) {
  if (data.length === 0) return <p className="py-6 text-center text-sm text-muted">No recent matches</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-[150px] items-end justify-around">
      {data.map((d, i) => (
        <div key={`${d.matchId}-${i}`} className="flex flex-col items-center gap-1.5">
          <div className="w-[30px] rounded-md" style={{ height: Math.max(4, (d.value / max) * 110), backgroundColor: color }} />
          <span className="rounded bg-border px-1.5 py-1 text-xs font-bold text-ink">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function CricketOverview({ squad }: { squad: SquadDetail }) {
  const navigate = useAppNavigate();
  const [filter, setFilter] = useState<"all" | "batFirst" | "bowlFirst">("all");
  const { data: figures, matches, isLoading } = useSquadCricketFigures(squad.name, squad.sport_id);
  if (isLoading) return <Loading />;
  const all = figures ?? [];
  const record = squadWinLossRecord(all, filter, 20);
  const lostPercent = 100 - record.winPercent;
  const recent5 = all.slice(0, 5);
  const memberNames = squad.squad_members.map((m) => m.profiles?.full_name).filter((n): n is string => !!n);
  const topPerformers = squadTopPerformers(squadPlayerFigures((matches ?? []).filter((m) => recent5.some((f) => f.matchId === m.id)), memberNames), 3);
  const trend = squadRunsWicketsTrend(all, 5);
  const scheduled = (matches ?? []).find((m) => m.status === "SCHEDULED");

  return (
    <div>
      <SectionTitle title="Win Loss Ratio" subtitle="Recent 20 matches" />
      <Panel>
        <div className="mb-4">
          <SegmentBar value={filter} options={["all", "batFirst", "bowlFirst"]} labels={{ all: "Both", batFirst: "Bat First", bowlFirst: "Bowl First" }} onChange={setFilter} />
        </div>
        <div className="mb-2 flex justify-between text-sm font-bold">
          <span className="text-primary-dark">Won - {record.winPercent.toFixed(1)}%</span>
          <span className="text-muted">Lost - {lostPercent.toFixed(1)}%</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full">
          <div className="bg-primary-dark" style={{ width: `${record.winPercent}%` }} />
          <div className="bg-[#D1D5DB]" style={{ width: `${lostPercent}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
        <div className="mt-4 flex justify-around text-sm font-bold text-ink">
          <span>Matches - {record.matches}</span>
          <span>Won - {record.won}</span>
          <span>Lost - {record.lost}</span>
        </div>
      </Panel>

      {topPerformers.length > 0 && (
        <>
          <SectionTitle title="Top Performers" subtitle="Recent 5 matches" />
          <div className="flex flex-wrap justify-around gap-3 rounded-2xl bg-brand p-4 shadow-card">
            {topPerformers.map((p) => (
              <div key={p.name} className="flex w-[92px] flex-col items-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface font-bold text-primary-dark shadow-card">{(p.name || "?").charAt(0).toUpperCase()}</span>
                <span className="mt-1 flex items-center gap-1">
                  <span className="rounded-full bg-[#FBBF24] px-2 py-0.5 text-[11px] font-bold text-white">{p.runs > 0 ? p.battingAverage.toFixed(1) : p.bowlingAverage.toFixed(1)}</span>
                  {p.wickets > 0 && <span className="min-w-[22px] rounded-full bg-white/30 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{p.wickets}w</span>}
                </span>
                <span className="mt-1 w-full truncate text-center text-xs font-semibold text-white">{p.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {scheduled && (
        <>
          <SectionTitle title="Scheduled Matches" />
          <button type="button" onClick={() => navigate(paths.match("cricket", scheduled.id))} className="flex w-full items-center gap-3 rounded-2xl bg-surface-overlay p-4 text-left">
            <Ionicon name="calendar-outline" size={22} color={colors.primaryDark} />
            <span className="flex-1">
              <span className="block text-sm font-bold text-ink">{scheduled.team_a_name}</span>
              <span className="block text-sm font-bold text-ink">{scheduled.team_b_name}</span>
              {scheduled.venue && <span className="mt-1 block text-xs text-muted">{scheduled.venue}</span>}
            </span>
          </button>
        </>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div>
          <SectionTitle title="Runs Scored In Recent Matches" />
          <Panel>
            <BarChart data={trend.runsScored} color="#2563EB" />
            <div className="mt-2 flex justify-between text-xs font-bold text-muted">
              <span>NEW</span>
              <span>OLD</span>
            </div>
          </Panel>
        </div>
        <div>
          <SectionTitle title="Wickets Taken In Recent Matches" />
          <Panel>
            <BarChart data={trend.wicketsTaken} color="#DC2626" />
            <div className="mt-2 flex justify-between text-xs font-bold text-muted">
              <span>NEW</span>
              <span>OLD</span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function GenericOverview({ squad, sport }: { squad: SquadDetail; sport: GenericSport }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, squad.name);
  const { data: matches } = usePlayerGenericMatches(sport, squad.name);
  if (isLoading) return <Loading />;
  const totals = aggregateGeneric(figures ?? []);
  const form = genericRecentForm(figures ?? [], 5);
  const scheduled = (matches ?? []).find((m) => m.status === "SCHEDULED");
  const formStyle = { W: ["rgb(var(--jz-green-100))", "#16A34A"], L: [colors.dangerLight, "#DC2626"], D: [colors.warningLight, "#CA8A04"] } as const;
  return (
    <div>
      <SectionTitle title="Record" subtitle="All matches" />
      <Panel>
        <div className="flex justify-around text-sm font-bold">
          <span className="text-ink">Matches - {totals.matches}</span>
          <span className="text-primary-dark">Won - {totals.wins}</span>
          <span className="text-muted">Lost - {totals.losses}</span>
        </div>
        <p className="mt-2 text-center text-xs text-muted">Win % {totals.winPercent.toFixed(1)}%</p>
      </Panel>
      <SectionTitle title="Recent Form" />
      <div className="flex gap-2">
        {form.length === 0 ? (
          <p className="text-sm text-muted">No matches yet</p>
        ) : (
          form.map((f) => (
            <span key={f.matchId} className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: formStyle[f.letter][0], color: formStyle[f.letter][1] }}>
              {f.letter}
            </span>
          ))
        )}
      </div>
      {scheduled && (
        <>
          <SectionTitle title="Scheduled Matches" />
          <Panel>
            <p className="text-sm font-bold text-ink">{scheduled.sideAName}</p>
            <p className="text-sm font-bold text-ink">{scheduled.sideBName}</p>
            {scheduled.venue && <p className="mt-1 text-xs text-muted">{scheduled.venue}</p>}
          </Panel>
        </>
      )}
    </div>
  );
}

function NoData({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center py-10">
      <Ionicon name={icon} size={32} color={colors.muted} />
      <p className="mt-2 text-center text-sm text-muted">{text}</p>
    </div>
  );
}

// Port of SquadTeamOverview.
export function SquadTeamOverview({ squad }: { squad: SquadDetail }) {
  const kind = classifySportKind(squad.sports?.name);
  if (kind === "cricket") return <CricketOverview squad={squad} />;
  if (kind) return <GenericOverview squad={squad} sport={kind} />;
  return <NoData icon="stats-chart-outline" text="No scorecard data for this sport yet." />;
}

// Port of SquadTeamPlayers: the active roster, A-Z (and, for cricket, by
// matches played for this team).
export function SquadTeamPlayers({ squad, isCricket }: { squad: SquadDetail; isCricket: boolean }) {
  const navigate = useAppNavigate();
  const [sort, setSort] = useState<"az" | "matches">("az");
  const { data: matches, isLoading } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const rows = useMemo(
    () =>
      squad.squad_members
        .filter((m) => m.status === "ACTIVE")
        .map((m) => {
          const name = m.profiles?.full_name ?? "Member";
          return { id: m.id, userId: m.user_id, name, avatar: m.profiles?.avatar ?? null, played: isCricket && matches ? computePlayerFigures(matches, name).length : 0 };
        }),
    [squad.squad_members, matches, isCricket]
  );
  const sorted = useMemo(() => [...rows].sort((a, b) => (sort === "matches" ? b.played - a.played : a.name.localeCompare(b.name))), [rows, sort]);
  if (isCricket && isLoading) return <Loading />;
  return (
    <div>
      <div className="mb-4 inline-flex overflow-hidden rounded-full bg-border">
        {(["az", ...(isCricket ? (["matches"] as const) : [])] as ("az" | "matches")[]).map((key) => (
          <Pill key={key} selected={sort === key} onPress={() => setSort(key)} className="px-4 py-2">
            {key === "az" ? "A-Z" : "Most Matches"}
          </Pill>
        ))}
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-x-3">
        {sorted.map((r) => (
          <button key={r.id} type="button" onClick={() => navigate(paths.player(r.userId))} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-card hover:shadow-hero">
            <Avatar url={r.avatar} name={r.name} size={44} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.name}</span>
            {isCricket && <span className="text-xs text-muted">{r.played} mat</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const GENERIC_MATCH_SPORT: Record<GenericSport, MatchSport> = { football: "football", padel: "padel", badminton: "badminton", pickleball: "pickleball", table_tennis: "table_tennis", tennis: "tennis" };
const statusLabel = (status: string) => (status === "IN_PROGRESS" ? "LIVE" : status === "SCHEDULED" ? "Scheduled" : "Completed");
const shortDate = (v: string) => new Date(v).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

function CricketMatchRow({ match }: { match: CricketMatchDetail }) {
  const navigate = useAppNavigate();
  const isLive = match.status === "IN_PROGRESS";
  const scores = matchTeamScores(match);
  return (
    <button type="button" onClick={() => navigate(paths.match("cricket", match.id))} className="press mb-3 block w-full rounded-2xl bg-surface-overlay p-4 text-left">
      <span className="mb-3 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">
          Open Match, {match.format}, {shortDate(match.created_at)}
          {match.venue ? ` - ${match.venue}` : ""}
        </span>
        <span className="shrink-0 text-xs font-bold" style={{ color: isLive ? "#DC2626" : colors.muted }}>
          {statusLabel(match.status)}
        </span>
      </span>
      {(["A", "B"] as const).map((side) => (
        <span key={side} className={`flex items-center justify-between ${side === "B" ? "mt-2" : ""}`}>
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <TeamCrest color={side === "A" ? colors.primary : "#1D4ED8"} size={32} icon="cricket" />
            <span className="truncate text-sm font-bold text-ink">{side === "A" ? match.team_a_name : match.team_b_name}</span>
          </span>
          <span className="text-sm font-bold text-ink">{scores[side] ? `${scores[side]!.runs}-${scores[side]!.wickets} (${scores[side]!.oversLabel})` : ""}</span>
        </span>
      ))}
      {!isLive && match.result_summary && <span className="mt-3 block truncate text-xs font-semibold text-primary">{match.result_summary}</span>}
    </button>
  );
}

function GenericMatchCard({ sport, match }: { sport: GenericSport; match: GenericMatchRow }) {
  const navigate = useAppNavigate();
  const isLive = match.status === "IN_PROGRESS";
  return (
    <button type="button" onClick={() => navigate(paths.match(GENERIC_MATCH_SPORT[sport], match.id))} className="press mb-3 block w-full rounded-2xl bg-surface-overlay p-4 text-left">
      <span className="mb-3 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">
          {shortDate(match.createdAt)}
          {match.venue ? ` - ${match.venue}` : ""}
        </span>
        <span className="shrink-0 text-xs font-bold" style={{ color: isLive ? "#DC2626" : colors.muted }}>
          {statusLabel(match.status)}
        </span>
      </span>
      <span className="block truncate text-sm font-bold text-ink">{match.sideAName}</span>
      <span className="mt-1 block truncate text-sm font-bold text-ink">{match.sideBName}</span>
      {!isLive && match.resultSummary && <span className="mt-3 block truncate text-xs font-semibold text-primary">{match.resultSummary}</span>}
    </button>
  );
}

// Port of SquadTeamMatches.
export function SquadTeamMatches({ squad }: { squad: SquadDetail }) {
  const kind = classifySportKind(squad.sports?.name);
  const isCricket = kind === "cricket";
  const generic = kind && kind !== "cricket" ? kind : null;
  const { data: cricketMatches, isLoading: cl } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const { data: genericMatches, isLoading: gl } = usePlayerGenericMatches(generic, generic ? squad.name : null);
  const empty = <NoData icon="baseball-outline" text="No matches yet" />;
  if (isCricket) {
    if (cl) return <Loading />;
    return !cricketMatches?.length ? empty : <div className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-3">{cricketMatches.map((m) => <CricketMatchRow key={m.id} match={m} />)}</div>;
  }
  if (generic) {
    if (gl) return <Loading />;
    return !genericMatches?.length ? empty : <div className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-3">{genericMatches.map((m) => <GenericMatchCard key={m.id} sport={generic} match={m} />)}</div>;
  }
  return empty;
}

// Port of SquadTeamTournaments: tournaments this team's matches belong to.
export function SquadTeamTournaments({ squad }: { squad: SquadDetail }) {
  const navigate = useAppNavigate();
  const kind = classifySportKind(squad.sports?.name);
  const isCricket = kind === "cricket";
  const generic = kind && kind !== "cricket" ? kind : null;
  const { data: cricketMatches, isLoading: cl } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const { data: genericMatches, isLoading: gl } = usePlayerGenericMatches(generic, generic ? squad.name : null);
  const [tournaments, setTournaments] = useState<PlayerTournamentEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (isCricket && cricketMatches) fetchTournamentsForMatches("cricket_match_id", cricketMatches.map((m) => m.id)).then((r) => !cancelled && setTournaments(r), () => !cancelled && setTournaments([]));
    else if (generic && genericMatches)
      fetchTournamentsForMatches(SPORT_CONFIGS[generic].tournamentMatchIdCol, genericMatches.map((m) => m.id)).then((r) => !cancelled && setTournaments(r), () => !cancelled && setTournaments([]));
    else if (!isCricket && !generic) setTournaments([]);
    return () => {
      cancelled = true;
    };
  }, [isCricket, cricketMatches, generic, genericMatches]);
  if ((isCricket ? cl : gl) || tournaments === null) return <Loading />;
  if (tournaments.length === 0) return <NoData icon="trophy-outline" text="No tournaments yet" />;
  return (
    <div className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-3">
      {tournaments.map((t) => (
        <EntityCard
          key={t.gameId}
          photoUrl={t.iconUrl}
          title={t.title}
          subtitle={t.gameDate ? shortDate(t.gameDate) : null}
          subtitleIcon="calendar-outline"
          pillLabel="Tournament"
          sportName={squad.sports?.name ?? "cricket"}
          onPress={() => navigate(paths.game(t.gameId))}
        />
      ))}
    </div>
  );
}

type StatTab = "TEAM" | "BAT" | "BOWL" | "FIELD" | "MVP";

function PillRow<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {options.map((o) => (
        <Pill key={o} selected={value === o} onPress={() => onChange(o)}>
          {o}
        </Pill>
      ))}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl bg-surface-overlay py-3">
      <span className="text-base font-bold text-ink">{value}</span>
      <span className="mt-0.5 text-center text-xs text-muted">{label}</span>
    </div>
  );
}

function RankedTable({ rows, columns, nameLabel = "Player" }: { rows: { rank: number; name: string; values: string[] }[]; columns: string[]; nameLabel?: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">No data to show.</p>;
  return (
    <div className="mt-3">
      <div className="flex border-b border-border py-2 text-xs font-bold text-muted">
        <span className="w-6" />
        <span className="flex-1">{nameLabel}</span>
        {columns.map((c) => (
          <span key={c} className="w-[60px] text-center">
            {c}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={`${r.rank}-${r.name}`} className="flex items-center border-b border-border py-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border text-xs font-bold text-ink">{r.rank}</span>
          <span className="ml-2 min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.name}</span>
          {r.values.map((v, i) => (
            <span key={i} className="w-[60px] text-center text-sm text-ink">
              {v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

type TeamSub = "Overview" | "Chased" | "Defended" | "Partnerships";

function TeamSection({ matches, teamName }: { matches: CricketMatchDetail[]; teamName: string }) {
  const [sub, setSub] = useState<TeamSub>("Overview");
  const figures = useMemo(() => computeSquadFigures(matches, teamName), [matches, teamName]);
  const o = useMemo(() => squadTeamOverviewStats(figures), [figures]);
  const cd = useMemo(() => squadChasedDefended(figures), [figures]);
  const partnerships = useMemo(() => squadPartnerships(matches, teamName), [matches, teamName]);
  const heading = (t: string) => <p className="mt-4 text-center text-base font-bold text-ink">{t}</p>;
  return (
    <div className="mt-4">
      <PillRow value={sub} options={["Overview", "Chased", "Defended", "Partnerships"] as TeamSub[]} onChange={setSub} />
      {sub === "Overview" && (
        <div className="mt-4 flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <StatBox label="Matches" value={o.matches} />
            <StatBox label="Won" value={o.won} />
            <StatBox label="Win %" value={`${o.winPercent.toFixed(1)}%`} />
          </div>
          <div className="flex gap-2.5">
            <StatBox label="Lost" value={o.lost} />
            <StatBox label="Tie" value={o.tied} />
            <StatBox label="NR" value={o.noResult} />
          </div>
          {heading("Team Score")}
          <div className="overflow-hidden rounded-xl border border-border text-sm">
            <div className="flex text-xs font-bold text-muted">
              <span className="flex-1" />
              <span className="flex-1 py-2 text-center">High</span>
              <span className="flex-1 py-2 text-center">Low</span>
            </div>
            {[
              ["Scored", o.highScore, o.lowScore],
              ["Conceded", o.highConceded, o.lowConceded],
            ].map(([label, hi, lo]) => (
              <div key={label} className="flex border-t border-border">
                <span className="flex-1 px-3 py-2 text-ink">{label}</span>
                <span className="flex-1 py-2 text-center font-bold text-ink">{hi}</span>
                <span className="flex-1 py-2 text-center font-bold text-ink">{lo}</span>
              </div>
            ))}
          </div>
          {heading("Toss")}
          <div className="flex gap-2.5">
            <StatBox label="Toss Won" value={o.tossWonCount} />
            <StatBox label="Bat First" value={o.battedFirstCount} />
            <StatBox label="Bowl First" value={o.bowledFirstCount} />
          </div>
          {heading("Result Insights")}
          <div className="flex gap-2.5">
            <StatBox label="Bat First Win %" value={`${o.batFirstWinPercent.toFixed(1)}%`} />
            <StatBox label="Bowl First Win %" value={`${o.bowlFirstWinPercent.toFixed(1)}%`} />
          </div>
        </div>
      )}
      {sub === "Chased" && <RankedTable nameLabel="Opponent Team" columns={["Format", "Target"]} rows={cd.chased.map((r, i) => ({ rank: i + 1, name: r.opponentTeamName.toUpperCase(), values: [r.format, String(r.value)] }))} />}
      {sub === "Defended" && <RankedTable nameLabel="Opponent Team" columns={["Format", "Score"]} rows={cd.defended.map((r, i) => ({ rank: i + 1, name: r.opponentTeamName.toUpperCase(), values: [r.format, String(r.value)] }))} />}
      {sub === "Partnerships" && (
        <div className="mt-3">
          {partnerships.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No data to show.</p>
          ) : (
            partnerships.map((row, i) => {
              const total = row.totalRuns || 1;
              return (
                <div key={`${row.matchId}-${i}`} className="mb-3 flex items-center justify-between rounded-2xl bg-surface-overlay p-4">
                  <div className="min-w-0 flex-1 pr-3 text-sm text-ink">
                    <p>
                      <b>{row.runsA}</b> ({row.ballsA}) <span className="font-semibold">{row.batterA}</span>
                    </p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#516171]" style={{ width: `${Math.min(100, (row.runsA / total) * 100)}%` }} />
                    <div className="mt-1 h-1.5 rounded-full bg-[#F9A8D4]" style={{ width: `${Math.min(100, (row.runsB / total) * 100)}%` }} />
                    <p className="mt-1.5">
                      <b>{row.runsB}</b> ({row.ballsB}) <span className="font-semibold">{row.batterB}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-primary-dark">{row.totalRuns}</p>
                    <p className="text-xs text-muted">{row.totalBalls} Balls</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

type Metric<T extends string> = Record<T, { primary: (r: RosterAggregateRow) => number; cols: string[]; values: (r: RosterAggregateRow) => string[] }>;
const BAT: Metric<"Most Runs" | "Most 30s" | "Most 50s" | "Most 100s" | "Highest Score" | "Batting Average" | "Strike Rate" | "Most Sixes" | "Most Fours" | "Balls Faced" | "Duck Outs"> = {
  "Most Runs": { primary: (r) => r.batting.runs, cols: ["Run", "Inn", "Avg"], values: (r) => [String(r.batting.runs), String(r.batting.innings), r.batting.average.toFixed(1)] },
  "Most 30s": { primary: (r) => r.batting.thirties, cols: ["30s", "Inn", "Run"], values: (r) => [String(r.batting.thirties), String(r.batting.innings), String(r.batting.runs)] },
  "Most 50s": { primary: (r) => r.batting.fifties, cols: ["50s", "Inn", "Run"], values: (r) => [String(r.batting.fifties), String(r.batting.innings), String(r.batting.runs)] },
  "Most 100s": { primary: (r) => r.batting.hundreds, cols: ["100", "Inn", "Run"], values: (r) => [String(r.batting.hundreds), String(r.batting.innings), String(r.batting.runs)] },
  "Highest Score": {
    primary: (r) => r.batting.highScore,
    cols: ["Run", "Bal", "SR"],
    values: (r) => [`${r.batting.highScore}${r.batting.highScoreNotOut ? "*" : ""}`, String(r.batting.balls), r.batting.strikeRate.toFixed(1)],
  },
  "Batting Average": { primary: (r) => r.batting.average, cols: ["Avg", "Inn", "Run"], values: (r) => [r.batting.average.toFixed(1), String(r.batting.innings), String(r.batting.runs)] },
  "Strike Rate": { primary: (r) => r.batting.strikeRate, cols: ["SR", "Inn", "Run"], values: (r) => [r.batting.strikeRate.toFixed(1), String(r.batting.innings), String(r.batting.runs)] },
  "Most Sixes": { primary: (r) => r.batting.sixes, cols: ["6s", "Inn", "Run"], values: (r) => [String(r.batting.sixes), String(r.batting.innings), String(r.batting.runs)] },
  "Most Fours": { primary: (r) => r.batting.fours, cols: ["4s", "Inn", "Run"], values: (r) => [String(r.batting.fours), String(r.batting.innings), String(r.batting.runs)] },
  "Balls Faced": { primary: (r) => r.batting.balls, cols: ["Bal", "Inn", "Run"], values: (r) => [String(r.batting.balls), String(r.batting.innings), String(r.batting.runs)] },
  "Duck Outs": { primary: (r) => r.batting.ducks, cols: ["Duk", "Inn", "Avg"], values: (r) => [String(r.batting.ducks), String(r.batting.innings), r.batting.average.toFixed(1)] },
};
const BOWL: Metric<"Most Wickets" | "3 Wkt Hauls" | "5 Wkt Hauls" | "Best Bowling"> = {
  "Most Wickets": { primary: (r) => r.bowling.wickets, cols: ["Wkt", "Inn", "Avg"], values: (r) => [String(r.bowling.wickets), String(r.bowling.innings), r.bowling.wickets > 0 ? r.bowling.average.toFixed(1) : "0.0"] },
  "3 Wkt Hauls": { primary: (r) => r.bowling.threeWickets, cols: ["3w", "Inn", "Wkt"], values: (r) => [String(r.bowling.threeWickets), String(r.bowling.innings), String(r.bowling.wickets)] },
  "5 Wkt Hauls": { primary: (r) => r.bowling.fiveWickets, cols: ["5w", "Inn", "Wkt"], values: (r) => [String(r.bowling.fiveWickets), String(r.bowling.innings), String(r.bowling.wickets)] },
  "Best Bowling": { primary: (r) => r.bowling.wickets, cols: ["Best", "Inn", "Wkt"], values: (r) => [`${r.bowling.bestWickets}-${r.bowling.bestRuns}`, String(r.bowling.innings), String(r.bowling.wickets)] },
};
const FIELD: Metric<"Catches" | "Stumpings" | "Runouts"> = {
  Catches: { primary: (r) => r.fielding.catches, cols: ["Cat", "Stu", "Rou"], values: (r) => [String(r.fielding.catches), String(r.fielding.stumpings), String(r.fielding.runouts)] },
  Stumpings: { primary: (r) => r.fielding.stumpings, cols: ["Stu", "Cat", "Rou"], values: (r) => [String(r.fielding.stumpings), String(r.fielding.catches), String(r.fielding.runouts)] },
  Runouts: { primary: (r) => r.fielding.runouts, cols: ["Rou", "Stu", "Cat"], values: (r) => [String(r.fielding.runouts), String(r.fielding.stumpings), String(r.fielding.catches)] },
};

function ranked<T extends string>(roster: RosterAggregateRow[], cfg: Metric<T>, metric: T, filter: (r: RosterAggregateRow) => boolean = () => true) {
  const { primary, cols, values } = cfg[metric];
  const rows = roster
    .filter(filter)
    .filter((r) => primary(r) > 0)
    .sort((a, b) => primary(b) - primary(a))
    .map((r, i) => ({ rank: i + 1, name: r.name, values: values(r) }));
  return { cols, rows };
}

function MvpSection({ roster }: { roster: RosterAggregateRow[] }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const rows = useMemo(() => squadMvpPoints(roster), [roster]);
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setRulesOpen(true)} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-ink">
        MVP Rules
        <Ionicon name="information-circle-outline" size={16} color={colors.muted} />
      </button>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No data to show.</p>
      ) : (
        <div className="mt-3">
          {rows.map((r, i) => (
            <div key={r.name} className="flex items-center border-b border-border py-3">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-border text-xs font-bold text-ink">{i + 1}</span>
              <div className="ml-2 min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Bat {r.batPoints.toFixed(1)}
                  {r.bowlPoints > 0 ? `  Bowl ${r.bowlPoints.toFixed(1)}` : ""}
                  {r.fieldPoints > 0 ? `  Field ${r.fieldPoints.toFixed(1)}` : ""}
                </p>
              </div>
              <span className="text-base font-extrabold text-primary-dark">{r.totalPoints.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="MVP Rules">
        <p className="whitespace-pre-line pb-4 text-sm leading-relaxed text-muted">
          {
            "Batting: 1 point per run, +1 per four, +2 per six, +4 for a 30, +8 for a 50, +16 for a 100.\n\nBowling: 20 points per wicket, +8 per maiden over, +8 for a 3-wicket haul, +16 for a 5-wicket haul.\n\nFielding: 8 points per catch, 12 per stumping, 6 per run-out."
          }
        </p>
      </Modal>
    </div>
  );
}

// Port of SquadTeamStatistics (cricket teams only).
export function SquadTeamStatistics({ squad }: { squad: SquadDetail }) {
  const [tab, setTab] = useState<StatTab>("TEAM");
  const [batMetric, setBatMetric] = useState<keyof typeof BAT>("Most Runs");
  const [bowlMetric, setBowlMetric] = useState<keyof typeof BOWL>("Most Wickets");
  const [fieldMetric, setFieldMetric] = useState<keyof typeof FIELD>("Catches");
  const { data: matches, isLoading } = useSquadCricketMatches(squad.name, squad.sport_id);
  const memberNames = useMemo(() => squad.squad_members.filter((m) => m.status === "ACTIVE").map((m) => m.profiles?.full_name).filter((n): n is string => !!n), [squad.squad_members]);
  const roster = useMemo(() => (matches ? squadRosterAggregates(matches, memberNames) : []), [matches, memberNames]);
  if (isLoading) return <Loading />;
  if (!matches) return null;
  const bat = ranked(roster, BAT, batMetric, (r) => r.batting.innings > 0);
  const bowl = ranked(roster, BOWL, bowlMetric, (r) => r.bowling.innings > 0);
  const field = ranked(roster, FIELD, fieldMetric);
  return (
    <div>
      <SegmentBar value={tab} options={["TEAM", "BAT", "BOWL", "FIELD", "MVP"] as StatTab[]} onChange={setTab} />
      {tab === "TEAM" && <TeamSection matches={matches} teamName={squad.name} />}
      {tab === "BAT" && (
        <div className="mt-4">
          <PillRow value={batMetric} options={Object.keys(BAT) as (keyof typeof BAT)[]} onChange={setBatMetric} />
          <RankedTable columns={bat.cols} rows={bat.rows} />
        </div>
      )}
      {tab === "BOWL" && (
        <div className="mt-4">
          <PillRow value={bowlMetric} options={Object.keys(BOWL) as (keyof typeof BOWL)[]} onChange={setBowlMetric} />
          <RankedTable columns={bowl.cols} rows={bowl.rows} />
        </div>
      )}
      {tab === "FIELD" && (
        <div className="mt-4">
          <PillRow value={fieldMetric} options={Object.keys(FIELD) as (keyof typeof FIELD)[]} onChange={setFieldMetric} />
          <RankedTable columns={field.cols} rows={field.rows} />
        </div>
      )}
      {tab === "MVP" && <MvpSection roster={roster} />}
    </div>
  );
}

function CompareRow({ label, a, b, leaderA, leaderB }: { label: string; a: string | number; b: string | number; leaderA?: string; leaderB?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center text-sm font-bold text-primary-dark">
        <span className="flex-1">{a}</span>
        <span className="text-xs text-muted">{label}</span>
        <span className="flex-1 text-right">{b}</span>
      </div>
      {(leaderA || leaderB) && (
        <div className="mt-1 flex text-xs text-muted">
          <span className="flex-1 truncate">{leaderA ?? ""}</span>
          <span className="flex-1 truncate text-right">{leaderB ?? ""}</span>
        </div>
      )}
    </div>
  );
}

function CompareHeader({ a, b }: { a: string; b: string }) {
  return (
    <div className="mb-5 flex justify-between gap-3 text-base font-extrabold text-ink">
      <span className="flex-1 truncate">{a.toUpperCase()}</span>
      <span className="flex-1 truncate text-right">{b.toUpperCase()}</span>
    </div>
  );
}

function PickTeamSheet({ open, onClose, excludeSquadId, onPick }: { open: boolean; onClose: () => void; excludeSquadId: string; onPick: (s: { id: string; name: string }) => void }) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const [search, setSearch] = useState("");
  const { data: searchResults, isLoading: searching } = useSquads(search.trim() ? { search: search.trim() } : {});
  const { data: myTeams, isLoading: myLoading } = useMyOwnedSquads(userId);
  const results: SquadListItem[] = (search.trim() ? (searchResults ?? []) : (myTeams ?? [])).filter((s) => s.group_type === "team" && s.id !== excludeSquadId);
  const loading = search.trim() ? searching : myLoading;
  return (
    <Modal open={open} onClose={onClose} title="Select a Team">
      <FieldInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a team" aria-label="Search a team" left={<Ionicon name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />} />
      {!search.trim() && <p className="mb-1 mt-3 text-xs text-muted">My Teams</p>}
      {loading ? (
        <div className="mt-3">
          <SkeletonCardRows count={2} />
        </div>
      ) : results.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">No teams found.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 pb-2">
          {results.map((s) => (
            <button key={s.id} type="button" onClick={() => (onPick({ id: s.id, name: s.name }), onClose())} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-left hover:border-primary/40">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">{s.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function CricketCompare({ squad, other }: { squad: SquadDetail; other: { id: string; name: string } }) {
  const { data: a, isLoading: la } = useSquadCricketMatches(squad.name, squad.sport_id);
  const { data: b, isLoading: lb } = useSquadCricketMatches(other.name, squad.sport_id);
  if (la || lb) return <Loading />;
  const sa = squadTeamOverviewStats(computeSquadFigures(a ?? [], squad.name));
  const sb = squadTeamOverviewStats(computeSquadFigures(b ?? [], other.name));
  const names = squad.squad_members.filter((m) => m.status === "ACTIVE").map((m) => m.profiles?.full_name).filter((n): n is string => !!n);
  const roster = squadRosterAggregates(a ?? [], names);
  const topBat = [...roster].sort((x, y) => y.batting.runs - x.batting.runs)[0];
  const topBowl = [...roster].sort((x, y) => y.bowling.wickets - x.bowling.wickets)[0];
  return (
    <div className="mt-4">
      <CompareHeader a={squad.name} b={other.name} />
      <CompareRow label="Matches" a={sa.matches} b={sb.matches} />
      <CompareRow label="Won" a={sa.won} b={sb.won} />
      <CompareRow label="Lost" a={sa.lost} b={sb.lost} />
      <CompareRow label="Win %" a={sa.winPercent.toFixed(1)} b={sb.winPercent.toFixed(1)} />
      <CompareRow label="High Score" a={sa.highScore} b={sb.highScore} />
      <CompareRow label="Low Score" a={sa.lowScore} b={sb.lowScore} />
      <p className="mb-3 mt-2 text-center text-sm font-bold text-ink">Most Runs</p>
      <CompareRow label="" a={topBat?.batting.runs ?? 0} b={0} leaderA={topBat?.name} />
      <p className="mb-3 mt-2 text-center text-sm font-bold text-ink">Most Wickets</p>
      <CompareRow label="" a={topBowl?.bowling.wickets ?? 0} b={0} leaderA={topBowl?.name} />
    </div>
  );
}

function GenericCompare({ squad, other, sport }: { squad: SquadDetail; other: { id: string; name: string }; sport: GenericSport }) {
  const { data: a, isLoading: la } = usePlayerGenericFigures(sport, squad.name);
  const { data: b, isLoading: lb } = usePlayerGenericFigures(sport, other.name);
  if (la || lb) return <Loading />;
  const sa = aggregateGeneric(a ?? []);
  const sb = aggregateGeneric(b ?? []);
  return (
    <div className="mt-4">
      <CompareHeader a={squad.name} b={other.name} />
      <CompareRow label="Matches" a={sa.matches} b={sb.matches} />
      <CompareRow label="Won" a={sa.wins} b={sb.wins} />
      <CompareRow label="Lost" a={sa.losses} b={sb.losses} />
      <CompareRow label="Win %" a={sa.winPercent.toFixed(1)} b={sb.winPercent.toFixed(1)} />
    </div>
  );
}

function HeadToHead({ squad, other }: { squad: SquadDetail; other: { id: string; name: string } }) {
  const kind = classifySportKind(squad.sports?.name);
  const isCricket = kind === "cricket";
  const generic = kind && kind !== "cricket" ? kind : null;
  const { data: matches, isLoading: cl } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const { data: genericFigures, isLoading: gl } = usePlayerGenericFigures(generic, generic ? squad.name : null);
  if (isCricket ? cl : gl) return <Loading />;
  const vs = other.name.trim().toLowerCase();
  const none = <p className="mt-10 text-center text-sm text-muted">These teams have not faced each other in any matches.</p>;
  let totals: { matches: number; won: number; lost: number } | null = null;
  if (isCricket) {
    const f = computeSquadFigures(matches ?? [], squad.name).filter((x) => x.opponentTeamName.trim().toLowerCase() === vs);
    if (f.length) {
      const s = squadTeamOverviewStats(f);
      totals = { matches: s.matches, won: s.won, lost: s.lost };
    }
  } else {
    const f = (genericFigures ?? []).filter((x) => x.opponentName.trim().toLowerCase() === vs);
    if (f.length) {
      const s = aggregateGeneric(f);
      totals = { matches: s.matches, won: s.wins, lost: s.losses };
    }
  }
  if (!totals) return none;
  return (
    <div className="mt-4 flex gap-2.5">
      <StatBox label="Matches" value={totals.matches} />
      <StatBox label={`${squad.name} Won`} value={totals.won} />
      <StatBox label={`${other.name} Won`} value={totals.lost} />
    </div>
  );
}

// Port of SquadTeamCompare: compare with (or see head-to-head against) any team.
export function SquadTeamCompare({ squad }: { squad: SquadDetail }) {
  const [mode, setMode] = useState<"COMPARE" | "HEAD_TO_HEAD">("COMPARE");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [other, setOther] = useState<{ id: string; name: string } | null>(null);
  const kind = classifySportKind(squad.sports?.name);
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setPickerOpen(true)} className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted hover:border-primary/40">
        <Ionicon name="people-outline" size={16} color={colors.muted} />
        {other ? `Comparing with ${other.name}` : "Select one of my teams"}
      </button>
      <div className="mb-4">
        <SegmentBar value={mode} options={["COMPARE", "HEAD_TO_HEAD"]} labels={{ HEAD_TO_HEAD: "HEAD TO HEAD" }} onChange={setMode} />
      </div>
      {!other ? (
        <p className="mt-6 text-center text-sm text-muted">Search a team to compare or select one of your teams.</p>
      ) : mode === "COMPARE" ? (
        kind === "cricket" ? (
          <CricketCompare squad={squad} other={other} />
        ) : kind ? (
          <GenericCompare squad={squad} other={other} sport={kind} />
        ) : (
          <NoData icon="stats-chart-outline" text="No scorecard data for this sport yet." />
        )
      ) : (
        <HeadToHead squad={squad} other={other} />
      )}
      <PickTeamSheet open={pickerOpen} onClose={() => setPickerOpen(false)} excludeSquadId={squad.id} onPick={setOther} />
    </div>
  );
}
