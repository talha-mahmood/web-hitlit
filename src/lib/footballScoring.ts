// Pure football (association football) scoring engine — no I/O, no React.
// Unlike the other six sports built into this scorecard (cricket, padel,
// tennis, pickleball, badminton, table tennis), football has no
// point/game/set ladder at all — it's a running match clock plus a log of
// goals. So instead of replaying an abstract "who won the point" log, this
// module works off:
//   - a handful of phase-transition timestamps (when each half/period
//     kicked off, how much added time the referee gave at the end of each)
//     stored directly on the match row, since a real match can't be
//     "rewound" the way a sequence of points can — there's nothing to undo
//     about when kickoff happened;
//   - an append-only goal log (and a separate penalty-kick log for a
//     shootout), which IS replayed/derived from, exactly like the other
//     five engines — this is what "Undo Last Goal" operates on.
//
// The match clock is continuous, not reset at half-time: the second half's
// displayed time runs 45:00 → 90:00 (not 0:00 → 45:00), matching how real
// broadcasts show it and how the spec's own "67:20" second-half example
// already implied.

export type Team = "A" | "B";

export type Phase =
  | "NOT_STARTED"
  | "FIRST_HALF"
  | "HALF_TIME"
  | "SECOND_HALF"
  | "FULL_TIME"
  | "EXTRA_TIME_FIRST"
  | "EXTRA_TIME_BREAK"
  | "EXTRA_TIME_SECOND"
  | "EXTRA_TIME_FULL_TIME"
  | "PENALTIES"
  | "COMPLETE";

// A phase that's actively "running" — its elapsed time counts up live.
// Break/complete phases are frozen at whatever the clock read when they began.
const RUNNING_PHASES: Phase[] = ["FIRST_HALF", "SECOND_HALF", "EXTRA_TIME_FIRST", "EXTRA_TIME_SECOND"];

// Both entered directly by the host at match creation — a standard match is
// 45/15, but either can be shortened for a casual game. Extra time is no
// longer derived from the match length; the host sets it explicitly.
export type MatchConfig = {
  halfDurationMinutes: number; // length of each regular half
  extraTimePeriodMinutes: number; // length of each extra-time period
};

export function totalMatchMinutes(config: MatchConfig): number {
  return config.halfDurationMinutes * 2;
}
export function extraTimeTotalMinutes(config: MatchConfig): number {
  return config.extraTimePeriodMinutes * 2;
}

// "45 min" for a whole number, "2.5 min" (one decimal) for a fractional
// period (e.g. an odd total split into two halves) — used to label a
// half/period's scheduled length on screen.
export function formatMinutesLabel(minutes: number): string {
  return Number.isInteger(minutes) ? `${minutes}` : minutes.toFixed(1);
}

function extraTimePeriodSeconds(config: MatchConfig): number {
  return Math.round(config.extraTimePeriodMinutes * 60);
}

// The scheduled clock time (in seconds) at which each running phase's
// stoppage time begins — kept in seconds internally so a fractional period
// (from an odd total split in half) still schedules precisely;
// `formatClock`/`formatGoalMinuteLabel` round this to a whole minute only
// for the "45+2'" style label, which is always whole-minute by convention.
// Exported so the live screen can detect "this half has reached its
// scheduled length" to trigger the end-of-half alert.
export function phaseBoundarySeconds(phase: Phase, config: MatchConfig): number | undefined {
  if (phase === "FIRST_HALF") return config.halfDurationMinutes * 60;
  if (phase === "SECOND_HALF") return config.halfDurationMinutes * 2 * 60;
  if (phase === "EXTRA_TIME_FIRST") return config.halfDurationMinutes * 2 * 60 + extraTimePeriodSeconds(config);
  if (phase === "EXTRA_TIME_SECOND") return config.halfDurationMinutes * 2 * 60 + extraTimePeriodSeconds(config) * 2;
  return undefined;
}

export type GoalEvent = {
  seq: number;
  team: Team;
  phase: Phase; // which phase it was scored in — determines which score bucket(s) it counts toward
  minuteLabel: string; // e.g. "23'" or "45+2'", computed once at the moment it was scored
};

export type PenaltyKick = {
  seq: number;
  team: Team;
  scored: boolean;
};

export type MatchTimestamps = {
  firstHalfKickoffAt: string | null;
  firstHalfAddedMinutes: number | null;
  secondHalfKickoffAt: string | null;
  secondHalfAddedMinutes: number | null;
  extraTimeFirstKickoffAt: string | null;
  extraTimeFirstAddedMinutes: number | null;
  extraTimeSecondKickoffAt: string | null;
  extraTimeSecondAddedMinutes: number | null;
};

// Whole seconds accumulated by every phase that has *fully finished*
// before `phase` began — i.e. the clock reading the instant `phase` started.
function accumulatedSecondsBeforePhase(phase: Phase, t: MatchTimestamps, config: MatchConfig): number {
  let seconds = 0;
  if (phase === "FIRST_HALF") return 0;
  seconds += config.halfDurationMinutes * 60 + (t.firstHalfAddedMinutes ?? 0) * 60;
  if (phase === "HALF_TIME" || phase === "SECOND_HALF") return seconds;
  seconds += config.halfDurationMinutes * 60 + (t.secondHalfAddedMinutes ?? 0) * 60;
  if (phase === "FULL_TIME" || phase === "EXTRA_TIME_FIRST") return seconds;
  seconds += extraTimePeriodSeconds(config) + (t.extraTimeFirstAddedMinutes ?? 0) * 60;
  if (phase === "EXTRA_TIME_BREAK" || phase === "EXTRA_TIME_SECOND") return seconds;
  seconds += extraTimePeriodSeconds(config) + (t.extraTimeSecondAddedMinutes ?? 0) * 60;
  return seconds; // EXTRA_TIME_FULL_TIME, PENALTIES, COMPLETE
}

function kickoffTimestampFor(phase: Phase, t: MatchTimestamps): string | null {
  if (phase === "FIRST_HALF") return t.firstHalfKickoffAt;
  if (phase === "SECOND_HALF") return t.secondHalfKickoffAt;
  if (phase === "EXTRA_TIME_FIRST") return t.extraTimeFirstKickoffAt;
  if (phase === "EXTRA_TIME_SECOND") return t.extraTimeSecondKickoffAt;
  return null;
}

// The live, continuously-running elapsed match time, in seconds, right now
// (or as of `nowMs` if given — used for testing without a real clock).
export function computeElapsedSeconds(phase: Phase, t: MatchTimestamps, config: MatchConfig, nowMs: number = Date.now()): number {
  const before = accumulatedSecondsBeforePhase(phase, t, config);
  if (!RUNNING_PHASES.includes(phase)) return before;
  const kickoff = kickoffTimestampFor(phase, t);
  if (!kickoff) return before;
  const running = Math.max(0, Math.floor((nowMs - new Date(kickoff).getTime()) / 1000));
  return before + running;
}

// "23:45" during normal time, "45+2'" once past the phase's scheduled
// boundary (stoppage/added time) — the running clock shown on the live
// screen. The boundary is rounded to the nearest whole minute here (even
// though it's tracked to the second internally) since stoppage-time labels
// are always whole minutes by football convention.
export function formatClock(elapsedSeconds: number, phase: Phase, config: MatchConfig): string {
  const boundarySeconds = phaseBoundarySeconds(phase, config);
  const boundary = boundarySeconds !== undefined ? Math.round(boundarySeconds / 60) : undefined;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (boundary !== undefined && elapsedMinutes >= boundary) {
    const added = elapsedMinutes - boundary + 1;
    return `${boundary}+${added} minutes`;
  }
  const seconds = Math.floor(elapsedSeconds % 60);
  return `${String(elapsedMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// "01:18" — the exact match-clock reading at the instant a goal is
// recorded, for the goal-history list.
export function formatGoalMinuteLabel(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = Math.floor(elapsedSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const REGULATION_PHASES: Phase[] = ["FIRST_HALF", "HALF_TIME", "SECOND_HALF", "FULL_TIME"];
const EXTRA_TIME_PHASES: Phase[] = ["EXTRA_TIME_FIRST", "EXTRA_TIME_BREAK", "EXTRA_TIME_SECOND", "EXTRA_TIME_FULL_TIME"];

export type ScoreTally = { a: number; b: number };

function tally(goals: GoalEvent[]): ScoreTally {
  return goals.reduce((acc, g) => (g.team === "A" ? { ...acc, a: acc.a + 1 } : { ...acc, b: acc.b + 1 }), { a: 0, b: 0 });
}

export type MatchScoreSummary = {
  halfTime: ScoreTally; // score at the break (first-half goals only)
  fullTime: ScoreTally; // score after 90 minutes (first + second half)
  afterExtraTime: ScoreTally | null; // full-time + extra-time goals, only once extra time has been played
  current: ScoreTally; // whichever of the above reflects the match's current point
};

// `wentToExtraTime` should reflect whether extra time actually kicked off
// (e.g. `!!match.extra_time_first_kickoff_at`) rather than being inferred
// from goals — a scoreless extra time (0-0, going to penalties) still
// counts as having been played, even though no goal event marks it.
export function computeScoreSummary(goals: GoalEvent[], phase: Phase, wentToExtraTime: boolean): MatchScoreSummary {
  const halfTime = tally(goals.filter((g) => g.phase === "FIRST_HALF"));
  const fullTime = tally(goals.filter((g) => REGULATION_PHASES.includes(g.phase)));
  const afterExtraTime = wentToExtraTime
    ? tally(goals.filter((g) => REGULATION_PHASES.includes(g.phase) || EXTRA_TIME_PHASES.includes(g.phase)))
    : null;
  const current = afterExtraTime ?? fullTime;
  return { halfTime, fullTime, afterExtraTime, current };
}

export type PenaltyShootoutState = {
  scoreA: number;
  scoreB: number;
  isDecided: boolean;
  winner: Team | null;
};

// Standard shootout rule: 5 kicks each, but decided as soon as the
// trailing side can no longer catch up even with every remaining kick of
// their initial 5 (real shootouts routinely end before kick 5 for exactly
// this reason) — then sudden death, one kick each per round, decided the
// moment a completed round leaves the scores unequal.
export function computePenaltyShootoutState(kicks: PenaltyKick[]): PenaltyShootoutState {
  const scoreA = kicks.filter((k) => k.team === "A" && k.scored).length;
  const scoreB = kicks.filter((k) => k.team === "B" && k.scored).length;
  const takenA = kicks.filter((k) => k.team === "A").length;
  const takenB = kicks.filter((k) => k.team === "B").length;

  if (takenA < 5 || takenB < 5) {
    // Still within the initial 5 kicks each — decided early the moment the
    // trailing side can no longer catch up with whatever kicks they have
    // left in this phase, even before both sides reach 5.
    const remainingA = 5 - takenA;
    const remainingB = 5 - takenB;
    if (scoreA > scoreB + remainingB) return { scoreA, scoreB, isDecided: true, winner: "A" };
    if (scoreB > scoreA + remainingA) return { scoreA, scoreB, isDecided: true, winner: "B" };
    if (takenA === 5 && takenB === 5 && scoreA !== scoreB) {
      return { scoreA, scoreB, isDecided: true, winner: scoreA > scoreB ? "A" : "B" };
    }
    return { scoreA, scoreB, isDecided: false, winner: null };
  }

  // Sudden death: one kick each per round beyond the initial 5. Only
  // decided once a round is *complete* (both sides have taken the same
  // number of sudden-death kicks) — a lead after just one side's kick in
  // the round doesn't count, since the other side still gets to answer it.
  const suddenDeathRoundsA = takenA - 5;
  const suddenDeathRoundsB = takenB - 5;
  if (suddenDeathRoundsA === suddenDeathRoundsB && scoreA !== scoreB) {
    return { scoreA, scoreB, isDecided: true, winner: scoreA > scoreB ? "A" : "B" };
  }
  return { scoreA, scoreB, isDecided: false, winner: null };
}

export function matchResultSummary(
  teamAName: string,
  teamBName: string,
  scoreSummary: MatchScoreSummary,
  shootout: PenaltyShootoutState | null
): string {
  if (shootout?.isDecided) {
    const winnerName = shootout.winner === "A" ? teamAName : teamBName;
    return `${winnerName} won on penalties (${shootout.scoreA}-${shootout.scoreB}) after ${scoreSummary.current.a}-${scoreSummary.current.b}`;
  }
  const { a, b } = scoreSummary.current;
  if (a === b) return `Draw ${a}-${b}`;
  const winnerName = a > b ? teamAName : teamBName;
  return `${winnerName} won ${a}-${b}`;
}
