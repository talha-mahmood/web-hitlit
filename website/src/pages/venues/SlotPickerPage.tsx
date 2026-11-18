import { useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useVenueDetail } from "@app/hooks/useVenueDetail";
import { useBookedSlots } from "@app/hooks/useBookings";
import { useCourtPriceRules } from "@app/hooks/useVenues";
import {
  toLocalDateStr,
  getNext14Days,
  generateFullDaySlots,
  isSlotBooked,
  isSlotPast,
  resolveSlotPrice,
  type Slot,
} from "@app/lib/slots";
import type { BookingSlotSelection } from "@app/navigation/bookingTypes";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { BookingHero, StickyActionBar } from "@/components/booking/BookingParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// What the checkout page receives through navigation state.
export type CheckoutState = {
  date: string;
  slots: BookingSlotSelection[];
  courtName: string;
  venueName: string;
  sportName?: string;
  forGameId?: string;
};

// Port of SlotPickerScreen: 14-day strip, all 24 hourly slots (past ones
// hidden, booked ones disabled, price-rule hours tinted amber), multi-select,
// live re-check of booked slots every 30s, then on to checkout. Court/venue
// details come from the venue query instead of route params so the page
// survives a refresh.
export default function SlotPickerPage() {
  const { venueId = "", courtId = "" } = useParams();
  const [search] = useSearchParams();
  const forGameId = search.get("forGame") ?? undefined;
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.venue(venueId));

  const days = getNext14Days();
  const todayStr = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);

  const { data: venue, isLoading: venueLoading } = useVenueDetail(venueId);
  const court = venue?.court.find((c) => c.id === courtId);
  const pricePerHour = court?.price_per_hour ?? 0;

  const slots = generateFullDaySlots();
  const { data: bookedSlots = [], isLoading } = useBookedSlots(courtId, selectedDate);
  const { data: priceRules = [] } = useCourtPriceRules(courtId);

  if (venueLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-4 lg:px-8 lg:pt-6">
        <SkeletonDetailHeader />
      </div>
    );
  }
  if (!venue || !court) return <Navigate to={paths.venue(venueId)} replace />;

  const slotPrice = (slot: Slot) => resolveSlotPrice(slot, pricePerHour, priceRules);
  const allPrices = slots.map(slotPrice);
  const minPrice = allPrices.length ? Math.min(...allPrices) : pricePerHour;
  const maxPrice = allPrices.length ? Math.max(...allPrices) : pricePerHour;
  const sortedSelected = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
  const totalPrice = selectedSlots.reduce((sum, s) => sum + slotPrice(s), 0);
  const sportName = court.sports?.name ?? undefined;

  const toggleSlot = (slot: Slot) =>
    setSelectedSlots((prev) => (prev.some((s) => s.start === slot.start) ? prev.filter((s) => s.start !== slot.start) : [...prev, slot]));

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlots([]);
  };

  const goToCheckout = () => {
    if (selectedSlots.length === 0) return;
    const state: CheckoutState = {
      date: selectedDate,
      slots: sortedSelected.map((s) => ({ startTime: s.start, endTime: s.end, price: slotPrice(s) })),
      courtName: court.name,
      venueName: venue.name,
      sportName,
      forGameId,
    };
    navigate(paths.checkout(venueId, courtId), { state });
  };

  return (
    <div className="mx-auto max-w-4xl lg:px-8 lg:pt-6">
      <BookingHero
        sportName={sportName}
        onBack={goBack}
        right={
          <span className="rounded-full bg-surface px-3 py-2 text-sm shadow-card">
            <span className="text-muted">{minPrice === maxPrice ? "" : "From "}</span>
            <span className="font-extrabold text-primary-dark">Rs {minPrice.toLocaleString()}/hr</span>
          </span>
        }
      >
        <h1 className="mt-4 truncate text-[22px] font-extrabold text-ink">{court.name}</h1>
        <p className="mt-1 flex items-center gap-1 font-medium text-primary-dark">
          <Ionicon name="location" size={13} color={colors.primaryDark} />
          <span className="truncate">{venue.name}</span>
        </p>
      </BookingHero>

      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border px-4 py-3.5 lg:px-0">
        {days.map((day) => {
          const isToday = day === todayStr;
          const isSelected = day === selectedDate;
          const d = new Date(day + "T12:00:00");
          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDateChange(day)}
              aria-pressed={isSelected}
              className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl transition ${
                isSelected ? "bg-brand text-white shadow-cta" : "border border-border bg-surface shadow-card hover:border-primary/40"
              }`}
            >
              <span className={`text-xs font-semibold ${isSelected ? "text-white" : isToday ? "text-primary" : "text-muted"}`}>
                {isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className={`mt-0.5 text-lg font-extrabold ${isSelected ? "text-white" : "text-ink"}`}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-4 lg:px-0">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary-light">
            <Ionicon name="time" size={14} color={colors.primaryDark} />
          </span>
          Available time slots
        </h2>
        {isLoading ? (
          <div className="mt-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {slots
              .filter((slot) => !isSlotPast(slot, selectedDate))
              .map((slot) => {
                const booked = isSlotBooked(slot, selectedDate, bookedSlots);
                const isSelected = selectedSlots.some((s) => s.start === slot.start);
                const price = slotPrice(slot);
                // Hours priced differently from the base rate (peak/off-peak rule).
                const isSpecial = !booked && price !== pricePerHour;
                const iconBg = booked ? "rgb(var(--jz-gray-100))" : isSelected ? "rgba(255,255,255,0.22)" : isSpecial ? "rgb(var(--jz-amber-100))" : colors.primaryLight;
                const iconColor = booked ? colors.muted : isSelected ? "white" : isSpecial ? "#D97706" : colors.primaryDark;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={booked}
                    onClick={() => toggleSlot(slot)}
                    aria-pressed={isSelected}
                    className={`flex items-center rounded-2xl border px-2.5 py-3 text-left transition ${
                      isSelected
                        ? "border-primary bg-brand"
                        : booked
                          ? "cursor-not-allowed border-border bg-[#FAFAFA]"
                          : isSpecial
                            ? "border-amber-200 bg-amber-50 hover:border-[#F59E0B]"
                            : "border-border bg-surface hover:border-primary/40"
                    }`}
                  >
                    <span className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
                      <Ionicon name="time-outline" size={13} color={iconColor} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block whitespace-nowrap text-[12.5px] font-bold ${booked ? "text-muted" : isSelected ? "text-white" : "text-ink"}`}>
                        {slot.label}
                      </span>
                      <span className={`mt-0.5 block text-xs ${isSelected ? "text-white/85" : "text-muted"}`}>
                        {booked ? "Booked" : `Rs ${price.toLocaleString()}`}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      <StickyActionBar>
        {selectedSlots.length > 0 && (
          <p className="mb-2 line-clamp-2 text-center text-sm text-muted">
            {sortedSelected.length} slot{sortedSelected.length !== 1 ? "s" : ""} · {sortedSelected.map((s) => s.label.split(" – ")[0]).join(", ")} · Rs{" "}
            {totalPrice.toLocaleString()}
          </p>
        )}
        <button
          type="button"
          onClick={goToCheckout}
          disabled={selectedSlots.length === 0}
          className={`w-full rounded-2xl py-4 text-base font-bold transition ${
            selectedSlots.length > 0 ? "press bg-brand text-white shadow-cta hover:brightness-110" : "cursor-not-allowed bg-gray-200 text-muted"
          }`}
        >
          {selectedSlots.length > 0 ? "Continue to Checkout" : "Select a time slot to continue"}
        </button>
      </StickyActionBar>
    </div>
  );
}
