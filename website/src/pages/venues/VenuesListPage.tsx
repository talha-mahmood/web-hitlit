import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useSports } from "@app/hooks/useSports";
import { useVenues } from "@app/hooks/useVenues";
import { useDeviceLocation } from "@app/hooks/useDeviceLocation";
import { distanceKm, formatDistanceKm } from "@app/lib/distance";
import type { VenueListItem } from "@app/lib/api/venues";
import { getSportImage } from "@app/lib/sportImages";
import { getVenuePhoto } from "@app/lib/venuePhotos";
import { imageUrl } from "@/lib/cn";
import { useUrlTextParam } from "@/lib/useUrlTextParam";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import FilterPill from "@/components/filters/FilterPill";
import {
  SelectDistanceSheet,
  SelectLocationSheet,
  SelectPriceSheet,
  SelectSportSheet,
  type PriceRange,
} from "@/components/filters/FilterSheets";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
const PRICE_RANGES: readonly PriceRange[] = [
  { label: "Rs 1,000 - 2,000/hr", min: 1000, max: 2000 },
  { label: "Rs 2,000 - 3,000/hr", min: 2000, max: 3000 },
  { label: "Rs 3,000 - 4,000/hr", min: 3000, max: 4000 },
  { label: "Rs 4,000 - 5,000/hr", min: 4000, max: 5000 },
  { label: "Rs 5,000 - 6,000/hr", min: 5000, max: 6000 },
  { label: "Above Rs 6,000/hr", min: 6000, max: null },
];
const MAX_SPORT_CHIPS = 2;

// The Venues list's own card: banner photo (rating + distance pinned on it),
// name, address · city, up to two sport chips (+N), and a "View" CTA.
function VenueListCard({ venue, onPress, distanceLabel, index }: { venue: VenueListItem; onPress: () => void; distanceLabel?: string; index: number }) {
  const coverImage = [...venue.venue_images].sort((a, b) => a.display_order - b.display_order).at(0)?.image_url;
  const sportNames = Array.from(new Set(venue.court.map((c) => c.sports?.name).filter(Boolean))) as string[];
  const photo = coverImage ?? imageUrl(getVenuePhoto(venue.id) ?? getSportImage(sportNames[0] ?? ""));

  return (
    <button
      type="button"
      onClick={onPress}
      className="press block w-full animate-fadeUp overflow-hidden rounded-3xl border border-border bg-surface text-left shadow-card transition-shadow hover:shadow-hero"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative aspect-[100/21] w-full bg-primary-light sm:aspect-[16/7]">
        {photo && <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-[3px] rounded-full bg-black/60 px-[7px] py-[3px] text-[10px] font-bold text-white sm:text-xs">
          <Ionicon name="star" size={10} color={colors.warning} />
          {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
        </span>
        {distanceLabel ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-[7px] py-[3px] text-[10px] font-semibold text-white sm:text-xs">
            {distanceLabel}
          </span>
        ) : null}
      </div>
      <div className="px-2.5 pb-1.5 pt-1.5 sm:px-3.5 sm:pb-3 sm:pt-2.5">
        <p className="mb-0.5 truncate text-sm font-extrabold text-ink sm:text-base">{venue.name}</p>
        <p className="mb-1 flex items-center gap-1 text-[11.5px] text-muted sm:text-[13px]">
          <Ionicon name="location-outline" size={12} color={colors.muted} />
          <span className="truncate">{[venue.address, venue.city].filter(Boolean).join(" · ") || "Location not set"}</span>
        </p>
        <div className="flex items-center justify-between">
          <div className="mr-2 flex min-w-0 flex-1 items-center gap-[5px]">
            {sportNames.slice(0, MAX_SPORT_CHIPS).map((name) => (
              <span key={name} className="truncate rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">
                {name}
              </span>
            ))}
            {sportNames.length > MAX_SPORT_CHIPS && (
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">+{sportNames.length - MAX_SPORT_CHIPS}</span>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-[3px] rounded-2xl bg-brand px-2 py-1 text-[11.5px] font-bold text-white shadow-cta sm:px-3 sm:text-xs">
            View
            <Ionicon name="arrow-forward" size={11} color="white" />
          </span>
        </div>
      </div>
    </button>
  );
}

// Port of VenuesListScreen: search + Location / Sports / Distance / Price
// filters (each a bottom sheet). Filters live in the URL so refresh, back
// and shared links keep them.
export default function VenuesListPage() {
  const navigate = useAppNavigate();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useUrlTextParam("q");
  const selectedSportId = params.get("sport") ?? undefined;
  const locationTags = useMemo(() => (params.get("loc") ? params.get("loc")!.split("|").filter(Boolean) : []), [params]);
  const kmParam = Number(params.get("km"));
  const distanceKmFilter = (DISTANCE_OPTIONS_KM as readonly number[]).includes(kmParam) ? kmParam : null;
  const priceParam = params.get("price");
  const priceRangeFilter = priceParam != null ? (PRICE_RANGES[Number(priceParam)] ?? null) : null;

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true, state: { tab: "venues" } }
    );

  const [sportOpen, setSportOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [distanceOpen, setDistanceOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();

  const { data: sports } = useSports();
  const { data: venuesData, isLoading } = useVenues({
    search: search || undefined,
    sportId: selectedSportId,
    locations: locationTags.length > 0 ? locationTags : undefined,
  });

  const byDistance =
    distanceKmFilter != null && myCoords
      ? (venuesData ?? []).filter((v) => {
          if (v.latitude == null || v.longitude == null) return false;
          return distanceKm(myCoords.latitude, myCoords.longitude, v.latitude, v.longitude) <= distanceKmFilter;
        })
      : venuesData;
  const venues =
    priceRangeFilter != null
      ? (byDistance ?? []).filter((v) => {
          const prices = v.court.map((c) => c.price_per_hour).filter((p): p is number => p != null);
          if (prices.length === 0) return false;
          // Qualifies when its cheapest court ("starting from" price) is in the bracket.
          const startingPrice = Math.min(...prices);
          return startingPrice >= priceRangeFilter.min && (priceRangeFilter.max == null || startingPrice < priceRangeFilter.max);
        })
      : byDistance;

  return (
    <div className="mx-auto max-w-6xl lg:px-8 lg:pt-6">
      <PageHeader title={<span className="text-[26px] font-extrabold">Venues</span>} subtitle="Find and book venues nearby" back backFallback="/" />

      <div className="px-3.5 pt-4 sm:px-6 lg:px-0">
        <FieldInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search venues..."
          autoCapitalize="none"
          autoCorrect="off"
          type="search"
          aria-label="Search venues"
          containerClassName="mb-3 h-[52px] !rounded-[28px] lg:max-w-xl"
          left={<span className="mr-2"><Ionicon name="search-outline" size={20} color={colors.muted} /></span>}
        />

        <div className="no-scrollbar -mx-3.5 mb-3 flex gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:px-0">
          <FilterPill
            icon="location-outline"
            label={locationTags.length === 0 ? "Location" : locationTags.length === 1 ? locationTags[0] : `${locationTags.length} locations`}
            active={locationTags.length > 0}
            onPress={() => setLocationOpen(true)}
          />
          <FilterPill icon="options-outline" label="Sports" active={!!selectedSportId} onPress={() => setSportOpen(true)} />
          <FilterPill
            icon="navigate-outline"
            label={distanceKmFilter != null ? `${distanceKmFilter} km` : "Distance"}
            active={distanceKmFilter != null}
            onPress={() => {
              if (locationStatus !== "granted") requestLocation();
              setDistanceOpen(true);
            }}
          />
          <FilterPill icon="pricetag-outline" label="Price" active={priceRangeFilter != null} onPress={() => setPriceOpen(true)} />
        </div>

        {isLoading ? (
          <div className="pt-1">
            <SkeletonCardRows />
          </div>
        ) : (venues ?? []).length === 0 ? (
          <p className="mt-10 text-center text-muted">
            {distanceKmFilter != null
              ? `No venues found within ${distanceKmFilter} km.`
              : priceRangeFilter != null
                ? `No venues found in ${priceRangeFilter.label.toLowerCase()}.`
                : "No venues found. Try a different search, location, or sport."}
          </p>
        ) : (
          <div className="grid gap-2 pb-5 pt-1 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {(venues ?? []).map((v, i) => (
              <VenueListCard
                key={v.id}
                venue={v}
                index={i}
                distanceLabel={
                  myCoords && v.latitude != null && v.longitude != null
                    ? formatDistanceKm(distanceKm(myCoords.latitude, myCoords.longitude, v.latitude, v.longitude))
                    : undefined
                }
                onPress={() => navigate(paths.venue(v.id))}
              />
            ))}
          </div>
        )}
      </div>

      <SelectDistanceSheet
        open={distanceOpen}
        onClose={() => setDistanceOpen(false)}
        options={DISTANCE_OPTIONS_KM}
        selectedKm={distanceKmFilter}
        locationDenied={locationStatus === "denied"}
        onApply={(km) => {
          setParam("km", km != null ? String(km) : null);
          setDistanceOpen(false);
        }}
      />
      <SelectLocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        value={locationTags}
        onApply={(locs) => {
          setParam("loc", locs.length ? locs.join("|") : null);
          setLocationOpen(false);
        }}
      />
      <SelectSportSheet
        open={sportOpen}
        onClose={() => setSportOpen(false)}
        sports={sports ?? []}
        selectedSportId={selectedSportId}
        onApply={(id) => {
          setParam("sport", id ?? null);
          setSportOpen(false);
        }}
      />
      <SelectPriceSheet
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        options={PRICE_RANGES}
        selected={priceRangeFilter}
        onApply={(range) => {
          setParam("price", range ? String(PRICE_RANGES.indexOf(range)) : null);
          setPriceOpen(false);
        }}
      />
    </div>
  );
}
