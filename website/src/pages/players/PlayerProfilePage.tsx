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
import { useBlockUser, useReportMessage } from "@app/hooks/useModeration";
import { showReportBlockActions } from "@app/lib/moderationActions";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import PlayerTeamSquadsList from "@/components/players/PlayerTeamSquadsList";

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
  const reportMessage = useReportMessage();
  const blockUser = useBlockUser(viewerId);
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
  // Report / block from the profile's options menu (App Store guideline 1.2).
  const openProfileMenu = () => {
    if (!viewerId) return;
    showReportBlockActions({
      targetName: player?.fullName ?? "this player",
      onReport: (reason) =>
        reportMessage.mutate(
          { reporterId: viewerId, reportedUserId: userId, source: "profile", sourceId: userId, contextId: userId, messageSnapshot: "", reason },
          { onSuccess: () => Alert.alert("Reported", "Thanks — we'll review this profile."), onError: (e) => Alert.alert("Error", getFriendlyErrorMessage(e, "Could not submit report.")) }
        ),
      onBlock: () => blockUser.mutate(userId, { onSuccess: goBack, onError: (e) => Alert.alert("Error", getFriendlyErrorMessage(e, "Could not block user.")) }),
    });
  };
  const tab = hasSportData ? activeTab : "profile";

  return (
    <div className="mx-auto max-w-5xl lg:px-8 lg:pt-6">
      <header className="relative overflow-hidden rounded-b-[32px] bg-primary-light px-3.5 pb-4 pt-[calc(env(safe-area-inset-top)+10px)] sm:px-6 lg:rounded-[32px] lg:px-8 lg:pt-6">
        <div className="relative flex items-start">
          <button type="button" onClick={goBack} aria-label="Back" className="mr-3 rounded-full p-1 transition hover:bg-black/5 active:scale-90">
            <Ionicon name="arrow-back" size={22} color={colors.ink} />
          </button>
          <div className="relative mr-4 shrink-0">
            {player?.avatar ? (
              <img src={player.avatar} alt="" className="h-16 w-16 rounded-full border-[3px] border-white object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-brand text-2xl font-bold text-white">{(player?.fullName ?? "?").charAt(0).toUpperCase()}</span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-surface shadow-card">
              <MCIcon name="crown" size={13} color={tier.color} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[19px] font-extrabold text-ink">{player?.fullName ?? "Player"}</h1>
            {player?.userCode ? <p className="mt-1 truncate text-xs text-muted">ID: {player.userCode}</p> : null}
            <p className="mt-1 text-xs text-muted">Play Together, Stay Active</p>
          </div>
          {/* Follow (+ report/block menu) and the sport filter stack on the right. */}
          <div className="flex flex-col items-end gap-2">
            {!isOwnProfile && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={openProfileMenu} aria-label="Profile options" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface shadow-card">
                  <Ionicon name="ellipsis-vertical" size={16} color={colors.ink} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFollow.mutate(!followState?.isFollowing)}
                  disabled={toggleFollow.isPending || !viewerId}
                  aria-pressed={!!followState?.isFollowing}
                  className={`press flex min-w-[100px] items-center justify-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-bold text-primary-dark ${followState?.isFollowing ? "border border-border" : ""}`}
                >
                  {toggleFollow.isPending ? (
                    <Spinner size={16} color={colors.primary} />
                  ) : (
                    <>
                      <Ionicon name={followState?.isFollowing ? "checkmark" : "add"} size={16} color={colors.primaryDark} />
                      {followState?.isFollowing ? "Following" : "Follow"}
                    </>
                  )}
                </button>
              </div>
            )}
            <button type="button" onClick={() => setSportSheetOpen(true)} className="flex items-center gap-[5px] rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
              <span className="max-w-[140px] truncate">{filterSportName ?? "All Sports"}</span>
              <Ionicon name="chevron-down" size={13} color="white" />
            </button>
          </div>
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
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${tab === key ? "bg-brand text-white" : "bg-border text-ink-secondary hover:text-ink"}`}
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
                {tab === "teams" && <PlayerTeamSquadsList userId={userId} sportId={filterSportId} />}
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
                {tab === "teams" && <PlayerTeamSquadsList userId={userId} sportId={filterSportId} />}
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
            {player.jerseyNumber != null && (tab === "profile" || tab === "overview") && <JerseyNumberCard number={player.jerseyNumber} />}
          </div>
        </>
      )}
    </div>
  );
}
