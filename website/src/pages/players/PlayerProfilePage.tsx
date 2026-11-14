import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { usePlayerPublicProfile } from "@app/hooks/usePlayers";
import { useFollowState, useToggleFollow } from "@app/hooks/usePlayerFollows";
import { useSports } from "@app/hooks/useSports";
import { useAuthStore } from "@app/store/authStore";
import { computeRating, computeRankingRating, getRatingTierInfo } from "@app/lib/playerRating";
import { getSportIcon } from "@app/lib/sportIcons";
import { classifySportKind, type GenericSport } from "@app/lib/genericSportStats";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { SelectSportSheet } from "@/components/filters/FilterSheets";
import PlayerStatCards, { JerseyNumberCard } from "@/components/players/PlayerStatCards";
import {
  PlayerCricketOverview,
  PlayerCricketStatistics,
  PlayerCricketMatches,
  PlayerCricketTeams,
  PlayerCricketTournaments,
  PlayerCricketClubs,
  PlayerCricketInsights,
  PlayerCricketCompare,
} from "@/components/players/PlayerCricketTabs";
import {
  PlayerSportOverview,
  PlayerSportStatistics,
  PlayerSportMatches,
  PlayerSportTeams,
  PlayerSportTournaments,
  PlayerSportClubs,
  PlayerSportInsights,
  PlayerSportCompare,
} from "@/components/players/PlayerSportTabs";
import { usePlayerCricketFigures, usePlayerGenericFigures } from "@/hooks/usePlayerSportStats";
import { useGoBack } from "@/routes/navigation";

export type ProfileTab = "profile" | "overview" | "statistics" | "matches" | "teams" | "tournaments" | "clubs" | "insights" | "compare";

const TABS: [ProfileTab, string][] = [
  ["profile", "Player Profile"],
  ["overview", "Player Overview"],
  ["statistics", "Statistics"],
  ["matches", "Matches"],
  ["teams", "Teams"],
  ["tournaments", "Tournaments"],
  ["clubs", "Clubs"],
  ["insights", "Insights"],
  ["compare", "Compare"],
];

// Port of PlayerProfileScreen: hero (avatar + crown tier, ID, tier pill,
// sport filter pill, Follow/Following), then either the stat cards or —
// once filtered to a sport the player has scorecard data for — the nine
// sport tabs (overview, statistics, matches, teams, tournaments, clubs,
// insights, compare).
export default function PlayerProfilePage() {
  const { userId = "" } = useParams();
  const [search] = useSearchParams();
  const goBack = useGoBack("/community/players");
  const viewerId = useAuthStore((s) => s.session?.user.id);

  const [filterSportId, setFilterSportId] = useState<string | undefined>(search.get("sport") ?? undefined);
  const [filterSportName, setFilterSportName] = useState<string | undefined>(search.get("sportName") ?? undefined);
  const { data: player, isLoading } = usePlayerPublicProfile(userId, filterSportId);
  const { data: allSportsProfile } = usePlayerPublicProfile(userId);
  const { data: followState } = useFollowState(viewerId, userId);
  const toggleFollow = useToggleFollow(userId, viewerId);
  const isOwnProfile = viewerId === userId;
  const { data: cricketFigures } = usePlayerCricketFigures(player?.fullName, filterSportId);
  const sportKind: "cricket" | GenericSport | null = filterSportName ? classifySportKind(filterSportName) : null;
  const genericSport: GenericSport | null = sportKind && sportKind !== "cricket" ? sportKind : null;
  const { data: genericFigures } = usePlayerGenericFigures(genericSport, player?.fullName);
  const hasSportData = sportKind === "cricket" ? !!cricketFigures?.length : sportKind ? !!genericFigures?.length : false;
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const { data: allSports } = useSports();

  const setSport = (id: string | undefined, name: string | undefined) => {
    setFilterSportId(id);
    setFilterSportName(name);
  };

  const rating = computeRankingRating(player);
  const tier = getRatingTierInfo(rating);
  const heroIcon = player?.sportBreakdown?.[0] ? getSportIcon(player.sportBreakdown[0].sportName).icon : "trophy-outline";
  const tab = hasSportData ? activeTab : "profile";

  return (
    <div className="mx-auto max-w-5xl lg:px-8 lg:pt-6">
      <header className="relative overflow-hidden rounded-b-[32px] bg-[#E3F6EA] px-3.5 pb-[26px] pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6 lg:rounded-[32px] lg:px-8 lg:pt-6">
        <MCIcon name={heroIcon} size={150} color={colors.primaryDark} className="pointer-events-none absolute -right-[26px] top-7 opacity-10" style={{ transform: "rotate(-8deg)" }} />

        <div className="relative mb-5 flex items-center">
          <button type="button" onClick={goBack} aria-label="Back" className="mr-3 rounded-full p-1 transition hover:bg-white/60 active:scale-90">
            <Ionicon name="arrow-back" size={22} color={colors.ink} />
          </button>
          <p className="flex-1 truncate text-base font-bold text-ink">{player?.fullName ?? "Player Profile"}</p>
        </div>

        <div className="relative flex flex-wrap items-center gap-y-4">
          <div className="relative mr-4">
            {player?.avatar ? (
              <img src={player.avatar} alt="" className="h-[84px] w-[84px] rounded-full border-[3px] border-white object-cover" />
            ) : (
              <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-[3px] border-white bg-brand text-3xl font-bold text-white">
                {(player?.fullName ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-surface shadow-card">
              <MCIcon name="crown" size={16} color={tier.color} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-extrabold text-ink">{player?.fullName ?? "Player"}</h1>
            {player?.userCode ? <p className="mt-1 truncate text-xs text-muted">ID: {player.userCode}</p> : null}
            <p className="mt-1 text-xs text-muted">Play Together, Stay Active</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-[5px] rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: tier.bg, color: tier.color }}>
                <MCIcon name="crown" size={14} color={tier.color} />
                {tier.label}
              </span>
              <button type="button" onClick={() => setSportSheetOpen(true)} className="flex items-center gap-[5px] rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                <span className="max-w-[140px] truncate">{filterSportName ?? "All Sports"}</span>
                <Ionicon name="chevron-down" size={13} color="white" />
              </button>
            </div>
          </div>
          {!isOwnProfile && (
            <button
              type="button"
              onClick={() => toggleFollow.mutate(!followState?.isFollowing)}
              disabled={toggleFollow.isPending || !viewerId}
              aria-pressed={!!followState?.isFollowing}
              className={`press flex min-w-[110px] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
                followState?.isFollowing ? "border border-border bg-surface text-primary-dark" : "bg-brand text-white"
              }`}
            >
              {toggleFollow.isPending ? (
                <Spinner size={16} color={followState?.isFollowing ? colors.primary : "white"} />
              ) : followState?.isFollowing ? (
                <>
                  <Ionicon name="checkmark" size={16} color={colors.primaryDark} />
                  Following
                </>
              ) : (
                <>
                  <Ionicon name="add" size={16} color="white" />
                  Follow
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <SelectSportSheet
        open={sportSheetOpen}
        onClose={() => setSportSheetOpen(false)}
        sports={allSports ?? []}
        selectedSportId={filterSportId}
        onApply={(id) => {
          setSport(id, id ? (allSports ?? []).find((s) => s.id === id)?.name : undefined);
          setSportSheetOpen(false);
        }}
      />

      {isLoading || !player ? (
        <div className="px-5 pt-4">
          <SkeletonDetailHeader />
        </div>
      ) : (
        <>
          {hasSportData ? (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3.5 lg:px-0" role="tablist">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setActiveTab(key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${tab === key ? "bg-brand text-white" : "bg-border text-[#374151] hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={`px-5 pb-10 lg:px-0 ${hasSportData ? "" : "pt-5"}`}>
            {tab !== "profile" && sportKind === "cricket" && player.fullName ? (
              <>
                {tab === "overview" && <PlayerCricketOverview fullName={player.fullName} sportId={filterSportId} />}
                {tab === "statistics" && <PlayerCricketStatistics fullName={player.fullName} sportId={filterSportId} />}
                {tab === "matches" && <PlayerCricketMatches fullName={player.fullName} sportId={filterSportId} />}
                {tab === "teams" && <PlayerCricketTeams fullName={player.fullName} sportId={filterSportId} />}
                {tab === "tournaments" && <PlayerCricketTournaments fullName={player.fullName} sportId={filterSportId} />}
                {tab === "clubs" && <PlayerCricketClubs userId={userId} />}
                {tab === "insights" && <PlayerCricketInsights fullName={player.fullName} sportId={filterSportId} />}
                {tab === "compare" && <PlayerCricketCompare fullName={player.fullName} displayName={player.fullName} sportId={filterSportId} />}
              </>
            ) : tab !== "profile" && genericSport && player.fullName ? (
              <>
                {tab === "overview" && <PlayerSportOverview sport={genericSport} fullName={player.fullName} />}
                {tab === "statistics" && <PlayerSportStatistics sport={genericSport} fullName={player.fullName} />}
                {tab === "matches" && <PlayerSportMatches sport={genericSport} fullName={player.fullName} />}
                {tab === "teams" && <PlayerSportTeams sport={genericSport} fullName={player.fullName} />}
                {tab === "tournaments" && <PlayerSportTournaments sport={genericSport} fullName={player.fullName} />}
                {tab === "clubs" && <PlayerSportClubs sport={genericSport} userId={userId} />}
                {tab === "insights" && <PlayerSportInsights sport={genericSport} fullName={player.fullName} />}
                {tab === "compare" && <PlayerSportCompare sport={genericSport} fullName={player.fullName} displayName={player.fullName} />}
              </>
            ) : (
              <PlayerStatCards
                data={{
                  rating,
                  gamesPlayed: player.gamesPlayedTotal,
                  tournamentsPlayed: player.tournamentsPlayedTotal,
                  gamesHosted: player.gamesHostedTotal,
                  activeSquads: player.activeSquads,
                  hoursPlayed: player.hoursPlayedTotal,
                  participationScore: computeRating(player),
                  followerCount: followState?.followerCount ?? 0,
                  regularGamesPlayed: player.regularGamesPlayed,
                  matchesWon: player.matchesWonTotal ?? 0,
                  matchesPlayed: player.matchesPlayedTotal ?? 0,
                  sportSegments: player.sportBreakdown.map((sp) => ({ label: sp.sportName, value: sp.count, color: getSportIcon(sp.sportName).fg })),
                  totals: { runs: player.totalRuns, wickets: player.totalWickets, goals: player.totalGoals },
                }}
                filterSportId={filterSportId}
                filterSportName={filterSportName}
                sportsPlayed={allSportsProfile?.sportBreakdown ?? []}
                onSelectSport={(id, name) => (filterSportId === id ? setSport(undefined, undefined) : setSport(id, name))}
                hideSportsFilter
              />
            )}
            {player.jerseyNumber != null && <JerseyNumberCard number={player.jerseyNumber} />}
          </div>
        </>
      )}
    </div>
  );
}
