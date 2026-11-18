// An implementation of the Duckworth/Lewis METHOD (the real published
// exponential-decay resource model and target formula), calibrated to
// publicly available Duckworth/Lewis Standard Edition reference points.
//
// IMPORTANT, and disclosed in the UI wherever this is used: the official
// ICC/ECB resource table is commercially confidential and has never been
// published in full — not by Duckworth & Lewis's original 1998 paper
// ("were not disclosed due to commercial confidentiality"), and not by the
// current DLS Professional Edition either. What follows is this app's own
// curve, fitted to the handful of resource-percentage figures that HAVE
// been published over the years (various editions, cited on Wikipedia's
// Duckworth–Lewis–Stern article) using the same Z(u,w) = Z0(w)(1-e^-b(w)u)
// formula D&L used. It will not reproduce an official broadcast's exact
// figure — there is no way to, without their proprietary table — but it is
// a real, smooth, monotonic resource model, not an arbitrary guess.
//
// Two further simplifications, both disclosed: (1) the standard model
// assumes a 10-wicket (11-a-side) team — a match with a different roster
// size maps its wickets-lost onto the 0-9 scale proportionally; (2) the
// model is calibrated to a 50-over reference — a match with a different
// overs_limit (T10/T20/Club) maps its overs onto the 0-50 scale
// proportionally, since the real method's separate per-format tables are
// just as confidential as the 50-over one.

// Index = wickets lost (0-9). Percentage-of-resources units (Z0(0) is
// slightly above 100 since the u=50 point hasn't fully reached the
// unlimited-overs asymptote).
const Z0 = [124.5, 106.0, 91.2, 76.5, 63.6, 49.3, 35.0, 26.5, 15.5, 7.6];
const B = [0.0325, 0.0413, 0.0542, 0.0693, 0.086, 0.104, 0.1231, 0.1432, 0.1642, 0.186];

// Linearly interpolates Z0/b between adjacent integer wicket rows for a
// fractional w (which non-standard, not-11-a-side team sizes produce via
// resourcePercent's wicketsLost/maxWickets*9 scaling) instead of rounding to
// the nearest row — smoother, and avoids small discontinuities as wickets
// fall in a 6- or 8-a-side match.
function z(u: number, w: number): number {
  const clamped = Math.min(9, Math.max(0, w));
  const lo = Math.floor(clamped);
  const hi = Math.min(9, lo + 1);
  const frac = clamped - lo;
  const z0 = Z0[lo] + (Z0[hi] - Z0[lo]) * frac;
  const b = B[lo] + (B[hi] - B[lo]) * frac;
  return z0 * (1 - Math.exp(-b * u));
}

const FULL_RESOURCE = z(50, 0); // ≈100, the normalizing ceiling

// Resources remaining (%) for a side with `wicketsLost` down (out of
// `totalPlayers` on their side) and `oversRemaining` left out of this
// match's `oversLimit`.
export function resourcePercent(oversRemaining: number, wicketsLost: number, oversLimit: number, totalPlayers: number): number {
  // All out at wicketsLost = totalPlayers - 1 (one batter left standing with
  // no partner) — nobody left to bat, regardless of overs left on the clock.
  const allOutAt = Math.max(totalPlayers - 1, 1);
  if (wicketsLost >= allOutAt) return 0;
  // The model's own native scale is 0-9, reached at the last-pair-batting
  // point (wicketsLost = totalPlayers - 2 for an 11-a-side team, wicketsLost
  // = 9 exactly — no distortion at all for the standard case this model was
  // calibrated on). Other roster sizes map proportionally onto that same
  // 0-9 scale instead.
  const lastPairAt = Math.max(totalPlayers - 2, 1);
  const w = (wicketsLost / lastPairAt) * 9;
  const u = oversLimit > 0 ? (Math.max(oversRemaining, 0) / oversLimit) * 50 : 0;
  return Math.max(0, Math.min(FULL_RESOURCE, z(u, w)));
}

export type DLResult = {
  team1ResourcesUsed: number;
  team2ResourcesAvailable: number;
  parScore: number;
  target: number;
};

// G50: the average total score a side batting its full resources would be
// expected to make — the 2002-2013 era's commonly cited value. There's no
// honest way to tune this per-competition without real historical scoring
// data this app doesn't have, so it's a fixed constant.
const G50 = 235;

export function computeDuckworthLewis(
  team1Score: number,
  team1ResourcesUsed: number,
  team2ResourcesAvailable: number
): DLResult {
  const r1 = Math.max(team1ResourcesUsed, 0.01);
  const parScore =
    team2ResourcesAvailable <= r1
      ? team1Score * (team2ResourcesAvailable / r1)
      : team1Score + (G50 * (team2ResourcesAvailable - r1)) / 100;
  return {
    team1ResourcesUsed,
    team2ResourcesAvailable,
    parScore,
    target: Math.floor(parScore) + 1,
  };
}
