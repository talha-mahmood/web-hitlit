import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useAdminVenueDetail, useVenueBookings, useCancelledBookingsCount } from "@app/hooks/useVenuesAdmin";
import { useVenueReviews, useRespondToVenueReview } from "@app/hooks/useVenueReviews";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useDeleteNotification, useDeleteAllNotifications } from "@app/hooks/useNotifications";
import { useLookupProfileByEmail, useAssignVenueAdmin, useRemoveVenueAdmin, useVenueAdmins, useGrantVenueAdmin, useRevokeVenueAdminAccess, useAllVenues } from "@app/hooks/useSuperadmin";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { computeDashboardStats, computeVenueAnalytics, computeSportBreakdown, computeRevenueByScale, type RevenueScale } from "@app/lib/adminDashboard";
import type { VenueBooking } from "@app/lib/api/venuesAdmin";
import type { VenueReview } from "@app/lib/api/venueReviews";
import type { NotificationRow } from "@app/lib/api/notifications";
import type { AdminLookupResult } from "@app/lib/api/superadmin";
import { STATUS_BADGE, COUNTED_STATUSES, REVENUE_STATUSES } from "@app/lib/bookingStatus";
import { toLocalDateStr } from "@app/lib/slots";
import { exportCsv } from "@app/lib/exportCsv";
import { BOOKING_CSV_HEADER, formatBookingRowForCsv, toSafeFilenameSegment } from "@app/lib/bookingCsv";
import { isVenueBoosted } from "@app/lib/api/venues";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import FieldInput from "@/components/ui/FieldInput";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import DateRangeSheet, { type DateSelection } from "@/components/filters/DateRangeSheet";
import { AdminPageHeader, EmptyBox, Loading, PageBody, RevenueLineChart, ScaleToggle, SportIconBadge, StatCard, StatusBadge, useAdminPaths, useAdminRole } from "@/components/admin/AdminParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}
const formatDateLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// All Sports + one chip per sport offered at the venue.
function SportChips({ sports, selected, onSelect }: { sports: string[]; selected: string | null; onSelect: (s: string | null) => void }) {
  if (sports.length === 0) return null;
  return (
    <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
      {[null, ...sports].map((sport) => {
        const isSel = selected === sport;
        return (
          <button
            key={sport ?? "all"}
            type="button"
            aria-pressed={isSel}
            onClick={() => onSelect(sport)}
            className={`shrink-0 rounded-xl border-[1.5px] px-3 py-2 text-sm font-medium ${isSel ? "border-primary bg-primary text-white" : "border-border bg-surface text-ink hover:border-primary/40"}`}
          >
            {sport ?? "All Sports"}
          </button>
        );
      })}
    </div>
  );
}

function useCsvExport(venueName: string | undefined) {
  const [exporting, setExporting] = useState(false);
  const run = async (rows: VenueBooking[], nameParts: (string | null | undefined)[]) => {
    if (rows.length === 0) return Alert.alert("Nothing to Export", "There are no bookings for this selection yet.");
    setExporting(true);
    try {
      const filename = `${toSafeFilenameSegment([venueName ?? "venue", ...nameParts].filter((x): x is string => !!x).join("-"))}-bookings.csv`;
      await exportCsv(filename, [BOOKING_CSV_HEADER, ...rows.map(formatBookingRowForCsv)]);
    } catch (err) {
      Alert.alert("Export Failed", getFriendlyErrorMessage(err, "Could not export bookings."));
    } finally {
      setExporting(false);
    }
  };
  return { exporting, run };
}

function BookingRow({ booking }: { booking: VenueBooking }) {
  return (
    <div className="border-b border-border py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <SportIconBadge sportName={booking.court?.sports?.name} size={30} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">
              {formatTimeRange(booking.start_time, booking.end_time)} · {booking.court?.name ?? "Court"}
            </span>
            {booking.status !== "BLOCKED" && (
              <span className="mt-0.5 block truncate text-xs text-muted">
                {booking.profiles?.full_name ?? "Customer"} · Rs {booking.total_amount.toLocaleString()}
              </span>
            )}
          </span>
        </span>
        <StatusBadge badge={STATUS_BADGE[booking.status]} />
      </div>
      {booking.checked_in_at && (
        <span className="ml-10 flex items-center gap-1 text-xs font-medium text-primary">
          <Ionicon name="checkmark-circle" size={12} color={colors.primary} />
          Checked in
        </span>
      )}
    </div>
  );
}

// Port of VenueBookingsScreen: sport filter, today's revenue, a date/range
// summary (with that day's bookings), CSV export, link to Analytics.
export function VenueBookingsPage() {
  const { venueId = "" } = useParams();
  const p = useAdminPaths();
  const navigate = useAppNavigate();
  const { data: venue, isLoading: vl } = useAdminVenueDetail(venueId);
  const { data: bookings, isLoading: bl } = useVenueBookings(venueId);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateSelection, setDateSelection] = useState<DateSelection | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const csv = useCsvExport(venue?.name);
  const sportOptions = useMemo(() => Array.from(new Set((venue?.court ?? []).map((c) => c.sports?.name).filter((n): n is string => !!n))).sort(), [venue]);
  const filtered = useMemo(() => (bookings ?? []).filter((b) => !selectedSport || b.court?.sports?.name === selectedSport), [bookings, selectedSport]);
  const stats = useMemo(() => (venue ? computeDashboardStats(filtered, venue, venue.court.length) : null), [filtered, venue]);
  const inRange = useMemo(
    () => (dateSelection ? filtered.filter((b) => { const d = toLocalDateStr(new Date(b.start_time)); return d >= dateSelection.start && d <= dateSelection.end; }) : filtered),
    [filtered, dateSelection]
  );
  const selection = useMemo(() => {
    if (!dateSelection) return null;
    const counted = inRange.filter((b) => COUNTED_STATUSES.has(b.status));
    const isSingleDay = dateSelection.start === dateSelection.end;
    return {
      isSingleDay,
      totalBookings: counted.length,
      totalRevenue: inRange.filter((b) => REVENUE_STATUSES.has(b.status)).reduce((s, b) => s + b.total_amount, 0),
      dayBookings: isSingleDay ? [...counted].sort((a, b) => a.start_time.localeCompare(b.start_time)) : [],
    };
  }, [dateSelection, inRange]);

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        backTo={p.venue(venueId)}
        right={
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => setCalendarOpen(true)} aria-label="Pick a date or range" title="Pick a date or range" className="rounded-full p-1.5 hover:bg-black/5">
              <Ionicon name="calendar-outline" size={20} color={colors.ink} />
            </button>
            <button
              type="button"
              onClick={() => csv.run(inRange, [selectedSport, dateSelection ? (dateSelection.start === dateSelection.end ? dateSelection.start : `${dateSelection.start}_to_${dateSelection.end}`) : null])}
              disabled={csv.exporting}
              aria-label="Export CSV"
              title="Export CSV"
              className="rounded-full p-1.5 hover:bg-black/5"
            >
              {csv.exporting ? <Spinner size={18} color={colors.ink} /> : <Ionicon name="download-outline" size={20} color={colors.ink} />}
            </button>
            <button type="button" onClick={() => navigate(p.analytics(venueId))} className="ml-1 flex items-center gap-1 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary">
              <Ionicon name="stats-chart-outline" size={14} color={colors.primaryDark} />
              Analytics
            </button>
          </span>
        }
      />
      <PageBody narrow>
        {vl || bl || !stats ? (
          <SkeletonCardRows />
        ) : (
          <>
            <SportChips sports={sportOptions} selected={selectedSport} onSelect={setSelectedSport} />
            <div className="mb-4 rounded-2xl bg-surface p-5 shadow-card">
              <p className="text-xs text-muted">{selectedSport ? `Today's ${selectedSport} Revenue` : "Today's Revenue"}</p>
              <p className="mt-1 text-3xl font-extrabold text-ink">Rs {stats.todaysRevenue.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted">{stats.todaysBookingsCount} bookings today</p>
            </div>
            {dateSelection && selection && (
              <div className="mb-4 rounded-2xl bg-surface p-5 shadow-card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="truncate text-base font-bold text-ink">
                    {selection.isSingleDay ? formatDateLabel(dateSelection.start) : `${formatDateLabel(dateSelection.start)} – ${formatDateLabel(dateSelection.end)}`}
                  </p>
                  <button type="button" aria-label="Clear date" onClick={() => setDateSelection(null)}>
                    <Ionicon name="close-circle" size={20} color={colors.muted} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-app p-3">
                    <p className="text-xs text-muted">Total Bookings</p>
                    <p className="mt-0.5 text-lg font-extrabold text-ink">{selection.totalBookings}</p>
                  </div>
                  <div className="rounded-xl bg-app p-3">
                    <p className="text-xs text-muted">Total Revenue</p>
                    <p className="mt-0.5 text-lg font-extrabold text-ink">Rs {selection.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
                {selection.isSingleDay && (
                  <div className="mt-4">{selection.dayBookings.length === 0 ? <p className="py-2 text-sm text-muted">No bookings on this day.</p> : selection.dayBookings.map((b) => <BookingRow key={b.id} booking={b} />)}</div>
                )}
              </div>
            )}
            <p className="text-center text-xs text-muted">Looking for past bookings, revenue trends, or court performance? Check Analytics.</p>
          </>
        )}
      </PageBody>
      <DateRangeSheet open={calendarOpen} initialSelection={dateSelection} onClose={() => setCalendarOpen(false)} onSave={(sel) => (setDateSelection(sel), setCalendarOpen(false))} />
    </>
  );
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicon key={n} name={n <= rating ? "star" : "star-outline"} size={size} color="#F59E0B" />
      ))}
    </span>
  );
}

// Port of AdminReviewsScreen: average rating, each review, public response.
export function AdminReviewsPage() {
  const { venueId = "" } = useParams();
  const p = useAdminPaths();
  const { data: venue } = useAdminVenueDetail(venueId);
  const { data: reviews, isLoading } = useVenueReviews(venueId);
  const respond = useRespondToVenueReview(venueId);
  const [respondingTo, setRespondingTo] = useState<VenueReview | null>(null);
  const [responseText, setResponseText] = useState("");
  const avg = reviews && reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const submit = () => {
    if (!respondingTo || !responseText.trim()) return;
    respond.mutate(
      { reviewId: respondingTo.id, response: responseText.trim() },
      { onSuccess: () => (setRespondingTo(null), setResponseText("")), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send response.")) }
    );
  };

  return (
    <>
      <AdminPageHeader title={`Reviews · ${venue?.name ?? ""}`} backTo={p.venue(venueId)} />
      <PageBody narrow>
        {isLoading ? (
          <SkeletonCardRows />
        ) : (reviews ?? []).length === 0 ? (
          <EmptyBox icon="star-outline" text="No reviews yet." />
        ) : (
          <>
            <div className="mb-4 flex flex-col items-center rounded-2xl border border-ink/5 bg-surface p-5">
              <p className="text-3xl font-extrabold text-ink">{avg.toFixed(1)}</p>
              <Stars rating={Math.round(avg)} size={18} />
              <p className="mt-1 text-xs text-muted">
                {reviews!.length} review{reviews!.length === 1 ? "" : "s"}
              </p>
            </div>
            {reviews!.map((r) => (
              <div key={r.id} className="mb-3 rounded-2xl border border-ink/5 bg-surface p-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{r.profiles?.full_name ?? "Customer"}</p>
                  <p className="shrink-0 text-xs text-muted">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                <Stars rating={r.rating} />
                {r.review && <p className="mt-2 text-sm text-ink">{r.review}</p>}
                {r.owner_response ? (
                  <div className="mt-3 rounded-xl bg-app p-3">
                    <p className="mb-1 text-xs font-semibold text-muted">Your response</p>
                    <p className="text-sm text-ink">{r.owner_response}</p>
                  </div>
                ) : (
                  <button type="button" onClick={() => (setRespondingTo(r), setResponseText(""))} className="mt-3 w-full rounded-lg border border-primary py-2 text-xs font-semibold text-primary hover:bg-primary-light">
                    Respond
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </PageBody>
      <Modal
        open={!!respondingTo}
        onClose={() => setRespondingTo(null)}
        title="Respond to Review"
        footer={
          <button type="button" onClick={submit} disabled={respond.isPending || !responseText.trim()} className={`flex w-full items-center justify-center rounded-xl py-4 text-base font-semibold ${responseText.trim() ? "press bg-brand text-white shadow-cta" : "bg-gray-200 text-muted"}`}>
            {respond.isPending ? <Spinner size={20} color="white" /> : "Post Response"}
          </button>
        }
      >
        {respondingTo && (
          <div className="mb-3">
            <Stars rating={respondingTo.rating} />
            {respondingTo.review && <p className="mt-1 text-sm text-muted">{respondingTo.review}</p>}
          </div>
        )}
        <textarea
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          placeholder="Write a public response..."
          maxLength={500}
          rows={4}
          autoFocus
          aria-label="Your response"
          className="w-full resize-none rounded-xl border border-border bg-surface p-3 text-ink outline-none focus:border-primary"
        />
      </Modal>
    </>
  );
}

// Port of AdminAnalyticsScreen: sport → court filters, eight stat cards,
// court performance by sport, revenue trend line, CSV export.
export function AdminAnalyticsPage() {
  const { venueId = "" } = useParams();
  const p = useAdminPaths();
  const { data: venue, isLoading: vl } = useAdminVenueDetail(venueId);
  const { data: bookings, isLoading: bl } = useVenueBookings(venueId);
  const { data: cancelledCount, isLoading: cl } = useCancelledBookingsCount(venueId);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [revenueScale, setRevenueScale] = useState<RevenueScale>("days");
  const csv = useCsvExport(venue?.name);
  const sportOptions = useMemo(() => Array.from(new Set((venue?.court ?? []).map((c) => c.sports?.name).filter((n): n is string => !!n))).sort(), [venue]);
  const courtOptions = useMemo(() => (selectedSport ? (venue?.court ?? []).filter((c) => c.sports?.name === selectedSport) : []), [venue, selectedSport]);
  const selectedCourtName = courtOptions.find((c) => c.id === selectedCourtId)?.name ?? null;
  const filtered = useMemo(() => (bookings ?? []).filter((b) => (!selectedSport || b.court?.sports?.name === selectedSport) && (!selectedCourtId || b.court?.id === selectedCourtId)), [bookings, selectedSport, selectedCourtId]);
  const isFiltered = !!selectedSport || !!selectedCourtId;
  const analytics = useMemo(() => (bookings ? computeVenueAnalytics(filtered, isFiltered ? 0 : (cancelledCount ?? 0)) : null), [bookings, filtered, isFiltered, cancelledCount]);
  const sportBreakdown = useMemo(() => computeSportBreakdown(bookings ?? []), [bookings]);
  const trend = useMemo(() => computeRevenueByScale(filtered, revenueScale), [filtered, revenueScale]);
  const combinedRevenue = useMemo(() => (bookings ?? []).reduce((s, b) => (COUNTED_STATUSES.has(b.status) ? s + b.total_amount : s), 0), [bookings]);

  if (vl || bl || cl || !analytics) return <Loading />;
  const scopeLabel = selectedCourtName ?? selectedSport;

  return (
    <>
      <AdminPageHeader
        title={`AI Analytics · ${venue?.name ?? ""}`}
        backTo={p.venue(venueId)}
        right={
          <button type="button" onClick={() => csv.run(filtered, [selectedCourtName ?? selectedSport])} disabled={csv.exporting} className="flex items-center gap-1 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary">
            {csv.exporting ? <Spinner size={14} color={colors.primaryDark} /> : <Ionicon name="download-outline" size={14} color={colors.primaryDark} />}
            Export
          </button>
        }
      />
      <PageBody>
        <SportChips sports={sportOptions} selected={selectedSport} onSelect={(s) => (setSelectedSport(s), setSelectedCourtId(null))} />
        {courtOptions.length > 1 && (
          <div className="no-scrollbar -mt-2 mb-4 flex gap-1.5 overflow-x-auto pb-1">
            {[{ id: null as string | null, name: `All ${selectedSport} Courts` }, ...courtOptions.map((c) => ({ id: c.id as string | null, name: c.name }))].map((c) => (
              <button
                key={c.id ?? "all"}
                type="button"
                aria-pressed={selectedCourtId === c.id}
                onClick={() => setSelectedCourtId(c.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ${selectedCourtId === c.id ? "bg-primary-light text-primary-dark" : "bg-app text-muted"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {analytics.totalBookings === 0 ? (
          <div className="mb-4">
            <EmptyBox icon="stats-chart-outline" text={selectedCourtName ? `No bookings for ${selectedCourtName} yet.` : selectedSport ? `No ${selectedSport} bookings yet.` : "Not enough booking history yet to show analytics."} />
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard iconSize={36} icon="calendar" iconBg={colors.primaryLight} iconColor={colors.primaryDark} label="Total Bookings" value={String(analytics.totalBookings)} />
            <StatCard iconSize={36} icon="wallet" iconBg="rgb(var(--jz-purple-100))" iconColor="#7C3AED" label={scopeLabel ? `${scopeLabel} Revenue` : "Total Revenue"} value={`Rs ${analytics.totalRevenue.toLocaleString()}`} />
            <StatCard iconSize={36} icon="pricetag" iconBg="rgb(var(--jz-blue-100))" iconColor="#2563EB" label="Avg. Booking Value" value={`Rs ${analytics.avgBookingValue.toLocaleString()}`} />
            <StatCard iconSize={36} icon="close-circle" iconBg="rgb(var(--jz-red-50))" iconColor="#DC2626" label="Cancellation Rate" value={isFiltered ? "—" : `${analytics.cancellationRate}%`} />
            {!selectedSport && (
              <>
                <StatCard iconSize={36} icon="basketball" iconBg="rgb(var(--jz-orange-100))" iconColor="#EA580C" label="Most Popular Sport" value={analytics.mostPopularSport ?? "—"} />
                <StatCard iconSize={36} icon="grid" iconBg={colors.primaryLight} iconColor={colors.primaryDark} label="Most Popular Court" value={analytics.mostPopularCourt ?? "—"} />
              </>
            )}
            <StatCard iconSize={36} icon="time" iconBg="rgb(var(--jz-amber-50))" iconColor="#D97706" label="Peak Hours" value={analytics.peakHourLabel ?? "—"} />
            <StatCard iconSize={36} icon="people" iconBg="rgb(var(--jz-blue-100))" iconColor="#4F46E5" label="Repeat Customers" value={`${analytics.repeatCustomers} of ${analytics.totalCustomers}`} />
          </div>
        )}
        <div className="lg:grid lg:grid-cols-2 lg:gap-4">
          {sportBreakdown.length > 0 && (
            <div className="mb-4 rounded-2xl bg-surface p-5 shadow-card">
              <p className="mb-1 text-base font-bold text-ink">Court Performance by Sport</p>
              <p className="mb-3 text-xs text-muted">How each sport contributes to this venue's business.</p>
              {sportBreakdown.map((s) => (
                <div key={s.sportName} className="flex items-center justify-between gap-3 border-b border-border py-2">
                  <span className="flex-1 truncate text-sm font-medium text-ink">{s.sportName}</span>
                  <span className="text-xs text-muted">{s.bookings} bookings</span>
                  <span className="text-xs font-semibold text-ink">Rs {s.revenue.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 text-sm">
                <span className="font-bold text-ink">Combined Venue Revenue</span>
                <span className="font-extrabold text-ink">Rs {combinedRevenue.toLocaleString()}</span>
              </div>
            </div>
          )}
          {trend.total > 0 && (
            <div className="mb-4 rounded-2xl bg-surface p-5 shadow-card">
              <p className="mb-1 text-base font-bold text-ink">
                Revenue Trend
                {scopeLabel ? ` · ${scopeLabel}` : ""}
              </p>
              <p className="mb-3 text-xs text-muted">
                Rs {trend.total.toLocaleString()} ({trend.periodLabel})
              </p>
              <ScaleToggle options={["days", "weeks", "months", "year"] as RevenueScale[]} value={revenueScale} onChange={setRevenueScale} />
              <RevenueLineChart labels={trend.labels} values={trend.values} />
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}

const TIERS = [
  { days: 7, price: 1500, label: "1 Week" },
  { days: 30, price: 4500, label: "1 Month", best: true },
  { days: 90, price: 10000, label: "3 Months" },
];

// Port of BoostVenueScreen (payments aren't live — Pay & Boost explains how
// to activate it through support, same as the app).
export function BoostVenuePage() {
  const { venueId = "" } = useParams();
  const p = useAdminPaths();
  const { data: venue, isLoading } = useAdminVenueDetail(venueId);
  const boosted = venue ? isVenueBoosted(venue) : false;
  const handlePay = () => Alert.alert("Coming Soon", "Online payments for boosting aren't live yet. To boost this venue right now, contact HitLit support and they'll activate it for you.");

  return (
    <>
      <AdminPageHeader title={`Boost · ${venue?.name ?? ""}`} backTo={p.venue(venueId)} />
      {isLoading ? (
        <Loading />
      ) : (
        <PageBody narrow>
          <div className="mb-5 rounded-2xl bg-[#111827] p-5">
            <p className="mb-2 flex items-center gap-2 text-lg font-extrabold text-white">
              <Ionicon name="rocket" size={20} color="#F59E0B" />
              Boost Your Venue
            </p>
            <p className="text-sm leading-5 text-gray-300">A boosted venue is pinned to the top of search &amp; "near you" results in its area, so players see it first — more visibility, more bookings.</p>
          </div>
          <div className="mb-5 flex items-center gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
            <Ionicon name={boosted ? "checkmark-circle" : "information-circle-outline"} size={22} color={boosted ? colors.primary : colors.muted} />
            {venue && boosted && venue.boosted_until ? (
              <div>
                <p className="text-sm font-semibold text-ink">Boost is active</p>
                <p className="mt-0.5 text-xs text-muted">This venue is pinned to the top until {new Date(venue.boosted_until).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}.</p>
              </div>
            ) : (
              <p className="text-sm text-muted">This venue isn't boosted right now.</p>
            )}
          </div>
          <p className="mb-3 text-base font-bold text-ink">Choose a plan</p>
          {TIERS.map((t) => (
            <div key={t.days} className={`mb-3 flex items-center justify-between rounded-2xl bg-surface p-4 shadow-card ${t.best ? "border-[1.5px] border-primary" : ""}`}>
              <div>
                <p className="flex items-center gap-2 text-base font-bold text-ink">
                  {t.label}
                  {t.best && <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">BEST VALUE</span>}
                </p>
                <p className="mt-1 text-xs text-muted">{t.days} days at the top</p>
              </div>
              <div className="flex flex-col items-end">
                <p className="mb-2 text-lg font-extrabold text-ink">Rs {t.price.toLocaleString("en-PK")}</p>
                <button type="button" onClick={handlePay} className="rounded-xl bg-gray-200 px-4 py-2 text-xs font-semibold text-muted">
                  Pay &amp; Boost
                </button>
              </div>
            </div>
          ))}
          <p className="mt-2 text-center text-xs text-muted">Online payments are coming soon — pricing shown here is indicative.</p>
        </PageBody>
      )}
    </>
  );
}

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  venue_booking_created: { icon: "calendar", color: colors.primary, bg: "bg-primary-light" },
  venue_booking_cancelled: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50" },
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Port of AdminNotificationsScreen: booking created/cancelled notifications,
// tap → that venue's bookings; mark all read, delete one/all.
export function AdminNotificationsPage() {
  const p = useAdminPaths();
  const navigate = useAppNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: notifications, isLoading } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const deleteNotif = useDeleteNotification(userId);
  const deleteAll = useDeleteAllNotifications(userId);
  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  const open = (n: NotificationRow) => {
    if (!n.is_read) markRead.mutate(n.id);
    const data = (n.data ?? {}) as Record<string, unknown>;
    const venueId = data.venueId ?? data.venue_id;
    if (typeof venueId === "string") navigate(p.bookings(venueId));
  };

  return (
    <>
      <AdminPageHeader
        title="Notifications"
        backTo={p.home}
        right={
          <span className="flex items-center gap-4 text-sm font-semibold">
            {hasUnread && (
              <button type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="text-primary hover:underline">
                Mark all read
              </button>
            )}
            {(notifications?.length ?? 0) > 0 && (
              <button
                type="button"
                disabled={deleteAll.isPending}
                className="text-danger hover:underline"
                onClick={() =>
                  Alert.alert("Delete All Notifications", "Remove all your notifications? This can't be undone.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete All", style: "destructive", onPress: () => deleteAll.mutate(undefined, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete notifications.")) }) },
                  ])
                }
              >
                Delete all
              </button>
            )}
          </span>
        }
      />
      <PageBody narrow>
        {isLoading ? (
          <SkeletonCardRows />
        ) : (notifications ?? []).length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <Ionicon name="notifications-outline" size={48} color={colors.border} />
            <p className="text-base font-semibold text-ink">No notifications yet</p>
            <p className="px-8 text-sm text-muted">You'll see updates here when your venues get new bookings or cancellations.</p>
          </div>
        ) : (
          notifications!.map((n) => {
            const meta = TYPE_META[n.type ?? ""] ?? { icon: "notifications", color: colors.muted, bg: "bg-gray-50" };
            const unread = !n.is_read;
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => open(n)}
                onKeyDown={(e) => e.key === "Enter" && open(n)}
                className={`mb-3 flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 ${unread ? "border-primary bg-primary-light" : "border-border bg-surface"}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
                  <Ionicon name={meta.icon} size={19} color={meta.color} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-ink">{n.title}</span>
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  </p>
                  {n.body && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.body}</p>}
                  <p className="mt-1.5 text-xs text-muted">{timeAgo(n.created_at)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    Alert.alert("Delete Notification", "Remove this notification?", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteNotif.mutate(n.id) },
                    ]);
                  }}
                  className="-mr-1 -mt-1 p-1"
                >
                  <Ionicon name="close" size={18} color={colors.muted} />
                </button>
              </div>
            );
          })
        )}
      </PageBody>
    </>
  );
}

function EmailLookupRow({ email, setEmail, onLookup, isLoading, label }: { email: string; setEmail: (v: string) => void; onLookup: () => void; isLoading: boolean; label: string }) {
  return (
    <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), onLookup())}>
      <div className="min-w-0 flex-1">
        <FieldInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@gmail.com" type="email" autoCapitalize="none" aria-label={label} containerClassName="!bg-surface" />
      </div>
      <button type="submit" disabled={isLoading || !email.trim()} className="press flex shrink-0 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-cta disabled:opacity-70">
        {isLoading ? <Spinner size={16} color="white" /> : "Look up"}
      </button>
    </form>
  );
}

function LookupResultCard({ result, onConfirm, submitting, confirmLabel }: { result: AdminLookupResult; onConfirm: () => void; submitting: boolean; confirmLabel: string }) {
  return (
    <div className="mt-3 flex items-center rounded-xl border border-primary bg-primary-light px-4 py-3">
      <Avatar url={result.avatar} name={result.full_name ?? "?"} size={40} className="mr-3" />
      <div className="mr-3 min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{result.full_name || "No name set"}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{result.email}</p>
      </div>
      <button type="button" onClick={onConfirm} disabled={submitting} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white">
        {submitting ? <Spinner size={14} color="white" /> : confirmLabel}
      </button>
    </div>
  );
}

function NotFoundNote() {
  return (
    <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">No account found for this email. Ask them to sign in with Google at least once, then try again.</div>
  );
}

// Port of AssignAdminScreen: the owner (superadmin only — assign / remove)
// and any number of additional admins (grant / revoke by Gmail).
export function AssignAdminPage() {
  const { venueId = "" } = useParams();
  const p = useAdminPaths();
  const role = useAdminRole();
  const navigate = useAppNavigate();
  const goBack = useGoBack(role === "superadmin" ? p.home : p.venue(venueId));
  const state = useLocation().state as { currentAdminEmail?: string | null } | null;
  const profile = useProfileStore((s) => s.profile);
  const { data: venue } = useAdminVenueDetail(venueId);
  const { data: allVenues } = useAllVenues(undefined);
  // An owner reaches this from their own dashboard and can't transfer
  // ownership (hideOwnerTransfer); a superadmin sees the owner section too.
  const hideOwnerTransfer = role === "owner";
  const currentAdminEmail = state && "currentAdminEmail" in state ? (state.currentAdminEmail ?? null) : role === "owner" ? (profile?.email ?? null) : (allVenues?.find((v) => v.id === venueId)?.profiles?.email ?? null);
  const venueName = venue?.name ?? "";

  const ownerLookup = useLookupProfileByEmail();
  const assignOwner = useAssignVenueAdmin(venueId);
  const removeOwner = useRemoveVenueAdmin(venueId);
  const { data: extraAdmins, isLoading: extraLoading, error: extraError } = useVenueAdmins(venueId);
  const extraLookup = useLookupProfileByEmail();
  const grantAdmin = useGrantVenueAdmin(venueId);
  const revokeAdmin = useRevokeVenueAdminAccess(venueId);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerResult, setOwnerResult] = useState<AdminLookupResult | null | "not_searched">("not_searched");
  const [extraEmail, setExtraEmail] = useState("");
  const [extraResult, setExtraResult] = useState<AdminLookupResult | null | "not_searched">("not_searched");
  const err = (fallback: string) => (e: unknown) => Alert.alert("Error", getFriendlyErrorMessage(e, fallback));

  const assign = () => {
    if (ownerResult === "not_searched" || !ownerResult) return;
    Alert.alert("Assign Owner", `Make "${ownerResult.full_name ?? ownerResult.email}" the owner of "${venueName}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Assign", onPress: () => assignOwner.mutate(ownerResult.id, { onSuccess: () => navigate(p.venue(venueId), { replace: true }), onError: err("Could not assign owner.") }) },
    ]);
  };
  const removeOwnerNow = () =>
    Alert.alert("Remove Owner", `Remove the current owner from "${venueName}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeOwner.mutate(undefined, { onSuccess: goBack, onError: err("Could not remove owner.") }) },
    ]);
  const grant = () => {
    if (extraResult === "not_searched" || !extraResult) return;
    grantAdmin.mutate(extraResult.id, { onSuccess: () => (setExtraEmail(""), setExtraResult("not_searched")), onError: err("Could not add admin.") });
  };
  const revoke = (userId: string, name: string) =>
    Alert.alert("Remove Admin", `Remove admin access for "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => revokeAdmin.mutate(userId, { onError: err("Could not remove admin.") }) },
    ]);

  return (
    <>
      <AdminPageHeader title={`Manage Admins · ${venueName}`} backTo={role === "superadmin" ? p.home : p.venue(venueId)} />
      <PageBody narrow>
        {!hideOwnerTransfer && (
          <section className="mb-2">
            <p className="mb-1 text-base font-bold text-ink">Owner</p>
            <p className="mb-3 text-xs text-muted">The primary owner. Only they (or you) can manage this venue's additional admins below.</p>
            {currentAdminEmail ? (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Current owner</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink">{currentAdminEmail}</p>
                </div>
                <button type="button" onClick={removeOwnerNow} disabled={removeOwner.isPending} className="text-sm font-semibold text-danger hover:underline">
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">No owner assigned yet.</div>
                <p className="mb-1.5 text-xs font-semibold text-muted">Owner's Gmail</p>
                <EmailLookupRow
                  label="Owner's Gmail"
                  email={ownerEmail}
                  setEmail={(t) => (setOwnerEmail(t), setOwnerResult("not_searched"))}
                  onLookup={() => ownerEmail.trim() && ownerLookup.mutate(ownerEmail.trim(), { onSuccess: setOwnerResult, onError: err("Lookup failed.") })}
                  isLoading={ownerLookup.isPending}
                />
                {ownerResult && ownerResult !== "not_searched" && <LookupResultCard result={ownerResult} onConfirm={assign} submitting={assignOwner.isPending} confirmLabel="Assign" />}
                {ownerResult === null && <NotFoundNote />}
                <div className="h-6" />
              </>
            )}
          </section>
        )}
        <section className={hideOwnerTransfer ? "" : "mt-2 border-t border-border pt-5"}>
          <p className="mb-1 text-base font-bold text-ink">Additional Admins</p>
          <p className="mb-3 text-xs text-muted">Extra people who can manage this venue (bookings, courts, pricing) alongside the owner. No limit on how many.</p>
          {extraLoading ? (
            <div className="mb-3">
              <SkeletonCardRows count={2} />
            </div>
          ) : extraError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{getFriendlyErrorMessage(extraError, "Could not load additional admins.")}</div>
          ) : (extraAdmins ?? []).length === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">No additional admins yet.</div>
          ) : (
            <div className="mb-4 flex flex-col gap-2">
              {extraAdmins!.map((a) => (
                <div key={a.id} className="flex items-center rounded-xl border border-border bg-surface px-4 py-3">
                  <Avatar url={a.profiles?.avatar} name={a.profiles?.full_name ?? "?"} size={36} className="mr-3" />
                  <div className="mr-3 min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{a.profiles?.full_name || "No name set"}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{a.profiles?.email}</p>
                  </div>
                  <button type="button" onClick={() => revoke(a.user_id, a.profiles?.full_name ?? a.profiles?.email ?? "this admin")} disabled={revokeAdmin.isPending} className="text-sm font-semibold text-danger hover:underline">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mb-1.5 text-xs font-semibold text-muted">Add Admin by Gmail</p>
          <EmailLookupRow
            label="Add admin by Gmail"
            email={extraEmail}
            setEmail={(t) => (setExtraEmail(t), setExtraResult("not_searched"))}
            onLookup={() => extraEmail.trim() && extraLookup.mutate(extraEmail.trim(), { onSuccess: setExtraResult, onError: err("Lookup failed.") })}
            isLoading={extraLookup.isPending}
          />
          {extraResult && extraResult !== "not_searched" && <LookupResultCard result={extraResult} onConfirm={grant} submitting={grantAdmin.isPending} confirmLabel="Add" />}
          {extraResult === null && <NotFoundNote />}
        </section>
      </PageBody>
    </>
  );
}
