import { forwardRef } from "react";
import { Ionicon } from "../icons/Icon";

// Port of MatchSummaryShareCard: a fixed 1080px-wide "SUMMARY" card that's
// rendered off-screen and rasterised to a PNG for sharing.
const CARD_W = 1080;
const NAVY_DARK = "#0E2229";
const NAVY = "#123036";
const TEAL = "#3FD0BE";
const TEAL_SOFT = "#9FD9CE";
const MUTED = "#8FA7AE";

export type ShareCardStat = { name: string; statLabel: string };
export type ShareCardInningsEntry = { teamName: string; score: string; oversLabel: string; topBatters: ShareCardStat[]; topBowlers: ShareCardStat[] };

function TeamSection({ entry }: { entry: ShareCardInningsEntry }) {
  const rowCount = Math.max(entry.topBatters.length, entry.topBowlers.length);
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 18 }}>
        <span style={{ flex: 1, color: TEAL, fontSize: 32, fontWeight: 800, letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.teamName.toUpperCase()}</span>
        <span style={{ display: "flex", alignItems: "baseline", marginRight: 36 }}>
          <span style={{ color: TEAL_SOFT, fontSize: 18, fontWeight: 600, marginRight: 8 }}>Overs</span>
          <span style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 700 }}>{entry.oversLabel}</span>
        </span>
        <span style={{ color: "#FFFFFF", fontSize: 42, fontWeight: 800, lineHeight: 1 }}>{entry.score}</span>
      </div>
      {Array.from({ length: rowCount }, (_, i) => {
        const batter = entry.topBatters[i];
        const bowler = entry.topBowlers[i];
        const cell = { color: "#FFFFFF", fontSize: 19 } as const;
        return (
          <div key={i} style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "16px 20px", marginBottom: 6 }}>
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between", paddingRight: 20 }}>
              <span style={{ ...cell, fontWeight: 600 }}>{batter?.name ?? ""}</span>
              <span style={{ ...cell, fontWeight: 700 }}>{batter?.statLabel ?? ""}</span>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
              <span style={{ ...cell, fontWeight: 600 }}>{bowler?.name ?? ""}</span>
              <span style={{ ...cell, fontWeight: 700 }}>{bowler?.statLabel ?? ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MatchSummaryShareCard = forwardRef<HTMLDivElement, { scoringCode: string; innings: ShareCardInningsEntry[]; resultSummary: string; playerOfTheMatch: string | null; dateLabel: string }>(function MatchSummaryShareCard(
  { scoringCode, innings, resultSummary, playerOfTheMatch, dateLabel },
  ref
) {
  return (
    <div ref={ref} style={{ width: CARD_W, borderRadius: 36, overflow: "hidden", fontFamily: "Poppins, sans-serif", background: `linear-gradient(135deg, ${NAVY_DARK}, #1B4A4A)` }}>
      <div style={{ position: "relative", padding: "44px 48px 8px" }}>
        <svg width={560} height={260} viewBox="0 0 560 260" style={{ position: "absolute", top: 0, right: 0 }} aria-hidden>
          <polygon points="180,0 560,0 560,170 60,260" fill="rgba(255,255,255,0.08)" />
          <polygon points="320,0 560,0 560,110 230,220" fill="#1C5A52" />
        </svg>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#E7EEF0", fontSize: 40, fontWeight: 800 }}>SUMMARY</div>
            <div style={{ color: MUTED, fontSize: 15, fontWeight: 600, marginTop: 4 }}>#{scoringCode}</div>
          </div>
          <div style={{ color: "#D8F3EC", fontSize: 17, fontWeight: 800, letterSpacing: 6, marginTop: 8 }}>HITLIT</div>
        </div>
        <div style={{ position: "relative" }}>
          {innings.map((entry, i) => (
            <TeamSection key={i} entry={entry} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, padding: "26px 40px", textAlign: "center", background: "linear-gradient(90deg, #2FB8A6, #1C6E66)", color: "#0B2420", fontSize: 26, fontWeight: 800 }}>{resultSummary}</div>

      <div style={{ background: NAVY, padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: MUTED, fontSize: 15 }}>{dateLabel}</span>
        {playerOfTheMatch ? (
          <div style={{ background: "rgba(63,208,190,0.18)", borderRadius: 10, padding: "10px 28px", textAlign: "center" }}>
            <div style={{ color: "#FFFFFF", fontSize: 19, fontWeight: 700 }}>{playerOfTheMatch}</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Player of the match</div>
          </div>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: TEAL, fontSize: 17, fontWeight: 800, marginRight: 4 }}>HitLit</span>
          {["logo-google-playstore", "logo-apple"].map((icon) => (
            <span key={icon} style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ionicon name={icon} size={18} color="#FFFFFF" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

export default MatchSummaryShareCard;
