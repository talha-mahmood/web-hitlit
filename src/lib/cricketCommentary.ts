import type { BallEvent, InningsState } from "./cricketScoring";

// Full-sentence commentary for one delivery — used by the completed-match
// "Balls" tab (a reverse-chronological feed). Distinct from
// cricketScoring.ts's private describeDismissal, which produces scorecard
// abbreviations ("c Moiz b Waseem") rather than sentences, but reads off
// the exact same BallEvent fields (wicketType/fielderName/fielderName2).
export function describeBallCommentary(b: BallEvent): string {
  if (b.isWicket) {
    switch (b.wicketType) {
      case "BOWLED":
        return "Bowled. It's a wicket.";
      case "CAUGHT":
        return b.fielderName ? `Wicket. Caught by ${b.fielderName}.` : "Wicket. Caught and bowled.";
      case "LBW":
        return "LBW. It's a wicket.";
      case "STUMPED":
        return b.fielderName ? `Wicket. Stumped by ${b.fielderName}.` : "Wicket. Stumped.";
      case "RUN_OUT": {
        const fielders = [b.fielderName, b.fielderName2].filter((f): f is string => !!f);
        return fielders.length > 0 ? `Run out! (${fielders.join("/")})` : "Run out!";
      }
      case "HIT_WICKET":
        return "Hit wicket. It's a wicket.";
      case "MANKAD":
        return "Run out (Mankad).";
      case "RETIRED_OUT":
      case "RETIRED_HURT":
        return "Retired.";
      case "OVER_THE_FENCE":
        return "Out — over the fence.";
      case "ONE_HAND_ONE_BOUNCE":
        return "Wicket. One hand, one bounce.";
      case "OBSTRUCTING_THE_FIELD":
        return "Obstructing the field. It's a wicket.";
      case "HIT_THE_BALL_TWICE":
        return "Hit the ball twice. It's a wicket.";
      case "TIMED_OUT":
        return "Timed out.";
      default:
        return "It's a wicket.";
    }
  }

  switch (b.extraType) {
    case "WIDE":
      return b.extraRuns > 1 ? `Wide + ${b.extraRuns - 1} more.` : "Wide";
    case "NOBALL":
      return b.runsBatted > 0 ? `No ball. ${b.runsBatted} off the bat.` : "No ball.";
    case "BYE":
      return `${b.extraRuns} bye${b.extraRuns === 1 ? "" : "s"}.`;
    case "LEGBYE":
      return `${b.extraRuns} leg bye${b.extraRuns === 1 ? "" : "s"}.`;
    case "PENALTY":
      return "Penalty runs.";
    default:
      break;
  }

  switch (b.runsBatted) {
    case 0:
      return "Dot ball.";
    case 1:
      return "Single run.";
    case 2:
      return "Two runs.";
    case 3:
      return "Three runs. Good running from the batsmen.";
    case 4:
      return "It's a boundary. Four.";
    case 6:
      return "Huge. It's a six.";
    default:
      return `${b.runsBatted} runs.`;
  }
}

export type PartnershipSegment = { batsmanA: string; batsmanB: string; runs: number; balls: number };

// Every partnership of an innings, in order — a new segment starts whenever
// the pair of batsmen at the crease changes (a wicket brings in a
// replacement). Each persisted ball already carries the pair that was
// batting when it was bowled, so this is a straightforward grouping, not a
// wicket-by-wicket lookup. Last Man Stand's null non-striker just becomes
// its own segment key, same as any other pair.
export function computePartnerships(balls: BallEvent[]): PartnershipSegment[] {
  const segments: PartnershipSegment[] = [];
  let currentKey: string | null = null;
  let currentA = "";
  let currentB = "";
  let runs = 0;
  let legalBalls = 0;

  const flush = () => {
    if (currentKey !== null) segments.push({ batsmanA: currentA, batsmanB: currentB, runs, balls: legalBalls });
  };

  for (const b of balls) {
    const key = [b.strikerName, b.nonStrikerName ?? ""].sort().join("|");
    if (key !== currentKey) {
      flush();
      currentKey = key;
      currentA = b.strikerName;
      currentB = b.nonStrikerName ?? "";
      runs = 0;
      legalBalls = 0;
    }
    runs += b.runsBatted + b.extraRuns;
    if (b.extraType !== "WIDE" && b.extraType !== "NOBALL" && b.extraType !== "PENALTY") legalBalls += 1;
  }
  flush();
  return segments;
}

// Auto-computed "best performer" across both innings — runs plus a simple
// per-wicket weighting, a common quick impact heuristic for this kind of
// summary (not a league-official formula). Returns null only when there's
// genuinely no batting/bowling data at all.
export function computePlayerOfTheMatch(innings: { state: InningsState }[]): string | null {
  const impact = new Map<string, number>();
  const add = (name: string, points: number) => impact.set(name, (impact.get(name) ?? 0) + points);

  for (const { state } of innings) {
    for (const name of state.battingOrder) {
      add(name, state.battingStats[name]?.runs ?? 0);
    }
    for (const name of state.bowlingOrder) {
      add(name, (state.bowlingStats[name]?.wickets ?? 0) * 20);
    }
  }

  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [name, score] of impact) {
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}
