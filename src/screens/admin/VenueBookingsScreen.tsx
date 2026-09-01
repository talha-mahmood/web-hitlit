import { useMemo } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useVenueBookings } from "../../hooks/useVenuesAdmin";
import type { VenueBooking } from "../../lib/api/venuesAdmin";
import { generateSlots, toLocalDateStr } from "../../lib/slots";
import { COUNTED_STATUSES, REVENUE_STATUSES, OCCUPIED_STATUSES, STATUS_BADGE } from "../../lib/bookingStatus";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

type Route = RouteProp<VenueEditingParamList, "VenueBookings">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "VenueBookings">;

const CARD_BORDER = {
  borderWidth: 1,
  borderColor: "rgba(17, 24, 39, 0.06)",
} as const;

type PeriodKey = "today" | "week" | "month" | "year";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function isWithinPeriod(date: Date, period: PeriodKey, now: Date): boolean {
  if (period === "today") return toLocalDateStr(date) === toLocalDateStr(now);
  if (period === "month") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (period === "year") return date.getFullYear() === now.getFullYear();

  // Calendar week, Monday–Sunday.
  const startOfWeek = new Date(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return date >= startOfWeek && date < endOfWeek;
}

function useBookingStats(bookings: VenueBooking[] | undefined) {
  return useMemo(() => {
    const now = new Date();
    const counts: Record<PeriodKey, number> = { today: 0, week: 0, month: 0, year: 0 };
    const revenue: Record<PeriodKey, number> = { today: 0, week: 0, month: 0, year: 0 };
    let totalRevenue = 0;

    for (const b of bookings ?? []) {
      const isRevenue = REVENUE_STATUSES.has(b.status);
      if (isRevenue) totalRevenue += b.total_amount;
      if (!COUNTED_STATUSES.has(b.status)) continue;

      const startDate = new Date(b.start_time);
      for (const { key } of PERIODS) {
        if (isWithinPeriod(startDate, key, now)) {
          counts[key] += 1;
          if (isRevenue) revenue[key] += b.total_amount;
        }
      }
    }

    return { counts, revenue, totalRevenue };
  }, [bookings]);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function BookingRow({ booking }: { booking: VenueBooking }) {
  const badge = STATUS_BADGE[booking.status];
  return (
    <View className="border border-border rounded-xl px-4 py-3 mb-2">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>
          {booking.court?.name ?? "Court"}
        </Text>
        {badge && (
          <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
          </View>
        )}
      </View>
      <Text className="text-muted text-xs">{formatDateTime(booking.start_time)}</Text>
      {booking.status !== "BLOCKED" && (
        <Text className="text-muted text-xs mt-0.5">
          {booking.profiles?.full_name ?? "Customer"} · Rs {booking.total_amount.toLocaleString()}
        </Text>
      )}
    </View>
  );
}

function StatsHeader({
  bookings,
  courtCount,
  slotsPerCourtPerDay,
  onViewSlots,
}: {
  bookings: VenueBooking[] | undefined;
  courtCount: number;
  slotsPerCourtPerDay: number;
  onViewSlots: () => void;
}) {
  const { counts, revenue, totalRevenue } = useBookingStats(bookings);

  const today = toLocalDateStr(new Date());
  const bookedToday = (bookings ?? []).filter(
    (b) => OCCUPIED_STATUSES.has(b.status) && toLocalDateStr(new Date(b.start_time)) === today
  ).length;
  const totalSlotsToday = slotsPerCourtPerDay * courtCount;
  const freeToday = Math.max(totalSlotsToday - bookedToday, 0);

  return (
    <View className="mb-5">
      <View className="bg-white rounded-2xl p-5 mb-3" style={CARD_BORDER}>
        <Text className="text-muted text-xs">Total Revenue</Text>
        <Text className="text-ink font-extrabold text-3xl mt-1">Rs {totalRevenue.toLocaleString()}</Text>
      </View>

      <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
        {PERIODS.map(({ key, label }) => (
          <View key={key} className="bg-white rounded-2xl p-4" style={{ width: "48%", ...CARD_BORDER }}>
            <Text className="text-muted text-xs mb-1">{label}</Text>
            <Text className="text-ink font-extrabold text-xl">{counts[key]}</Text>
            <Text className="text-muted text-xs mt-0.5">bookings · Rs {revenue[key].toLocaleString()}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onViewSlots}
        className="flex-row items-center bg-white rounded-2xl p-4 mt-3"
        style={CARD_BORDER}
      >
        <View
          className="items-center justify-center rounded-full mr-3"
          style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
        >
          <Ionicons name="grid-outline" size={18} color={colors.primaryDark} />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-semibold text-sm">
            {bookedToday} of {totalSlotsToday} slots booked today
          </Text>
          <Text className="text-muted text-xs mt-0.5">{freeToday} slots left · tap to view courts</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.border} />
      </Pressable>

      <Text className="text-lg font-semibold text-ink mt-6 mb-1">All Bookings</Text>
    </View>
  );
}

export default function VenueBookingsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading: venueLoading } = useAdminVenueDetail(params.venueId);
  const { data: bookings, isLoading: bookingsLoading } = useVenueBookings(params.venueId);

  const isLoading = venueLoading || bookingsLoading;
  const slotsPerCourtPerDay = venue
    ? generateSlots(venue.start_time ?? "06:00", venue.end_time ?? "23:00").length
    : 0;

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
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={bookings ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListHeaderComponent={
            <StatsHeader
              bookings={bookings}
              courtCount={venue?.court.length ?? 0}
              slotsPerCourtPerDay={slotsPerCourtPerDay}
              onViewSlots={() => navigation.navigate("ManageCourts", { venueId: params.venueId })}
            />
          }
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="calendar-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">No bookings yet.</Text>
            </View>
          }
          renderItem={({ item }) => <BookingRow booking={item} />}
        />
      )}
    </View>
  );
}
