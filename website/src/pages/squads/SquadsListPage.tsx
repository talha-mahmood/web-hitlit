import { useEffect, useMemo, useState } from "react";
import { colors } from "@app/constants/theme";
import { useJoinSquad, useSquads } from "@app/hooks/useSquads";
import { useSports } from "@app/hooks/useSports";
import { useDeviceLocation } from "@app/hooks/useDeviceLocation";
import type { SquadGroupType, SquadListItem } from "@app/lib/api/squads";
import { matchesLocationQuery } from "@app/lib/locationFilter";
import { distanceKm } from "@app/lib/distance";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { Alert } from "@/lib/alert";
import { useUrlTextParam } from "@/lib/useUrlTextParam";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import PlainHeader from "@/components/ui/PlainHeader";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import FilterPill from "@/components/filters/FilterPill";
import { SelectDistanceSheet, SelectLocationSheet, SelectSportSheet } from "@/components/filters/FilterSheets";
import { JoinRequestModal } from "@/components/games/JoinSheets";
import SquadCard, { GROUP_TYPE_LABELS, SelectGroupTypeSheet } from "@/components/squads/SquadCard";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;

// Port of SquadsListScreen: search (server-side, name or squad ID), All /
// My Squads, Squad Type / Location / Sports / Distance filters, and the
// shared Request-to-Join sheet straight from the card.
export default function SquadsListPage({ lockedGroupType }: { lockedGroupType?: SquadGroupType } = {}) {
  // lockedGroupType: the same screen scoped to one type (Explore Training Camps).
  const kindLabel = lockedGroupType ? GROUP_TYPE_LABELS[lockedGroupType] : "Squad";
  const kindPlural = `${kindLabel}s`;
  const kindPluralLower = kindPlural.toLowerCase();
  const navigate = useAppNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [searchInput, setSearchInput] = useUrlTextParam("q");
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput.trim());
  const [listFilter, setListFilter] = useState<"all" | "mine">("all");
  const myOnly = listFilter === "mine";
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>(undefined);
  const [groupTypeFilters, setGroupTypeFilters] = useState<SquadGroupType[]>([]);
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | "sport" | "location" | "groupType" | "distance">(null);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: sports } = useSports();
  const { data: squadsData, isLoading } = useSquads({ search: debouncedSearch || undefined, sportId: selectedSportId });

  const squads = useMemo(() => {
    let list = squadsData ?? [];
    if (locationTags.length > 0) list = list.filter((s) => matchesLocationQuery([s.location], locationTags));
    if (myOnly) list = list.filter((s) => s.squad_owner_id === userId || s.squad_members.some((m) => m.user_id === userId && m.status === "ACTIVE"));
    const typeFilters = lockedGroupType ? [lockedGroupType] : groupTypeFilters;
    if (typeFilters.length > 0) list = list.filter((s) => typeFilters.includes(s.group_type as SquadGroupType));
    if (distanceKmFilter != null && myCoords) {
      list = list.filter((s) => {
        const lat = s.profiles?.latitude;
        const lng = s.profiles?.longitude;
        return lat != null && lng != null && distanceKm(myCoords.latitude, myCoords.longitude, lat, lng) <= distanceKmFilter;
      });
    }
    return list;
  }, [squadsData, locationTags, myOnly, userId, groupTypeFilters, lockedGroupType, distanceKmFilter, myCoords]);

  const [joinTarget, setJoinTarget] = useState<SquadListItem | null>(null);
  const joinSquad = useJoinSquad();

  const hasFilters = !!debouncedSearch || locationTags.length > 0 || !!selectedSportId || myOnly || distanceKmFilter != null || groupTypeFilters.length > 0;
  const createLink = () => navigate(lockedGroupType ? paths.createSquadWith({ presetType: lockedGroupType, lockType: true }) : paths.createSquad);

  return (
    <div className="mx-auto max-w-7xl lg:px-8 lg:pt-6">
      <PlainHeader
        wide
        crumbs={[{ label: "Home", to: "/" }]}
        title={kindPlural}
        subtitle={`Find and join ${kindPluralLower} nearby`}
        backFallback={paths.community}
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
          placeholder={`Search ${kindPluralLower}...`}
          type="search"
          aria-label={`Search ${kindPluralLower}`}
          autoCapitalize="none"
          autoCorrect="off"
          containerClassName="mb-3 h-[52px] !rounded-[28px] lg:max-w-xl"
          left={<span className="mr-2"><Ionicon name="search-outline" size={20} color={colors.muted} /></span>}
        />

        <div className="no-scrollbar -mx-3.5 mb-3 flex gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:flex-wrap sm:px-0">
          {(
            [
              ["all", "All"],
              ["mine", `My ${kindPlural}`],
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
          {!lockedGroupType && <FilterPill
            trailingIcon="chevron-down"
            label={groupTypeFilters.length === 0 ? "Squad Type" : groupTypeFilters.length === 1 ? GROUP_TYPE_LABELS[groupTypeFilters[0]] : `${groupTypeFilters.length} types`}
            active={groupTypeFilters.length > 0}
            onPress={() => setSheet("groupType")}
          />}
          <FilterPill
            icon="location-outline"
            label={locationTags.length === 0 ? "Location" : locationTags.length === 1 ? locationTags[0] : `${locationTags.length} locations`}
            active={locationTags.length > 0}
            onPress={() => setSheet("location")}
          />
          {lockedGroupType !== "training_camp" && <FilterPill icon="options-outline" label="Sports" active={!!selectedSportId} onPress={() => setSheet("sport")} />}
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
        ) : squads.length === 0 ? (
          hasFilters ? (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <Ionicon name="search-outline" size={48} color={colors.border} />
              <p className="text-base font-semibold text-ink">No {kindPluralLower} found</p>
              <p className="px-8 text-sm text-muted">
                {debouncedSearch && locationTags.length > 0
                  ? `No ${kindPluralLower} match "${debouncedSearch}" near "${locationTags.join(", ")}".`
                  : locationTags.length > 0
                    ? `No ${kindPluralLower} found near "${locationTags.join(", ")}".`
                    : debouncedSearch
                      ? `No ${kindPluralLower} match "${debouncedSearch}". Try a different name or squad ID.`
                      : myOnly
                        ? `You haven't created any ${kindPluralLower} yet.`
                        : distanceKmFilter != null
                          ? `No ${kindPluralLower} found within ${distanceKmFilter} km.`
                          : "No squads match this sport filter yet."}
              </p>
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <Ionicon name="people-outline" size={48} color={colors.border} />
              <p className="text-base font-semibold text-ink">No {kindPluralLower} yet</p>
              <p className="px-8 text-sm text-muted">Create a {kindLabel.toLowerCase()} to find regular playmates near you!</p>
              <button type="button" onClick={createLink} className="press mt-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white">
                Create a {kindLabel}
              </button>
            </div>
          )
        ) : (
          <div className="grid gap-2 pb-5 pt-1 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
            {squads.map((s, i) => (
              <SquadCard key={s.id} squad={s} index={i} currentUserId={userId} myGender={myGender} onPress={() => navigate(paths.squad(s.id))} onJoinPress={() => setJoinTarget(s)} />
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
      <SelectGroupTypeSheet open={sheet === "groupType"} onClose={() => setSheet(null)} value={groupTypeFilters} onApply={(t) => (setGroupTypeFilters(t), setSheet(null))} />
      <SelectSportSheet open={sheet === "sport"} onClose={() => setSheet(null)} sports={sports ?? []} selectedSportId={selectedSportId} onApply={(id) => (setSelectedSportId(id), setSheet(null))} />

      <JoinRequestModal
        open={!!joinTarget}
        onClose={() => setJoinTarget(null)}
        submitting={joinSquad.isPending}
        title="Request to Join"
        subtitle="The squad captain will see this and can approve or reject your request."
        onSubmit={(skillLevel, location) => {
          if (!userId || !joinTarget) return;
          joinSquad.mutate(
            { squadId: joinTarget.id, userId, skillLevel, location },
            { onSuccess: () => setJoinTarget(null), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request.")) }
          );
        }}
      />
    </div>
  );
}
