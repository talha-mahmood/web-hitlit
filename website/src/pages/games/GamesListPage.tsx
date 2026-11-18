import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "@app/constants/theme";
import { useGames, useJoinGame } from "@app/hooks/useGames";
import { useRequestToJoinTeam } from "@app/hooks/useTournamentTeams";
import { useSports } from "@app/hooks/useSports";
import { useDeviceLocation } from "@app/hooks/useDeviceLocation";
import { hasGameEnded, isGameLive, type GameListItem } from "@app/lib/api/games";
import { matchesLocationQuery } from "@app/lib/locationFilter";
import { distanceKm } from "@app/lib/distance";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { useAuthStore } from "@app/store/authStore";
import { Alert } from "@/lib/alert";
import { useUrlTextParam } from "@/lib/useUrlTextParam";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import PlainHeader from "@/components/ui/PlainHeader";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import FilterPill from "@/components/filters/FilterPill";
import { SelectDistanceSheet, SelectLocationSheet, SelectSportSheet } from "@/components/filters/FilterSheets";
import DateRangeSheet, { type DateSelection } from "@/components/filters/DateRangeSheet";
import GameCard from "@/components/games/GameCard";
import { JoinRequestModal, SelectJoinTeamModal, type JoinableTeam } from "@/components/games/JoinSheets";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

type ListFilter = "all" | "upcoming" | "live" | "completed" | "mine";
const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Port of GamesListScreen: search (name, game ID, sport, venue, area),
// All / Upcoming / Live / Completed / My Games, the Tournaments toggle,
// Location / Sports / Date / Distance filters, newest first; Join (request
// with skill + location) or join a team, straight from the card.
export default function GamesListPage() {
  const navigate = useAppNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const userId = useAuthStore((s) => s.session?.user.id);
  const gameType = params.get("type") === "TOURNAMENT" ? "TOURNAMENT" : undefined;
  const selectedSportId = params.get("sport") ?? undefined;
  const [searchInput, setSearchInput] = useUrlTextParam("q");
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput.trim());
  const [showTournaments, setShowTournaments] = useState(gameType === "TOURNAMENT");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<DateSelection | null>(null);
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | "sport" | "location" | "date" | "distance">(null);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();

  useEffect(() => setShowTournaments(gameType === "TOURNAMENT"), [gameType]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setSport = (id: string | undefined) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("sport", id);
        else next.delete("sport");
        return next;
      },
      { replace: true, preventScrollReset: true, state: window.history.state?.usr }
    );

  const { data: sports } = useSports();
  const { data: gamesData, isLoading } = useGames({ sportId: selectedSportId, gameType: showTournaments ? "TOURNAMENT" : "REGULAR" });

  const games = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    let list = gamesData ?? [];
    if (q) {
      list = list.filter((g) =>
        [g.title, g.game_code, g.sports?.name, g.venues?.name, g.venues?.city, g.venues?.address, g.custom_venue_name].some((v) => !!v && v.toLowerCase().includes(q))
      );
    }
    if (locationTags.length > 0) list = list.filter((g) => matchesLocationQuery([g.venues?.name, g.venues?.city, g.venues?.address, g.custom_venue_name], locationTags));
    if (listFilter === "mine") {
      list = list.filter(
        (g) =>
          g.creator_id === userId ||
          (!!userId && (g.co_host_ids ?? []).includes(userId)) ||
          g.game_players.some((p) => p.user_id === userId && p.status === "JOINED") ||
          g.tournament_teams.some((t) => t.tournament_team_members.some((m) => m.user_id === userId && m.status === "JOINED"))
      );
    } else if (listFilter === "upcoming") {
      list = list.filter((g) => !hasGameEnded(g.game_date, g.end_date, g.end_time) && !isGameLive(g.game_date, g.start_time, g.end_date, g.end_time));
    } else if (listFilter === "live") {
      list = list.filter((g) => isGameLive(g.game_date, g.start_time, g.end_date, g.end_time));
    } else if (listFilter === "completed") {
      list = list.filter((g) => g.status === "COMPLETED");
    }
    if (timeRange) list = list.filter((g) => (g.end_date ?? g.game_date) >= timeRange.start && g.game_date <= timeRange.end);
    list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (distanceKmFilter != null && myCoords) {
      list = list.filter((g) => {
        const lat = g.venues?.latitude;
        const lng = g.venues?.longitude;
        return lat != null && lng != null && distanceKm(myCoords.latitude, myCoords.longitude, lat, lng) <= distanceKmFilter;
      });
    }
    return list;
  }, [gamesData, debouncedSearch, locationTags, listFilter, userId, timeRange, distanceKmFilter, myCoords]);

  const [joinTarget, setJoinTarget] = useState<GameListItem | null>(null);
  const [teamJoinTarget, setTeamJoinTarget] = useState<GameListItem | null>(null);
  const joinGame = useJoinGame();
  const requestToJoinTeam = useRequestToJoinTeam(teamJoinTarget?.id ?? "");
  const joinableTeams: JoinableTeam[] = teamJoinTarget
    ? teamJoinTarget.tournament_teams
        .filter((t) => t.status !== "REJECTED")
        .map((t) => ({ id: t.id, name: t.name, joinedCount: t.tournament_team_members.filter((m) => m.status === "JOINED").length, requiredSize: teamJoinTarget.players_per_team ?? 0 }))
        .filter((t) => t.requiredSize <= 0 || t.joinedCount < t.requiredSize)
    : [];

  const isTournamentList = showTournaments;
  const noun = isTournamentList ? "tournaments" : "games";
  const hasFilters = !!debouncedSearch || locationTags.length > 0 || listFilter !== "all" || !!timeRange;
  const createLink = () => navigate(paths.createGame(gameType ? { gameType } : undefined));

  return (
    <div className="mx-auto max-w-7xl lg:px-8 lg:pt-6">
      <PlainHeader
        wide
        crumbs={[{ label: "Home", to: "/" }]}
        title={gameType === "TOURNAMENT" ? "Tournaments" : "Games"}
        subtitle={isTournamentList ? "Find and join tournaments nearby" : "Find and join games nearby"}
        backFallback={paths.home}
        right={
          <button type="button" onClick={createLink} className="press flex items-center gap-1 rounded-full bg-surface px-3.5 py-2 text-[13px] font-bold text-primary-dark shadow-card hover:bg-gray-50">
            <Ionicon name="add" size={16} color={colors.primaryDark} />
            Create
          </button>
        }
      />

      <div className="px-3.5 pt-4 sm:px-6 lg:px-0">
        <FieldInput
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={isTournamentList ? "Search tournaments..." : "Search games, tournaments..."}
          type="search"
          aria-label="Search games"
          containerClassName="mb-3 h-[52px] !rounded-[28px] lg:max-w-xl"
          left={<span className="mr-2"><Ionicon name="search-outline" size={20} color={colors.muted} /></span>}
        />

        <div className="no-scrollbar -mx-3.5 mb-3 flex gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:flex-wrap sm:px-0">
          {(
            [
              ["all", "All"],
              ["upcoming", "Upcoming"],
              ["live", "Live"],
              ["completed", "Completed"],
              ["mine", isTournamentList ? "My Tournaments" : "My Games"],
            ] as const
          ).map(([key, label]) => {
            const active = listFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setListFilter(active && key !== "all" ? "all" : key)}
                className={`shrink-0 rounded-full border px-[9px] py-[5px] text-[11.5px] font-medium sm:px-3 sm:py-1.5 sm:text-[13px] ${active ? "border-primary bg-brand text-white" : "border-border bg-surface text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            );
          })}
          <FilterPill icon="options-outline" label="Sports" active={!!selectedSportId} onPress={() => setSheet("sport")} />
          <FilterPill
            icon="location-outline"
            label={locationTags.length === 0 ? "Location" : locationTags.length === 1 ? locationTags[0] : `${locationTags.length} locations`}
            active={locationTags.length > 0}
            onPress={() => setSheet("location")}
          />
          <FilterPill
            icon="calendar-outline"
            label={timeRange ? (timeRange.start === timeRange.end ? formatShortDate(timeRange.start) : `${formatShortDate(timeRange.start)} - ${formatShortDate(timeRange.end)}`) : "Date"}
            active={!!timeRange}
            onPress={() => setSheet("date")}
          />
          {timeRange && (
            <button type="button" aria-label="Clear date filter" onClick={() => setTimeRange(null)} className="-ml-1 shrink-0">
              <Ionicon name="close-circle" size={18} color={colors.primary} />
            </button>
          )}
          <FilterPill
            icon="navigate-outline"
            label={distanceKmFilter != null ? `${distanceKmFilter} km` : "Distance"}
            active={distanceKmFilter != null}
            onPress={() => {
              if (locationStatus !== "granted") requestLocation();
              setSheet("distance");
            }}
          />
        </div>

        {isLoading ? (
          <div className="pt-1">
            <SkeletonCardRows />
          </div>
        ) : games.length === 0 ? (
          hasFilters ? (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <Ionicon name="search-outline" size={48} color={colors.border} />
              <p className="text-base font-semibold text-ink">No {noun} found</p>
              <p className="px-8 text-sm text-muted">
                {debouncedSearch && locationTags.length > 0
                  ? `No ${noun} match "${debouncedSearch}" near "${locationTags.join(", ")}".`
                  : locationTags.length > 0
                    ? `No ${noun} found near "${locationTags.join(", ")}".`
                    : debouncedSearch
                      ? `No ${noun} match "${debouncedSearch}". Try a different name or ${isTournamentList ? "tournament" : "game"} ID.`
                      : `You haven't created any ${noun} yet.`}
              </p>
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <Ionicon name="tennisball-outline" size={48} color={colors.border} />
              <p className="text-base font-semibold text-ink">No {noun} yet</p>
              <p className="px-8 text-sm text-muted">Be the first to create a {isTournamentList ? "tournament" : "game"} and invite players to join!</p>
              <button type="button" onClick={createLink} className="press mt-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white">
                Create a {isTournamentList ? "Tournament" : "Game"}
              </button>
            </div>
          )
        ) : (
          <div className="grid gap-2 pb-5 pt-1 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
            {games.map((g, i) => (
              <GameCard
                key={g.id}
                game={g}
                index={i}
                currentUserId={userId}
                onPress={() => navigate(paths.game(g.id))}
                onJoinPress={() => setJoinTarget(g)}
                onTeamJoinPress={() => setTeamJoinTarget(g)}
              />
            ))}
          </div>
        )}
      </div>

      <SelectDistanceSheet
        open={sheet === "distance"}
        onClose={() => setSheet(null)}
        options={DISTANCE_OPTIONS_KM}
        selectedKm={distanceKmFilter}
        locationDenied={locationStatus === "denied"}
        onApply={(km) => (setDistanceKmFilter(km), setSheet(null))}
      />
      <SelectLocationSheet open={sheet === "location"} onClose={() => setSheet(null)} value={locationTags} onApply={(l) => (setLocationTags(l), setSheet(null))} />
      <SelectSportSheet open={sheet === "sport"} onClose={() => setSheet(null)} sports={sports ?? []} selectedSportId={selectedSportId} onApply={(id) => (setSport(id), setSheet(null))} />
      <DateRangeSheet
        open={sheet === "date"}
        initialSelection={timeRange}
        onClose={() => setSheet(null)}
        onSave={(sel) => (setTimeRange(sel), setSheet(null))}
        onClear={() => (setTimeRange(null), setSheet(null))}
      />

      <JoinRequestModal
        open={!!joinTarget}
        onClose={() => setJoinTarget(null)}
        submitting={joinGame.isPending}
        title="Request to Join"
        subtitle={
          joinTarget && joinTarget.entry_fee > 0
            ? `Entry fee: Rs ${joinTarget.entry_fee.toLocaleString()} (pay at the venue). The host must approve your request before you're added.`
            : "The host must approve your request before you're added."
        }
        onSubmit={(skillLevel, location) => {
          if (!userId || !joinTarget) return;
          joinGame.mutate(
            { gameId: joinTarget.id, userId, skillLevel, location },
            { onSuccess: () => setJoinTarget(null), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request.")) }
          );
        }}
      />
      <SelectJoinTeamModal
        open={!!teamJoinTarget}
        onClose={() => setTeamJoinTarget(null)}
        teams={joinableTeams}
        submitting={requestToJoinTeam.isPending}
        onSelect={(teamId) => {
          if (!userId || !teamJoinTarget) return;
          requestToJoinTeam.mutate(
            { teamId, userId },
            {
              onSuccess: () => {
                setTeamJoinTarget(null);
                qc.invalidateQueries({ queryKey: ["games"] });
              },
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not join this team.")),
            }
          );
        }}
      />
    </div>
  );
}
