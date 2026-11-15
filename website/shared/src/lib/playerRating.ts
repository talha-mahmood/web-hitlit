// A numeric rating (à la 8 Ball Pool / Chess.com) rather than a skill ELO —
// this app has no win/loss data to base a real competitive rating on, so
// it's activity-driven: it only ever goes up as you play more, host, and
// enter tournaments. Deliberately slow: everyone starts at 0, and a regular
// game is worth 1 point, so a rating of 100 genuinely means ~100 games
// played — reaching it should take real, sustained participation.
//
// Single source of truth for both ProfileScreen (your own rating) and the
// Players Dashboard leaderboard (everyone's rating) — keeping them in sync
// matters since the same person's number would otherwise disagree between
// the two screens.
const BASE_RATING = 0;
const POINTS_PER_GAME = 1;
const POINTS_PER_TOURNAMENT = 3;
const POINTS_PER_HOSTED_GAME = 2;

export const RATING_TIERS = [
  { label: "Rookie", min: 0, color: "#9AA8B7", bg: "#142533" },
  { label: "Bronze", min: 10, color: "#FBBF24", bg: "#352A13" },
  { label: "Silver", min: 25, color: "#CBD4DD", bg: "#1C2D3A" },
  { label: "Gold", min: 50, color: "#FBBF24", bg: "#352A13" },
  { label: "Platinum", min: 100, color: "#38BDF8", bg: "#102638" },
  { label: "Diamond", min: 200, color: "#C084FC", bg: "#271C3B" },
] as const;

export type RatingInputs = {
  gamesPlayedTotal: number;
  tournamentsPlayedTotal: number;
  gamesHostedTotal: number;
};

export function computeRating(stats: RatingInputs | undefined): number {
  if (!stats) return BASE_RATING;
  // gamesPlayedTotal is already scored games only, so tournaments are no
  // longer subtracted out of it.
  return (
    BASE_RATING +
    stats.gamesPlayedTotal * POINTS_PER_GAME +
    stats.tournamentsPlayedTotal * POINTS_PER_TOURNAMENT +
    stats.gamesHostedTotal * POINTS_PER_HOSTED_GAME
  );
}

export function getRatingTierInfo(rating: number) {
  let idx = 0;
  for (let i = 0; i < RATING_TIERS.length; i++) {
    if (rating >= RATING_TIERS[i].min) idx = i;
  }
  const current = RATING_TIERS[idx];
  const next = RATING_TIERS[idx + 1] ?? null;
  const progress = next ? (rating - current.min) / (next.min - current.min) : 1;
  return {
    label: current.label,
    color: current.color,
    bg: current.bg,
    progress: Math.max(0, Math.min(1, progress)),
    nextLabel: next?.label ?? null,
    remaining: next ? next.min - rating : 0,
  };
}

// The rating shown on player profiles and used to rank Top Players:
// 70% games-win percentage + 30% games played. Only *scored* games count as
// played here (matchesPlayedTotal) — a game nobody scored adds nothing. That
// count is scaled onto 0-100 first (100 scored games = full marks, capped
// above that) so volume alone can't outweigh winning. get_top_players in the
// database orders by the same formula, so keep the two in sync.
const RANKING_WIN_WEIGHT = 0.7;
const RANKING_GAMES_PLAYED_WEIGHT = 0.3;
const RANKING_GAMES_PLAYED_FULL_MARKS = 100;

export type RankingRatingInputs = {
  matchesWonTotal: number;
  matchesPlayedTotal: number;
};

export function computeRankingRating(stats: RankingRatingInputs | undefined): number {
  if (!stats) return 0;
  const winShare = stats.matchesPlayedTotal > 0 ? Math.min(100, (stats.matchesWonTotal / stats.matchesPlayedTotal) * 100) : 0;
  const gamesPlayedShare = Math.min(100, (stats.matchesPlayedTotal / RANKING_GAMES_PLAYED_FULL_MARKS) * 100);
  return Math.round(winShare * RANKING_WIN_WEIGHT + gamesPlayedShare * RANKING_GAMES_PLAYED_WEIGHT);
}
