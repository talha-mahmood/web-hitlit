import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { colors } from "@app/constants/theme";
import { getSportIcon } from "@app/lib/sportIcons";
import type { BookingConfirmationParams } from "@app/navigation/bookingTypes";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import { DetailRow, StickyActionBar, formatHour } from "@/components/booking/BookingParts";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

export type ConfirmationState = BookingConfirmationParams;

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-PK", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

// Port of BookingConfirmationScreen: success mark, copyable reference,
// details, total, "Pay at venue", then My Bookings / Back to Venues.
export default function BookingConfirmationPage() {
  const state = useLocation().state as (ConfirmationState & { tab?: string }) | null;
  const navigate = useAppNavigate();
  const [copied, setCopied] = useState(false);

  if (!state?.bookingIds?.length) return <Navigate to={paths.myBookings} replace />;

  const { bookingIds, venueName, courtName, date, slots, totalAmount } = state;
  const referenceCode = bookingIds[0].slice(0, 8).toUpperCase();
  const { icon } = getSportIcon(state.sportName ?? "");

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(referenceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the code is visible on screen anyway
    }
  };

  return (
    <div className="mx-auto max-w-xl lg:pt-6">
      <div className="flex flex-col items-center px-6">
        <div className="relative flex h-80 w-full flex-col items-center overflow-hidden">
          <MCIcon name={icon} size={130} color={colors.primary} className="pointer-events-none absolute -left-5 top-[60px] opacity-[0.12]" style={{ transform: "rotate(-18deg)" }} />
          <MCIcon name={icon} size={150} color={colors.primary} className="pointer-events-none absolute -right-[30px] top-[90px] opacity-10" style={{ transform: "scaleX(-1) rotate(10deg)" }} />
          <div className="mt-12 flex h-28 w-28 animate-pop items-center justify-center rounded-full bg-primary-light">
            <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-brand">
              <Ionicon name="checkmark" size={44} color="white" />
            </span>
          </div>
          <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">Booking Confirmed!</h1>
          <p className="mt-2 text-center text-base leading-6 text-muted">
            Your court is reserved.
            <br />
            We'll see you on the field!
          </p>
        </div>

        <div className="w-full rounded-2xl bg-surface p-3 shadow-hero">
          <div className="mb-1 flex items-center gap-2.5 rounded-2xl bg-primary-light px-3 py-3">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface">
              <Ionicon name="document-text-outline" size={17} color={colors.primaryDark} />
            </span>
            <span className="flex-1 text-sm font-bold text-primary-dark">Booking Reference</span>
            <span className="text-sm font-extrabold text-primary-dark">
              {referenceCode}
              {bookingIds.length > 1 ? ` (+${bookingIds.length - 1} more)` : ""}
            </span>
            <button type="button" onClick={copyReference} aria-label="Copy booking reference" className="ml-1 rounded p-0.5 hover:bg-white/60">
              <Ionicon name={copied ? "checkmark" : "copy-outline"} size={18} color={colors.primaryDark} />
            </button>
          </div>

          <div className="px-1">
            <DetailRow icon="location-outline" label="Venue" value={venueName} />
            <DetailRow icon="tennisball-outline" label="Court" value={courtName} />
            <DetailRow icon="calendar-outline" label="Date" value={formatDateFull(date)} />
            <div className="flex items-start gap-3 border-b border-border py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="time-outline" size={17} color={colors.primaryDark} />
              </span>
              <div className="flex-1">
                <p className="mb-2 text-xs text-muted">
                  {slots.length} time slot{slots.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-col gap-1.5">
                  {slots.map((s) => (
                    <span key={s.startTime} className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-ink">
                      <Ionicon name="time-outline" size={13} color={colors.muted} />
                      {formatHour(s.startTime)} – {formatHour(s.endTime)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-primary-light px-3 py-3">
              <span className="flex items-center gap-2.5">
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface">
                  <Ionicon name="wallet-outline" size={16} color={colors.primaryDark} />
                </span>
                <span className="font-medium text-ink">Total</span>
              </span>
              <span className="text-lg font-extrabold text-primary-dark">Rs {totalAmount.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                  <Ionicon name="card-outline" size={17} color="#D97706" />
                </span>
                <span className="font-medium text-ink">Payment</span>
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">Pay at venue</span>
            </div>
          </div>
        </div>
      </div>

      <StickyActionBar>
        <div className="flex flex-col gap-2.5 px-0 lg:px-6">
          <button
            type="button"
            onClick={() => navigate(paths.myBookings, { state: { tab: "profile" } })}
            className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-cta hover:brightness-110"
          >
            <Ionicon name="calendar-outline" size={18} color="white" />
            View My Bookings
            <Ionicon name="chevron-forward" size={18} color="white" />
          </button>
          <button type="button" onClick={() => navigate(paths.venues(), { state: { tab: "venues" } })} className="py-3 font-semibold text-primary hover:underline">
            Back to Venues
          </button>
        </div>
      </StickyActionBar>
    </div>
  );
}
