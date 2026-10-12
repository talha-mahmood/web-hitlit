import type { CricketMatchDetail } from "../api/cricket";
import { ballRowToEvent } from "../api/cricket";
import {
  createInitialInningsState,
  applyBall,
  replayInnings,
  formatOvers,
  computeRunRate,
  type InningsState,
  type BallEvent,
} from "../cricketScoring";
import { escapeHtml, reportFooter, wrapReportHtml, teamCrestHtml, SPORT_EMOJI } from "./reportHtml";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function overFormatLabel(oversLimit: number): string {
  if (oversLimit === 20) return "T20";
  if (oversLimit === 10) return "T10";
  if (oversLimit === 50) return "ODI";
  return `${oversLimit}-Over`;
}

// One ball's short scorecard symbol — "0".."6" for a plain run, "W" for a
// wicket, "Wd"/"N"/"B"/"L" (prefixed with any extra runs run on top of the
// mandatory one) for wides/no-balls/byes/leg-byes, matching the shorthand a
// printed cricket scorecard uses.
function ballSymbol(ball: BallEvent): string {
  if (ball.extraType === "WIDE") return ball.extraRuns > 1 ? `${ball.extraRuns - 1}+Wd` : "Wd";
  if (ball.extraType === "NOBALL") return ball.runsBatted > 0 ? `${ball.runsBatted}N` : "N";
  if (ball.extraType === "BYE") return `${ball.extraRuns}B`;
  if (ball.extraType === "LEGBYE") return `${ball.extraRuns}L`;
  if (ball.extraType === "PENALTY") return `P${ball.extraRuns >= 0 ? "+" : ""}${ball.extraRuns}`;
  if (ball.isWicket) return "W";
  return `${ball.runsBatted}`;
}

type OverRow = {
  overNumber: number;
  symbols: string[];
  batters: { name: string; runs: number; balls: number }[];
  bowler: { name: string; overs: string; maidens: number; runs: number; wickets: number };
  overRuns: number;
  cumulativeRuns: number;
  cumulativeWickets: number;
};

// Re-plays the innings ball by ball (same engine the live scorer and
// InningsCard both use — see cricketScoring.ts) but snapshots the state at
// the end of every completed over, instead of only the final totals, so the
// PDF can show an over-by-over breakdown alongside the full scorecard.
function buildOverRows(
  balls: BallEvent[],
  battingTeam: "A" | "B",
  oversLimit: number,
  totalPlayers: number,
  lastManStand: boolean
): OverRow[] {
  if (balls.length === 0) return [];
  let state = createInitialInningsState(
    battingTeam,
    oversLimit,
    totalPlayers,
    balls[0].strikerName,
    balls[0].nonStrikerName ?? "",
    0,
    lastManStand
  );
  const rows: OverRow[] = [];
  let symbols: string[] = [];
  let overStartRuns = 0;

  for (const ball of balls) {
    const prevBallsInOver = state.ballsInCurrentOver;
    const isLegal = ball.extraType !== "WIDE" && ball.extraType !== "NOBALL" && ball.extraType !== "PENALTY";
    state = applyBall(state, ball);
    symbols.push(ballSymbol(ball));

    if (isLegal && state.ballsInCurrentOver === 0 && prevBallsInOver === 5) {
      const bowlerStat = state.bowlingStats[ball.bowlerName];
      const batters = [state.striker, state.nonStriker]
        .filter((n): n is string => !!n)
        .map((n) => {
          const s = state.battingStats[n];
          return { name: s.name, runs: s.runs, balls: s.balls };
        });
      rows.push({
        overNumber: rows.length + 1,
        symbols,
        batters,
        bowler: {
          name: ball.bowlerName,
          overs: formatOvers(bowlerStat.legalBalls),
          maidens: bowlerStat.maidens,
          runs: bowlerStat.runsConceded,
          wickets: bowlerStat.wickets,
        },
        overRuns: state.runs - overStartRuns,
        cumulativeRuns: state.runs,
        cumulativeWickets: state.wickets,
      });
      symbols = [];
      overStartRuns = state.runs;
    }
  }
  return rows;
}

function inningsScorecardHtml(teamName: string, state: InningsState): string {
  const runRate = computeRunRate(state.runs, state.legalBalls);
  const battingRows = state.battingOrder
    .map((name) => {
      const s = state.battingStats[name];
      const sr = s.balls > 0 ? (s.runs / s.balls) * 100 : 0;
      return `
        <tr>
          <td style="padding:7px 0; font-weight:700;">${escapeHtml(name)}</td>
          <td style="padding:7px 0; color:#6B7280;">${s.isOut ? escapeHtml(s.outDescription ?? "out") : "not out"}</td>
          <td style="padding:7px 0; text-align:center;">${s.runs}</td>
          <td style="padding:7px 0; text-align:center;">${s.balls}</td>
          <td style="padding:7px 0; text-align:center;">${s.fours}</td>
          <td style="padding:7px 0; text-align:center;">${s.sixes}</td>
          <td style="padding:7px 0; text-align:center;">${sr.toFixed(1)}</td>
        </tr>`;
    })
    .join("");

  const bowlingRows = state.bowlingOrder
    .map((name) => {
      const b = state.bowlingStats[name];
      const econ = b.legalBalls > 0 ? (b.runsConceded / b.legalBalls) * 6 : 0;
      return `
        <tr>
          <td style="padding:7px 0; font-weight:700;">${escapeHtml(name)}</td>
          <td style="padding:7px 0; text-align:center;">${formatOvers(b.legalBalls)}</td>
          <td style="padding:7px 0; text-align:center;">${b.maidens}</td>
          <td style="padding:7px 0; text-align:center;">${b.runsConceded}</td>
          <td style="padding:7px 0; text-align:center;">${b.wickets}</td>
          <td style="padding:7px 0; text-align:center;">${econ.toFixed(1)}</td>
        </tr>`;
    })
    .join("");

  const extrasTotal = state.extras.wide + state.extras.noball + state.extras.bye + state.extras.legbye;
  const fow = state.fallOfWickets
    .map((f) => `${f.teamScore}-${f.wicketNumber} (${escapeHtml(f.playerOut)}, ${f.overs})`)
    .join(", ");

  return `
    <div class="card" style="margin-bottom:16px;">
      <table>
        <tr>
          <td style="font-weight:700; font-size:14px;">${escapeHtml(teamName)}</td>
          <td style="text-align:right; font-weight:700; font-size:14px;">${state.runs}-${state.wickets} (${formatOvers(state.legalBalls)})</td>
        </tr>
      </table>
      <table style="margin-top:10px;">
        <tr style="color:#0E5C34; font-size:11px; font-weight:700;">
          <td style="padding-bottom:5px; border-bottom:1px solid #D1D5DB;">${escapeHtml(teamName)}</td>
          <td style="border-bottom:1px solid #D1D5DB;"></td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">R</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">B</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">4s</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">6s</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">SR</td>
        </tr>
        ${battingRows}
      </table>
      <table style="margin-top:8px;">
        <tr><td class="muted">Extras (B ${state.extras.bye} | LB ${state.extras.legbye} | WD ${state.extras.wide} | NB ${state.extras.noball})</td><td style="text-align:right;">${extrasTotal}</td></tr>
        <tr><td style="font-weight:700;">Total</td><td style="text-align:right; font-weight:700;">${state.runs}/${state.wickets} · Run Rate ${runRate.toFixed(2)}</td></tr>
      </table>
      ${fow ? `<div style="margin-top:8px;"><div class="label">Fall Of Wickets</div><div class="muted">${fow}</div></div>` : ""}
      ${
        bowlingRows
          ? `<table style="margin-top:10px;">
        <tr style="color:#0E5C34; font-size:11px; font-weight:700;">
          <td style="padding-bottom:5px; border-bottom:1px solid #D1D5DB;">Bowler</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">O</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">M</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">R</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">W</td>
          <td style="text-align:center; border-bottom:1px solid #D1D5DB;">Eco</td>
        </tr>
        ${bowlingRows}
      </table>`
          : ""
      }
    </div>`;
}

function overComparisonRowHtml(row: OverRow | undefined): string {
  if (!row) return `<div class="card" style="visibility:hidden;"></div>`;
  const batterLines = row.batters.map((b) => `<div>${escapeHtml(b.name)} ${b.runs}(${b.balls})</div>`).join("");
  return `
    <div class="card" style="margin-bottom:10px;">
      <div style="font-weight:700; font-size:11px; letter-spacing:0.5px;">${row.symbols.map(escapeHtml).join("  ")}</div>
      <div style="margin-top:6px; font-size:12px;">${batterLines}</div>
      <div style="margin-top:4px; font-size:12px;">${escapeHtml(row.bowler.name)}</div>
      <div class="muted" style="font-size:11px;">${row.bowler.overs} - ${row.bowler.maidens} - ${row.bowler.runs} - ${row.bowler.wickets}</div>
      <table style="margin-top:6px; font-size:11px;" class="muted">
        <tr>
          <td>Overs ${row.overNumber}</td>
          <td>Runs ${row.overRuns}</td>
          <td style="text-align:right; font-weight:700; color:#111827;">Score ${row.cumulativeRuns}-${row.cumulativeWickets}</td>
        </tr>
      </table>
    </div>`;
}

export function buildCricketMatchReportHtml(
  match: CricketMatchDetail,
  opts: { organiserName: string; appName: string }
): string {
  const innings = [...match.cricket_innings]
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((inn) => {
      const balls = [...inn.cricket_balls].sort((a, b) => a.seq - b.seq).map(ballRowToEvent);
      const teamName = inn.batting_team === "A" ? match.team_a_name : match.team_b_name;
      const totalPlayers = inn.batting_team === "A" ? match.team_a_players.length : match.team_b_players.length;
      const state = balls.length
        ? replayInnings(
            balls,
            inn.batting_team as "A" | "B",
            match.overs_limit,
            totalPlayers,
            balls[0].strikerName,
            balls[0].nonStrikerName ?? "",
            0,
            match.last_man_stand
          )
        : null;
      const overRows = buildOverRows(balls, inn.batting_team as "A" | "B", match.overs_limit, totalPlayers, match.last_man_stand);
      return { inn, teamName, state, overRows };
    })
    .filter((x): x is typeof x & { state: InningsState } => x.state !== null);

  // Player of the Match: a simple runs + 20-per-wicket heuristic across both
  // innings — the app doesn't track an explicit MVP pick, so this is a
  // reasonable stand-in rather than leaving the field blank.
  let potm: { name: string; score: number } | null = null;
  for (const { state } of innings) {
    for (const name of state.battingOrder) {
      const s = state.battingStats[name];
      const score = s.runs;
      if (!potm || score > potm.score) potm = { name, score };
    }
    for (const name of state.bowlingOrder) {
      const b = state.bowlingStats[name];
      const score = b.wickets * 20 - b.runsConceded * 0.2;
      if (!potm || score > potm.score) potm = { name, score };
    }
  }

  const tossWinnerName = match.toss_winner === "A" ? match.team_a_name : match.team_b_name;
  const matchIdShort = match.id.replace(/-/g, "").slice(0, 8);
  const maxPlayers = Math.max(match.team_a_players.length, match.team_b_players.length);

  const summaryCards = innings
    .map(({ teamName, state }) => {
      const topBatters = [...state.battingOrder]
        .sort((a, b) => state.battingStats[b].runs - state.battingStats[a].runs)
        .slice(0, 3);
      const topBowlers = [...state.bowlingOrder]
        .sort((a, b) => state.bowlingStats[b].wickets - state.bowlingStats[a].wickets)
        .slice(0, 3);
      const rows = Array.from({ length: Math.max(topBatters.length, topBowlers.length) }, (_, i) => {
        const bat = topBatters[i] ? state.battingStats[topBatters[i]] : null;
        const bowl = topBowlers[i] ? state.bowlingStats[topBowlers[i]] : null;
        return `
          <tr>
            <td style="padding:5px 0; color:#0E5C34;">${bat ? `${escapeHtml(bat.name)} ${bat.runs}${bat.isOut ? "" : "*"}(${bat.balls})` : ""}</td>
            <td style="padding:5px 0; text-align:right; color:#0E5C34;">${bowl ? `${escapeHtml(bowl.name)} ${bowl.wickets}-${bowl.runsConceded}` : ""}</td>
          </tr>`;
      }).join("");
      return `
        <div style="margin-bottom:14px;">
          <table>
            <tr>
              <td style="font-weight:700; padding-bottom:6px; border-bottom:1px solid #D1D5DB;">${escapeHtml(teamName)}</td>
              <td style="text-align:right; font-weight:700; padding-bottom:6px; border-bottom:1px solid #D1D5DB;">${state.runs}-${state.wickets} (${formatOvers(state.legalBalls)})</td>
            </tr>
          </table>
          <table style="margin-top:2px;">${rows}</table>
        </div>`;
    })
    .join("");

  const scoreCards = innings
    .map(
      ({ teamName, state }, i) => `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:${innings.length > 1 ? "10px" : "0"};">
          <div style="text-align:center;">
            ${teamCrestHtml(i === 0 ? "#1D9254" : "#1D4ED8", SPORT_EMOJI.cricket, 40)}
            <div style="font-weight:700; font-size:11px; margin-top:4px;">${escapeHtml(teamName)}</div>
          </div>
          <div>
            <div class="value">${state.runs}-${state.wickets} in ${formatOvers(state.legalBalls)} overs</div>
          </div>
        </div>`
    )
    .join("");

  const overComparisonHtml =
    innings.length === 2
      ? (() => {
          const [first, second] = innings;
          const maxOvers = Math.max(first.overRows.length, second.overRows.length);
          const rows = Array.from({ length: maxOvers }, (_, i) => `
            <tr>
              <td style="width:50%; vertical-align:top; padding-right:6px;">${overComparisonRowHtml(first.overRows[i])}</td>
              <td style="width:50%; vertical-align:top; padding-left:6px;">${overComparisonRowHtml(second.overRows[i])}</td>
            </tr>`).join("");
          return `
            <div class="page-break"></div>
            <h2>Over Comparison</h2>
            <table>
              <tr>
                <td style="width:50%; font-weight:700; padding-bottom:6px;">${escapeHtml(first.teamName)}</td>
                <td style="width:50%; font-weight:700; padding-bottom:6px;">${escapeHtml(second.teamName)}</td>
              </tr>
              ${rows}
            </table>`;
        })()
      : "";

  const body = `
    <h1>Match Report</h1>
    <table>
      <tr>
        <td style="width:60%; vertical-align:top;">
          <div class="card">${scoreCards}</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:36%; vertical-align:top;">
          <div class="card">
            <div class="label">Result</div>
            <div class="value" style="margin-bottom:10px;">${escapeHtml(match.result_summary ?? "In progress")}</div>
            ${potm ? `<div class="label">Player Of The Match</div><div class="value">${escapeHtml(potm.name)}</div>` : ""}
          </div>
        </td>
      </tr>
    </table>

    <h2>Match Information</h2>
    <div class="card">
      <table>
        <tr><td class="muted" style="padding:4px 0; width:35%;">Organiser</td><td style="padding:4px 0;">${escapeHtml(opts.organiserName)}</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Match Format</td><td style="padding:4px 0;">${overFormatLabel(match.overs_limit)}</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Playing</td><td style="padding:4px 0;">${maxPlayers} Per Side</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Overs</td><td style="padding:4px 0;">${match.overs_limit}</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Venue</td><td style="padding:4px 0;">${escapeHtml(match.venue ?? "Not specified")}</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Date &amp; Time</td><td style="padding:4px 0;">${formatDateTime(match.created_at)}</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Toss</td><td style="padding:4px 0;">${escapeHtml(tossWinnerName)} Opted To ${match.toss_decision === "BAT" ? "Bat" : "Bowl"}</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Scorer</td><td style="padding:4px 0;">${escapeHtml(opts.organiserName)}</td></tr>
        <tr><td class="muted" style="padding:4px 0;">Match ID</td><td style="padding:4px 0;">${matchIdShort}</td></tr>
      </table>
    </div>

    <h2>Match Summary</h2>
    <div class="card">${summaryCards}</div>

    <div class="page-break"></div>
    <h2>Innings Scorecards</h2>
    ${innings.map(({ teamName, inn, state }) => `
      <div style="margin-bottom:6px; font-weight:700; color:#0E5C34;">${inn.innings_number === 1 ? "1st" : "2nd"} Innings — ${escapeHtml(teamName)}</div>
      ${inningsScorecardHtml(teamName, state)}
    `).join("")}

    ${overComparisonHtml}

    ${reportFooter(opts.appName)}
  `;

  return wrapReportHtml(body);
}
