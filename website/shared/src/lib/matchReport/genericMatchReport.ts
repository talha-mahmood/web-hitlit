import { escapeHtml, reportFooter, wrapReportHtml, teamCrestHtml, SPORT_EMOJI } from "./reportHtml";

export type ReportBreakdownRow = { label: string; scoreA: string; scoreB: string };
export type ReportEventRow = { time: string; team: "A" | "B"; label: string };

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

// Non-cricket sports have no over-by-over/ball-by-ball concept, so their
// report is a single cover page — same branding (title, score summary,
// result, match info) as the cricket report, with a sets/games/goals
// breakdown table in place of cricket's innings scorecards.
export function buildGenericMatchReportHtml(input: {
  sportLabel: string;
  teamAName: string;
  teamBName: string;
  finalScoreA: string;
  finalScoreB: string;
  resultSummary: string | null;
  venue: string | null;
  createdAt: string;
  playMode?: string | null;
  formatLabel?: string | null;
  organiserName: string;
  breakdownTitle: string;
  breakdown: ReportBreakdownRow[];
  eventsTitle?: string;
  events?: ReportEventRow[];
  appName: string;
}): string {
  const matchInfoRows: string[] = [
    `<tr><td class="muted" style="padding:4px 0; width:35%;">Organiser</td><td style="padding:4px 0;">${escapeHtml(input.organiserName)}</td></tr>`,
    `<tr><td class="muted" style="padding:4px 0;">Sport</td><td style="padding:4px 0;">${escapeHtml(input.sportLabel)}</td></tr>`,
  ];
  if (input.formatLabel) {
    matchInfoRows.push(`<tr><td class="muted" style="padding:4px 0;">Format</td><td style="padding:4px 0;">${escapeHtml(input.formatLabel)}</td></tr>`);
  }
  if (input.playMode) {
    matchInfoRows.push(`<tr><td class="muted" style="padding:4px 0;">Play Mode</td><td style="padding:4px 0;">${escapeHtml(input.playMode)}</td></tr>`);
  }
  matchInfoRows.push(
    `<tr><td class="muted" style="padding:4px 0;">Venue</td><td style="padding:4px 0;">${escapeHtml(input.venue ?? "Not specified")}</td></tr>`,
    `<tr><td class="muted" style="padding:4px 0;">Date &amp; Time</td><td style="padding:4px 0;">${formatDateTime(input.createdAt)}</td></tr>`
  );

  const breakdownRows = input.breakdown
    .map(
      (row) => `
      <tr>
        <td style="padding:6px 0;">${escapeHtml(row.label)}</td>
        <td style="padding:6px 0; text-align:center;">${escapeHtml(row.scoreA)}</td>
        <td style="padding:6px 0; text-align:right;">${escapeHtml(row.scoreB)}</td>
      </tr>`
    )
    .join("");

  const eventRows = (input.events ?? [])
    .map(
      (ev) => `
      <tr>
        <td class="muted" style="padding:5px 0; width:60px;">${escapeHtml(ev.time)}</td>
        <td style="padding:5px 0;">${escapeHtml(ev.team === "A" ? input.teamAName : input.teamBName)}</td>
        <td class="muted" style="padding:5px 0; text-align:right;">${escapeHtml(ev.label)}</td>
      </tr>`
    )
    .join("");

  const emoji = SPORT_EMOJI[input.sportLabel.toLowerCase()] ?? "🏆";

  const body = `
    <h1>Match Report</h1>
    <table>
      <tr>
        <td style="width:60%; vertical-align:top;">
          <div class="card">
            <table>
              <tr>
                <td style="display:flex; align-items:center; gap:12px;">
                  <div style="text-align:center;">
                    ${teamCrestHtml("#1D9254", emoji, 40)}
                    <div style="font-weight:700; font-size:11px; margin-top:4px;">${escapeHtml(input.teamAName)}</div>
                  </div>
                  <div class="value">${escapeHtml(input.finalScoreA)}</div>
                </td>
              </tr>
              <tr><td style="height:10px;"></td></tr>
              <tr>
                <td style="display:flex; align-items:center; gap:12px;">
                  <div style="text-align:center;">
                    ${teamCrestHtml("#1D4ED8", emoji, 40)}
                    <div style="font-weight:700; font-size:11px; margin-top:4px;">${escapeHtml(input.teamBName)}</div>
                  </div>
                  <div class="value">${escapeHtml(input.finalScoreB)}</div>
                </td>
              </tr>
            </table>
          </div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:36%; vertical-align:top;">
          <div class="card">
            <div class="label">Result</div>
            <div class="value">${escapeHtml(input.resultSummary ?? "In progress")}</div>
          </div>
        </td>
      </tr>
    </table>

    <h2>Match Information</h2>
    <div class="card"><table>${matchInfoRows.join("")}</table></div>

    ${
      input.breakdown.length > 0
        ? `<h2>${escapeHtml(input.breakdownTitle)}</h2>
    <div class="card">
      <table>
        <tr style="color:#6B7280; font-size:11px; border-bottom:1px solid #D1D5DB;">
          <td style="padding-bottom:4px;"></td>
          <td style="text-align:center;">${escapeHtml(input.teamAName)}</td>
          <td style="text-align:right;">${escapeHtml(input.teamBName)}</td>
        </tr>
        ${breakdownRows}
      </table>
    </div>`
        : ""
    }

    ${
      eventRows
        ? `<h2>${escapeHtml(input.eventsTitle ?? "Timeline")}</h2>
    <div class="card"><table>${eventRows}</table></div>`
        : ""
    }

    ${reportFooter(input.appName)}
  `;

  return wrapReportHtml(body);
}
