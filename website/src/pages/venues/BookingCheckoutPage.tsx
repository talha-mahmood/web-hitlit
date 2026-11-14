import { Navigate, useLocation, useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useCreateBooking } from "@app/hooks/useBookings";
import { useLinkGameBooking } from "@app/hooks/useGames";
import { useAuthStore } from "@app/store/authStore";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import { BookingHero, DetailRow, StickyActionBar, formatHour } from "@/components/booking/BookingParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import type { CheckoutState } from "./SlotPickerPage";
import type { ConfirmationState } from "./BookingConfirmationPage";

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// Port of BookingCheckoutScreen: summary, slot list, total, "Pay at Venue",
// confirm. Booked from a game's "Book Venue" → link it to that game and go
// back to the game; otherwise → confirmation page.
export default function BookingCheckoutPage() {
  const { venueId = "", courtId = "" } = useParams();
  const state = useLocation().state as (CheckoutState & { tab?: string }) | null;
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.slotPicker(venueId, courtId));
  const session = useAuthStore((s) => s.session);
  const createBooking = useCreateBooking();
  const linkGameBooking = useLinkGameBooking();

  // The selection travels in history state: a refresh keeps it, but opening
  // the URL directly (no selection) goes back to the slot picker.
  if (!state?.slots?.length) return <Navigate to={paths.slotPicker(venueId, courtId)} replace />;

  const { date, slots, courtName, venueName, sportName, forGameId } = state;
  const totalAmount = slots.reduce((sum, s) => sum + s.price, 0);
  const sortedSlots = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const busy = createBooking.isPending || linkGameBooking.isPending;

  const handleConfirm = async () => {
    if (!session?.user.id || busy) return;
    try {
      const bookings = await createBooking.mutateAsync({ courtId, userId: session.user.id, date, slots, gameId: forGameId });
      if (forGameId) {
        await linkGameBooking.mutateAsync({ gameId: forGameId, bookingId: bookings[0].id });
        Alert.alert("Venue Booked", "Your venue has been booked for this tournament.", [
          { text: "OK", onPress: () => navigate(paths.game(forGameId)) },
        ]);
        return;
      }
      const confirmation: ConfirmationState = {
        bookingIds: bookings.map((b) => b.id),
        venueName,
        courtName,
        date,
        slots: sortedSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
        totalAmount: bookings.reduce((sum, b) => sum + b.total_amount, 0),
        sportName,
      };
      navigate(paths.bookingConfirmation, { replace: true, state: confirmation });
    } catch (err) {
      Alert.alert("Booking Failed", getFriendlyErrorMessage(err, "Could not complete your booking. Please try again."));
    }
  };

  return (
    <div className="mx-auto max-w-3xl lg:px-8 lg:pt-6">
      <BookingHero sportName={sportName} onBack={goBack} title="Confirm Booking" subtitle="Review your booking details" />

      <div className="px-4 pt-5 lg:px-0">
        <div className="mb-5 overflow-hidden rounded-2xl bg-surface shadow-card">
          <div className="flex items-center gap-3 bg-primary-light p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface">
              <Ionicon name="checkmark-done" size={20} color={colors.primaryDark} />
            </span>
            <div>
              <p className="text-base font-bold text-ink">Booking Summary</p>
              <p className="mt-0.5 text-xs text-primary-dark">Please review your booking details before confirming</p>
            </div>
          </div>
          <div className="px-4">
            <DetailRow icon="business-outline" label="Venue" value={venueName} />
            <DetailRow icon="tennisball-outline" label="Court" value={courtName} />
            <DetailRow icon="calendar-outline" label="Date" value={formatDateFull(date)} divider={false} />
            <div className="flex items-start gap-3 border-t border-border py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <Ionicon name="time-outline" size={17} color={colors.primaryDark} />
              </span>
              <div className="flex-1">
                <p className="mb-2 text-xs text-muted">Time Slots ({sortedSlots.length})</p>
                <div className="overflow-hidden rounded-xl bg-gray-100">
                  {sortedSlots.map((s, i) => (
                    <div key={s.startTime} className={`flex items-center justify-between px-3 py-2.5 ${i ? "border-t border-white" : ""}`}>
                      <span className="text-sm font-bold text-ink">
                        {formatHour(s.startTime)} – {formatHour(s.endTime)}
                      </span>
                      <span className="text-sm text-muted">Rs {s.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl bg-primary-light px-4 py-3.5">
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface">
                <Ionicon name="wallet-outline" size={17} color={colors.primaryDark} />
              </span>
              <span className="font-medium text-ink">Total Amount</span>
            </span>
            <span className="text-xl font-extrabold text-primary-dark">Rs {totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="card flex items-center gap-3 px-4 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light">
            <Ionicon name="cash-outline" size={20} color={colors.primary} />
          </span>
          <div className="flex-1">
            <p className="text-base font-bold text-ink">Pay at Venue</p>
            <p className="mt-0.5 text-xs text-muted">Cash on arrival · Online payment coming soon</p>
          </div>
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-brand">
            <Ionicon name="checkmark" size={16} color="white" />
          </span>
        </div>
      </div>

      <StickyActionBar>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-cta hover:brightness-110 disabled:opacity-80"
        >
          {busy ? (
            <Spinner color="white" />
          ) : (
            <>
              Confirm Booking · Rs {totalAmount.toLocaleString()}
              <Ionicon name="arrow-forward" size={18} color="white" />
            </>
          )}
        </button>
      </StickyActionBar>
    </div>
  );
}
