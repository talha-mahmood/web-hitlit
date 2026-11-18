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
import { TeamChallengeComposerModal, TeamManagerRequiredModal } from "@/components/challenges/ChallengeModals";
import { useVenues } from "@app/hooks/useVenues";
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
import VenueCard from "@/components/VenueCard";
import PromoCarousel from "@/components/home/PromoCarousel";
import HomeHero, { type HeroStat } from "@/components/home/HomeHero";
import { HomeEventCard, HomeGameRowCard, HomeSquadCard, NearbyEmptyRow, SportFilterCard } from "@/components/home/HomeCards";
import { useAppNavigate } from "@/routes/navigation";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
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

function SectionHeader({ title, icon, subtitle, onSeeAll, seeAllLabel = "View all" }: { title: string; icon: string; subtitle?: string; onSeeAll: () => void; seeAllLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-light">
            <Ionicon name={icon} size={17} color={colors.primary} />
          </span>
          <span className="section-title">{title}</span>
        </h2>
        {subtitle && <p className="mt-1 hidden text-sm text-ink-secondary sm:block">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onSeeAll}
        className="group flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-semibold text-primary-dark transition-colors hover:bg-primary-light"
      >
        {seeAllLabel}
        <Ionicon name="arrow-forward" size={15} color={colors.primary} style={{ transition: "transform .15s" }} />
      </button>
    </div>
  );
}

// Desktop shows a grid with this many cards, then a "view all" tile.
const DESKTOP_GRID_COUNT = 8;

function NearbySection<T>({
  title,
  subtitle,
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
  subtitle?: string;
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
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const grid = horizontal && isDesktop;
  return (
    <section className="mb-12 min-w-0">
      <SectionHeader title={title} subtitle={subtitle} icon={icon} onSeeAll={onSeeAll} />
      {isLoading ? (
        horizontal ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <SkeletonBlock height={150} radius={16} />
            <SkeletonBlock height={150} radius={16} />
            <SkeletonBlock height={150} radius={16} className="hidden sm:block" />
            <SkeletonBlock height={150} radius={16} className="hidden lg:block" />
          </div>
        ) : (
          <SkeletonCardRows count={2} />
        )
      ) : data.length === 0 ? (
        <NearbyEmptyRow icon={emptyIcon} label={emptyLabel} />
      ) : grid ? (
        <div className="grid grid-cols-4 gap-4">
          {data.slice(0, DESKTOP_GRID_COUNT).map((entry) => (
            <div key={keyOf(entry.item)} className="min-w-0">
              {render(entry)}
            </div>
          ))}
          {data.length > DESKTOP_GRID_COUNT && (
            <button
              type="button"
              onClick={onSeeAll}
              className="lift flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-primary/40 bg-primary-light/60 text-sm font-semibold text-primary-dark"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <Ionicon name="arrow-forward" size={20} color="white" />
              </span>
              View all {data.length}
            </button>
          )}
        </div>
      ) : horizontal ? (
        <Rail>
          {data.map((entry) => (
            <div key={keyOf(entry.item)} className="w-[calc((100vw-38px)*0.48)] shrink-0 sm:w-[220px]">
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

// Port of HomeScreen as a website home: a search-first hero (greeting,
// search across venues/games/tournaments/squads/events, live counts), the
// sport filter (tap again to clear), and the nearest-first Venues /
// Challenge a Team / Squads / Games / Tournaments / Events sections, each
// with "View all". Challenging a team opens the composer, or asks you to
// create a team first (and resumes afterwards).
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

  const firstName = profile?.full_name?.split(" ")[0];
  // Desktop: every sport card (plus "All sports") shares one row when they fit.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const sportCardCount = (sports?.length ?? 0) + 1;
  const sportGridStyle = isDesktop && sportCardCount <= 12 ? { gridTemplateColumns: `repeat(${sportCardCount}, minmax(0, 1fr))` } : undefined;
  const selectedSport = (sports ?? []).find((s) => s.id === selectedSportId);
  const heroStats: HeroStat[] = [
    { label: "Venues", value: nearbyVenues.length, loading: venuesLoading, icon: "location", to: paths.venues() },
    { label: "Open games", value: nearbyRegularGames.length, loading: gamesLoading, icon: "tennisball", to: paths.games() },
    { label: "Squads", value: nearbySquads.length, loading: squadsLoading, icon: "people", to: paths.squads },
    { label: "Events", value: nearbyEvents.length, loading: eventsLoading, icon: "calendar", to: paths.events() },
  ];

  return (
    <div>
      <HomeHero firstName={firstName} sports={sports ?? []} stats={heroStats} />

      <div className="border-b border-border bg-surface">
        <section className="site-container py-8 lg:py-10" aria-labelledby="sport-filter-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="sport-filter-title" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-light">
                  <Ionicon name="football" size={17} color={colors.primary} />
                </span>
                <span className="section-title">Browse by sport</span>
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">
                {selectedSport ? (
                  <>
                    Showing <span className="font-semibold text-ink">{selectedSport.name}</span> venues, teams, games and events below.
                  </>
                ) : (
                  "Pick a sport to filter the venues, teams, games and events below."
                )}
              </p>
            </div>
            {selectedSport && (
              <button
                type="button"
                onClick={() => setSelectedSportId(null)}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-gray-50"
              >
                <Ionicon name="close" size={14} color={colors.muted} />
                Clear filter
              </button>
            )}
          </div>
          {/* Phones: a swipeable row. Wider screens: cards share the full row width. */}
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:[grid-template-columns:repeat(auto-fit,minmax(112px,1fr))] lg:gap-4" style={sportGridStyle}>
            <SportFilterCard allSports name="All sports" selected={!selectedSportId} onPress={() => setSelectedSportId(null)} />
            {(sports ?? []).map((s) => (
              <SportFilterCard key={s.id} name={s.name} selected={selectedSportId === s.id} onPress={() => setSelectedSportId((prev) => (prev === s.id ? null : s.id))} />
            ))}
          </div>
        </section>
      </div>

      <div className="site-container pt-10 lg:pt-12">

        <NearbySection
          title="Venues near you"
          subtitle="Courts and turfs closest to you, featured venues first"
          icon="location"
          data={nearbyVenues}
          isLoading={venuesLoading}
          emptyIcon="location-outline"
          emptyLabel="No venues near you yet"
          keyOf={(v: VenueListItem) => v.id}
          render={({ item, km }) => <VenueCard venue={item} showFavorite={false} minimal distanceLabel={km !== null ? formatDistanceKm(km) : undefined} onPress={() => navigate(paths.venue(item.id))} />}
          onSeeAll={() => navigate(paths.venues(), { state: { tab: "venues" } })}
        />

        <section className="mb-12" aria-labelledby="highlights-title">
          <h2 id="highlights-title" className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-light">
              <Ionicon name="sparkles" size={17} color={colors.primary} />
            </span>
            <span className="section-title">Highlights</span>
          </h2>
          <PromoCarousel
            slides={[
              { key: "venues", title: "Book Premium Turfs", image: slide2 },
              { key: "squads", title: "Build Your Squad", image: slide3 },
              { key: "challenge-team", title: "Challenge a team", image: slide4 },
              { key: "nearby-players", title: "Find Players near you", image: slide5 },
            ]}
          />
        </section>

        <NearbySection
          title="Challenge a Team"
          subtitle="Teams near you that are up for a match"
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
          subtitle="Groups and squads you can join"
          icon="people"
          data={nearbyGroups}
          isLoading={squadsLoading}
          emptyIcon="people-outline"
          emptyLabel="No squads near you yet"
          keyOf={(s: SquadListItem) => s.id}
          render={({ item }) => <HomeSquadCard squad={item} currentUserId={userId} myGender={profile?.gender} onPress={() => navigate(paths.squad(item.id))} />}
          onSeeAll={() => navigate(paths.squads)}
        />

        <div className="grid gap-x-10 lg:grid-cols-2">
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
          subtitle="Meetups, socials and community events"
          icon="calendar-outline"
          data={nearbyEvents}
          isLoading={eventsLoading}
          emptyIcon="calendar-outline"
          emptyLabel="No events near you yet"
          keyOf={(e: EventListItem) => e.id}
          render={({ item }) => <HomeEventCard event={item} currentUserId={userId} myGender={profile?.gender} onPress={() => navigate(paths.event(item.id))} />}
          onSeeAll={() => navigate(paths.events())}
        />

        <section className="relative overflow-hidden rounded-3xl bg-brand px-6 py-9 shadow-hero sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:py-12">
          <span aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[36px] border-white/[0.06]" />
          <div className="relative max-w-xl">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Bring your people together</h2>
            <p className="mt-2 text-white/90">Start a squad for your regulars, host an event, or set up a tournament. Everyone gets notified.</p>
          </div>
          <div className="relative mt-6 flex flex-wrap gap-3 lg:mt-0 lg:shrink-0">
            <button
              type="button"
              onClick={() => navigate(paths.createSquad)}
              className="press inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-bold text-primary-deep shadow-hero transition hover:bg-[#ECFDF3]"
            >
              <Ionicon name="people" size={18} color="#0B7A45" />
              Create a squad
            </button>
            <button
              type="button"
              onClick={() => navigate(paths.hostEvent)}
              className="press inline-flex items-center gap-2 rounded-xl border-[1.5px] border-white/40 px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-white/10"
            >
              <Ionicon name="calendar" size={18} color="white" />
              Host an event
            </button>
          </div>
        </section>
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
