import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useVenueBookings } from "../../hooks/useVenuesAdmin";
import type { VenueBooking } from "../../lib/api/venuesAdmin";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

type Route = RouteProp<VenueEditingParamList, "VenueBookings">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "VenueBookings">;

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-orange-50", text: "text-orange-600", label: "Pending" },
  CONFIRMED: { bg: "bg-green-50", text: "text-green-700", label: "Confirmed" },
  COMPLETED: { bg: "bg-blue-50", text: "text-blue-600", label: "Completed" },
  BLOCKED: { bg: "bg-red-50", text: "text-red-600", label: "Blocked by you" },
};

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

export default function VenueBookingsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: bookings, isLoading } = useVenueBookings(params.venueId);

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
