import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { colors } from "@app/constants/theme";
import {
  aggregateGeneric,
  genericRecentForm,
  genericYearlyOverview,
  genericBestAgainstOpponent,
  SPORT_CONFIGS,
  type GenericSport,
} from "@app/lib/genericSportStats";
import type { UserSearchResult } from "@app/lib/api/users";
import { usePlayerGenericFigures, usePlayerGenericMatches } from "@/hooks/usePlayerSportStats";
import { fetchTournamentsForMatches } from "@/lib/playerTournaments";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import { ArcPie, CompareBar, ComparePlayerSearch, EmptyTab, EntityCard, FormPager, Loading, MiniTable, SectionCard } from "./PlayerTabParts";
import { PlayerClubs } from "./PlayerCricketTabs";

// Ports of the app's PlayerSport* tabs (football, padel, badminton,
// pickleball, table tennis, tennis).

const RESULT_COLOR: Record<string, string> = { W: "#16A34A", L: "#DC2626", D: "#CA8A04", Wins: "#16A34A", Losses: "#DC2626", Draws: "#CA8A04" };
const PAGE_SIZE = 5;

function Panel({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-2xl bg-surface py-4 shadow-card">
      <span className="text-[22px] font-extrabold" style={{ color }}>
        {value}
      </span>
      <span className="mt-1 text-xs text-muted">{label}</span>
    </div>
  );
}

export function PlayerSportOverview({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, fullName);
  const [formPage, setFormPage] = useState(0);
  const cfg = SPORT_CONFIGS[sport];
  if (isLoading) return <Loading />;
  if (!figures || figures.length === 0) return null;
  const t = aggregateGeneric(figures);
  const yearly = genericYearlyOverview(figures);
  const opponents = genericBestAgainstOpponent(figures);
  const form = genericRecentForm(figures.slice(formPage * PAGE_SIZE, formPage * PAGE_SIZE + PAGE_SIZE), PAGE_SIZE);
  const goals = cfg.headline === "goals";

  return (
    <div>
      <div className="flex gap-2.5">
        <Panel value={String(t.matches)} label="Matches" color={colors.ink} />
        <Panel value={String(t.wins)} label="Wins" color="#16A34A" />
        <Panel value={String(t.losses)} label="Losses" color="#DC2626" />
        {cfg.hasDraw ? <Panel value={String(t.draws)} label="Draws" color="#CA8A04" /> : null}
      </div>
      <div className="mt-3 flex gap-2.5">
        <Panel value={`${t.winPercent.toFixed(0)}%`} label="Win Rate" color={colors.primary} />
        {goals ? <Panel value={String(t.goals)} label="Goals" color="#2563EB" /> : null}
      </div>

      <h3 className="mb-3 mt-6 text-base font-bold text-ink">Recent Form</h3>
      <div className="flex items-center gap-2">
        {form.length > 0 ? (
          form.map((f) => (
            <span key={f.matchId} className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: RESULT_COLOR[f.letter] }}>
              {f.letter}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted">No results yet</span>
        )}
      </div>
      {figures.length > PAGE_SIZE ? (
        <FormPager hasNewer={formPage > 0} hasOlder={(formPage + 1) * PAGE_SIZE < figures.length} onNewer={() => setFormPage((p) => p - 1)} onOlder={() => setFormPage((p) => p + 1)} />
      ) : null}

      <SectionCard title="Yearly Overview">
        <MiniTable
          colWidth={56}
          cols={goals ? ["M", "W", "L", "Gls"] : ["M", "W", "L"]}
          rows={[yearly.thisYear, yearly.lastYear].map((r) => ({ label: r.label, values: goals ? [r.matches, r.wins, r.losses, r.goals] : [r.matches, r.wins, r.losses] }))}
        />
      </SectionCard>

      <SectionCard title="Best Against Opponent">
        {opponents.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">No matches yet</p>
        ) : (
          <MiniTable colWidth={56} cols={["M", "W", "L"]} rows={opponents.map((r) => ({ label: r.opponentName.toUpperCase(), values: [r.matches, r.wins, r.losses] }))} />
        )}
      </SectionCard>
    </div>
  );
}

export function PlayerSportStatistics({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];
  if (isLoading) return <Loading />;
  if (!figures || figures.length === 0) return null;
  const t = aggregateGeneric(figures);
  const rows: { label: string; value: string | number }[] = [
    { label: "Matches", value: t.matches },
    { label: "Wins", value: t.wins },
    { label: "Losses", value: t.losses },
    ...(cfg.hasDraw ? [{ label: "Draws", value: t.draws }] : []),
    { label: "Win %", value: `${t.winPercent.toFixed(1)}%` },
    ...(cfg.headline === "goals" ? [{ label: "Goals", value: t.goals }, { label: "Goals per Match", value: (t.goals / t.matches).toFixed(2) }] : []),
  ];
  return (
    <div className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
      {rows.map((row, i) => (
        <div key={row.label} className={`flex items-center justify-between py-3 ${i > 0 ? "border-t border-border" : ""}`}>
          <span className="text-[14.5px] font-semibold text-ink">{row.label}</span>
          <span className="text-base font-extrabold text-ink">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PlayerSportMatches({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const navigate = useAppNavigate();
  const { data: matches, isLoading } = usePlayerGenericMatches(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];
  if (isLoading) return <Loading />;
  if (!matches || matches.length === 0) return <EmptyTab icon="calendar-outline" label="No matches yet" />;
  return (
    <div className="mt-4">
      {matches.map((m) => {
        const isLive = m.status !== "COMPLETED";
        const dateLabel = new Date(m.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
        return (
          <EntityCard
            key={m.id}
            title={`${m.sideAName} vs ${m.sideBName}`}
            subtitle={isLive ? `Live · ${dateLabel}` : (m.resultSummary ?? dateLabel)}
            subtitleIcon={isLive ? "radio-outline" : "calendar-outline"}
            pillLabel={isLive ? "Live" : "Completed"}
            sportName={cfg.dbSportNames[0]}
            onPress={() => navigate(paths.match(sport, m.id))}
          />
        );
      })}
    </div>
  );
}

export function PlayerSportTeams({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: matches, isLoading } = usePlayerGenericMatches(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];
  if (isLoading) return <Loading />;
  const counts = new Map<string, number>();
  for (const m of matches ?? []) {
    // Singles have no players array — identity is the side name itself.
    const onA = m.sideAPlayers.includes(fullName) || m.sideAName === fullName;
    const name = onA ? m.sideAName : m.sideBName;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const teams = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (teams.length === 0) return <EmptyTab icon="people-outline" label="No teams yet" />;
  return (
    <div className="mt-4">
      {teams.map(([name, count]) => (
        <EntityCard key={name} title={name.toUpperCase()} subtitle={`${count} match${count === 1 ? "" : "es"}`} subtitleIcon="stats-chart-outline" sportName={cfg.dbSportNames[0]} />
      ))}
    </div>
  );
}

export function PlayerSportTournaments({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const navigate = useAppNavigate();
  const cfg = SPORT_CONFIGS[sport];
  const { data: matches, isLoading } = usePlayerGenericMatches(sport, fullName);
  const ids = (matches ?? []).map((m) => m.id);
  const { data: tournaments } = useQuery({
    queryKey: ["playerTournaments", cfg.tournamentMatchIdCol, ids],
    queryFn: () => fetchTournamentsForMatches(cfg.tournamentMatchIdCol, ids),
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
          sportName={cfg.dbSportNames[0]}
          onPress={() => navigate(paths.game(t.gameId))}
        />
      ))}
    </div>
  );
}

export function PlayerSportClubs({ sport, userId }: { sport: GenericSport; userId: string }) {
  const cfg = SPORT_CONFIGS[sport];
  return <PlayerClubs userId={userId} sportNames={cfg.dbSportNames} fallbackSport={cfg.dbSportNames[0]} />;
}

export function PlayerSportInsights({ sport, fullName }: { sport: GenericSport; fullName: string }) {
  const { data: figures, isLoading } = usePlayerGenericFigures(sport, fullName);
  const cfg = SPORT_CONFIGS[sport];
  if (isLoading) return <Loading />;
  if (!figures || figures.length === 0) return null;
  const t = aggregateGeneric(figures);
  const slices = [
    { label: "Wins", value: t.wins },
    { label: "Losses", value: t.losses },
    ...(cfg.hasDraw ? [{ label: "Draws", value: t.draws }] : []),
  ].filter((s) => s.value > 0);
  return (
    <SectionCard title="Match Result Distribution" center>
      {t.matches > 0 ? (
        <div className="flex flex-col items-center">
          <ArcPie slices={slices.map((s) => ({ key: s.label, value: s.value, color: RESULT_COLOR[s.label] }))} />
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {slices.map((s) => (
              <div key={s.label} className="flex w-[70px] flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: RESULT_COLOR[s.label] }}>
                  {s.value}
                </span>
                <span className="mt-1 text-xs font-semibold text-ink">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">No matches yet</p>
      )}
    </SectionCard>
  );
}

function SportComparePanel({ sport, fullNameA, nameA, fullNameB, nameB }: { sport: GenericSport; fullNameA: string; nameA: string; fullNameB: string; nameB: string }) {
  const { data: fa, isLoading: la } = usePlayerGenericFigures(sport, fullNameA);
  const { data: fb, isLoading: lb } = usePlayerGenericFigures(sport, fullNameB);
  const cfg = SPORT_CONFIGS[sport];
  if (la || lb) return <Loading />;
  const a = aggregateGeneric(fa ?? []);
  const b = aggregateGeneric(fb ?? []);
  return (
    <div className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex justify-between gap-3">
        <span className="flex-1 truncate text-base font-bold text-ink">{nameA}</span>
        <span className="flex-1 truncate text-right text-base font-bold text-ink">{nameB}</span>
      </div>
      <CompareBar label="Matches" leftValue={a.matches} rightValue={b.matches} leftDisplay={String(a.matches)} rightDisplay={String(b.matches)} />
      <CompareBar label="Wins" leftValue={a.wins} rightValue={b.wins} leftDisplay={String(a.wins)} rightDisplay={String(b.wins)} />
      <CompareBar label="Losses" leftValue={a.losses} rightValue={b.losses} leftDisplay={String(a.losses)} rightDisplay={String(b.losses)} />
      {cfg.hasDraw ? <CompareBar label="Draws" leftValue={a.draws} rightValue={b.draws} leftDisplay={String(a.draws)} rightDisplay={String(b.draws)} /> : null}
      <CompareBar label="Win %" leftValue={a.winPercent} rightValue={b.winPercent} leftDisplay={`${a.winPercent.toFixed(0)}%`} rightDisplay={`${b.winPercent.toFixed(0)}%`} />
      {cfg.headline === "goals" ? <CompareBar label="Goals" leftValue={a.goals} rightValue={b.goals} leftDisplay={String(a.goals)} rightDisplay={String(b.goals)} /> : null}
    </div>
  );
}

export function PlayerSportCompare({ sport, fullName, displayName }: { sport: GenericSport; fullName: string; displayName: string }) {
  const [opponent, setOpponent] = useState<UserSearchResult | null>(null);
  return (
    <div>
      <ComparePlayerSearch onSelect={setOpponent} />
      {opponent?.full_name ? <SportComparePanel sport={sport} fullNameA={fullName} nameA={displayName} fullNameB={opponent.full_name} nameB={opponent.full_name} /> : null}
    </div>
  );
}
