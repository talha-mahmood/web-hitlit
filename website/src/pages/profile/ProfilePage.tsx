import { useState } from "react";
import { colors } from "@app/constants/theme";
import { useProfileStore } from "@app/store/profileStore";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStats } from "@app/hooks/useProfileStats";
import { usePlayerPublicProfile } from "@app/hooks/usePlayers";
import { useFollowState } from "@app/hooks/usePlayerFollows";
import { useSports } from "@app/hooks/useSports";
import { computeRating, computeRankingRating } from "@app/lib/playerRating";
import { getSportIcon } from "@app/lib/sportIcons";
import { classifySportKind, type GenericSport } from "@app/lib/genericSportStats";
import { pickImages, uploadImage } from "@app/lib/upload";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
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
import type { ProfileTab } from "@/pages/players/PlayerProfilePage";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

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

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

// Port of ProfileScreen (the signed-in user's own profile): green banner
// with the avatar (tap to change), name, copyable ID, member-since and
// followers, a settings button; then the stat cards — or, once filtered to a
// sport with scorecard data, the nine sport tabs — and the jersey card.
export default function ProfilePage() {
  const navigate = useAppNavigate();
  const goHome = useGoBack(paths.home);
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const userId = useAuthStore((s) => s.session?.user.id);

  const [filterSportId, setFilterSportId] = useState<string | undefined>(undefined);
  const [filterSportName, setFilterSportName] = useState<string | undefined>(undefined);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const { data: allSports } = useSports();
  const { data: stats, isLoading } = useProfileStats(userId, filterSportId);
  const { data: player } = usePlayerPublicProfile(userId, filterSportId);
  const { data: allSportsProfile } = usePlayerPublicProfile(userId);
  const { data: followState } = useFollowState(userId, userId);
  const { data: cricketFigures } = usePlayerCricketFigures(player?.fullName, filterSportId);
  const sportKind: "cricket" | GenericSport | null = filterSportName ? classifySportKind(filterSportName) : null;
  const genericSport: GenericSport | null = sportKind && sportKind !== "cricket" ? sportKind : null;
  const { data: genericFigures } = usePlayerGenericFigures(genericSport, player?.fullName);
  const hasActiveSportData = sportKind === "cricket" ? !!cricketFigures?.length : sportKind ? !!genericFigures?.length : false;
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userIdCopied, setUserIdCopied] = useState(false);
  const tab = hasActiveSportData ? activeTab : "profile";

  const setSport = (id: string | undefined, name: string | undefined) => {
    setFilterSportId(id);
    setFilterSportName(name);
  };

  const handleCopyUserId = async () => {
    if (!profile?.user_code) return;
    try {
      await navigator.clipboard.writeText(profile.user_code);
      setUserIdCopied(true);
      setTimeout(() => setUserIdCopied(false), 1500);
    } catch {
      // clipboard blocked — the ID is on screen
    }
  };

  const handleChangeAvatar = async () => {
    if (!userId) return;
    const assets = await pickImages({ allowsEditing: true, aspect: [1, 1] });
    if (assets.length === 0) return;
    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadImage(assets[0], { bucket: "avatars", pathPrefix: userId });
      await updateProfile(userId, { avatar: publicUrl });
    } catch (err) {
      Alert.alert("Upload failed", getFriendlyErrorMessage(err, "Could not upload photo."));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const followerCount = followState?.followerCount ?? 0;

  return (
    <div className="mx-auto max-w-5xl lg:px-8 lg:pt-6">
      <header className="rounded-b-[32px] bg-brand px-3.5 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] lg:rounded-[32px] lg:px-7 lg:py-6">
        <div className="flex items-center">
          <button type="button" onClick={goHome} aria-label="Back to Home" className="mr-3 rounded-full p-0.5 hover:bg-white/10 lg:hidden">
            <Ionicon name="arrow-back" size={22} color="white" />
          </button>
          <button type="button" onClick={handleChangeAvatar} disabled={uploadingAvatar} aria-label="Change profile photo" title="Change profile photo" className="group relative mr-4 shrink-0">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="" className="h-16 w-16 rounded-full bg-primary-light object-cover lg:h-20 lg:w-20" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-xl font-bold text-primary lg:h-20 lg:w-20">{profile?.full_name?.charAt(0).toUpperCase() ?? "?"}</span>
            )}
            {uploadingAvatar ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                <Spinner size={18} color="white" />
              </span>
            ) : (
              <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand transition group-hover:scale-110">
                <Ionicon name="camera" size={12} color="white" />
              </span>
            )}
          </button>
          <div className="mr-2 min-w-0 flex-1 text-white">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-[19px] font-bold lg:text-[22px]">{profile?.full_name ?? "Profile"}</h1>
              <Ionicon name="checkmark-circle" size={17} color="#4ADE80" />
            </div>
            <button type="button" onClick={handleCopyUserId} title="Copy your player ID" className="mt-1 flex items-center gap-1 text-sm hover:underline">
              <Ionicon name="pricetag-outline" size={12} color="white" />
              <span className="truncate">ID: {profile?.user_code ?? "—"}</span>
              <Ionicon name={userIdCopied ? "checkmark" : "copy-outline"} size={12} color="white" />
            </button>
            {profile?.created_at && (
              <p className="mt-1 flex items-center gap-1 text-xs">
                <Ionicon name="calendar-outline" size={12} color="white" />
                Member since {formatMonthYear(profile.created_at)}
              </p>
            )}
            {followerCount > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs">
                <Ionicon name="people-outline" size={12} color="white" />
                {followerCount} follower{followerCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <button type="button" onClick={() => navigate(paths.accountSettings)} aria-label="Account settings" title="Account settings" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-card hover:bg-gray-50">
            <Ionicon name="settings-outline" size={20} color={colors.primaryDark} />
          </button>
        </div>
      </header>

      {hasActiveSportData && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4 lg:px-0" role="tablist">
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
      )}

      <div className={`px-6 pb-10 lg:px-0 ${hasActiveSportData ? "pt-4" : "pt-5"}`}>
        {tab !== "profile" && sportKind === "cricket" && player?.fullName ? (
          <>
            {tab === "overview" && <PlayerCricketOverview fullName={player.fullName} sportId={filterSportId} />}
            {tab === "statistics" && <PlayerCricketStatistics fullName={player.fullName} sportId={filterSportId} />}
            {tab === "matches" && <PlayerCricketMatches fullName={player.fullName} sportId={filterSportId} />}
            {tab === "teams" && <PlayerCricketTeams fullName={player.fullName} sportId={filterSportId} />}
            {tab === "tournaments" && <PlayerCricketTournaments fullName={player.fullName} sportId={filterSportId} />}
            {tab === "clubs" && userId && <PlayerCricketClubs userId={userId} />}
            {tab === "insights" && <PlayerCricketInsights fullName={player.fullName} sportId={filterSportId} />}
            {tab === "compare" && <PlayerCricketCompare fullName={player.fullName} displayName={player.fullName} sportId={filterSportId} />}
          </>
        ) : tab !== "profile" && genericSport && player?.fullName ? (
          <>
            {tab === "overview" && <PlayerSportOverview sport={genericSport} fullName={player.fullName} />}
            {tab === "statistics" && <PlayerSportStatistics sport={genericSport} fullName={player.fullName} />}
            {tab === "matches" && <PlayerSportMatches sport={genericSport} fullName={player.fullName} />}
            {tab === "teams" && <PlayerSportTeams sport={genericSport} fullName={player.fullName} />}
            {tab === "tournaments" && <PlayerSportTournaments sport={genericSport} fullName={player.fullName} />}
            {tab === "clubs" && userId && <PlayerSportClubs sport={genericSport} userId={userId} />}
            {tab === "insights" && <PlayerSportInsights sport={genericSport} fullName={player.fullName} />}
            {tab === "compare" && <PlayerSportCompare sport={genericSport} fullName={player.fullName} displayName={player.fullName} />}
          </>
        ) : (
          <PlayerStatCards
            data={{
              rating: computeRankingRating(stats),
              gamesPlayed: stats?.gamesPlayedTotal ?? 0,
              tournamentsPlayed: stats?.tournamentsPlayedTotal ?? 0,
              gamesHosted: stats?.gamesHostedTotal ?? 0,
              activeSquads: stats?.activeSquads.length ?? 0,
              hoursPlayed: stats?.hoursPlayedTotal ?? 0,
              participationScore: computeRating(stats),
              followerCount,
              regularGamesPlayed: stats?.regularGamesPlayedTotal ?? 0,
              matchesWon: player?.matchesWonTotal ?? 0,
              matchesPlayed: player?.matchesPlayedTotal ?? 0,
              sportSegments: (stats?.sportBreakdown ?? []).map((s) => ({ label: s.sportName, value: s.count, color: getSportIcon(s.sportName).fg })),
              totals: player ? { runs: player.totalRuns, wickets: player.totalWickets, goals: player.totalGoals } : null,
            }}
            isLoading={isLoading}
            filterSportId={filterSportId}
            filterSportName={filterSportName}
            sportsPlayed={allSportsProfile?.sportBreakdown ?? []}
            onSelectSport={(id, name) => (filterSportId === id ? setSport(undefined, undefined) : setSport(id, name))}
            hideSportsFilter
            onOpenSportFilter={() => setSportSheetOpen(true)}
          />
        )}
        {profile?.jersey_number != null && <JerseyNumberCard number={profile.jersey_number} />}
      </div>

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
    </div>
  );
}
