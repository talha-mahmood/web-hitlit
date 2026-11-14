import { useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { colors } from "@app/constants/theme";
import { useEnterManualScore } from "@app/hooks/useTournamentMatches";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { computeManualResult, isValidOversText, oversToDecimal, type ManualInnings, type ManualScore, type ManualScoreParams } from "@app/lib/manualScore";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import Spinner from "@/components/ui/Spinner";
import { PillRow } from "@/components/forms/FormControls";
import { CardSection } from "@/components/scorecard/NewMatchParts";
import { useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const OVERS_PRESETS = ["2", "5", "10", "20", "50"];
const EMPTY_INNINGS = { runs: "", wickets: "", overs: "" };
const digits = (t: string, max = 3) => t.replace(/[^0-9]/g, "").slice(0, max);
type Pair = { a: string; b: string };

function InfoBox({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
  const isError = tone === "error";
  return (
    <div className="mt-3 flex gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: isError ? "rgb(var(--jz-red-100))" : colors.primaryLight }} role={isError ? "alert" : undefined}>
      <span className="mt-px shrink-0">
        <Ionicon name="information-circle" size={16} color={isError ? colors.danger : colors.primaryDark} />
      </span>
      <p className="flex-1 text-xs" style={{ color: isError ? colors.danger : colors.primaryDark }}>
        {text}
      </p>
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder = "0", inputMode = "numeric", maxLength = 3 }: { label: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "numeric" | "decimal"; maxLength?: number }) {
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block truncate text-xs text-muted">{label}</span>
      <FieldInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} />
    </label>
  );
}

function ScorePair({ label, teamAName, teamBName, a, b, onA, onB }: { label?: string; teamAName: string; teamBName: string; a: string; b: string; onA: (v: string) => void; onB: (v: string) => void }) {
  return (
    <div className="mt-2">
      {label ? <p className="mb-2 text-sm font-semibold text-ink">{label}</p> : null}
      <div className="flex gap-2.5">
        <NumberField label={teamAName} value={a} onChange={(t) => onA(digits(t))} />
        <NumberField label={teamBName} value={b} onChange={(t) => onB(digits(t))} />
      </div>
    </div>
  );
}

// Port of ManualScoreScreen: a tournament fixture's final score typed in
// directly — cricket innings, racket sets/games or football goals (plus a
// shootout) — with the result computed and draws refused where the fixture
// needs a winner.
export default function ManualScorePage() {
  const params = (useLocation().state as { params?: ManualScoreParams } | null)?.params;
  if (!params) return <Navigate to={paths.community} replace />;
  return <ManualScoreForm params={params} />;
}

function ManualScoreForm({ params }: { params: ManualScoreParams }) {
  const { sport, allowDraw, prefill } = params;
  const goBack = useGoBack(paths.tournamentMatches(prefill.gameId));
  const enterScore = useEnterManualScore(prefill.gameId);
  const isRacquetSets = sport === "padel" || sport === "tennis";
  const isRacquetGames = sport === "badminton" || sport === "pickleball" || sport === "table_tennis";

  const [oversLimit, setOversLimit] = useState<string | null>("20");
  const [battedFirst, setBattedFirst] = useState<"A" | "B" | null>(null);
  const [innings1, setInnings1] = useState(EMPTY_INNINGS);
  const [innings2, setInnings2] = useState(EMPTY_INNINGS);
  const [rows, setRows] = useState<Pair[]>([{ a: "", b: "" }]);
  const [goalsA, setGoalsA] = useState("");
  const [goalsB, setGoalsB] = useState("");
  const [penalties, setPenalties] = useState<"NO" | "YES">("NO");
  const [pensA, setPensA] = useState("");
  const [pensB, setPensB] = useState("");

  const teamAName = prefill.teamAName;
  const teamBName = prefill.teamBName;
  const num = (t: string) => parseInt(t, 10);

  const buildScore = (): ManualScore | null => {
    if (sport === "cricket") {
      const limit = num(oversLimit ?? "");
      if (!limit || !battedFirst) return null;
      const toInnings = (team: "A" | "B", f: typeof EMPTY_INNINGS): ManualInnings | null => {
        if (f.runs === "" || f.wickets === "" || !isValidOversText(f.overs)) return null;
        if (num(f.wickets) > 10 || oversToDecimal(f.overs) > limit) return null;
        return { team, runs: num(f.runs), wickets: num(f.wickets), overs: f.overs };
      };
      const first = toInnings(battedFirst, innings1);
      const second = toInnings(battedFirst === "A" ? "B" : "A", innings2);
      return first && second ? { sport: "cricket", oversLimit: limit, innings: [first, second] } : null;
    }
    if (isRacquetSets || isRacquetGames) {
      const parsed: [number, number][] = [];
      for (const r of rows) {
        if (r.a === "" || r.b === "" || num(r.a) === num(r.b)) return null;
        parsed.push([num(r.a), num(r.b)]);
      }
      return isRacquetSets ? { sport, sets: parsed } : { sport: sport as "badminton" | "pickleball" | "table_tennis", games: parsed };
    }
    if (goalsA === "" || goalsB === "") return null;
    const a = num(goalsA);
    const b = num(goalsB);
    if (a === b && penalties === "YES") {
      if (pensA === "" || pensB === "" || num(pensA) === num(pensB)) return null;
      return { sport: "football", a, b, pensA: num(pensA), pensB: num(pensB) };
    }
    return { sport: "football", a, b };
  };

  const score = buildScore();
  const result = score ? computeManualResult(score) : null;
  const drawNotAllowed = !!result?.isDraw && !allowDraw;
  const tiedSets = !!result?.isDraw && (isRacquetSets || isRacquetGames);
  const isValid = !!score && !!result && !drawNotAllowed && !tiedSets;
  const noun = isRacquetSets ? "Set" : "Game";

  const handleSave = () => {
    if (!score || !result || !isValid) return;
    enterScore.mutate(
      { matchId: prefill.tournamentMatchId, result: { winner: result.winner, isDraw: result.isDraw, manualScore: score } },
      { onSuccess: goBack, onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save the score.")) }
    );
  };

  return (
    <div className="mx-auto max-w-2xl pb-16 lg:px-8">
      <div className="flex items-center gap-1.5 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-0 lg:pt-6">
        <button type="button" onClick={goBack} aria-label="Back" className="rounded-full p-1 hover:bg-gray-100">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink">Enter Score</h1>
          <p className="mt-0.5 text-sm text-muted">Record the final score</p>
        </div>
      </div>

      <div className="px-5 pt-1 lg:px-0">
        <section className="mb-4 rounded-2xl bg-surface p-4 shadow-card">
          <div className="flex items-center">
            <p className="flex-1 truncate text-base font-bold text-ink">{teamAName}</p>
            <span className="mx-2 text-xs font-bold text-muted">VS</span>
            <p className="flex-1 truncate text-right text-base font-bold text-ink">{teamBName}</p>
          </div>
          {(prefill.teamAPlayers.length > 0 || prefill.teamBPlayers.length > 0) && (
            <div className="mt-3 flex gap-2.5 text-xs text-muted">
              <p className="line-clamp-2 flex-1">{prefill.teamAPlayers.map((p) => p.name).join(", ")}</p>
              <p className="line-clamp-2 flex-1 text-right">{prefill.teamBPlayers.map((p) => p.name).join(", ")}</p>
            </div>
          )}
          {prefill.venue ? (
            <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted">
              <Ionicon name="location-outline" size={14} color={colors.muted} />
              <span className="truncate">{prefill.venue}</span>
            </p>
          ) : null}
        </section>

        {sport === "cricket" && (
          <>
            <CardSection icon="baseball-outline" title="Overs per Innings">
              <PillRow options={OVERS_PRESETS.map((n) => ({ label: n, value: n }))} value={OVERS_PRESETS.includes(oversLimit ?? "") ? oversLimit : null} onChange={setOversLimit} />
              <p className="mb-2 mt-3 text-xs text-muted">Or enter a custom number</p>
              <FieldInput value={oversLimit ?? ""} onChange={(e) => setOversLimit(digits(e.target.value))} placeholder="e.g. 15" inputMode="numeric" maxLength={3} aria-label="Overs per innings" />
            </CardSection>
            <CardSection icon="trophy-outline" title="Batted First">
              <PillRow
                options={[
                  { label: teamAName, value: "A" as const },
                  { label: teamBName, value: "B" as const },
                ]}
                value={battedFirst}
                onChange={setBattedFirst}
              />
            </CardSection>
            {battedFirst &&
              (
                [
                  { key: 1, team: battedFirst, state: innings1, set: setInnings1 },
                  { key: 2, team: battedFirst === "A" ? "B" : "A", state: innings2, set: setInnings2 },
                ] as const
              ).map(({ key, team, state, set }) => (
                <CardSection key={key} icon="stats-chart-outline" title={`${team === "A" ? teamAName : teamBName} — ${key === 1 ? "1st" : "2nd"} Innings`}>
                  <div className="flex gap-2.5">
                    <NumberField label="Runs" value={state.runs} onChange={(t) => set({ ...state, runs: digits(t) })} />
                    <NumberField label="Wickets" value={state.wickets} onChange={(t) => set({ ...state, wickets: digits(t, 2) })} maxLength={2} />
                    <NumberField label="Overs" value={state.overs} onChange={(t) => set({ ...state, overs: t.replace(/[^0-9.]/g, "").slice(0, 5) })} placeholder="e.g. 18.3" inputMode="decimal" maxLength={5} />
                  </div>
                  {state.overs !== "" && !isValidOversText(state.overs) ? <InfoBox tone="error" text="Overs must look like 18 or 18.3 (0–5 balls after the dot)." /> : null}
                </CardSection>
              ))}
          </>
        )}

        {(isRacquetSets || isRacquetGames) && (
          <CardSection icon="trophy-outline" title={isRacquetSets ? "Set Scores" : "Game Scores"}>
            {rows.map((row, i) => (
              <ScorePair
                key={i}
                label={`${noun} ${i + 1}`}
                teamAName={teamAName}
                teamBName={teamBName}
                a={row.a}
                b={row.b}
                onA={(v) => setRows(rows.map((r, idx) => (idx === i ? { ...r, a: v } : r)))}
                onB={(v) => setRows(rows.map((r, idx) => (idx === i ? { ...r, b: v } : r)))}
              />
            ))}
            <div className="mt-4 flex gap-2.5">
              {rows.length < (isRacquetSets ? 5 : 7) && (
                <button type="button" onClick={() => setRows([...rows, { a: "", b: "" }])} className="flex items-center gap-1.5 rounded-xl border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-light">
                  <Ionicon name="add" size={16} color={colors.primary} />
                  Add {noun}
                </button>
              )}
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows(rows.slice(0, -1))} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-gray-50">
                  <Ionicon name="remove" size={16} color={colors.muted} />
                  Remove last
                </button>
              )}
            </div>
            {tiedSets ? <InfoBox tone="error" text={`Each ${noun.toLowerCase()} needs a winner, and both teams can't win the same number of ${noun.toLowerCase()}s.`} /> : null}
          </CardSection>
        )}

        {sport === "football" && (
          <>
            <CardSection icon="football-outline" title="Final Score">
              <ScorePair teamAName={teamAName} teamBName={teamBName} a={goalsA} b={goalsB} onA={setGoalsA} onB={setGoalsB} />
            </CardSection>
            {goalsA !== "" && goalsA === goalsB && (
              <CardSection icon="flag-outline" title="Decided on Penalties?">
                <PillRow
                  options={[
                    { label: "No", value: "NO" as const },
                    { label: "Yes", value: "YES" as const },
                  ]}
                  value={penalties}
                  onChange={setPenalties}
                />
                {penalties === "YES" && <ScorePair label="Penalty shootout" teamAName={teamAName} teamBName={teamBName} a={pensA} b={pensB} onA={setPensA} onB={setPensB} />}
              </CardSection>
            )}
          </>
        )}

        {drawNotAllowed ? <InfoBox tone="error" text="A draw isn't allowed for this match — it needs a winner." /> : null}
        {isValid && result && <InfoBox text={result.isDraw ? "Result: Draw" : `Result: ${result.winner === "A" ? teamAName : teamBName} won`} />}

        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || enterScore.isPending}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold ${isValid ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-gray-200 text-muted"}`}
        >
          {enterScore.isPending ? (
            <Spinner size={20} color="white" />
          ) : (
            <>
              <Ionicon name="checkmark" size={16} color={isValid ? "white" : colors.muted} />
              Save Score
            </>
          )}
        </button>
      </div>
    </div>
  );
}
