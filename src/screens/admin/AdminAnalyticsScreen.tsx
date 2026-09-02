import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useVenueBookings, useCancelledBookingsCount } from "../../hooks/useVenuesAdmin";
import { computeVenueAnalytics } from "../../lib/adminDashboard";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

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
    <View className="bg-white rounded-2xl p-4" style={{ width: "48%", ...CARD_BORDER }}>
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

  const isLoading = venueLoading || bookingsLoading || cancelledLoading;

  const analytics = useMemo(
    () => (bookings ? computeVenueAnalytics(bookings, cancelledCount ?? 0) : null),
    [bookings, cancelledCount]
  );

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
          Analytics · {venue?.name ?? ""}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {analytics.totalBookings === 0 ? (
          <View className="border border-dashed border-border rounded-2xl p-8 items-center">
            <Ionicons name="stats-chart-outline" size={32} color={colors.border} />
            <Text className="text-muted text-sm text-center mt-2">
              Not enough booking history yet to show analytics.
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
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
              label="Total Revenue"
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
              iconBg="#FEE2E2"
              iconColor="#DC2626"
              label="Cancellation Rate"
              value={`${analytics.cancellationRate}%`}
            />
            <StatCard
              icon="basketball"
              iconBg="#FFEDD5"
              iconColor="#EA580C"
              label="Most Popular Sport"
              value={analytics.mostPopularSport ?? "—"}
            />
            <StatCard
              icon="grid"
              iconBg="#DCFCE7"
              iconColor={colors.primaryDark}
              label="Most Popular Court"
              value={analytics.mostPopularCourt ?? "—"}
            />
            <StatCard
              icon="time"
              iconBg="#FEF3C7"
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
      </ScrollView>
    </View>
  );
}
