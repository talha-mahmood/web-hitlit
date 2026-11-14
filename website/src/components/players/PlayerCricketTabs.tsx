import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { colors } from "@app/constants/theme";
import {
  aggregateBatting,
  aggregateBowling,
  aggregateFielding,
  recentForm,
  yearlyOverview,
  bestAgainstTeam,
  statisticsByFormat,
  matchWiseRows,
  battingPositionStats,
  bowlingConcededDistribution,
  matchTeamScores,
  FORMAT_LABEL,
  type CricketFormat,
} from "@app/lib/playerCricketStats";
import { fetchMySquads } from "@app/lib/api/squads";
import type { UserSearchResult } from "@app/lib/api/users";
import { usePlayerCricketFigures, usePlayerCricketMatches } from "@/hooks/usePlayerSportStats";
import { fetchTournamentsForMatches } from "@/lib/playerTournaments";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import {
  ArcPie,
  CompareBar,
  ComparePlayerSearch,
  EmptyTab,
  EntityCard,
  FormPager,
  Loading,
  MiniTable,
  SectionCard,
  TeamCrest,
  TogglePill,
} from "./PlayerTabParts";

// Ports of the app's PlayerCricket* tab components. Panel colours match the
// app's (deliberately not the green palette — see PlayerCricketOverview).
const PANEL = {
  bat: { header: "#8C5E82", body: "#EFE0F2", text: "#4A2F47" },
  bowl: { header: "#3E6B5C", body: "#DEF2E3", text: "#2C4A3D" },
  field: { header: "#BD6B45", body: "#FBE4D1", text: "#7A4426" },
};

function StatPanel({ title, color, rows }: { title: string; color: (typeof PANEL)["bat"]; rows: { label: string; value: string }[] }) {
  return (
    <div className="flex-1 overflow-hidden rounded-2xl shadow-card">
      <div className="py-2 text-center text-xs font-bold text-white" style={{ backgroundColor: color.header }}>
        {title}
      </div>
      <div style={{ backgroundColor: color.body }}>
        {rows.map((r, i) => (
          <div key={r.label} className={`flex flex-col items-center py-3 ${i > 0 ? "border-t border-black/[0.08]" : ""}`}>
            <span className="text-xl font-extrabold" style={{ color: color.text }}>
              {r.value}
            </span>
            <span className="mt-0.5 text-xs opacity-80" style={{ color: color.text }}>
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormCircle({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${accent ? "bg-brand text-white" : "bg-border text-ink"}`}>
      {children}
    </span>
  );
}

const PAGE_SIZE = 5;

export function PlayerCricketOverview({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const { data: figures, isLoading } = usePlayerCricketFigures(fullName, sportId);
  const [yearlyTab, setYearlyTab] = useState<"Batting" | "Bowling">("Batting");
  const [opponentTab, setOpponentTab] = useState<"Batting" | "Bowling">("Batting");
  const [formPage, setFormPage] = useState(0);

  if (isLoading) return <Loading />;
  if (!figures || figures.length === 0) return null;

  const bat = aggregateBatting(figures);
  const bowl = aggregateBowling(figures);
  const field = aggregateFielding(figures);
  const yearly = yearlyOverview(figures);
  const opponents = bestAgainstTeam(figures);
  const formEntries = recentForm(figures.slice(formPage * PAGE_SIZE, formPage * PAGE_SIZE + PAGE_SIZE), PAGE_SIZE);
  const opponentRows = opponentTab === "Batting" ? opponents.batting : opponents.bowling;

  return (
    <div>
      <div className="flex gap-2.5">
        <StatPanel
          title="Batting"
          color={PANEL.bat}
          rows={[
            { label: "Runs", value: String(bat.runs) },
            { label: "Average", value: bat.average.toFixed(1) },
            { label: "High Score", value: `${bat.highScore}${bat.highScoreNotOut ? "*" : ""}` },
          ]}
        />
        <StatPanel
          title="Bowling"
          color={PANEL.bowl}
          rows={[
            { label: "Wickets", value: String(bowl.wickets) },
            { label: "Average", value: bowl.wickets > 0 ? bowl.average.toFixed(1) : "0.0" },
            { label: "Best Bowling", value: bowl.innings > 0 ? `${bowl.bestWickets}-${bowl.bestRuns}` : "-" },
          ]}
        />
        <StatPanel
          title="Fielding"
          color={PANEL.field}
          rows={[
            { label: "Catches", value: String(field.catches) },
            { label: "Stumpings", value: String(field.stumpings) },
            { label: "Runouts", value: String(field.runouts) },
          ]}
        />
      </div>

      <h3 className="mb-3 mt-6 text-base font-bold text-ink">Recent Form</h3>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        <FormCircle accent>Bat</FormCircle>
        {formEntries.map((f) => (
          <FormCircle key={`${f.matchId}-bat`}>{String(f.bat)}</FormCircle>
        ))}
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        <FormCircle accent>Bowl</FormCircle>
        {formEntries.map((f) => (
          <FormCircle key={`${f.matchId}-bowl`}>{String(f.bowl)}</FormCircle>
        ))}
      </div>
      <FormPager
        hasNewer={formPage > 0}
        hasOlder={(formPage + 1) * PAGE_SIZE < figures.length}
        onNewer={() => setFormPage((p) => Math.max(0, p - 1))}
        onOlder={() => setFormPage((p) => p + 1)}
      />

      <SectionCard title="Yearly Overview">
        <TogglePill options={["Batting", "Bowling"]} value={yearlyTab} onChange={setYearlyTab} />
        <div className="mt-3">
          <MiniTable
            cols={yearlyTab === "Batting" ? ["Runs", "Avg", "HS"] : ["Wkts", "Econ", "Best"]}
            rows={[yearly.thisYear, yearly.lastYear].map((row) => ({
              label: row.label,
              values: yearlyTab === "Batting" ? [row.runs, row.average.toFixed(1), row.highScore] : [row.wickets, row.economy.toFixed(1), row.bestBowling],
            }))}
          />
        </div>
      </SectionCard>

      <SectionCard title="Best Against Team">
        <TogglePill options={["Batting", "Bowling"]} value={opponentTab} onChange={setOpponentTab} />
        <div className="mt-3">
          <MiniTable
            cols={opponentTab === "Batting" ? ["Runs", "Inn", "SR"] : ["Wkts", "Econ"]}
            rows={opponentRows.map((row) => ({
              label: row.teamName.toUpperCase(),
              values:
                opponentTab === "Batting"
                  ? [(row as (typeof opponents.batting)[number]).runs, (row as (typeof opponents.batting)[number]).innings, (row as (typeof opponents.batting)[number]).strikeRate.toFixed(1)]
                  : [(row as (typeof opponents.bowling)[number]).wickets, (row as (typeof opponents.bowling)[number]).economy.toFixed(1)],
            }))}
          />
          {opponentRows.length === 0 ? <p className="py-3 text-center text-sm text-muted">No matches yet</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}

type SubTab = "BAT" | "BOWL" | "FIELD" | "MATCH-WISE";
const SUB_TABS: SubTab[] = ["BAT", "BOWL", "FIELD", "MATCH-WISE"];
const FORMATS: CricketFormat[] = ["T10", "T20", "Club", "ODI"];

function FormatTable({ rows }: { rows: { label: string; values: (string | number)[] }[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="flex border-b border-border pb-2">
        <span className="flex-[1.2]" />
        {FORMATS.map((fmt) => (
          <span key={fmt} className="flex-1 text-center text-[13px] font-bold text-[#0D9488]">
            {FORMAT_LABEL[fmt]}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center border-b border-border py-2.5 text-sm">
          <span className="flex-[1.2] font-bold text-ink">{row.label}</span>
          {row.values.map((v, i) => (
            <span key={i} className="flex-1 text-center text-ink">
              {v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PlayerCricketStatistics({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const { data: figures, isLoading } = usePlayerCricketFigures(fullName, sportId);
  const [subTab, setSubTab] = useState<SubTab>("BAT");
  if (isLoading) return <Loading />;
  if (!figures || figures.length === 0) return null;
  const s = statisticsByFormat(figures);
  const by = <T,>(fn: (f: CricketFormat) => T) => FORMATS.map(fn) as (string | number)[];

  return (
    <div>
      <div className="flex overflow-hidden rounded-xl bg-gray-100" role="tablist">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={subTab === t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 text-xs font-bold ${subTab === t ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === "BAT" && (
        <FormatTable
          rows={[
            { label: "Matches", values: by((f) => s.matches[f]) },
            { label: "Innings", values: by((f) => s.batting[f].innings) },
            { label: "Runs", values: by((f) => s.batting[f].runs) },
            { label: "Balls", values: by((f) => s.batting[f].balls) },
            { label: "Highest", values: by((f) => `${s.batting[f].highScore}${s.batting[f].highScoreNotOut ? "*" : ""}`) },
            { label: "Average", values: by((f) => s.batting[f].average.toFixed(1)) },
            { label: "SR", values: by((f) => s.batting[f].strikeRate.toFixed(1)) },
            { label: "Not Out", values: by((f) => s.batting[f].notOuts) },
            { label: "Ducks", values: by((f) => s.batting[f].ducks) },
            { label: "100s", values: by((f) => s.batting[f].hundreds) },
            { label: "50s", values: by((f) => s.batting[f].fifties) },
            { label: "30s", values: by((f) => s.batting[f].thirties) },
            { label: "6s", values: by((f) => s.batting[f].sixes) },
            { label: "4s", values: by((f) => s.batting[f].fours) },
          ]}
        />
      )}
      {subTab === "BOWL" && (
        <FormatTable
          rows={[
            { label: "Matches", values: by((f) => s.matches[f]) },
            { label: "Innings", values: by((f) => s.bowling[f].innings) },
            { label: "Balls", values: by((f) => s.bowling[f].balls) },
            { label: "Runs", values: by((f) => s.bowling[f].runs) },
            { label: "Dots", values: by((f) => s.bowling[f].dots) },
            { label: "Maidens", values: by((f) => s.bowling[f].maidens) },
            { label: "Wickets", values: by((f) => s.bowling[f].wickets) },
            { label: "Average", values: by((f) => (s.bowling[f].wickets > 0 ? s.bowling[f].average.toFixed(1) : "0.0")) },
            { label: "Economy", values: by((f) => s.bowling[f].economy.toFixed(1)) },
            { label: "SR", values: by((f) => (s.bowling[f].wickets > 0 ? s.bowling[f].strikeRate.toFixed(1) : "0.0")) },
            { label: "3w", values: by((f) => s.bowling[f].threeWickets) },
            { label: "5w", values: by((f) => s.bowling[f].fiveWickets) },
          ]}
        />
      )}
      {subTab === "FIELD" && (
        <FormatTable
          rows={[
            { label: "Catches", values: by((f) => s.fielding[f].catches) },
            { label: "Stumpings", values: by((f) => s.fielding[f].stumpings) },
            { label: "Runouts", values: by((f) => s.fielding[f].runouts) },
          ]}
        />
      )}
      {subTab === "MATCH-WISE" && (
        <div className="mt-4">
          {matchWiseRows(figures).map((row) => {
            const dateLabel = new Date(row.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
            const grid = (heads: string[], values: (string | number)[]) => (
              <>
                <div className="flex">
                  {heads.map((h) => (
                    <span key={h} className="flex-1 text-center text-xs text-muted">
                      {h}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex">
                  {values.map((v, i) => (
                    <span key={i} className="flex-1 text-center text-sm font-bold text-ink">
                      {v}
                    </span>
                  ))}
                </div>
              </>
            );
            return (
              <div key={row.matchId} className="mb-3 rounded-2xl bg-gray-100 p-4">
                <p className="mb-3 text-sm font-bold text-ink">
                  {row.format} - {dateLabel} vs {row.opponentTeamName.toUpperCase()}
                </p>
                {row.batting &&
                  grid(
                    ["Bat Order", "Runs", "Balls", "Fours", "Sixes", "SR"],
                    [
                      row.batting.position,
                      row.batting.runs,
                      row.batting.balls,
                      row.batting.fours,
                      row.batting.sixes,
                      row.batting.balls > 0 ? ((row.batting.runs / row.batting.balls) * 100).toFixed(1) : "0.0",
                    ]
                  )}
                {row.bowling && (
                  <div className="mt-3">
                    {grid(
                      ["Overs", "Runs", "Maidens", "Wickets", "Eco."],
                      [
                        `${Math.floor(row.bowling.legalBalls / 6)}.${row.bowling.legalBalls % 6}`,
                        row.bowling.runsConceded,
                        row.bowling.maidens,
                        row.bowling.wickets,
                        row.bowling.legalBalls > 0 ? ((row.bowling.runsConceded / row.bowling.legalBalls) * 6).toFixed(1) : "0.0",
                      ]
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PlayerCricketMatches({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const navigate = useAppNavigate();
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName, sportId);
  if (isLoading) return <Loading />;
  if (!matches || matches.length === 0) return <EmptyTab icon="baseball-outline" label="No matches yet" />;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {matches.map((match) => {
        const isLive = match.status === "IN_PROGRESS";
        const scores = matchTeamScores(match);
        const dateLabel = new Date(match.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
        const side = (name: string, color: string, sc: typeof scores.A) => (
          <div className="flex items-center justify-between">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <TeamCrest color={color} size={32} icon="cricket" />
              <span className="truncate text-sm font-bold text-ink">{name}</span>
            </span>
            <span className="text-sm font-bold text-ink">{sc ? `${sc.runs}-${sc.wickets} (${sc.oversLabel})` : ""}</span>
          </div>
        );
        return (
          <button key={match.id} type="button" onClick={() => navigate(paths.match("cricket", match.id))} className="press rounded-2xl bg-surface p-4 text-left shadow-card hover:shadow-hero">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-muted">
                Open Match, {match.format}, {dateLabel}
                {match.venue ? ` - ${match.venue}` : ""}
              </span>
              <span className="text-xs font-bold" style={{ color: isLive ? colors.danger : colors.muted }}>
                {isLive ? "LIVE" : "Completed"}
              </span>
            </div>
            {side(match.team_a_name, colors.primary, scores.A)}
            <div className="mt-2">{side(match.team_b_name, "rgb(var(--jz-blue-700))", scores.B)}</div>
            {!isLive && match.result_summary ? <p className="mt-3 truncate text-xs font-semibold text-primary">{match.result_summary}</p> : null}
          </button>
        );
      })}
    </div>
  );
}

export function PlayerCricketTeams({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName, sportId);
  if (isLoading) return <Loading />;
  const counts = new Map<string, number>();
  for (const m of matches ?? []) {
    const name = m.team_a_players.includes(fullName) ? m.team_a_name : m.team_b_name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const teams = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (teams.length === 0) return <EmptyTab icon="people-outline" label="No teams yet" />;
  return (
    <div className="mt-4">
      {teams.map(([name, count]) => (
        <EntityCard key={name} title={name.toUpperCase()} subtitle={`${count} match${count === 1 ? "" : "es"}`} subtitleIcon="stats-chart-outline" sportName="cricket" />
      ))}
    </div>
  );
}

export function PlayerCricketTournaments({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const navigate = useAppNavigate();
  const { data: matches, isLoading } = usePlayerCricketMatches(fullName, sportId);
  const ids = (matches ?? []).map((m) => m.id);
  const { data: tournaments } = useQuery({
    queryKey: ["playerTournaments", "cricket_match_id", ids],
    queryFn: () => fetchTournamentsForMatches("cricket_match_id", ids),
    enabled: !!matches,
  });
  if (isLoading || !tournaments) return <Loading />;
  if (tournaments.length === 0) return <EmptyTab icon="trophy-outline" label="No tournaments yet" />;
  return (
    <div className="mt-4">
      {tournaments.map((t) => (
        <EntityCard
          key={t.gameId}
          photoUrl={t.iconUrl}
          title={t.title}
          subtitle={t.gameDate ? new Date(t.gameDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : null}
          subtitleIcon="calendar-outline"
          pillLabel="Tournament"
          sportName="cricket"
          onPress={() => navigate(paths.game(t.gameId))}
        />
      ))}
    </div>
  );
}

const CRICKET_SPORT_NAMES = ["hard ball", "tape ball", "outdoor cricket"];

// Clubs: groups explicitly created as type "club" for a sport in `sportNames`.
export function PlayerClubs({ userId, sportNames, fallbackSport }: { userId: string; sportNames: string[]; fallbackSport: string }) {
  const navigate = useAppNavigate();
  const { data: squads } = useQuery({ queryKey: ["playerClubs", userId], queryFn: () => fetchMySquads(userId) });
  if (!squads) return <Loading />;
  const clubs = squads.filter((s) => s.group_type === "club" && sportNames.includes((s.sports?.name ?? "").toLowerCase()));
  if (clubs.length === 0) return <EmptyTab icon="shield-outline" label="No clubs yet" />;
  return (
    <div className="mt-4">
      {clubs.map((s) => {
        const active = s.squad_members.filter((m) => m.status === "ACTIVE").length;
        return (
          <EntityCard
            key={s.id}
            photoUrl={s.icon_url}
            title={s.name}
            subtitle={`${s.location ?? "Location not set"} · ${active} member${active === 1 ? "" : "s"}`}
            sportName={s.sports?.name ?? fallbackSport}
            onPress={() => navigate(paths.squad(s.id))}
          />
        );
      })}
    </div>
  );
}

export function PlayerCricketClubs({ userId }: { userId: string }) {
  return <PlayerClubs userId={userId} sportNames={CRICKET_SPORT_NAMES} fallbackSport="cricket" />;
}

type BatMetric = "Inn" | "Run" | "Avg" | "SR";
const BAT_METRICS: BatMetric[] = ["Inn", "Run", "Avg", "SR"];
const PIE_COLORS: Record<string, string> = { "1": "#06B6D4", "2": "#8B5CF6", "3": "#F59E0B", "4": "#F59E0B", "6": "#7C3AED", Ex: "#3B82F6" };

export function PlayerCricketInsights({ fullName, sportId }: { fullName: string; sportId?: string | null }) {
  const { data: figures, isLoading: fl } = usePlayerCricketFigures(fullName, sportId);
  const { data: matches, isLoading: ml } = usePlayerCricketMatches(fullName, sportId);
  const [section, setSection] = useState<"Batting" | "Bowling">("Batting");
  const [metric, setMetric] = useState<BatMetric>("Run");
  if (fl || ml) return <Loading />;
  if (!figures || figures.length === 0 || !matches) return null;

  const rows = battingPositionStats(figures);
  const dist = bowlingConcededDistribution(matches, fullName);
  const values = rows.map((r) => (metric === "Inn" ? r.innings : metric === "Run" ? r.runs : metric === "Avg" ? r.average : r.strikeRate));
  const max = Math.max(1, ...values);
  const CH = 160;

  return (
    <div>
      <TogglePill options={["Batting", "Bowling"]} value={section} onChange={setSection} />
      {section === "Batting" ? (
        <SectionCard title="Bat Position Stats" center>
          <div className="flex justify-center gap-2.5">
            {BAT_METRICS.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={metric === o}
                onClick={() => setMetric(o)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-bold ${metric === o ? "bg-[#14B8A6] text-white" : "bg-border text-muted"}`}
              >
                {o}
              </button>
            ))}
          </div>
          {rows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <div className="flex items-end gap-[18px] px-2" style={{ height: CH }}>
                {rows.map((r, i) => (
                  <div key={r.position} className="w-7 shrink-0 rounded bg-[#14B8A6] transition-[height] duration-300" style={{ height: Math.max(2, (values[i] / max) * CH) }} />
                ))}
              </div>
              <div className="mt-2 flex gap-[18px] px-2">
                {rows.map((r, i) => (
                  <div key={r.position} className="flex w-7 shrink-0 flex-col items-center">
                    <span className="text-xs font-bold text-ink">{Math.round(values[i] * 10) / 10}</span>
                    <span className="mt-1 rounded-full bg-border px-2 py-0.5 text-[10px] font-bold text-ink">{r.position}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-muted">No batting innings yet</p>
          )}
        </SectionCard>
      ) : (
        <SectionCard title="Conceded Runs Distribution" center>
          {dist.totalRuns > 0 ? (
            <div className="mt-4 flex flex-col items-center">
              <ArcPie slices={dist.byValue.map((b) => ({ key: b.value, value: b.runs, color: PIE_COLORS[b.value] ?? "#9CA3AF" }))} />
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                {dist.byValue.map((b) => (
                  <div key={b.value} className="flex w-12 flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: PIE_COLORS[b.value] ?? "#9CA3AF" }}>
                      {b.value}
                    </span>
                    <span className="mt-1 text-xs font-bold text-ink">{b.runs}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm font-bold text-ink">Total Bowl Runs : {dist.totalRuns}</p>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-muted">No bowling figures yet</p>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function CricketComparePanel({ fullNameA, nameA, fullNameB, nameB, sportId }: { fullNameA: string; nameA: string; fullNameB: string; nameB: string; sportId?: string | null }) {
  const { data: fa, isLoading: la } = usePlayerCricketFigures(fullNameA, sportId);
  const { data: fb, isLoading: lb } = usePlayerCricketFigures(fullNameB, sportId);
  if (la || lb) return <Loading />;
  const [batA, batB] = [aggregateBatting(fa ?? []), aggregateBatting(fb ?? [])];
  const [bowlA, bowlB] = [aggregateBowling(fa ?? []), aggregateBowling(fb ?? [])];
  const [fieldA, fieldB] = [aggregateFielding(fa ?? []), aggregateFielding(fb ?? [])];
  const bar = (label: string, a: number, b: number, dec = false) => (
    <CompareBar label={label} leftValue={a} rightValue={b} leftDisplay={dec ? a.toFixed(1) : String(a)} rightDisplay={dec ? b.toFixed(1) : String(b)} />
  );
  return (
    <div className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex justify-between gap-3">
        <span className="flex-1 truncate text-base font-bold text-ink">{nameA}</span>
        <span className="flex-1 truncate text-right text-base font-bold text-ink">{nameB}</span>
      </div>
      <p className="mt-2 text-center font-extrabold text-ink">Batting</p>
      {bar("Matches", batA.innings, batB.innings)}
      {bar("Runs", batA.runs, batB.runs)}
      {bar("Avg", batA.average, batB.average, true)}
      {bar("SR", batA.strikeRate, batB.strikeRate, true)}
      {bar("6s", batA.sixes, batB.sixes)}
      {bar("4s", batA.fours, batB.fours)}
      <p className="mt-4 text-center font-extrabold text-ink">Bowling</p>
      {bar("Matches", bowlA.innings, bowlB.innings)}
      {bar("Wickets", bowlA.wickets, bowlB.wickets)}
      {bar("Avg", bowlA.average, bowlB.average, true)}
      {bar("Econ", bowlA.economy, bowlB.economy, true)}
      <p className="mt-4 text-center font-extrabold text-ink">Fielding</p>
      {bar("Catches", fieldA.catches, fieldB.catches)}
      {bar("Runouts", fieldA.runouts, fieldB.runouts)}
    </div>
  );
}

export function PlayerCricketCompare({ fullName, displayName, sportId }: { fullName: string; displayName: string; sportId?: string | null }) {
  const [opponent, setOpponent] = useState<UserSearchResult | null>(null);
  return (
    <div>
      <ComparePlayerSearch onSelect={setOpponent} />
      {opponent?.full_name ? <CricketComparePanel fullNameA={fullName} nameA={displayName} fullNameB={opponent.full_name} nameB={opponent.full_name} sportId={sportId} /> : null}
    </div>
  );
}
