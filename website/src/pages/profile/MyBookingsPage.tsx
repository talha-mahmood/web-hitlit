import { useState } from "react";
import { colors } from "@app/constants/theme";
import { useMyBookings } from "@app/hooks/useBookings";
import { getSportImage } from "@app/lib/sportImages";
import { getSportIcon } from "@app/lib/sportIcons";
import type { BookingWithCourt } from "@app/lib/api/bookings";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import { BookingHero } from "@/components/booking/BookingParts";
import { useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

function formatBookingDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatBookingTime(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  return `${new Date(startIso).toLocaleTimeString("en-PK", opts)} – ${new Date(endIso).toLocaleTimeString("en-PK", opts)}`;
}

const STATUS: Record<BookingWithCourt["status"], { bg: string; fg: string; icon: string; label: string }> = {
  CONFIRMED: { bg: colors.primaryLight, fg: colors.primaryDark, icon: "checkmark-circle", label: "Confirmed" },
  PENDING: { bg: "#FEF9C3", fg: "#A16207", icon: "hourglass", label: "Pending" },
  CANCELLED: { bg: "rgb(var(--jz-red-100))", fg: colors.danger, icon: "close-circle", label: "Cancelled" },
  COMPLETED: { bg: "rgb(var(--jz-blue-100))", fg: "rgb(var(--jz-blue-700))", icon: "checkmark-done-circle", label: "Completed" },
  EXPIRED: { bg: "rgb(var(--jz-gray-100))", fg: colors.muted, icon: "time-outline", label: "Expired" },
};

function BookingCard({ booking }: { booking: BookingWithCourt }) {
  const sportName = booking.court?.sports?.name ?? "";
  const photo = imageUrl(getSportImage(sportName));
  const { icon } = getSportIcon(sportName);
  const status = STATUS[booking.status] ?? STATUS.EXPIRED;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface shadow-card">
      <MCIcon name={icon} size={90} color={colors.primary} className="pointer-events-none absolute -bottom-3.5 -right-3.5 opacity-[0.08]" />
      <div className="relative flex p-3">
        {photo ? (
          <img src={photo} alt="" className="h-[108px] w-[84px] shrink-0 rounded-[14px] object-cover" />
        ) : (
          <span className="flex h-[108px] w-[84px] shrink-0 items-center justify-center rounded-2xl bg-primary-light">
            <MCIcon name={icon} size={32} color={colors.primaryDark} />
          </span>
        )}
        <div className="ml-3 min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <p className="mr-2 flex-1 truncate text-base font-bold text-ink">{booking.court?.venues?.name ?? "—"}</p>
            <Ionicon name="chevron-forward" size={16} color={colors.muted} />
          </div>
          <p className="text-base font-extrabold text-primary-dark">Rs {booking.total_amount.toLocaleString()}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <Ionicon name="location" size={12} color={colors.primaryDark} />
            <span className="truncate">
              {booking.court?.name}
              {booking.court?.venues?.city ? ` · ${booking.court.venues.city}` : ""}
            </span>
          </p>
          <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-primary-light px-2.5 py-2 text-xs font-semibold text-primary-dark">
            <span className="flex items-center gap-1">
              <Ionicon name="calendar-outline" size={13} color={colors.primaryDark} />
              {formatBookingDate(booking.start_time)}
            </span>
            <span className="h-3 w-px bg-black/10" />
            <span className="flex min-w-0 items-center gap-1">
              <Ionicon name="time-outline" size={13} color={colors.primaryDark} />
              <span className="truncate">{formatBookingTime(booking.start_time, booking.end_time)}</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: status.bg, color: status.fg }}>
              <Ionicon name={status.icon} size={12} color={status.fg} />
              {status.label}
            </span>
            {booking.payment_status === "unpaid" && (booking.status === "CONFIRMED" || booking.status === "PENDING") && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                <Ionicon name="card-outline" size={12} color="rgb(var(--jz-amber-700))" />
                Pay at venue
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Port of MyBookingsScreen: Upcoming / Past tabs with counts.
export default function MyBookingsPage() {
  const goBack = useGoBack(paths.profile);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { data: bookings = [], isLoading } = useMyBookings();

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.start_time) > now && b.status !== "CANCELLED" && b.status !== "EXPIRED");
  const past = bookings.filter((b) => new Date(b.start_time) <= now || b.status === "CANCELLED" || b.status === "EXPIRED");
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="mx-auto max-w-4xl lg:px-8 lg:pt-6">
      <BookingHero watermarkIcon="stadium-variant" onBack={goBack} title="My Bookings" subtitle="View and manage bookings" />

      <div className="mx-4 mb-3 mt-4 flex gap-2.5 lg:mx-0" role="tablist">
        {(["upcoming", "past"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold transition ${
                active ? "bg-primary text-white shadow-card" : "border border-border bg-surface text-muted hover:text-ink"
              }`}
            >
              <Ionicon name={t === "upcoming" ? "calendar-outline" : "time-outline"} size={16} color={active ? "white" : colors.muted} />
              {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-8 lg:px-0">
        {isLoading ? (
          <div className="flex justify-center pt-16">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center pt-16 text-center">
            <Ionicon name="calendar-outline" size={52} color={colors.border} />
            <p className="mt-4 text-base font-semibold text-ink">No {tab} bookings</p>
            <p className="mt-1 px-8 text-sm text-muted">
              {tab === "upcoming" ? "Book a court from the Venues tab." : "Your completed and cancelled bookings will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
