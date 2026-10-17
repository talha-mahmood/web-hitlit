import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useVenueBookings } from "../../hooks/useVenuesAdmin";
import { computeDashboardStats } from "../../lib/adminDashboard";
import type { VenueBooking } from "../../lib/api/venuesAdmin";
import { STATUS_BADGE, COUNTED_STATUSES, REVENUE_STATUSES } from "../../lib/bookingStatus";
import { toLocalDateStr } from "../../lib/slots";
import { exportCsv } from "../../lib/exportCsv";
import { BOOKING_CSV_HEADER, formatBookingRowForCsv, toSafeFilenameSegment } from "../../lib/bookingCsv";
import SportIconBadge from "../../components/SportIconBadge";
import BookingsDateRangeModal, { type DateSelection } from "../../components/BookingsDateRangeModal";
import { colors, cardShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Route = RouteProp<VenueEditingParamList, "VenueBookings">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "VenueBookings">;

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function BookingRow({ booking }: { booking: VenueBooking }) {
  const badge = STATUS_BADGE[booking.status];
  const isRealCustomerBooking = booking.status !== "BLOCKED";

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
        <View className="flex-row items-center ml-10" style={{ gap: 4 }}>
          <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
          <Text className="text-primary text-xs font-medium">Checked in</Text>
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

export default function VenueBookingsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading: venueLoading, refetch: refetchVenue, isRefetching: venueRefetching } = useAdminVenueDetail(params.venueId);
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings, isRefetching: bookingsRefetching } = useVenueBookings(params.venueId);

  const isLoading = venueLoading || bookingsLoading;
  const isRefreshing = venueRefetching || bookingsRefetching;
  const handleRefresh = () => {
    refetchVenue();
    refetchBookings();
  };

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateSelection, setDateSelection] = useState<DateSelection | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const sportOptions = useMemo(() => {
    const names = new Set((venue?.court ?? []).map((c) => c.sports?.name).filter((n): n is string => !!n));
    return Array.from(names).sort();
  }, [venue]);

  // No sport picked → every court's bookings; a sport picked → only that
  // sport's courts, everywhere on this screen (today's revenue and the
  // date-range/single-day results below).
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    if (!selectedSport) return bookings;
    return bookings.filter((b) => b.court?.sports?.name === selectedSport);
  }, [bookings, selectedSport]);

  const stats = useMemo(
    () => (venue ? computeDashboardStats(filteredBookings, venue, venue.court.length) : null),
    [filteredBookings, venue]
  );

  const selectionResult = useMemo(() => {
    if (!dateSelection) return null;
    const isSingleDay = dateSelection.start === dateSelection.end;
    const inRange = filteredBookings.filter((b) => {
      const day = toLocalDateStr(new Date(b.start_time));
      return day >= dateSelection.start && day <= dateSelection.end;
    });
    const counted = inRange.filter((b) => COUNTED_STATUSES.has(b.status));
    const revenue = inRange
      .filter((b) => REVENUE_STATUSES.has(b.status))
      .reduce((sum, b) => sum + b.total_amount, 0);
    const dayBookings = isSingleDay ? counted.slice().sort((a, b) => a.start_time.localeCompare(b.start_time)) : [];
    return { isSingleDay, totalBookings: counted.length, totalRevenue: revenue, dayBookings };
  }, [dateSelection, filteredBookings]);

  // Same set the on-screen "Total Bookings/Revenue" figures are computed
  // from — sport filter always applied, date range/single-day on top of it
  // when one's selected. Exporting always matches what's currently shown.
  const [exporting, setExporting] = useState(false);
  const bookingsToExport = useMemo(() => {
    if (!dateSelection) return filteredBookings;
    return filteredBookings.filter((b) => {
      const day = toLocalDateStr(new Date(b.start_time));
      return day >= dateSelection.start && day <= dateSelection.end;
    });
  }, [filteredBookings, dateSelection]);

  const handleExport = async () => {
    if (bookingsToExport.length === 0) {
      Alert.alert("Nothing to Export", "There are no bookings for this selection yet.");
      return;
    }
    setExporting(true);
    try {
      const rows = [BOOKING_CSV_HEADER, ...bookingsToExport.map(formatBookingRowForCsv)];
      const nameParts = [
        venue?.name ?? "venue",
        selectedSport,
        dateSelection
          ? dateSelection.start === dateSelection.end
            ? dateSelection.start
            : `${dateSelection.start}_to_${dateSelection.end}`
          : null,
      ].filter((p): p is string => !!p);
      const filename = `${toSafeFilenameSegment(nameParts.join("-"))}-bookings.csv`;
      await exportCsv(filename, rows);
    } catch (err) {
      Alert.alert("Export Failed", getFriendlyErrorMessage(err, "Could not export bookings."));
    } finally {
      setExporting(false);
    }
  };

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
        <Pressable onPress={handleExport} disabled={exporting} hitSlop={8} className="mr-2 p-1">
          {exporting ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Ionicons name="download-outline" size={20} color={colors.ink} />
          )}
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
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        >
          {sportOptions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              style={{ marginBottom: 16 }}
            >
              <Pressable
                onPress={() => setSelectedSport(null)}
                className="px-3 py-2 rounded-xl"
                style={{
                  borderWidth: 1.5,
                  borderColor: !selectedSport ? colors.primary : colors.border,
                  backgroundColor: !selectedSport ? colors.primary : "white",
                }}
              >
                <Text className={`text-sm font-medium ${!selectedSport ? "text-white" : "text-ink"}`}>
                  All Sports
                </Text>
              </Pressable>
              {sportOptions.map((sport) => {
                const selected = selectedSport === sport;
                return (
                  <Pressable
                    key={sport}
                    onPress={() => setSelectedSport(sport)}
                    className="px-3 py-2 rounded-xl"
                    style={{
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : "white",
                    }}
                  >
                    <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>{sport}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View className="bg-white rounded-2xl p-5 mb-4" style={cardShadow}>
            <Text className="text-muted text-xs">
              {selectedSport ? `Today's ${selectedSport} Revenue` : "Today's Revenue"}
            </Text>
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
                    selectionResult.dayBookings.map((b) => <BookingRow key={b.id} booking={b} />)
                  )}
                </View>
              )}
            </View>
          )}

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
