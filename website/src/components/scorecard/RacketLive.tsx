import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "@app/constants/theme";
import { supabase } from "@app/lib/supabase";
import { uniqueChannelName } from "@app/lib/realtimeChannel";
import { getSportImage } from "@app/lib/sportImages";
import { imageUrl } from "@/lib/cn";
import { Ionicon } from "../icons/Icon";
import Spinner from "../ui/Spinner";
import { GradientActionButton, OfflineScoringBanner, OutlineActionButton, ScoringCodeBadge, TeamCrest, TEAM_A_COLOR, TEAM_B_COLOR, TEAM_B_LIGHT } from "./ScorecardParts";

type Side = "A" | "B";

// Live push for every viewer: any change to the match row or its point /
// rally log refetches the match (same channel pattern as the app).
export function useLiveMatchChannel(matchId: string, matchTable: string, eventsTable: string, queryKeyPrefix: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!matchId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: [queryKeyPrefix, matchId] });
    const channel = supabase
      .channel(uniqueChannelName(`${queryKeyPrefix}LiveScoring:${matchId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: matchTable, filter: `id=eq.${matchId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: eventsTable, filter: `match_id=eq.${matchId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, matchTable, eventsTable, queryKeyPrefix, qc]);
}

export function LiveLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ScorePill({ value, side }: { value: string | number; side: Side }) {
  return (
    <span
      className="flex min-w-[84px] items-center justify-center rounded-2xl px-[18px] py-3.5 text-[32px] font-extrabold leading-none"
      style={{ color: side === "A" ? TEAM_A_COLOR : TEAM_B_COLOR, backgroundColor: side === "A" ? colors.primaryLight : TEAM_B_LIGHT }}
    >
      {value}
    </span>
  );
}

export function ScorePills({ a, b, gap = 16 }: { a: string | number; b: string | number; gap?: number }) {
  return (
    <div className="flex items-center" style={{ gap }}>
      <ScorePill value={a} side="A" />
      <span className="text-xl font-bold text-muted">-</span>
      <ScorePill value={b} side="B" />
    </div>
  );
}

export function IndicatorPill({ label, forName }: { label: string; forName?: string | null }) {
  return (
    <span className="mt-3 rounded-full bg-primary-light px-3 py-1 text-xs font-extrabold text-primary-dark">
      {label}
      {forName ? ` — ${forName}` : ""}
    </span>
  );
}

function DotGridCorner({ side }: { side: "left" | "right" }) {
  return (
    <span className={`pointer-events-none absolute top-3.5 flex w-8 flex-wrap ${side === "left" ? "left-3.5" : "right-3.5"}`}>
      {Array.from({ length: 16 }).map((_, i) => (
        <span key={i} className="m-0.5 h-1 w-1 rounded-full bg-border" />
      ))}
    </span>
  );
}

function PlayerInitial({ name, side }: { name: string; side: Side }) {
  return (
    <span
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ color: side === "A" ? colors.primaryDark : TEAM_B_COLOR, backgroundColor: side === "A" ? colors.primaryLight : TEAM_B_LIGHT }}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

// Point / rally log chips; `dots` marks side-outs (pickleball).
export function HistoryCard({ title, history, footer }: { title: string; history: { winner: Side; dot?: boolean }[]; footer?: ReactNode }) {
  if (history.length === 0) return null;
  return (
    <div className="mb-4 rounded-2xl bg-surface p-4 shadow-card">
      <p className="mb-2 text-xs font-bold tracking-[0.5px] text-muted">{title}</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {history.map((h, i) => (
          <span key={i} className="flex shrink-0 flex-col items-center">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: h.winner === "A" ? colors.primaryLight : TEAM_B_LIGHT, color: h.winner === "A" ? colors.primaryDark : TEAM_B_COLOR }}
            >
              {h.winner}
            </span>
            {h.dot && <span className="mt-[3px] h-1 w-1 rounded-full bg-warning" />}
          </span>
        ))}
      </div>
      {footer ?? <span className="mx-auto mt-3 block h-[3px] w-2/5 rounded-full bg-gray-100" />}
    </div>
  );
}

export function ServerCard({ label, value, sub, chevron = true }: { label: string; value: string; sub?: string; chevron?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3 shadow-card">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
        <p className="min-w-0 flex-1 truncate text-sm text-ink">
          <span className="font-bold">{label}: </span>
          {value}
        </p>
        {chevron && <Ionicon name="chevron-forward" size={16} color={colors.muted} />}
      </div>
      {sub && <p className="ml-4 mt-1.5 truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

// Current game / tiebreak card over a blurred sport photo.
export function CurrentGameCard({ sportImageKey, label, children }: { sportImageKey: string; label: string; children: ReactNode }) {
  const bg = imageUrl(getSportImage(sportImageKey));
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl shadow-card">
      {bg && (
        <>
          <img src={bg} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-[3px]" />
          <span className="absolute inset-0 bg-white/[0.86]" />
        </>
      )}
      <div className="relative flex flex-col items-center p-5">
        <p className="mb-3 text-xs font-bold tracking-[0.5px] text-muted">{label}</p>
        {children}
      </div>
    </div>
  );
}

export type ScoreColumn = { head: string; a: string | number; b: string | number };

// The in-progress live view shared by the five point/rally sports.
export function RacketLiveView({
  sportLabel,
  aName,
  bName,
  isDoubles,
  aPlayers,
  bPlayers,
  scoringCode,
  onBack,
  isOnline,
  pendingCount,
  unit,
  summaryLabel,
  wonA,
  wonB,
  firstToText,
  tableHeader,
  columns,
  currentCard,
  serverCard,
  history,
  isScorer,
  onPoint,
  pointPending,
  onUndo,
  undoDisabled,
  watermarkIcon,
}: {
  sportLabel: string;
  aName: string;
  bName: string;
  isDoubles: boolean;
  aPlayers: string[];
  bPlayers: string[];
  scoringCode: string | null;
  onBack: () => void;
  isOnline: boolean;
  pendingCount: number;
  unit: "point" | "rally";
  summaryLabel: string;
  wonA: number;
  wonB: number;
  firstToText: string;
  tableHeader: string;
  columns: ScoreColumn[];
  currentCard: ReactNode;
  serverCard: ReactNode;
  history: ReactNode;
  isScorer: boolean;
  onPoint: (side: Side) => void;
  pointPending: boolean;
  onUndo: () => void;
  undoDisabled: boolean;
  watermarkIcon: string;
}) {
  const teamRow = (side: Side) => {
    const isA = side === "A";
    const players = isA ? aPlayers : bPlayers;
    return (
      <div
        className={`flex-1 overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-card ${isA ? "" : "text-right"}`}
        style={isA ? { borderLeft: `4px solid ${TEAM_A_COLOR}` } : { borderRight: `4px solid ${TEAM_B_COLOR}` }}
      >
        <p className="truncate text-base font-extrabold text-ink">{isA ? aName : bName}</p>
        {isDoubles && (
          <div className={`mt-2 flex flex-col gap-1.5 ${isA ? "" : "items-end"}`}>
            {players.map((p, i) => (
              <span key={i} className={`flex max-w-full items-center gap-1.5 ${isA ? "" : "flex-row-reverse"}`}>
                <PlayerInitial name={p} side={side} />
                <span className="truncate text-xs font-medium text-ink">{p}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl pb-10 lg:px-8">
      <header className="sticky top-[var(--header-h)] z-20 flex items-center gap-2 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+16px)] backdrop-blur lg:px-0 lg:pt-6">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1 hover:bg-gray-100">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <span className="inline-flex shrink-0 items-center gap-[5px] rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-surface" />
          LIVE
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold text-ink">
            {aName} vs {bName}
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted">
            {isDoubles ? "Doubles" : "Singles"} · {sportLabel}
          </p>
        </div>
        <ScoringCodeBadge code={scoringCode} />
      </header>

      <div className="px-5 pt-1 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:px-0">
        <div>
          <OfflineScoringBanner isOnline={isOnline} pendingCount={pendingCount} unit={unit} />

          <div className="relative mb-4">
            <div className="flex items-stretch gap-2.5">
              {teamRow("A")}
              {teamRow("B")}
            </div>
            <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-extrabold text-ink shadow-card">VS</span>
          </div>

          <div className="relative mb-4 flex flex-col items-center overflow-hidden rounded-2xl bg-surface p-4 shadow-card">
            <DotGridCorner side="left" />
            <DotGridCorner side="right" />
            <p className="mb-1 flex items-center gap-[5px] text-xs font-bold tracking-[0.5px] text-muted">
              <Ionicon name="trophy" size={14} color={colors.warning} />
              {summaryLabel}
            </p>
            <div className="flex items-center gap-6">
              <span className="text-[30px] font-extrabold text-ink">{wonA}</span>
              <span className="text-lg font-bold text-muted">-</span>
              <span className="text-[30px] font-extrabold text-ink">{wonB}</span>
            </div>
            <span className="mt-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-muted">{firstToText}</span>
          </div>

          <div className="mb-4 overflow-x-auto rounded-2xl bg-surface p-4 shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-[38%] pb-2 text-left font-bold text-ink">{tableHeader}</th>
                  {columns.map((c, i) => (
                    <th key={i} className="pb-2 text-center text-xs font-semibold text-muted">
                      {c.head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["A", "B"] as const).map((side) => (
                  <tr key={side}>
                    <td className="pt-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={side === "A" ? { backgroundImage: "linear-gradient(90deg,#07301D,#1D9254)" } : { backgroundColor: TEAM_B_COLOR }} />
                        <span className="truncate font-semibold text-ink">{side === "A" ? aName : bName}</span>
                      </span>
                    </td>
                    {columns.map((c, i) => (
                      <td key={i} className="pt-2 text-center font-bold text-ink">
                        {side === "A" ? c.a : c.b}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {currentCard}
          {serverCard}
          {history}
        </div>

        {isScorer && (
          <aside className="mt-4 flex flex-col gap-2.5 lg:sticky lg:top-[calc(var(--header-h)+96px)] lg:mt-0 lg:self-start">
            <p className="hidden text-xs font-bold tracking-[0.5px] text-muted lg:block">SCORE</p>
            <div className={`flex flex-col gap-2.5 ${pointPending ? "pointer-events-none" : ""}`}>
              <GradientActionButton onPress={() => onPoint("A")} from={colors.primary} to={colors.primaryDark} icon="add" label={`${aName} Point`} watermarkIcon={watermarkIcon} shadow={!pointPending} />
              <GradientActionButton onPress={() => onPoint("B")} from="#2563EB" to={TEAM_B_COLOR} icon="add" label={`${bName} Point`} watermarkIcon={watermarkIcon} shadow={!pointPending} />
            </div>
            <OutlineActionButton onPress={onUndo} disabled={undoDisabled} icon="arrow-undo-outline" label="Undo Last Point" className="mt-0.5" style={{ opacity: undoDisabled ? 0.5 : 1 }} />
            <p className="hidden text-center text-xs text-muted lg:block">Shortcuts: A / B to score, Z to undo</p>
          </aside>
        )}
      </div>
    </div>
  );
}

// Keyboard shortcuts for the scorer on desktop (A / B point, Z undo) —
// ignored while typing or with a dialog open.
export function useScoringShortcuts(enabled: boolean, onPoint: (side: Side) => void, onUndo: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector("[role=dialog],[role=alertdialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "a") onPoint("A");
      else if (k === "b") onPoint("B");
      else if (k === "z") onUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onPoint, onUndo]);
}

// Match Complete: winner ribbon over the two crests and the final tally,
// a per-set/per-game breakdown, Generate Match Report, Back to Matches.
export function RacketCompleteView({
  sportLabel,
  crestIcon,
  aName,
  bName,
  winner,
  wonA,
  wonB,
  tallyLabel,
  breakdown,
  onBack,
  onReport,
  generatingReport,
  extra,
}: {
  sportLabel: string;
  crestIcon: string;
  aName: string;
  bName: string;
  // null = drawn (football)
  winner: Side | null;
  wonA: number;
  wonB: number;
  tallyLabel: string;
  breakdown: { label: string; score: string }[];
  onBack: () => void;
  onReport: () => void;
  generatingReport: boolean;
  extra?: ReactNode;
}) {
  const winnerName = winner === "A" ? aName : winner === "B" ? bName : null;
  return (
    <div className="mx-auto max-w-2xl pb-10 lg:px-8">
      <header className="flex items-center gap-1.5 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-0 lg:pt-6">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1 hover:bg-gray-100">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold text-ink">Match Complete</h1>
          <p className="mt-0.5 truncate text-xs text-muted">{sportLabel}</p>
        </div>
        <button type="button" onClick={onReport} disabled={generatingReport} className="press flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white">
          {generatingReport ? (
            <Spinner size={18} color="white" />
          ) : (
            <>
              <Ionicon name="document-text-outline" size={18} color="white" />
              <span className="hidden sm:inline">Generate Match Report</span>
              <span className="sm:hidden">Report</span>
            </>
          )}
        </button>
      </header>

      <div className="px-5 pt-1 lg:px-0">
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-surface shadow-card">
          <span className="pointer-events-none absolute left-0 top-0" style={{ borderTop: `56px solid ${TEAM_A_COLOR}`, borderRight: "56px solid transparent" }} />
          <span className="pointer-events-none absolute right-0 top-0" style={{ borderTop: `56px solid ${TEAM_B_COLOR}`, borderLeft: "56px solid transparent" }} />
          <div className="flex flex-col items-center p-5">
            <span className="mb-4 flex items-center gap-1.5 rounded-full bg-primary-light px-3.5 py-1.5 text-xs font-extrabold tracking-[0.5px] text-primary-dark">
              <Ionicon name={winnerName ? "trophy" : "flag-outline"} size={15} color={colors.primaryDark} />
              {winnerName ? `${winnerName.toUpperCase()} WINS` : "MATCH DRAWN"}
            </span>
            <div className="flex w-full items-center justify-between">
              <div className="flex w-[92px] flex-col items-center">
                <TeamCrest color={TEAM_A_COLOR} icon={crestIcon} />
                <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{aName}</p>
              </div>
              <div className="flex flex-1 flex-col items-center">
                <div className="flex items-center gap-4">
                  <span className="text-[42px] font-extrabold leading-none text-ink">{wonA}</span>
                  <span className="text-[22px] font-bold text-muted">-</span>
                  <span className="text-[42px] font-extrabold leading-none text-ink">{wonB}</span>
                </div>
                <span className="mt-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold tracking-[0.5px] text-muted">{tallyLabel}</span>
              </div>
              <div className="flex w-[92px] flex-col items-center">
                <TeamCrest color={TEAM_B_COLOR} icon={crestIcon} />
                <p className="mt-2 w-full truncate text-center text-sm font-bold text-ink">{bName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card">
          {breakdown.map((row, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-bold tracking-[0.5px] text-muted">
                <Ionicon name="time-outline" size={14} color={colors.muted} />
                {row.label}
              </span>
              <span className="text-sm font-bold text-ink">{row.score}</span>
            </div>
          ))}
        </div>

        {extra}

        <button type="button" onClick={onBack} className="press flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-cta" style={{ backgroundImage: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryDark})` }}>
          <Ionicon name="arrow-back-circle-outline" size={18} color="white" />
          Back to Matches
        </button>
      </div>
    </div>
  );
}
