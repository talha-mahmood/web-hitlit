import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useAdminVenueDetail, useVenueBookings, useMyVenues, useAllMyVenuesBookings } from "@app/hooks/useVenuesAdmin";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { computeDashboardStats, computeRevenueByScale, computeUpcomingBookings, computeRecentActivity, computeTopVenues, type RevenueScale } from "@app/lib/adminDashboard";
import { STATUS_BADGE } from "@app/lib/bookingStatus";
import { getSportImage } from "@app/lib/sportImages";
import { getSportIcon } from "@app/lib/sportIcons";
import { toLocalDateStr, generateFullDaySlots, slotBoundaryDateTime } from "@app/lib/slots";
import { signOutGoogle } from "@app/lib/googleAuth";
import { signOutWithPushCleanup } from "@app/lib/pushNotifications";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Modal from "@/components/ui/Modal";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import { EmptyBox, Loading, RevenueBarChart, ScaleToggle, SectionCard, SportIconBadge, StatCard, StatusBadge, useAdminPaths } from "@/components/admin/AdminParts";
import { VenueMenuOverlay } from "@/components/admin/AdminMenus";
import { useAppNavigate } from "@/routes/navigation";

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

// Port of AdminVenueListScreen: the venue admin's own venues, then Sign out.
export function AdminVenueListPage() {
  const navigate = useAppNavigate();
  const p = useAdminPaths();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venues, isLoading } = useMyVenues(userId);

  return (
    <div className="min-h-dvh bg-app">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-[calc(env(safe-area-inset-top)+16px)] lg:pt-10">
        <h1 className="mb-4 px-2 text-2xl font-bold text-ink">Your Venues</h1>
        {isLoading ? (
          <SkeletonCardRows />
        ) : (venues ?? []).length === 0 ? (
          <EmptyBox icon="business-outline" text="No venues assigned to you yet. Contact the app admin." />
        ) : (
          <div className="flex flex-col gap-3">
            {(venues ?? []).map((v) => (
              <button key={v.id} type="button" onClick={() => navigate(p.venue(v.id))} className="flex items-center rounded-2xl border border-border bg-surface p-3 text-left transition hover:shadow-card">
                {v.venue_images[0] ? (
                  <img src={v.venue_images[0].image_url} alt="" className="mr-3 h-14 w-14 rounded-xl bg-app object-cover" />
                ) : (
                  <span className="mr-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light">
                    <Ionicon name="business-outline" size={22} color={colors.primary} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{v.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{v.city ?? "City not set"}</span>
                </span>
                <Ionicon name="chevron-forward" size={16} color={colors.muted} />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={async () => {
            await signOutGoogle();
            signOutWithPushCleanup();
          }}
          className="mt-4 w-full rounded-xl border border-danger py-3 font-semibold text-danger hover:bg-red-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// Port of AdminDashboardScreen: greeting header with the venue switcher,
// today's revenue + Bookings, Boost and Venue Photos shortcuts, the venue's
// sports, four stat cards, today's schedule (+ hour-by-hour sheet), revenue
// overview by days/weeks/months/year, upcoming bookings, top venues and
// recent notifications.
export default function AdminDashboardPage() {
  const { venueId = "" } = useParams();
  const navigate = useAppNavigate();
  const p = useAdminPaths();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const { data: venue, isLoading } = useAdminVenueDetail(venueId);
  const { data: bookings } = useVenueBookings(venueId);
  const { data: myVenues } = useMyVenues(userId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [hourlyOpen, setHourlyOpen] = useState(false);
  const [hourlyCourtId, setHourlyCourtId] = useState<string | null>(null);
  const [revenueScale, setRevenueScale] = useState<RevenueScale>("days");

  const venueIds = useMemo(() => (myVenues ?? []).map((v) => v.id), [myVenues]);
  const { data: allBookings } = useAllMyVenuesBookings(venueIds);
  const venueSports = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of venue?.court ?? []) if (c.sports?.name) seen.set(c.sports_id, c.sports.name);
    return Array.from(seen.values());
  }, [venue]);
  const stats = useMemo(() => (venue && bookings ? computeDashboardStats(bookings, venue, venue.court.length) : null), [venue, bookings]);
  const revenue = useMemo(() => (bookings ? computeRevenueByScale(bookings, revenueScale) : null), [bookings, revenueScale]);
  const upcoming = useMemo(() => (bookings ? computeUpcomingBookings(bookings) : []), [bookings]);
  const recent = useMemo(() => (bookings ? computeRecentActivity(bookings) : []), [bookings]);
  const topVenues = useMemo(() => ((myVenues?.length ?? 0) > 1 ? computeTopVenues(myVenues!, allBookings) : []), [myVenues, allBookings]);

  if (isLoading || !venue || !stats || !revenue) return <Loading />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const today = toLocalDateStr(new Date());

  return (
    <div className="pb-10">
      <header className="rounded-b-[28px] bg-gradient-to-br from-[#0B3B24] to-[#062A19] px-3.5 pb-11 pt-[calc(env(safe-area-inset-top)+12px)] lg:rounded-b-none lg:px-8 lg:pb-14 lg:pt-8">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-full p-0.5 hover:bg-white/10">
            <Ionicon name="menu" size={26} color="white" />
          </button>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
            )}
          </button>
        </div>
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[1px] text-white/65">{greeting.toUpperCase()}</p>
          <p className="mt-1 text-2xl font-bold text-white">{firstName} 👋</p>
          {(myVenues?.length ?? 0) > 1 && (
            <button type="button" onClick={() => setSwitcherOpen(true)} className="mt-3 flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25">
              <Ionicon name="business" size={14} color="white" />
              <span className="truncate">{venue.name}</span>
              <Ionicon name="chevron-down" size={14} color="white" />
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto -mt-[30px] max-w-5xl px-3.5 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-surface p-5 shadow-card">
          <div className="min-w-0">
            <p className="text-xs text-muted">Today's Revenue</p>
            <p className="mt-1 truncate text-2xl font-extrabold text-ink">Rs {stats.todaysRevenue.toLocaleString()}</p>
          </div>
          <button type="button" onClick={() => navigate(p.bookings(venueId))} className="press flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
            <Ionicon name="calendar" size={14} color="white" />
            Bookings
          </button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => navigate(p.boost(venueId))} className="flex items-center justify-between gap-2.5 rounded-2xl bg-[#111827] p-4 text-left text-sm font-semibold text-white hover:brightness-110">
            <Ionicon name="rocket" size={18} color="#F59E0B" />
            <span className="flex-1">Boost Your Venue — get more bookings in your area</span>
            <Ionicon name="chevron-forward" size={16} color="white" />
          </button>
          <button type="button" onClick={() => navigate(p.venuePhotos(venueId))} className="flex items-center justify-between gap-2.5 rounded-2xl bg-surface p-4 text-left text-sm font-semibold text-ink shadow-card hover:shadow-hero">
            <Ionicon name="images" size={18} color={colors.primary} />
            <span className="flex-1">Venue Photos — the first one shows on your listing card</span>
            <Ionicon name="chevron-forward" size={16} color={colors.muted} />
          </button>
        </div>

        {venueSports.length > 0 && (
          <div className="mb-6">
            <p className="mb-3 text-xs font-bold tracking-[1px] text-ink">SPORTS &amp; COURTS</p>
            <div className="no-scrollbar flex gap-[18px] overflow-x-auto">
              {venueSports.map((sport) => {
                const photo = imageUrl(getSportImage(sport));
                const { icon, bg, fg } = getSportIcon(sport);
                return (
                  <button key={sport} type="button" onClick={() => navigate(p.courts(venueId))} className="flex w-16 shrink-0 flex-col items-center">
                    {photo ? (
                      <img src={photo} alt="" className="h-14 w-14 rounded-[18px] object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-[18px]" style={{ backgroundColor: bg }}>
                        <MCIcon name={icon} size={28} color={fg} />
                      </span>
                    )}
                    <span className="mt-1.5 w-full truncate text-center text-xs font-medium text-ink">{sport}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon="calendar" iconBg={colors.primaryLight} iconColor={colors.primaryDark} label="Today's Bookings" value={String(stats.todaysBookingsCount)} delta={stats.bookingsDelta} />
          <StatCard icon="wallet" iconBg="rgb(var(--jz-purple-100))" iconColor="#7C3AED" label="Today's Revenue" value={`Rs ${stats.todaysRevenue.toLocaleString()}`} delta={stats.revenueDelta} />
          <StatCard icon="pie-chart" iconBg="rgb(var(--jz-blue-100))" iconColor="#2563EB" label="Occupancy Rate" value={`${stats.occupancyRate}%`} delta={stats.occupancyDelta} />
          <StatCard icon="time" iconBg="rgb(var(--jz-orange-100))" iconColor="#EA580C" label="Pending Bookings" value={String(stats.pendingCount)} />
        </div>

        <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-4">
          <div>
            <SectionCard
              title="Today's Schedule"
              action="View by Hour"
              onAction={() => {
                setHourlyCourtId(venue.court[0]?.id ?? null);
                setHourlyOpen(true);
              }}
            >
              {stats.todaysSchedule.length === 0 ? (
                <p className="py-2 text-sm text-muted">No bookings scheduled for today yet.</p>
              ) : (
                stats.todaysSchedule.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 border-b border-border py-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                      <SportIconBadge sportName={b.court?.sports?.name} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{formatTimeRange(b.start_time, b.end_time)}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{b.court?.name ?? "Court"}</span>
                      </span>
                    </span>
                    <StatusBadge badge={STATUS_BADGE[b.status]} />
                  </div>
                ))
              )}
            </SectionCard>
            <SectionCard title="Upcoming Bookings">
              {upcoming.length === 0 ? (
                <p className="py-2 text-sm text-muted">No upcoming bookings yet.</p>
              ) : (
                upcoming.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 border-b border-border py-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                      <SportIconBadge sportName={b.court?.sports?.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {b.court?.name ?? "Court"} · {b.profiles?.full_name ?? "Customer"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">{formatTimeRange(b.start_time, b.end_time)}</span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <StatusBadge badge={STATUS_BADGE[b.status]} />
                      <span className="text-xs font-semibold text-ink">Rs {b.total_amount.toLocaleString()}</span>
                    </span>
                  </div>
                ))
              )}
            </SectionCard>
          </div>
          <div>
            <SectionCard title="Revenue Overview">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">Total Revenue ({revenue.periodLabel})</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-ink">Rs {revenue.total.toLocaleString()}</p>
                </div>
                {revenue.deltaPct !== null && (
                  <span className="flex items-center gap-0.5 text-[11px]" style={{ color: revenue.deltaPct >= 0 ? colors.primary : colors.danger }}>
                    <Ionicon name={revenue.deltaPct >= 0 ? "arrow-up" : "arrow-down"} size={11} color={revenue.deltaPct >= 0 ? colors.primary : colors.danger} />
                    {Math.abs(revenue.deltaPct)}% vs previous {revenue.periodLabel.replace("last ", "")}
                  </span>
                )}
              </div>
              <ScaleToggle options={["days", "weeks", "months", "year"] as RevenueScale[]} value={revenueScale} onChange={setRevenueScale} />
              <RevenueBarChart labels={revenue.labels} values={revenue.values} />
            </SectionCard>
            {topVenues.length > 0 && (
              <SectionCard title="Top Venues">
                {topVenues.map((v) => (
                  <div key={v.venueId} className="flex items-center justify-between gap-3 border-b border-border py-2">
                    <span className="flex-1 truncate text-sm font-medium text-ink">{v.name}</span>
                    <span className="text-xs text-muted">{v.bookingsCount} bookings</span>
                    <span className="text-xs font-semibold text-ink">Rs {v.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </SectionCard>
            )}
            <SectionCard title="Recent Notifications">
              {recent.length === 0 ? (
                <p className="py-2 text-sm text-muted">No recent activity yet.</p>
              ) : (
                recent.map((b) => (
                  <div key={b.id} className="flex items-start gap-2.5 border-b border-border py-2">
                    <SportIconBadge sportName={b.court?.sports?.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        {b.court?.name ?? "A court"} booked for {formatTimeRange(b.start_time, b.end_time)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{b.profiles?.full_name ?? "Customer"}</span>
                    </span>
                  </div>
                ))
              )}
            </SectionCard>
          </div>
        </div>
      </div>

      <VenueMenuOverlay venueId={venueId} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <Modal open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Switch Venue">
        {(myVenues ?? []).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setSwitcherOpen(false);
              navigate(p.venue(v.id), { replace: true });
            }}
            className="flex w-full items-center justify-between border-b border-border py-3 text-left text-sm font-medium text-ink hover:text-primary"
          >
            {v.name}
            {v.id === venueId && <Ionicon name="checkmark-circle" size={20} color={colors.primary} />}
          </button>
        ))}
      </Modal>

      <Modal open={hourlyOpen} onClose={() => setHourlyOpen(false)} title="Today, Hour by Hour">
        {venue.court.length > 1 && (
          <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
            {venue.court.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === hourlyCourtId}
                onClick={() => setHourlyCourtId(c.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${c.id === hourlyCourtId ? "bg-brand text-white" : "border border-border bg-surface text-ink"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {generateFullDaySlots().map((slot) => {
          const s = slotBoundaryDateTime(today, slot.start, false).getTime();
          const e = slotBoundaryDateTime(today, slot.end, true).getTime();
          const match = (bookings ?? []).find((b) => b.court?.id === hourlyCourtId && s < new Date(b.end_time).getTime() && e > new Date(b.start_time).getTime());
          const isBlocked = match?.status === "BLOCKED";
          const isBooked = !!match && !isBlocked;
          const badge = isBlocked ? { bg: "bg-red-50", text: "text-red-600", label: "Blocked" } : isBooked ? { bg: "bg-blue-50", text: "text-blue-600", label: "Booked" } : { bg: "bg-green-50", text: "text-green-700", label: "Available" };
          return (
            <div key={slot.start} className="flex items-center justify-between gap-2 border-b border-border py-2">
              <span className="text-sm text-ink">{slot.label}</span>
              <StatusBadge badge={{ ...badge, label: `${badge.label}${isBooked && match?.profiles?.full_name ? ` · ${match.profiles.full_name}` : ""}` }} />
            </div>
          );
        })}
      </Modal>
    </div>
  );
}
