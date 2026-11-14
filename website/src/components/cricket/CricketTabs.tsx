import { colors } from "@app/constants/theme";
import { ballRowToEvent, type CricketMatchDetail, type CricketInnings, type CricketBallRow } from "@app/lib/api/cricket";
import { replayInnings, formatOvers, computeRunRate, groupBallsByOver, type BallEvent, type InningsState } from "@app/lib/cricketScoring";
import { describeBallCommentary, computePartnerships, computePlayerOfTheMatch } from "@app/lib/cricketCommentary";
import { Ionicon } from "../icons/Icon";
import Spinner from "../ui/Spinner";
import { TeamCrest, TEAM_A_COLOR, TEAM_B_COLOR } from "../scorecard/ScorecardParts";

// Short label for one delivery — Wd/Nb/B/Lb/P shorthand for extras, the
// runs scored, or "W" (an extra that was also a run out keeps its shorthand).
export function ballLabel(b: BallEvent): string {
  const extraLabel =
    b.extraType === "WIDE"
      ? `Wd${b.extraRuns > 1 ? "+" + (b.extraRuns - 1) : ""}`
      : b.extraType === "NOBALL"
        ? `Nb${b.runsBatted > 0 ? "+" + b.runsBatted : ""}`
        : b.extraType === "BYE"
          ? `B${b.extraRuns}`
          : b.extraType === "LEGBYE"
            ? `Lb${b.extraRuns}`
            : b.extraType === "PENALTY"
              ? `P${b.extraRuns >= 0 ? "+" : ""}${b.extraRuns}`
              : null;
  if (b.isWicket) return extraLabel ? `${extraLabel} W` : "W";
  return extraLabel ?? String(b.runsBatted);
}

export function PlayerInitialAvatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-primary-light font-bold text-primary-dark" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// Rounded segmented toggle (Scorecard team switcher, Balls innings switcher).
export function SegmentedPill({ options, selected, onSelect }: { options: { key: string; label: string }[]; selected: string; onSelect: (key: string) => void }) {
  return (
    <div role="tablist" className="mb-4 flex rounded-full bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={selected === o.key}
          onClick={() => onSelect(o.key)}
          className={`flex-1 truncate rounded-full py-2.5 text-xs font-bold transition ${selected === o.key ? "bg-primary text-white" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const th = "pb-2 text-center text-xs font-semibold text-muted";
const td = "py-2.5 text-center text-sm text-ink";

// One innings' full batting/bowling card with extras, Did Not Bat, fall of
// wickets and partnerships.
export function InningsCard({ teamName, inningsNumber, color, state, balls, allPlayers }: { teamName: string; inningsNumber: number; color: string; state: InningsState; balls: BallEvent[]; allPlayers: string[] }) {
  const runRate = computeRunRate(state.runs, state.legalBalls);
  const didNotBat = allPlayers.filter((n) => !state.battingOrder.includes(n));
  const extrasTotal = state.extras.bye + state.extras.wide + state.extras.noball + state.extras.legbye;
  const extrasParts = [
    state.extras.bye > 0 ? `B ${state.extras.bye}` : null,
    state.extras.wide > 0 ? `WD ${state.extras.wide}` : null,
    state.extras.noball > 0 ? `NB ${state.extras.noball}` : null,
    state.extras.legbye > 0 ? `LB ${state.extras.legbye}` : null,
  ].filter((p): p is string => !!p);
  const partnerships = computePartnerships(balls);

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TeamCrest color={color} size={36} icon="cricket" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink">{teamName}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {inningsNumber === 1 ? "1st" : "2nd"} Innings · {state.isComplete ? "Completed" : "Batting"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-extrabold text-ink">
            {state.runs}/{state.wickets}
          </p>
          <p className="text-xs text-muted">
            ({formatOvers(state.legalBalls)} ov, RR {runRate.toFixed(2)})
          </p>
        </div>
      </div>

      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[320px]">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left text-xs font-semibold text-muted">Batsman</th>
              <th className={`${th} w-10`}>R</th>
              <th className={`${th} w-9`}>B</th>
              <th className={`${th} w-8`}>4s</th>
              <th className={`${th} w-8`}>6s</th>
              <th className={`${th} w-11`}>SR</th>
            </tr>
          </thead>
          <tbody>
            {state.battingOrder.map((name) => {
              const s = state.battingStats[name];
              const sr = s.balls > 0 ? (s.runs / s.balls) * 100 : 0;
              return (
                <tr key={name} className="border-b border-border">
                  <td className="max-w-0 py-2.5">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{s.isOut ? s.outDescription : "not out"}</p>
                  </td>
                  <td className={`${td} font-semibold`}>{s.runs}</td>
                  <td className={td}>{s.balls}</td>
                  <td className={td}>{s.fours}</td>
                  <td className={td}>{s.sixes}</td>
                  <td className={td}>{sr.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">Extras</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{extrasTotal}</p>
              <p className="mt-2.5 text-xs font-bold" style={{ color }}>
                Total
              </p>
              <p className="text-base font-extrabold" style={{ color }}>
                {state.runs}/{state.wickets}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Overs</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{formatOvers(state.legalBalls)}</p>
              <p className="mt-2.5 text-xs text-muted">Run Rate</p>
              <p className="text-sm font-semibold text-ink">{runRate.toFixed(1)}</p>
            </div>
          </div>
          {extrasParts.length > 0 && <p className="mt-3 text-xs text-muted">{extrasParts.join(" | ")}</p>}
        </div>
        {didNotBat.length > 0 && <p className="mt-2.5 line-clamp-2 text-xs text-muted">Did Not Bat - {didNotBat.join(", ")}</p>}

        {state.bowlingOrder.length > 0 && (
          <table className="mt-2 w-full min-w-[320px]">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pt-4 text-left text-xs font-semibold text-muted">Bowler</th>
                <th className={`${th} w-10 pt-4`}>O</th>
                <th className={`${th} w-8 pt-4`}>M</th>
                <th className={`${th} w-8 pt-4`}>R</th>
                <th className={`${th} w-8 pt-4`}>W</th>
                <th className={`${th} w-11 pt-4`}>Eco</th>
              </tr>
            </thead>
            <tbody>
              {state.bowlingOrder.map((name) => {
                const b = state.bowlingStats[name];
                const econ = b.legalBalls > 0 ? (b.runsConceded / b.legalBalls) * 6 : 0;
                return (
                  <tr key={name} className="border-b border-border">
                    <td className="max-w-0 truncate py-2.5 text-sm font-semibold text-ink">{name}</td>
                    <td className={td}>{formatOvers(b.legalBalls)}</td>
                    <td className={td}>{b.maidens}</td>
                    <td className={td}>{b.runsConceded}</td>
                    <td className={td}>{b.wickets}</td>
                    <td className={td}>{econ.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {state.fallOfWickets.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-ink">Fall of wickets</p>
            {state.fallOfWickets.map((f, i) => (
              <div key={i} className={`flex items-center justify-between py-2 ${i < state.fallOfWickets.length - 1 ? "border-b border-border" : ""}`}>
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="w-[18px] text-xs font-semibold text-muted">{f.wicketNumber}</span>
                  <span className="truncate text-sm font-semibold uppercase text-ink">{f.playerOut}</span>
                </span>
                <span className="text-sm text-ink">
                  {f.teamScore} ({f.overs})
                </span>
              </div>
            ))}
          </div>
        )}

        {partnerships.length > 0 && (
          <div className="mb-1 mt-4">
            <p className="mb-2 text-sm font-bold text-ink">Partnership</p>
            {partnerships.map((p, i) => {
              const statA = state.battingStats[p.batsmanA];
              const statB = p.batsmanB ? state.battingStats[p.batsmanB] : undefined;
              return (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold uppercase text-ink">{p.batsmanA}</p>
                    {statA && (
                      <p className="mt-0.5 text-xs text-muted">
                        {statA.runs}({statA.balls})
                      </p>
                    )}
                  </div>
                  <div className="flex w-[70px] flex-col items-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] text-sm font-extrabold" style={{ borderColor: color, color }}>
                      {p.runs}
                    </span>
                    <span className="mt-1 text-[10px] text-muted">{p.balls} Balls</span>
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    {p.batsmanB && (
                      <>
                        <p className="truncate text-sm font-semibold uppercase text-ink">{p.batsmanB}</p>
                        {statB && (
                          <p className="mt-0.5 text-xs text-muted">
                            {statB.runs}({statB.balls})
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export type ScorecardInningsEntry = {
  inn: CricketInnings & { cricket_balls: CricketBallRow[] };
  teamName: string;
  state: InningsState;
};

const teamColor = (letter: string) => (letter === "A" ? TEAM_A_COLOR : TEAM_B_COLOR);

function EmptyBalls() {
  return <p className="mt-10 text-center text-sm text-muted">No balls bowled yet.</p>;
}

// Completed-match Summary: each side's score with its top 3 batters against
// the opposing top 3 bowlers, Winner, Player of the Match, share actions.
export function SummaryTab({
  match,
  scorecardInnings,
  onShareReport,
  generatingReport,
  onShareSummary,
  generatingSummaryImage,
}: {
  match: CricketMatchDetail;
  scorecardInnings: ScorecardInningsEntry[];
  onShareReport: () => void;
  generatingReport: boolean;
  onShareSummary: () => void;
  generatingSummaryImage: boolean;
}) {
  if (scorecardInnings.length === 0) return <EmptyBalls />;
  const potm = computePlayerOfTheMatch(scorecardInnings);
  const [first, second] = scorecardInnings;
  let winnerName: string | null = null;
  let winnerColor = TEAM_A_COLOR;
  if (first && second) {
    if (second.state.runs > first.state.runs) {
      winnerName = second.teamName;
      winnerColor = teamColor(second.inn.batting_team);
    } else if (first.state.runs > second.state.runs) {
      winnerName = first.teamName;
      winnerColor = teamColor(first.inn.batting_team);
    }
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {scorecardInnings.map((si) => {
          const color = teamColor(si.inn.batting_team);
          const opposing = scorecardInnings.find((o) => o.inn.id !== si.inn.id);
          const topBatters = si.state.battingOrder
            .map((n) => si.state.battingStats[n])
            .sort((a, b) => b.runs - a.runs)
            .slice(0, 3);
          const topBowlers = opposing
            ? opposing.state.bowlingOrder
                .map((n) => opposing.state.bowlingStats[n])
                .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
                .slice(0, 3)
            : [];
          return (
            <section key={si.inn.id} className="rounded-2xl bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <TeamCrest color={color} size={32} icon="cricket" />
                  <p className="truncate text-base font-bold uppercase" style={{ color }}>
                    {si.teamName}
                  </p>
                </div>
                <p className="shrink-0 text-base font-extrabold" style={{ color }}>
                  {si.state.runs}-{si.state.wickets} <span className="text-xs font-semibold text-muted">({formatOvers(si.state.legalBalls)})</span>
                </p>
              </div>
              <div className="mb-2 h-px bg-border" />
              {Array.from({ length: Math.max(topBatters.length, topBowlers.length) }, (_, row) => (
                <div key={row} className="flex items-center justify-between gap-2 py-1.5 text-sm text-ink">
                  <span className="min-w-0 flex-1 truncate">{topBatters[row] ? `${topBatters[row].name} ${topBatters[row].runs}(${topBatters[row].balls})` : ""}</span>
                  <span className="min-w-0 flex-1 truncate text-right">{topBowlers[row] ? `${topBowlers[row].name} ${topBowlers[row].wickets}-${topBowlers[row].runsConceded}` : ""}</span>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {winnerName && (
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
            <TeamCrest color={winnerColor} size={44} icon="cricket" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Winner</p>
              <p className="mt-0.5 line-clamp-2 text-base font-bold text-ink">{match.result_summary ?? `${winnerName} won`}</p>
            </div>
          </div>
        )}
        {potm && (
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light">
              <Ionicon name="person" size={22} color={colors.primaryDark} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Player Of The Match</p>
              <p className="mt-0.5 truncate text-base font-bold text-ink">{potm}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onShareReport} disabled={generatingReport} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-border py-3.5 text-sm font-semibold text-ink hover:bg-gray-50">
          {generatingReport ? (
            <Spinner size={18} />
          ) : (
            <>
              <Ionicon name="document-text-outline" size={18} color={colors.primary} />
              Share Match Report
            </>
          )}
        </button>
        <button type="button" onClick={onShareSummary} disabled={generatingSummaryImage} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-border py-3.5 text-sm font-semibold text-ink hover:bg-gray-50">
          {generatingSummaryImage ? (
            <Spinner size={18} color={colors.ink} />
          ) : (
            <>
              <Ionicon name="share-social-outline" size={18} color={colors.ink} />
              Share Match Summary
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Completed-match Balls: reverse-chronological, over-grouped commentary for
// the selected innings, each over headed by a snapshot replayed to its end.
export function BallsTab({ match, scorecardInnings, selectedInningsNumber, onSelectInnings }: { match: CricketMatchDetail; scorecardInnings: ScorecardInningsEntry[]; selectedInningsNumber: number; onSelectInnings: (n: number) => void }) {
  if (scorecardInnings.length === 0) return <EmptyBalls />;
  const selected = scorecardInnings.find((si) => si.inn.innings_number === selectedInningsNumber) ?? scorecardInnings[scorecardInnings.length - 1];
  const battingTeamLetter = selected.inn.batting_team as "A" | "B";
  const battingPlayers = battingTeamLetter === "A" ? match.team_a_players : match.team_b_players;
  const startingRuns = battingTeamLetter === "A" ? match.team_a_penalty_runs : match.team_b_penalty_runs;
  const chronBalls = [...selected.inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
  const overs = groupBallsByOver(chronBalls);

  let consumed = 0;
  const overGroups = overs.map((over, overIdx) => {
    consumed += over.length;
    const snapshot = replayInnings(chronBalls.slice(0, consumed), battingTeamLetter, match.overs_limit, battingPlayers.length, chronBalls[0].strikerName, chronBalls[0].nonStrikerName ?? "", startingRuns, match.last_man_stand);
    let legalSoFar = 0;
    const labeled = over.map((b) => {
      const label = `${overIdx + 1}.${legalSoFar + 1}`;
      if (b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY") legalSoFar += 1;
      return { ball: b, label };
    });
    return { over: labeled, state: snapshot, runsInOver: over.reduce((s, b) => s + b.runsBatted + b.extraRuns, 0) };
  });

  return (
    <div>
      {scorecardInnings.length > 1 && (
        <SegmentedPill
          options={scorecardInnings.map((si) => ({ key: String(si.inn.innings_number), label: si.inn.innings_number === 1 ? "1st Innings" : "2nd Innings" }))}
          selected={String(selectedInningsNumber)}
          onSelect={(k) => onSelectInnings(Number(k))}
        />
      )}
      {[...overGroups].reverse().map((group, gi) => {
        const lastBall = group.over[group.over.length - 1].ball;
        const strikerStat = group.state.striker ? group.state.battingStats[group.state.striker] : undefined;
        const nonStrikerStat = group.state.nonStriker ? group.state.battingStats[group.state.nonStriker] : undefined;
        const bowlerStat = group.state.bowlingStats[lastBall.bowlerName];
        return (
          <div key={gi} className="mb-[18px]">
            <div className="mb-2 rounded-2xl bg-gray-50 px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm font-semibold text-ink">
                  {group.state.striker && (
                    <p className="truncate">
                      {group.state.striker} {strikerStat ? `${strikerStat.runs}(${strikerStat.balls})` : ""}
                    </p>
                  )}
                  {group.state.nonStriker && (
                    <p className="mt-0.5 truncate">
                      {group.state.nonStriker} {nonStrikerStat ? `${nonStrikerStat.runs}(${nonStrikerStat.balls})` : ""}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="truncate text-sm font-semibold text-ink">{lastBall.bowlerName}</p>
                  {bowlerStat && (
                    <p className="mt-0.5 text-xs text-muted">
                      {formatOvers(bowlerStat.legalBalls)} - {bowlerStat.maidens} - {bowlerStat.runsConceded} - {bowlerStat.wickets}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-xs font-semibold text-muted">
                <span>Overs {formatOvers(group.state.legalBalls)}</span>
                <span>Runs {group.runsInOver}</span>
                <span>
                  Score {group.state.runs}-{group.state.wickets}
                </span>
              </div>
            </div>
            {[...group.over].reverse().map(({ ball, label }, bi) => (
              <div key={bi} className={`flex items-start gap-2.5 py-2.5 ${bi < group.over.length - 1 ? "border-b border-border" : ""}`}>
                <span className="mt-0.5 w-8 text-xs font-semibold text-muted">{label}</span>
                <span
                  className="flex shrink-0 items-center justify-center rounded-full text-center text-[11px] font-bold"
                  style={{ width: ball.isWicket ? 30 : 26, height: ball.isWicket ? 30 : 26, backgroundColor: ball.isWicket ? colors.danger : "#E5E7EB", color: ball.isWicket ? "white" : colors.ink }}
                >
                  {ballLabel(ball)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {ball.bowlerName} to {ball.strikerName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{describeBallCommentary(ball)}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Completed-match Info: match metadata already on hand.
export function InfoTab({ match }: { match: CricketMatchDetail }) {
  const rows = [
    { label: "Venue", value: match.venue || "Not set" },
    { label: "Overs", value: `${match.overs_limit} overs` },
    { label: "Toss", value: match.toss_winner ? `${match.toss_winner} chose to ${match.toss_decision ?? "—"}` : "—" },
    { label: "Last Man Stand", value: match.last_man_stand ? "On" : "Off" },
    { label: "Scoring Code", value: match.scoring_code ?? "—" },
    { label: "Completed", value: match.completed_at ? new Date(match.completed_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }) : "—" },
  ];
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card lg:max-w-xl">
      {rows.map((r, i) => (
        <div key={r.label} className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
          <span className="text-sm text-muted">{r.label}</span>
          <span className="truncate text-sm font-semibold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
