import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useVenueBookings, useCancelledBookingsCount } from "../../hooks/useVenuesAdmin";
import {
  computeVenueAnalytics,
  computeSportBreakdown,
  computeRevenueByScale,
  type RevenueScale,
} from "../../lib/adminDashboard";
import { COUNTED_STATUSES } from "../../lib/bookingStatus";
import { exportCsv } from "../../lib/exportCsv";
import { BOOKING_CSV_HEADER, formatBookingRowForCsv, toSafeFilenameSegment } from "../../lib/bookingCsv";
import RevenueLineChart from "../../components/RevenueLineChart";
import { colors, cardShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Route = RouteProp<VenueEditingParamList, "AdminAnalytics">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "AdminAnalytics">;

const CARD_BORDER = { borderWidth: 1, borderColor: "rgba(17, 24, 39, 0.06)" } as const;

function StatCard({
  icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <View className="bg-surface rounded-2xl p-4" style={{ width: "48%", ...CARD_BORDER }}>
      <View
        className="items-center justify-center rounded-full mb-3"
        style={{ width: 36, height: 36, backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text className="text-muted text-xs">{label}</Text>
      <Text className="text-ink font-extrabold text-lg mt-0.5" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function AdminAnalyticsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading: venueLoading } = useAdminVenueDetail(params.venueId);
  const { data: bookings, isLoading: bookingsLoading } = useVenueBookings(params.venueId);
  const { data: cancelledCount, isLoading: cancelledLoading } = useCancelledBookingsCount(params.venueId);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [revenueScale, setRevenueScale] = useState<RevenueScale>("days");

  const isLoading = venueLoading || bookingsLoading || cancelledLoading;

  const sportOptions = useMemo(() => {
    const names = new Set((venue?.court ?? []).map((c) => c.sports?.name).filter((n): n is string => !!n));
    return Array.from(names).sort();
  }, [venue]);

  // Only surfaced once a sport is picked, and only when that sport has more
  // than one court — a venue with a single "Badminton" court has nothing to
  // drill further into.
  const courtOptions = useMemo(() => {
    if (!selectedSport) return [];
    return (venue?.court ?? []).filter((c) => c.sports?.name === selectedSport);
  }, [venue, selectedSport]);

  const selectedCourtName = courtOptions.find((c) => c.id === selectedCourtId)?.name ?? null;

  const handleSelectSport = (sport: string | null) => {
    setSelectedSport(sport);
    setSelectedCourtId(null);
  };

  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    let result = bookings;
    if (selectedSport) result = result.filter((b) => b.court?.sports?.name === selectedSport);
    if (selectedCourtId) result = result.filter((b) => b.court?.id === selectedCourtId);
    return result;
  }, [bookings, selectedSport, selectedCourtId]);

  const isFiltered = !!selectedSport || !!selectedCourtId;
  const analytics = useMemo(
    () => (bookings ? computeVenueAnalytics(filteredBookings, isFiltered ? 0 : cancelledCount ?? 0) : null),
    [bookings, filteredBookings, isFiltered, cancelledCount]
  );
  const sportBreakdown = useMemo(() => computeSportBreakdown(bookings ?? []), [bookings]);
  const revenueTrend = useMemo(
    () => computeRevenueByScale(filteredBookings, revenueScale),
    [filteredBookings, revenueScale]
  );
  const combinedRevenue = useMemo(
    () => (bookings ?? []).reduce((sum, b) => (COUNTED_STATUSES.has(b.status) ? sum + b.total_amount : sum), 0),
    [bookings]
  );

  const handleExport = async () => {
    if (filteredBookings.length === 0) {
      Alert.alert("Nothing to Export", "There are no bookings for this selection yet.");
      return;
    }
    setExporting(true);
    try {
      const rows = [BOOKING_CSV_HEADER, ...filteredBookings.map(formatBookingRowForCsv)];
      const nameParts = [venue?.name ?? "venue", selectedCourtName ?? selectedSport].filter(
        (p): p is string => !!p
      );
      const filename = `${toSafeFilenameSegment(nameParts.join("-"))}-bookings.csv`;
      await exportCsv(filename, rows);
    } catch (err) {
      Alert.alert("Export Failed", getFriendlyErrorMessage(err, "Could not export bookings."));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || !analytics) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          AI Analytics · {venue?.name ?? ""}
        </Text>
        <Pressable
          onPress={handleExport}
          disabled={exporting}
          className="flex-row items-center bg-primary-light rounded-lg px-3 py-1.5"
          style={{ gap: 4 }}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <>
              <Ionicons name="download-outline" size={14} color={colors.primaryDark} />
              <Text className="text-primary text-xs font-semibold">Export</Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {sportOptions.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: courtOptions.length > 1 ? 8 : 16 }}>
            <Pressable
              onPress={() => handleSelectSport(null)}
              className="px-3 py-2 rounded-xl"
              style={{
                borderWidth: 1.5,
                borderColor: !selectedSport ? colors.primary : colors.border,
                backgroundColor: !selectedSport ? colors.primary : "#0A1723",
              }}
            >
              <Text className={`text-sm font-medium ${!selectedSport ? "text-jazba-white" : "text-ink"}`}>
                All Sports
              </Text>
            </Pressable>
            {sportOptions.map((sport) => {
              const selected = selectedSport === sport;
              return (
                <Pressable
                  key={sport}
                  onPress={() => handleSelectSport(sport)}
                  className="px-3 py-2 rounded-xl"
                  style={{
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : "#0A1723",
                  }}
                >
                  <Text className={`text-sm font-medium ${selected ? "text-jazba-white" : "text-ink"}`}>{sport}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {courtOptions.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }} style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => setSelectedCourtId(null)}
              className="px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: !selectedCourtId ? colors.primaryLight : "#142533" }}
            >
              <Text className="text-xs font-medium" style={{ color: !selectedCourtId ? colors.primaryDark : colors.muted }}>
                All {selectedSport} Courts
              </Text>
            </Pressable>
            {courtOptions.map((court) => {
              const selected = selectedCourtId === court.id;
              return (
                <Pressable
                  key={court.id}
                  onPress={() => setSelectedCourtId(court.id)}
                  className="px-2.5 py-1.5 rounded-lg"
                  style={{ backgroundColor: selected ? colors.primaryLight : "#142533" }}
                >
                  <Text className="text-xs font-medium" style={{ color: selected ? colors.primaryDark : colors.muted }}>
                    {court.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {analytics.totalBookings === 0 ? (
          <View className="border border-dashed border-border rounded-2xl p-8 items-center mb-4">
            <Ionicons name="stats-chart-outline" size={32} color={colors.border} />
            <Text className="text-muted text-sm text-center mt-2">
              {selectedCourtName
                ? `No bookings for ${selectedCourtName} yet.`
                : selectedSport
                  ? `No ${selectedSport} bookings yet.`
                  : "Not enough booking history yet to show analytics."}
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-between mb-4" style={{ rowGap: 12 }}>
            <StatCard
              icon="calendar"
              iconBg={colors.primaryLight}
              iconColor={colors.primaryDark}
              label="Total Bookings"
              value={String(analytics.totalBookings)}
            />
            <StatCard
              icon="wallet"
              iconBg="#EDE9FE"
              iconColor="#7C3AED"
              label={selectedCourtName ? `${selectedCourtName} Revenue` : selectedSport ? `${selectedSport} Revenue` : "Total Revenue"}
              value={`Rs ${analytics.totalRevenue.toLocaleString()}`}
            />
            <StatCard
              icon="pricetag"
              iconBg="#DBEAFE"
              iconColor="#2563EB"
              label="Avg. Booking Value"
              value={`Rs ${analytics.avgBookingValue.toLocaleString()}`}
            />
            <StatCard
              icon="close-circle"
              iconBg="#351419"
              iconColor="#DC2626"
              label="Cancellation Rate"
              value={isFiltered ? "—" : `${analytics.cancellationRate}%`}
            />
            {!selectedSport && (
              <>
                <StatCard
                  icon="basketball"
                  iconBg="#FFEDD5"
                  iconColor="#EA580C"
                  label="Most Popular Sport"
                  value={analytics.mostPopularSport ?? "—"}
                />
                <StatCard
                  icon="grid"
                  iconBg="#103A2A"
                  iconColor={colors.primaryDark}
                  label="Most Popular Court"
                  value={analytics.mostPopularCourt ?? "—"}
                />
              </>
            )}
            <StatCard
              icon="time"
              iconBg="#352A13"
              iconColor="#D97706"
              label="Peak Hours"
              value={analytics.peakHourLabel ?? "—"}
            />
            <StatCard
              icon="people"
              iconBg="#E0E7FF"
              iconColor="#4F46E5"
              label="Repeat Customers"
              value={`${analytics.repeatCustomers} of ${analytics.totalCustomers}`}
            />
          </View>
        )}

        {sportBreakdown.length > 0 && (
          <View className="bg-surface rounded-2xl p-5 mb-4" style={cardShadow}>
            <Text className="text-ink font-bold text-base mb-1">Court Performance by Sport</Text>
            <Text className="text-muted text-xs mb-3">How each sport contributes to this venue's business.</Text>
            {sportBreakdown.map((s) => (
              <View key={s.sportName} className="flex-row items-center justify-between py-2 border-b border-border">
                <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
                  {s.sportName}
                </Text>
                <Text className="text-muted text-xs mr-3">{s.bookings} bookings</Text>
                <Text className="text-ink text-xs font-semibold">Rs {s.revenue.toLocaleString()}</Text>
              </View>
            ))}
            <View className="flex-row items-center justify-between pt-3">
              <Text className="text-ink text-sm font-bold flex-1">Combined Venue Revenue</Text>
              <Text className="text-ink text-sm font-extrabold">Rs {combinedRevenue.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {revenueTrend.total > 0 && (
          <View className="bg-surface rounded-2xl p-5 mb-4" style={cardShadow}>
            <Text className="text-ink font-bold text-base mb-1">
              Revenue Trend
              {selectedCourtName ? ` · ${selectedCourtName}` : selectedSport ? ` · ${selectedSport}` : ""}
            </Text>
            <Text className="text-muted text-xs mb-3">Rs {revenueTrend.total.toLocaleString()} ({revenueTrend.periodLabel})</Text>

            <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4" style={{ gap: 4 }}>
              {(["days", "weeks", "months", "year"] as RevenueScale[]).map((scale) => (
                <Pressable
                  key={scale}
                  onPress={() => setRevenueScale(scale)}
                  className="flex-1 items-center py-1.5 rounded-lg"
                  style={{ backgroundColor: revenueScale === scale ? "#0A1723" : "transparent" }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: revenueScale === scale ? colors.primary : colors.muted }}
                  >
                    {scale}
                  </Text>
                </Pressable>
              ))}
            </View>

            <RevenueLineChart labels={revenueTrend.labels} values={revenueTrend.values} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
