import { colors } from "@app/constants/theme";
import { getRatingTierInfo } from "@app/lib/playerRating";
import { getSportIcon } from "@app/lib/sportIcons";
import { Ionicon, MCIcon } from "../icons/Icon";
import { SkeletonBlock } from "../ui/Skeleton";
import { PieChart } from "../charts/Charts";

// Port of PlayerStatCards — shared by the Profile screen (own numbers) and a
// player's public profile: rating, Games Win + followers, the stat grid,
// sports pie + activity bars, football goal total, and "Filter By Sports".

function StatCard({ icon, bg, fg, value, label }: { icon: string; bg: string; fg: string; value: string | number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-card">
      <span className="mb-2 flex h-[34px] w-[34px] items-center justify-center rounded-full" style={{ backgroundColor: bg }}>
        <Ionicon name={icon} size={17} color={fg} />
      </span>
      <p className="text-xl font-extrabold text-ink">{value}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function ActivityBarRow({ icon, iconBg, label, value, max, color }: { icon: string; iconBg: string; label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="mr-2 flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
            <Ionicon name={icon} size={12} color={color} />
          </span>
          <span className="truncate text-sm font-medium text-ink">{label}</span>
        </span>
        <span className="text-sm font-bold text-ink">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-gray-100">
        <div className="h-2 rounded transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export type PlayerStatCardsData = {
  rating: number;
  gamesPlayed: number;
  tournamentsPlayed: number;
  gamesHosted: number;
  activeSquads: number;
  hoursPlayed: number;
  participationScore: number;
  followerCount: number;
  regularGamesPlayed: number;
  matchesWon: number;
  matchesPlayed: number;
  sportSegments: { label: string; value: number; color: string }[];
  totals: { runs: number; wickets: number; goals: number } | null;
};

export type SportsPlayedEntry = { sportId: string; sportName: string; count: number };

export default function PlayerStatCards({
  data,
  isLoading = false,
  filterSportId,
  filterSportName,
  sportsPlayed,
  onSelectSport,
  hideSportsFilter = false,
  onOpenSportFilter,
}: {
  data: PlayerStatCardsData;
  isLoading?: boolean;
  filterSportId?: string;
  filterSportName?: string;
  sportsPlayed: SportsPlayedEntry[];
  onSelectSport: (sportId: string, sportName: string) => void;
  hideSportsFilter?: boolean;
  onOpenSportFilter?: () => void;
}) {
  const { rating, gamesPlayed, tournamentsPlayed, gamesHosted, activeSquads, hoursPlayed, participationScore, followerCount, regularGamesPlayed, matchesWon, matchesPlayed, sportSegments, totals } = data;
  const tier = getRatingTierInfo(rating);
  const winPct = matchesPlayed > 0 ? Math.min(100, Math.round((matchesWon / matchesPlayed) * 100)) : 0;
  const winTag = matchesPlayed > 0 ? (winPct === 100 ? "Perfect!" : winPct >= 70 ? "Great!" : null) : null;
  const sportTotal = Math.max(1, sportSegments.reduce((sum, s) => sum + s.value, 0));
  const activityMax = Math.max(regularGamesPlayed, tournamentsPlayed, gamesHosted, 1);

  return (
    <>
      <div className="relative mb-6 rounded-2xl bg-surface p-4 shadow-card">
        <span className="absolute right-3.5 top-4 rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: tier.bg, color: tier.color }}>
          {tier.label}
        </span>
        <p className="mb-2 text-xs font-bold tracking-wide text-muted">Rating</p>
        {onOpenSportFilter && (
          <button type="button" onClick={onOpenSportFilter} className="mb-3 flex items-center gap-[5px] rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
            {filterSportName ?? "All Sports"}
            <Ionicon name="chevron-down" size={13} color="white" />
          </button>
        )}
        <div className="mb-2 flex items-center gap-2.5">
          <span className="relative flex h-[52px] w-[52px] items-center justify-center">
            <MCIcon name="hexagon" size={52} color={tier.bg} className="absolute" />
            <Ionicon name="trophy" size={22} color={tier.color} style={{ position: "relative" }} />
          </span>
          <span className="text-[34px] font-extrabold leading-[38px] text-ink">{rating}</span>
          <Ionicon name="star" size={16} color="#FACC15" style={{ marginTop: -18 }} />
        </div>
        <p className="mb-2 flex items-center gap-1 text-xs text-muted">
          {tier.nextLabel ? `${tier.remaining} points to ${tier.nextLabel}` : "Top tier"}
          <Ionicon name="information-circle-outline" size={13} color={colors.muted} />
        </p>
        <div className="h-2 rounded bg-gray-100">
          <div className="h-2 rounded" style={{ width: `${tier.progress * 100}%`, backgroundColor: tier.color }} />
        </div>
      </div>

      {isLoading ? (
        <div className="mb-6 flex gap-3">
          <SkeletonBlock height={88} radius={16} style={{ flex: 1 }} />
          <SkeletonBlock height={88} radius={16} style={{ flex: 1 }} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-2xl bg-surface p-3.5 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary-light">
                  <Ionicon name="locate" size={17} color={colors.primary} />
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-base font-extrabold text-ink">{winPct}%</span>
                  {winTag && <span className="mt-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-ink">{winTag}</span>}
                </span>
              </div>
              <p className="text-xl font-extrabold text-ink">
                {matchesWon} / {matchesPlayed}
              </p>
              <p className="mb-2 mt-0.5 truncate text-xs text-muted">{filterSportName ? `Games Win · ${filterSportName}` : "Games Win"}</p>
              <div className="mt-auto h-1.5 rounded-sm bg-gray-100">
                <div className="h-1.5 rounded-sm bg-brand" style={{ width: `${winPct}%` }} />
              </div>
            </div>
            <div className="rounded-2xl bg-surface p-3.5 shadow-card">
              <span className="mb-2 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-blue-50">
                <Ionicon name="people" size={17} color="#2563EB" />
              </span>
              <p className="text-xl font-extrabold text-ink">{followerCount}</p>
              <p className="mt-0.5 text-xs text-muted">Followers</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatCard icon="football-outline" bg="rgb(var(--jz-blue-50))" fg="#2563EB" value={gamesPlayed} label="Games Played" />
            <StatCard icon="trophy-outline" bg="rgb(var(--jz-amber-50))" fg="#D97706" value={tournamentsPlayed} label="Tournaments Played" />
            <StatCard icon="star-outline" bg="#FFF1F2" fg="#E11D48" value={gamesHosted} label="Games Hosted" />
            <StatCard icon="people-outline" bg="rgb(var(--jz-primary-light))" fg="#1D9254" value={activeSquads} label="Active Groups" />
            <StatCard icon="time-outline" bg="rgb(var(--jz-blue-50))" fg="#2563EB" value={hoursPlayed} label="Hours Played" />
            <StatCard icon="pulse-outline" bg="#F5F3FF" fg="#7C3AED" value={participationScore} label="Participation Score" />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface p-3.5 shadow-card">
              <p className="mb-3 flex items-center gap-1.5 font-semibold text-ink">
                <Ionicon name="pie-chart" size={15} color={colors.primary} />
                <span className="truncate">Sports Played</span>
              </p>
              {sportSegments.length === 0 ? (
                <div className="flex flex-col items-center py-4">
                  <Ionicon name="bar-chart-outline" size={24} color="#9CA3AF" />
                  <p className="mt-2 text-center text-xs text-muted">Play your first game to see this here.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative h-[110px] w-[110px]">
                    <PieChart segments={sportSegments} size={110} />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-[60px] w-[60px] flex-col items-center justify-center rounded-full bg-surface">
                        <span className="text-xl font-extrabold leading-none text-ink">{sportSegments.length}</span>
                        <span className="text-[10px] text-muted">Sports</span>
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex w-full flex-col gap-1.5">
                    {sportSegments.map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="flex-1 truncate text-xs text-muted">{s.label}</span>
                        <span className="text-[11px] text-muted">{Math.round((s.value / sportTotal) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-surface p-3.5 shadow-card">
              <p className="mb-3 flex items-center gap-1.5 font-semibold text-ink">
                <Ionicon name="bar-chart" size={15} color={colors.primary} />
                <span className="truncate">Your Activity</span>
              </p>
              <ActivityBarRow icon="game-controller" iconBg="rgb(var(--jz-green-50))" label="Regular Games" value={regularGamesPlayed} max={activityMax} color="#60A5FA" />
              <ActivityBarRow icon="trophy" iconBg="rgb(var(--jz-amber-50))" label="Tournaments" value={tournamentsPlayed} max={activityMax} color="#FBBF24" />
              <ActivityBarRow icon="people" iconBg="rgb(var(--jz-purple-50))" label="Games Hosted" value={gamesHosted} max={activityMax} color="#C084FC" />
            </div>
          </div>

          {totals && filterSportName?.toLowerCase() === "football" && (
            <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-surface p-3.5 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                <MCIcon name="soccer" size={22} color={colors.primary} />
              </span>
              <div>
                <p className="text-xl font-extrabold text-ink">{totals.goals}</p>
                <p className="mt-0.5 text-xs text-muted">Total Goals</p>
              </div>
            </div>
          )}

          {!hideSportsFilter && sportsPlayed.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-base font-bold text-ink">Filter By Sports</p>
                <span className="flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-bold text-primary-dark">
                  <Ionicon name="bar-chart" size={12} color={colors.primaryDark} />
                  {sportsPlayed.length} {sportsPlayed.length === 1 ? "Sport" : "Sports"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {sportsPlayed.map((sp) => {
                  const { icon, bg, fg } = getSportIcon(sp.sportName);
                  const selected = filterSportId === sp.sportId;
                  return (
                    <button
                      key={sp.sportId}
                      type="button"
                      onClick={() => onSelectSport(sp.sportId, sp.sportName)}
                      aria-pressed={selected}
                      className={`flex items-center rounded-2xl border-[1.5px] p-3 text-left transition ${selected ? "border-primary" : "border-transparent hover:bg-gray-50"}`}
                    >
                      <span className="mr-3 flex h-[46px] w-[46px] items-center justify-center rounded-xl" style={{ backgroundColor: bg }}>
                        <MCIcon name={icon} size={22} color={fg} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{sp.sportName}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {sp.count} {sp.count === 1 ? "game" : "games"}
                        </span>
                      </span>
                      {selected && <Ionicon name="checkmark-circle" size={18} color={colors.primary} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// Port of JerseyNumberCard: "Jersey No." over a giant light-green numeral.
export function JerseyNumberCard({ number }: { number: number }) {
  return (
    <div className="relative mt-4 flex h-[108px] items-center overflow-hidden">
      <span className="absolute -top-4 right-2 text-[130px] font-extrabold leading-[130px] text-[#8FD9AE]" aria-hidden>
        {number}
      </span>
      <span className="relative text-[28px] font-extrabold text-primary-dark">Jersey No.</span>
      <span className="sr-only">{number}</span>
    </div>
  );
}
