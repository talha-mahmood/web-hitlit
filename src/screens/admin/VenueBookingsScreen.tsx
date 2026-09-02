import { useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  useAdminVenueDetail,
  useVenueBookings,
  useCancelBookingAsAdmin,
  useCheckInBooking,
} from "../../hooks/useVenuesAdmin";
import { computeDashboardStats, computeUpcomingBookings } from "../../lib/adminDashboard";
import type { VenueBooking } from "../../lib/api/venuesAdmin";
import { STATUS_BADGE, COUNTED_STATUSES, REVENUE_STATUSES } from "../../lib/bookingStatus";
import { toLocalDateStr } from "../../lib/slots";
import SportIconBadge from "../../components/SportIconBadge";
import BookingsDateRangeModal, { type DateSelection } from "../../components/BookingsDateRangeModal";
import { colors, cardShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

type Route = RouteProp<VenueEditingParamList, "VenueBookings">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "VenueBookings">;

const CARD_BORDER = { borderWidth: 1, borderColor: "rgba(17, 24, 39, 0.06)" } as const;

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function handleContactCustomer(phone: string | null | undefined, name: string | null | undefined) {
  if (!phone) {
    Alert.alert("No Phone Number", `${name ?? "This customer"} hasn't added a phone number to their profile.`);
    return;
  }
  Alert.alert(`Contact ${name ?? "Customer"}`, phone, [
    { text: "Cancel", style: "cancel" },
    { text: "Call", onPress: () => Linking.openURL(`tel:${phone}`) },
    { text: "WhatsApp", onPress: () => Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`) },
  ]);
}

function BookingRow({
  booking,
  onCancel,
  onCheckIn,
  actionsDisabled,
}: {
  booking: VenueBooking;
  onCancel: (bookingId: string) => void;
  onCheckIn: (bookingId: string) => void;
  actionsDisabled: boolean;
}) {
  const badge = STATUS_BADGE[booking.status];
  const isRealCustomerBooking = booking.status !== "BLOCKED";
  const canCancel = isRealCustomerBooking && (booking.status === "PENDING" || booking.status === "CONFIRMED");
  const canCheckIn = booking.status === "CONFIRMED" && !booking.checked_in_at;

  return (
    <View className="border-b border-border py-3">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center flex-1 pr-2" style={{ gap: 10 }}>
          <SportIconBadge sportName={booking.court?.sports?.name} size={30} />
          <View className="flex-1">
            <Text className="text-ink text-sm font-semibold" numberOfLines={1}>
              {formatTimeRange(booking.start_time, booking.end_time)} · {booking.court?.name ?? "Court"}
            </Text>
            {isRealCustomerBooking && (
              <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                {booking.profiles?.full_name ?? "Customer"} · Rs {booking.total_amount.toLocaleString()}
              </Text>
            )}
          </View>
        </View>
        {badge && (
          <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
          </View>
        )}
      </View>
      {booking.checked_in_at && (
        <View className="flex-row items-center ml-10 mb-1" style={{ gap: 4 }}>
          <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
          <Text className="text-primary text-xs font-medium">Checked in</Text>
        </View>
      )}
      {isRealCustomerBooking && (
        <View className="flex-row ml-10" style={{ gap: 8 }}>
          {canCheckIn && (
            <Pressable
              onPress={() => onCheckIn(booking.id)}
              disabled={actionsDisabled}
              className="border border-primary rounded-lg px-3 py-1.5"
            >
              <Text className="text-primary text-xs font-semibold">Check In</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => handleContactCustomer(booking.profiles?.phone, booking.profiles?.full_name)}
            className="border border-border rounded-lg px-3 py-1.5"
          >
            <Text className="text-ink text-xs font-semibold">Contact</Text>
          </Pressable>
          {canCancel && (
            <Pressable
              onPress={() =>
                Alert.alert("Cancel Booking", `Cancel ${booking.profiles?.full_name ?? "this customer"}'s booking?`, [
                  { text: "Keep Booking", style: "cancel" },
                  { text: "Cancel Booking", style: "destructive", onPress: () => onCancel(booking.id) },
                ])
              }
              disabled={actionsDisabled}
              className="border border-danger rounded-lg px-3 py-1.5"
            >
              <Text className="text-danger text-xs font-semibold">Cancel</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-5 mb-4" style={CARD_BORDER}>
      <Text className="text-ink font-bold text-base mb-1">{title}</Text>
      {children}
    </View>
  );
}

export default function VenueBookingsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading: venueLoading } = useAdminVenueDetail(params.venueId);
  const { data: bookings, isLoading: bookingsLoading } = useVenueBookings(params.venueId);
  const cancelBooking = useCancelBookingAsAdmin(params.venueId);
  const checkInBooking = useCheckInBooking(params.venueId);

  const isLoading = venueLoading || bookingsLoading;
  const actionsDisabled = cancelBooking.isPending || checkInBooking.isPending;

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateSelection, setDateSelection] = useState<DateSelection | null>(null);

  const stats = useMemo(
    () => (venue ? computeDashboardStats(bookings ?? [], venue, venue.court.length) : null),
    [bookings, venue]
  );
  const upcoming = useMemo(() => computeUpcomingBookings(bookings ?? [], 20), [bookings]);

  const selectionResult = useMemo(() => {
    if (!dateSelection || !bookings) return null;
    const isSingleDay = dateSelection.start === dateSelection.end;
    const inRange = bookings.filter((b) => {
      const day = toLocalDateStr(new Date(b.start_time));
      return day >= dateSelection.start && day <= dateSelection.end;
    });
    const counted = inRange.filter((b) => COUNTED_STATUSES.has(b.status));
    const revenue = inRange
      .filter((b) => REVENUE_STATUSES.has(b.status))
      .reduce((sum, b) => sum + b.total_amount, 0);
    const dayBookings = isSingleDay ? counted.slice().sort((a, b) => a.start_time.localeCompare(b.start_time)) : [];
    return { isSingleDay, totalBookings: counted.length, totalRevenue: revenue, dayBookings };
  }, [dateSelection, bookings]);

  const handleCancel = (id: string) =>
    cancelBooking.mutate(id, {
      onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not cancel booking."),
    });
  const handleCheckIn = (id: string) =>
    checkInBooking.mutate(id, {
      onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not check in."),
    });

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Bookings</Text>
        <Pressable
          onPress={() => setCalendarOpen(true)}
          hitSlop={8}
          className="mr-2 p-1"
        >
          <Ionicons name="calendar-outline" size={20} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("AdminAnalytics", { venueId: params.venueId })}
          className="flex-row items-center bg-primary-light rounded-lg px-3 py-1.5"
          style={{ gap: 4 }}
        >
          <Ionicons name="stats-chart-outline" size={14} color={colors.primaryDark} />
          <Text className="text-primary text-xs font-semibold">Analytics</Text>
        </Pressable>
      </View>

      {isLoading || !stats ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View className="bg-white rounded-2xl p-5 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs">Today's Revenue</Text>
            <Text className="text-ink font-extrabold text-3xl mt-1">Rs {stats.todaysRevenue.toLocaleString()}</Text>
            <Text className="text-muted text-xs mt-1">{stats.todaysBookingsCount} bookings today</Text>
          </View>

          {dateSelection && selectionResult && (
            <View className="bg-white rounded-2xl p-5 mb-4" style={cardShadow}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>
                  {selectionResult.isSingleDay
                    ? formatDateLabel(dateSelection.start)
                    : `${formatDateLabel(dateSelection.start)} – ${formatDateLabel(dateSelection.end)}`}
                </Text>
                <Pressable onPress={() => setDateSelection(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              </View>
              <View className="flex-row" style={{ gap: 12 }}>
                <View className="flex-1 bg-gray-100 rounded-xl p-3">
                  <Text className="text-muted text-xs">Total Bookings</Text>
                  <Text className="text-ink font-extrabold text-lg mt-0.5">{selectionResult.totalBookings}</Text>
                </View>
                <View className="flex-1 bg-gray-100 rounded-xl p-3">
                  <Text className="text-muted text-xs">Total Revenue</Text>
                  <Text className="text-ink font-extrabold text-lg mt-0.5">
                    Rs {selectionResult.totalRevenue.toLocaleString()}
                  </Text>
                </View>
              </View>

              {selectionResult.isSingleDay && (
                <View className="mt-4">
                  {selectionResult.dayBookings.length === 0 ? (
                    <Text className="text-muted text-sm py-2">No bookings on this day.</Text>
                  ) : (
                    selectionResult.dayBookings.map((b) => (
                      <BookingRow
                        key={b.id}
                        booking={b}
                        actionsDisabled={actionsDisabled}
                        onCancel={handleCancel}
                        onCheckIn={handleCheckIn}
                      />
                    ))
                  )}
                </View>
              )}
            </View>
          )}

          <SectionCard title="Today's Calendar">
            {stats.todaysSchedule.length === 0 ? (
              <Text className="text-muted text-sm py-2">No bookings scheduled for today yet.</Text>
            ) : (
              stats.todaysSchedule.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  actionsDisabled={actionsDisabled}
                  onCancel={handleCancel}
                  onCheckIn={handleCheckIn}
                />
              ))
            )}
          </SectionCard>

          <SectionCard title="Upcoming Bookings">
            {upcoming.length === 0 ? (
              <Text className="text-muted text-sm py-2">No upcoming bookings yet.</Text>
            ) : (
              upcoming.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  actionsDisabled={actionsDisabled}
                  onCancel={handleCancel}
                  onCheckIn={handleCheckIn}
                />
              ))
            )}
          </SectionCard>

          <Text className="text-muted text-xs text-center">
            Looking for past bookings, revenue trends, or court performance? Check Analytics.
          </Text>
        </ScrollView>
      )}

      <BookingsDateRangeModal
        visible={calendarOpen}
        initialSelection={dateSelection}
        onClose={() => setCalendarOpen(false)}
        onSave={(selection) => {
          setDateSelection(selection);
          setCalendarOpen(false);
        }}
      />
    </View>
  );
}
