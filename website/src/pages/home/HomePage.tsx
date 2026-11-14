import { useMemo, useState, type ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { useProfileStore } from "@app/store/profileStore";
import { useAuthStore } from "@app/store/authStore";
import { useSports } from "@app/hooks/useSports";
import { useGames } from "@app/hooks/useGames";
import { useSquads, useTeamChallenges } from "@app/hooks/useSquads";
import { useEvents } from "@app/hooks/useEvents";
import { useMyOwnedSquads } from "@app/hooks/useSquadTeamFill";
import { challengeFormatsForSport } from "@app/lib/teamChallengeFormats";
import type { EventListItem } from "@app/lib/api/events";
import { Alert } from "@/lib/alert";
import ThemeToggle from "@/components/ThemeToggle";
import { TeamChallengeComposerModal, TeamManagerRequiredModal } from "@/components/challenges/ChallengeModals";
import { useVenues } from "@app/hooks/useVenues";
import { useUnreadNotificationCount } from "@app/hooks/useNotifications";
import { useDeviceLocation } from "@app/hooks/useDeviceLocation";
import { distanceKm, formatDistanceKm } from "@app/lib/distance";
import { isVenueBoosted, type VenueListItem } from "@app/lib/api/venues";
import type { GameListItem } from "@app/lib/api/games";
import type { SquadListItem } from "@app/lib/api/squads";
import slide2 from "@/assets/web/slide-venues.webp";
import slide3 from "@/assets/web/slide-squads.webp";
import slide4 from "@/assets/web/slide-fourth.webp";
import slide5 from "@/assets/web/slide-fifth.webp";
import { Ionicon } from "@/components/icons/Icon";
import { SkeletonBlock, SkeletonCardRows } from "@/components/ui/Skeleton";
import Rail from "@/components/ui/Rail";
import NotificationBell from "@/components/NotificationBell";
import VenueCard from "@/components/VenueCard";
import PromoCarousel from "@/components/home/PromoCarousel";
import { HomeEventCard, HomeGameRowCard, HomeSportTile, HomeSquadCard, NearbyEmptyRow } from "@/components/home/HomeCards";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// Attach a distance from the device's coordinates and sort nearest-first;
// items without coordinates sort last instead of being hidden (same as the app).
function withDistance<T>(
  items: T[],
  coords: { latitude: number; longitude: number } | null,
  getLatLng: (item: T) => { lat: number | null; lng: number | null }
): { item: T; km: number | null }[] {
  return items
    .map((item) => {
      const { lat, lng } = getLatLng(item);
      const km = coords && lat != null && lng != null ? distanceKm(coords.latitude, coords.longitude, lat, lng) : null;
      return { item, km };
    })
    .sort((a, b) => {
      if (a.km === null && b.km === null) return 0;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    });
}

function SectionHeader({ title, icon, onSeeAll, seeAllLabel = "See all" }: { title: string; icon: string; onSeeAll: () => void; seeAllLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-1.5">
        <Ionicon name={icon} size={17} color={colors.primary} />
        <span className="section-title">{title}</span>
      </h2>
      <button type="button" onClick={onSeeAll} className="flex items-center gap-0.5 rounded-lg px-1 text-sm font-semibold text-primary hover:underline">
        {seeAllLabel}
        <Ionicon name="chevron-forward" size={16} color={colors.primary} />
      </button>
    </div>
  );
}

function NearbySection<T>({
  title,
  icon,
  data,
  isLoading,
  emptyIcon,
  emptyLabel,
  keyOf,
  render,
  onSeeAll,
  horizontal = true,
  previewCount = 3,
}: {
  title: string;
  icon: string;
  data: { item: T; km: number | null }[];
  isLoading: boolean;
  emptyIcon: string;
  emptyLabel: string;
  keyOf: (item: T) => string;
  render: (entry: { item: T; km: number | null }) => ReactNode;
  onSeeAll: () => void;
  horizontal?: boolean;
  previewCount?: number;
}) {
  return (
    <section className="mb-7 min-w-0">
      <SectionHeader title={title} icon={icon} onSeeAll={onSeeAll} />
      {isLoading ? (
        horizontal ? (
          <div className="flex gap-2.5">
            <SkeletonBlock width={180} height={140} radius={16} />
            <SkeletonBlock width={180} height={140} radius={16} />
            <SkeletonBlock width={180} height={140} radius={16} className="hidden sm:block" />
          </div>
        ) : (
          <SkeletonCardRows count={2} />
        )
      ) : data.length === 0 ? (
        <NearbyEmptyRow icon={emptyIcon} label={emptyLabel} />
      ) : horizontal ? (
        <Rail>
          {data.map((entry) => (
            <div key={keyOf(entry.item)} className="w-[calc((100vw-38px)*0.48)] shrink-0 sm:w-[200px] lg:w-[210px]">
              {render(entry)}
            </div>
          ))}
        </Rail>
      ) : (
        <div className="flex flex-col gap-3">
          {data.slice(0, previewCount).map((entry) => (
            <div key={keyOf(entry.item)}>{render(entry)}</div>
          ))}
        </div>
      )}
    </section>
  );
}

// Port of HomeScreen: compact top bar (light/dark switch, HitLit, bell,
// avatar), promo carousel, sport filter (tap again to clear), and the
// nearest-first Venues / Challenge a Team / Squads / Games / Tournaments /
// Events sections, each with "See all". Challenging a team opens the
// composer, or asks you to create a team first (and resumes afterwards).
export default function HomePage() {
  const navigate = useAppNavigate();
  const profile = useProfileStore((s) => s.profile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const [selectedSportId, setSelectedSportId] = useState<string | null>(null);
  const [challengeOpponent, setChallengeOpponent] = useState<SquadListItem | null>(null);
  const [managerRequiredOpen, setManagerRequiredOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const { data: sports } = useSports();
  const { data: venues, isLoading: venuesLoading } = useVenues({ sportId: selectedSportId ?? undefined });
  const { data: unreadCount } = useUnreadNotificationCount(userId);
  const { coords } = useDeviceLocation();
  const { data: games, isLoading: gamesLoading } = useGames({ sportId: selectedSportId ?? undefined });
  const { data: squads, isLoading: squadsLoading } = useSquads({ sportId: selectedSportId ?? undefined });
  const { data: events, isLoading: eventsLoading } = useEvents();
  const { data: ownedSquads = [] } = useMyOwnedSquads(userId);
  const managedTeams = useMemo(() => ownedSquads.filter((sq) => sq.group_type === "team" && challengeFormatsForSport(sq.sports?.name).length > 0), [ownedSquads]);
  const managerIds = useMemo(() => managedTeams.map((t) => t.id).sort(), [managedTeams]);
  const { data: myTeamChallenges = [] } = useTeamChallenges(managerIds);
  // A team I manage already challenged this squad and is waiting on a reply.
  const pendingChallengeReceiverIds = useMemo(
    () => new Set(myTeamChallenges.filter((c) => c.status === "pending" && managerIds.includes(c.sender_squad_id)).map((c) => c.receiver_squad_id)),
    [myTeamChallenges, managerIds]
  );

  const gameLatLng = (g: GameListItem) => ({ lat: g.venues?.latitude ?? null, lng: g.venues?.longitude ?? null });
  const nearbyRegularGames = useMemo(
    () => withDistance((games ?? []).filter((g) => g.game_type !== "TOURNAMENT"), coords, gameLatLng),
    [games, coords]
  );
  const nearbyTournaments = useMemo(
    () => withDistance((games ?? []).filter((g) => g.game_type === "TOURNAMENT"), coords, gameLatLng),
    [games, coords]
  );
  const nearbySquads = useMemo(
    () => withDistance(squads ?? [], coords, (s: SquadListItem) => ({ lat: s.profiles?.latitude ?? null, lng: s.profiles?.longitude ?? null })),
    [squads, coords]
  );
  // Teams you could challenge: challengeable sport, not yours, not one you're in.
  const nearbyChallengeTeams = useMemo(
    () =>
      nearbySquads.filter(
        ({ item }) =>
          item.group_type === "team" &&
          challengeFormatsForSport(item.sports?.name).length > 0 &&
          item.squad_owner_id !== userId &&
          !item.squad_members.some((m) => m.status === "ACTIVE" && m.user_id === userId)
      ),
    [nearbySquads, userId]
  );
  const nearbyGroups = useMemo(() => nearbySquads.filter(({ item }) => item.group_type !== "team" || challengeFormatsForSport(item.sports?.name).length === 0), [nearbySquads]);
  const nearbyEvents = useMemo(
    () => withDistance(events ?? [], coords, (e: EventListItem) => ({ lat: e.profiles?.latitude ?? null, lng: e.profiles?.longitude ?? null })),
    [events, coords]
  );
  const nearbyVenues = useMemo(() => {
    const sorted = withDistance(venues ?? [], coords, (v: VenueListItem) => ({ lat: v.latitude, lng: v.longitude }));
    // Boosted venues come first for their area, regardless of exact distance.
    return [...sorted].sort((a, b) => Number(isVenueBoosted(b.item)) - Number(isVenueBoosted(a.item)));
  }, [venues, coords]);

  const beginChallenge = (opponent: SquadListItem) => {
    setChallengeOpponent(opponent);
    if (managedTeams.some((t) => t.sport_id === opponent.sport_id)) setComposerOpen(true);
    else setManagerRequiredOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl lg:px-8">
      <header className="sticky top-0 z-20 bg-app/95 px-5 pb-3.5 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur lg:px-0 lg:pt-6">
        <div className="relative flex min-h-[46px] items-center justify-between">
          <ThemeToggle />
          <span className="pointer-events-none absolute inset-x-0 text-center text-[22px] font-extrabold tracking-[-0.4px] text-ink">HitLit</span>
          <div className="relative flex items-center gap-4">
            <NotificationBell size={25} color={colors.ink} unreadCount={unreadCount} onPress={() => navigate(paths.notifications)} />
            <button
              type="button"
              onClick={() => navigate(paths.profile, { state: { tab: "profile" } })}
              aria-label="Your profile"
              className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full bg-surface-raised"
            >
              {profile?.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : <Ionicon name="person" size={18} color={colors.ink} />}
            </button>
          </div>
        </div>
      </header>

      <div className="px-3.5 pt-5 sm:px-6 lg:px-0">
        <PromoCarousel
          slides={[
            { key: "venues", title: "Book Premium Turfs", image: slide2 },
            { key: "squads", title: "Build Your Squad", image: slide3 },
            { key: "challenge-team", title: "Challenge a team", image: slide4 },
            { key: "nearby-players", title: "Find Players near you", image: slide5 },
          ]}
        />

        <h2 className="mb-3 flex items-center gap-2">
          <Ionicon name="filter" size={16} color={colors.primary} />
          <span className="section-title">Filter by Sport</span>
        </h2>
        <div className="mb-6">
          <Rail gap={14}>
            {(sports ?? []).map((s) => (
              <HomeSportTile key={s.id} compact name={s.name} selected={selectedSportId === s.id} onPress={() => setSelectedSportId((prev) => (prev === s.id ? null : s.id))} />
            ))}
          </Rail>
        </div>

        <NearbySection
          title="Venues near you"
          icon="location"
          data={nearbyVenues}
          isLoading={venuesLoading}
          emptyIcon="location-outline"
          emptyLabel="No venues near you yet"
          keyOf={(v: VenueListItem) => v.id}
          render={({ item, km }) => <VenueCard venue={item} showFavorite={false} minimal distanceLabel={km !== null ? formatDistanceKm(km) : undefined} onPress={() => navigate(paths.venue(item.id))} />}
          onSeeAll={() => navigate(paths.venues(), { state: { tab: "venues" } })}
        />

        <NearbySection
          title="Challenge a Team"
          icon="football"
          data={nearbyChallengeTeams}
          isLoading={squadsLoading}
          emptyIcon="football-outline"
          emptyLabel="No teams for these sports near you yet"
          keyOf={(s: SquadListItem) => s.id}
          render={({ item, km }) => (
            <HomeSquadCard
              squad={item}
              currentUserId={userId}
              myGender={profile?.gender}
              distanceLabel={km !== null ? formatDistanceKm(km) : undefined}
              onChallenge={managedTeams.some((t) => t.id === item.id) ? undefined : () => beginChallenge(item)}
              challengePending={pendingChallengeReceiverIds.has(item.id)}
              onPress={() => navigate(paths.squad(item.id))}
            />
          )}
          onSeeAll={() => navigate(paths.challengeTeams({ sportId: selectedSportId ?? undefined }))}
        />

        <NearbySection
          title="Squads near you"
          icon="people"
          data={nearbyGroups}
          isLoading={squadsLoading}
          emptyIcon="people-outline"
          emptyLabel="No squads near you yet"
          keyOf={(s: SquadListItem) => s.id}
          render={({ item }) => <HomeSquadCard squad={item} currentUserId={userId} myGender={profile?.gender} onPress={() => navigate(paths.squad(item.id))} />}
          onSeeAll={() => navigate(paths.squads)}
        />

        <div className="grid gap-x-8 lg:grid-cols-2">
          <NearbySection
            title="Games near you"
            icon="calendar"
            horizontal={false}
            data={nearbyRegularGames}
            isLoading={gamesLoading}
            emptyIcon="tennisball-outline"
            emptyLabel="No games near you yet"
            keyOf={(g: GameListItem) => g.id}
            render={({ item, km }) => <HomeGameRowCard game={item} distanceKm={km} onPress={() => navigate(paths.game(item.id))} />}
            onSeeAll={() => navigate(paths.games())}
          />
          <NearbySection
            title="Tournaments near you"
            icon="trophy"
            horizontal={false}
            data={nearbyTournaments}
            isLoading={gamesLoading}
            emptyIcon="trophy-outline"
            emptyLabel="No tournaments near you yet"
            keyOf={(g: GameListItem) => g.id}
            render={({ item, km }) => <HomeGameRowCard game={item} distanceKm={km} onPress={() => navigate(paths.game(item.id))} />}
            onSeeAll={() => navigate(paths.games({ gameType: "TOURNAMENT" }))}
          />
        </div>

        <NearbySection
          title="Events near you"
          icon="calendar-outline"
          data={nearbyEvents}
          isLoading={eventsLoading}
          emptyIcon="calendar-outline"
          emptyLabel="No events near you yet"
          keyOf={(e: EventListItem) => e.id}
          render={({ item }) => <HomeEventCard event={item} currentUserId={userId} myGender={profile?.gender} onPress={() => navigate(paths.event(item.id))} />}
          onSeeAll={() => navigate(paths.events())}
        />
      </div>

      <TeamManagerRequiredModal
        open={managerRequiredOpen}
        onClose={() => (setManagerRequiredOpen(false), setChallengeOpponent(null))}
        onCreateTeam={() => {
          setManagerRequiredOpen(false);
          // Challenge a Team resumes the challenge once the team exists.
          const opponent = challengeOpponent;
          navigate(paths.createSquadWith({ presetType: "team", lockType: true, presetSportId: opponent?.sport_id ?? undefined, lockSport: Boolean(opponent?.sport_id) }));
        }}
      />
      <TeamChallengeComposerModal
        open={composerOpen}
        senderTeams={managedTeams}
        opponent={challengeOpponent}
        onClose={() => (setComposerOpen(false), setChallengeOpponent(null))}
        onSent={() => {
          setComposerOpen(false);
          setChallengeOpponent(null);
          Alert.alert("Challenge sent", "The other team’s managers have been notified.");
        }}
      />
    </div>
  );
}
