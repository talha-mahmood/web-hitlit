import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { colors } from "@app/constants/theme";
import { useEvents, useJoinEvent } from "@app/hooks/useEvents";
import { useDeviceLocation } from "@app/hooks/useDeviceLocation";
import { hasEventEnded, isEventLive, type EventListItem } from "@app/lib/api/events";
import { matchesLocationQuery } from "@app/lib/locationFilter";
import { distanceKm } from "@app/lib/distance";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { Alert } from "@/lib/alert";
import { useUrlTextParam } from "@/lib/useUrlTextParam";
import { Ionicon } from "@/components/icons/Icon";
import { AvatarStack } from "@/components/ui/Avatar";
import FieldInput from "@/components/ui/FieldInput";
import PlainHeader from "@/components/ui/PlainHeader";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import FilterPill from "@/components/filters/FilterPill";
import { SelectDistanceSheet, SelectLocationSheet } from "@/components/filters/FilterSheets";
import { EventJoinRequestModal } from "@/components/games/JoinSheets";
import GeneratedEntityVisual from "@/components/GeneratedEntityVisual";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

const DISTANCE_OPTIONS_KM = [5, 10, 20, 30] as const;
type ListFilter = "all" | "upcoming" | "live" | "completed" | "mine";

// Port of ExploreEventsScreen's EventCard: name, location, members, event
// type, host; Join / Joined / Requested / Closed / gender-only CTA top-right
// and the event's (custom or generated) badge in the green disc.
export function EventCard({ event, onPress, onJoinPress, currentUserId, myGender, index = 0 }: { event: EventListItem; onPress: () => void; onJoinPress: () => void; currentUserId?: string; myGender?: string | null; index?: number }) {
  const active = event.event_members.filter((m) => m.status === "ACTIVE");
  const isClosed = event.join_requests_blocked;
  const isMine = event.event_owner_id === currentUserId;
  const hasJoined = event.event_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = event.event_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  const isGenderRestricted = event.gender !== "mixed" && (!myGender || myGender !== event.gender) && !hasJoined && !hasRequested;
  const stop = (fn: () => void) => (e: MouseEvent) => (e.stopPropagation(), fn());
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => e.key === "Enter" && onPress()}
      className="press relative min-h-[146px] animate-fadeUp cursor-pointer overflow-hidden rounded-3xl border border-border bg-surface shadow-card transition-shadow hover:shadow-hero"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="absolute right-2.5 top-2.5 z-[5] text-[11.5px]">
        {isClosed && !hasJoined ? (
          <span className="block rounded-2xl bg-gray-100 px-2 py-1 font-bold text-muted">Closed</span>
        ) : !isMine && isGenderRestricted ? (
          <span className="block rounded-2xl bg-gray-100 px-2 py-1 font-bold text-muted">{event.gender === "male" ? "Male Only" : "Female Only"}</span>
        ) : hasJoined || isMine ? (
          <span className="flex min-w-[60px] items-center justify-center gap-[3px] rounded-2xl bg-green-50 px-2 py-1 font-semibold text-primary">
            <Ionicon name="checkmark-circle" size={13} color={colors.primary} />
            Joined
          </span>
        ) : hasRequested ? (
          <button type="button" onClick={stop(onJoinPress)} className="min-w-[60px] rounded-2xl bg-orange-50 px-2 py-1 font-semibold text-orange-600">
            Requested
          </button>
        ) : (
          <button type="button" onClick={stop(onJoinPress)} className="min-w-[60px] rounded-2xl bg-brand px-2 py-1 font-bold text-white shadow-cta transition active:scale-95">
            Join
          </button>
        )}
      </div>
      <span className="pointer-events-none absolute -right-7 top-11 flex h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-full bg-primary-light">
        <GeneratedEntityVisual id={event.id} name={event.name} sport={event.event_type} kind="event" imageUrl={event.icon_url} size={48} style={{ marginRight: 17 }} />
      </span>
      <div className="px-2.5 pb-2 pt-2">
        <div className="mb-1 flex items-center gap-1.5 pr-20">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4.4px] bg-primary-light">
            <Ionicon name="calendar" size={13} color={colors.primary} style={{ opacity: 0.8 }} />
          </span>
          <p className="flex-1 truncate text-sm font-extrabold text-ink">{event.name}</p>
        </div>
        <p className="mb-1 flex items-center gap-1 pr-[92px] text-[11.5px] text-muted">
          <Ionicon name="location-outline" size={12} color={colors.muted} />
          <span className="truncate">{event.location ?? "Location not set"}</span>
        </p>
        <div className="mb-1.5 flex items-center gap-[5px] pr-[92px]">
          <AvatarStack people={active.map((m) => ({ avatar: m.profiles?.avatar ?? null, name: m.profiles?.full_name ?? null }))} size={20} />
          <span className="text-[11.5px] font-medium text-muted">
            {active.length} member{active.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="inline-block max-w-[60%] truncate rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">{event.event_type}</span>
        <p className="mt-1.5 flex items-center pr-[92px] text-xs text-muted">
          <Ionicon name="person-outline" size={13} color={colors.muted} style={{ marginRight: 4 }} />
          <span className="truncate">{event.profiles?.full_name ?? "Unknown"}</span>
        </p>
      </div>
    </div>
  );
}

// Port of ExploreEventsScreen: search, All / Upcoming / Live / Completed /
// My Events, Location and Distance filters ("near me" is measured from the
// host's registered location — events carry no coordinates), Host button.
export default function ExploreEventsPage() {
  const navigate = useAppNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const [searchInput, setSearchInput] = useUrlTextParam("q");
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput.trim());
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [distanceKmFilter, setDistanceKmFilter] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | "location" | "distance">(null);
  const { coords: myCoords, status: locationStatus, requestLocation } = useDeviceLocation();
  const [joinTarget, setJoinTarget] = useState<EventListItem | null>(null);
  const joinEvent = useJoinEvent();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: eventsData, isLoading } = useEvents({ search: debouncedSearch || undefined });
  const events = useMemo(() => {
    let list = eventsData ?? [];
    if (locationTags.length > 0) list = list.filter((e) => matchesLocationQuery([e.location], locationTags));
    if (listFilter === "mine") list = list.filter((e) => e.event_owner_id === userId || e.event_members.some((m) => m.user_id === userId && m.status === "ACTIVE"));
    else if (listFilter === "upcoming") list = list.filter((e) => !hasEventEnded(e.event_date, e.end_date, e.end_time) && !isEventLive(e.event_date, e.start_time, e.end_date, e.end_time));
    else if (listFilter === "live") list = list.filter((e) => isEventLive(e.event_date, e.start_time, e.end_date, e.end_time));
    else if (listFilter === "completed") list = list.filter((e) => hasEventEnded(e.event_date, e.end_date, e.end_time));
    if (distanceKmFilter != null && myCoords) {
      list = list.filter((e) => {
        const lat = e.profiles?.latitude;
        const lng = e.profiles?.longitude;
        return lat != null && lng != null && distanceKm(myCoords.latitude, myCoords.longitude, lat, lng) <= distanceKmFilter;
      });
    }
    return list;
  }, [eventsData, locationTags, listFilter, userId, distanceKmFilter, myCoords]);

  const hasFilters = !!debouncedSearch || locationTags.length > 0 || listFilter !== "all" || distanceKmFilter != null;
  const emptyMessage =
    debouncedSearch && locationTags.length > 0
      ? `No events match "${debouncedSearch}" near "${locationTags.join(", ")}".`
      : locationTags.length > 0
        ? `No events found near "${locationTags.join(", ")}".`
        : debouncedSearch
          ? `No events match "${debouncedSearch}". Try a different name or event type.`
          : listFilter === "mine"
            ? "You haven't hosted any events yet."
            : listFilter === "upcoming"
              ? "No upcoming events right now."
              : listFilter === "live"
                ? "No events are live right now."
                : listFilter === "completed"
                  ? "No completed events yet."
                  : `No events found within ${distanceKmFilter} km.`;

  return (
    <div className="mx-auto max-w-7xl lg:px-8">
      <PlainHeader
        wide
        crumbs={[{ label: "Home", to: "/" }]}
        title="Events"
        subtitle="Find and join events nearby"
        backFallback={paths.community}
        right={
          <button type="button" onClick={() => navigate(paths.hostEvent)} className="press flex items-center gap-1 rounded-full bg-surface px-3.5 py-2 text-[13px] font-bold text-primary-dark shadow-card hover:bg-gray-50">
            <Ionicon name="add" size={16} color={colors.primaryDark} />
            Host
          </button>
        }
      />
      <div className="px-3.5 pt-4 sm:px-6 lg:px-0">
        <FieldInput
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search events..."
          type="search"
          aria-label="Search events"
          autoCapitalize="none"
          autoCorrect="off"
          containerClassName="mb-3 h-[52px] !rounded-[28px] lg:max-w-xl"
          left={
            <span className="mr-2">
              <Ionicon name="search-outline" size={20} color={colors.muted} />
            </span>
          }
        />
        <div className="no-scrollbar -mx-3.5 mb-3 flex gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:flex-wrap sm:px-0">
          {(
            [
              ["all", "All"],
              ["upcoming", "Upcoming"],
              ["live", "Live"],
              ["completed", "Completed"],
              ["mine", "My Events"],
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
          <FilterPill icon="location-outline" label={locationTags.length === 0 ? "Location" : locationTags.length === 1 ? locationTags[0] : `${locationTags.length} locations`} active={locationTags.length > 0} onPress={() => setSheet("location")} />
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
          <SkeletonCardRows />
        ) : events.length === 0 ? (
          hasFilters ? (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <Ionicon name="search-outline" size={48} color={colors.border} />
              <p className="text-base font-semibold text-ink">No events found</p>
              <p className="px-8 text-sm text-muted">{emptyMessage}</p>
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <Ionicon name="calendar-outline" size={48} color={colors.border} />
              <p className="text-base font-semibold text-ink">No events yet</p>
              <p className="px-8 text-sm text-muted">Host an event to bring players together near you!</p>
              <button type="button" onClick={() => navigate(paths.hostEvent)} className="press mt-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-cta">
                Host an Event
              </button>
            </div>
          )
        ) : (
          <div className="grid gap-2 pb-6 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} currentUserId={userId} myGender={myGender} onPress={() => navigate(paths.event(e.id))} onJoinPress={() => setJoinTarget(e)} />
            ))}
          </div>
        )}
      </div>

      <SelectLocationSheet open={sheet === "location"} onClose={() => setSheet(null)} value={locationTags} onApply={(l) => (setLocationTags(l), setSheet(null))} />
      <SelectDistanceSheet
        open={sheet === "distance"}
        onClose={() => setSheet(null)}
        options={DISTANCE_OPTIONS_KM}
        selectedKm={distanceKmFilter}
        locationDenied={locationStatus === "denied"}
        onApply={(km) => (setDistanceKmFilter(km), setSheet(null))}
      />
      <EventJoinRequestModal
        open={!!joinTarget}
        onClose={() => setJoinTarget(null)}
        submitting={joinEvent.isPending}
        title="Request to Join"
        subtitle="The event host will see this and can approve or reject your request."
        onSubmit={(location) =>
          userId &&
          joinTarget &&
          joinEvent.mutate({ eventId: joinTarget.id, userId, location }, { onSuccess: () => setJoinTarget(null), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send request.")) })
        }
      />
    </div>
  );
}
