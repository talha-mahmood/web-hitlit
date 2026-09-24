import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useMyBookings, useCancelBooking } from "../../hooks/useBookings";
import { colors, cardShadow } from "../../constants/theme";
import type { BookingWithCourt } from "../../lib/api/bookings";

function formatBookingDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-PK", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBookingTime(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  const start = new Date(startIso).toLocaleTimeString("en-PK", opts);
  const end = new Date(endIso).toLocaleTimeString("en-PK", opts);
  return `${start} – ${end}`;
}

function StatusBadge({ status, payment }: { status: BookingWithCourt["status"]; payment: BookingWithCourt["payment_status"] }) {
  const bg =
    status === "CONFIRMED" ? "bg-primary-light" :
    status === "PENDING"   ? "bg-yellow-50" :
    status === "CANCELLED" ? "bg-red-50" :
    status === "COMPLETED" ? "bg-blue-50" : "bg-gray-100";
  const fg =
    status === "CONFIRMED" ? "text-primary-dark" :
    status === "PENDING"   ? "text-yellow-700" :
    status === "CANCELLED" ? "text-red-600" :
    status === "COMPLETED" ? "text-blue-600" : "text-muted";
  const label =
    status === "CONFIRMED" ? "Confirmed" :
    status === "PENDING"   ? "Pending" :
    status === "CANCELLED" ? "Cancelled" :
    status === "COMPLETED" ? "Completed" : "Expired";

  return (
    <View className="flex-row" style={{ gap: 6 }}>
      <View className={`px-2 py-0.5 rounded-full ${bg}`}>
        <Text className={`text-xs font-medium ${fg}`}>{label}</Text>
      </View>
      {payment === "unpaid" && (status === "CONFIRMED" || status === "PENDING") && (
        <View className="px-2 py-0.5 rounded-full bg-orange-50">
          <Text className="text-xs font-medium text-orange-600">Pay at venue</Text>
        </View>
      )}
    </View>
  );
}

function BookingCard({
  booking,
  onCancel,
  isCancelling,
}: {
  booking: BookingWithCourt;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}) {
  return (
    <View className="border border-border rounded-2xl bg-white mb-3" style={cardShadow}>
      <View className="px-4 py-4">
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-1 mr-2">
            <Text className="text-ink font-semibold text-base" numberOfLines={1}>
              {booking.court?.venues?.name ?? "—"}
            </Text>
            <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
              {booking.court?.name}
              {booking.court?.venues?.city ? ` · ${booking.court.venues.city}` : ""}
            </Text>
          </View>
          <Text className="text-ink font-bold">
            Rs {booking.total_amount.toLocaleString()}
          </Text>
        </View>

        <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
          <Ionicons name="calendar-outline" size={13} color={colors.muted} />
          <Text className="text-muted text-sm">{formatBookingDate(booking.start_time)}</Text>
        </View>
        <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text className="text-muted text-sm">
            {formatBookingTime(booking.start_time, booking.end_time)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mt-3">
          <StatusBadge status={booking.status} payment={booking.payment_status} />
        </View>
      </View>
    </View>
  );
}

export default function MyBookingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: bookings = [], isLoading, refetch, isRefetching } = useMyBookings();
  const cancelMutation = useCancelBooking();

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => new Date(b.start_time) > now && b.status !== "CANCELLED" && b.status !== "EXPIRED"
  );
  const past = bookings.filter(
    (b) => new Date(b.start_time) <= now || b.status === "CANCELLED" || b.status === "EXPIRED"
  );
  const list = tab === "upcoming" ? upcoming : past;

  const handleCancel = (bookingId: string) => {
    Alert.alert("Cancel Booking", "Are you sure? This cannot be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel Booking",
        style: "destructive",
        onPress: () => cancelMutation.mutate(bookingId),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-green-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-bold text-ink">My Bookings</Text>
      </View>

      {/* Tabs */}
      <View className="mx-4 mt-4 mb-3 flex-row border border-border rounded-xl overflow-hidden">
        {(["upcoming", "past"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-3 items-center ${tab === t ? "bg-primary" : "bg-white"}`}
          >
            <Text className={`font-semibold text-sm ${tab === t ? "text-white" : "text-muted"}`}>
              {t === "upcoming"
                ? `Upcoming (${upcoming.length})`
                : `Past (${past.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-16">
              <Ionicons name="calendar-outline" size={52} color={colors.border} />
              <Text className="text-ink font-semibold text-base mt-4">
                No {tab} bookings
              </Text>
              <Text className="text-muted text-sm text-center mt-1 px-8">
                {tab === "upcoming"
                  ? "Book a court from the Venues tab."
                  : "Your completed and cancelled bookings will appear here."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onCancel={handleCancel}
              isCancelling={
                cancelMutation.isPending && cancelMutation.variables === item.id
              }
            />
          )}
        />
      )}
    </View>
  );
}
