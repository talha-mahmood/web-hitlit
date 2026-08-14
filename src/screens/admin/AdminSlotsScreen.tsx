import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail } from "../../hooks/useVenuesAdmin";
import { useCourtBookingsForDate, useBlockSlot, useUnblockSlot } from "../../hooks/useAdminSlots";
import { useAuthStore } from "../../store/authStore";
import { toLocalDateStr, getNext14Days, generateSlots, type Slot } from "../../lib/slots";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

type Route = RouteProp<VenueEditingParamList, "AdminSlots">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "AdminSlots">;

function findBooking(
  slot: Slot,
  date: string,
  bookings: Array<{ id: string; start_time: string; end_time: string; status: string; profiles: { full_name: string | null } | null }>
) {
  const s = new Date(`${date}T${slot.start}:00+05:00`).getTime();
  const e = new Date(`${date}T${slot.end}:00+05:00`).getTime();
  return bookings.find((b) => {
    const bs = new Date(b.start_time).getTime();
    const be = new Date(b.end_time).getTime();
    return s < be && e > bs;
  });
}

export default function AdminSlotsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venue } = useAdminVenueDetail(params.venueId);

  const days = getNext14Days();
  const todayStr = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(days[0]);

  const { data: bookings = [], isLoading } = useCourtBookingsForDate(params.courtId, selectedDate);
  const blockSlot = useBlockSlot(params.courtId, selectedDate);
  const unblockSlot = useUnblockSlot(params.courtId, selectedDate);

  const slots = venue ? generateSlots(venue.start_time ?? "06:00", venue.end_time ?? "23:00") : [];
  const disabled = blockSlot.isPending || unblockSlot.isPending;

  const handleSlotPress = (slot: Slot) => {
    const booking = findBooking(slot, selectedDate, bookings);

    if (!booking) {
      Alert.alert("Block This Slot", `Block ${slot.label} so customers can't book it?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          onPress: () => {
            if (!userId) return;
            blockSlot.mutate(
              { adminUserId: userId, startTime: slot.start, endTime: slot.end },
              { onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not block slot.") }
            );
          },
        },
      ]);
      return;
    }

    if (booking.status === "BLOCKED") {
      Alert.alert("Unblock This Slot", `Make ${slot.label} available for booking again?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: () =>
            unblockSlot.mutate(booking.id, {
              onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not unblock slot."),
            }),
        },
      ]);
      return;
    }

    Alert.alert("Booked", `${slot.label} is booked by ${booking.profiles?.full_name ?? "a customer"}.`);
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
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          {params.courtName} · Slots
        </Text>
      </View>

      <View className="border-b border-border bg-gray-100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}
        >
          {days.map((day) => {
            const isToday = day === todayStr;
            const isSelected = day === selectedDate;
            const d = new Date(day + "T12:00:00");
            const dayLabel = isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDate(day)}
                className={`items-center justify-center w-14 h-16 rounded-xl ${
                  isSelected ? "bg-primary" : "bg-white border border-border"
                }`}
              >
                <Text className={`text-xs font-medium ${isSelected ? "text-white" : isToday ? "text-primary" : "text-muted"}`}>
                  {dayLabel}
                </Text>
                <Text className={`text-lg font-bold mt-0.5 ${isSelected ? "text-white" : "text-ink"}`}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="flex-row items-center px-4 py-2.5 border-b border-border" style={{ gap: 16 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border }} />
          <Text className="text-muted text-xs">Available</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#DBEAFE" }} />
          <Text className="text-muted text-xs">Booked</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FEE2E2" }} />
          <Text className="text-muted text-xs">Blocked</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {isLoading ? (
          <View className="items-center mt-12">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {slots.map((slot) => {
              const booking = findBooking(slot, selectedDate, bookings);
              const isBlocked = booking?.status === "BLOCKED";
              const isBooked = !!booking && !isBlocked;

              return (
                <Pressable
                  key={slot.start}
                  disabled={disabled}
                  onPress={() => handleSlotPress(slot)}
                  style={{ width: "47%" }}
                  className={`items-center justify-center rounded-xl border px-3 py-3 ${
                    isBooked
                      ? "bg-blue-50 border-blue-100"
                      : isBlocked
                        ? "bg-red-50 border-red-100"
                        : "bg-white border-border"
                  }`}
                >
                  <Text className={`text-sm font-medium text-center ${isBooked || isBlocked ? "text-ink" : "text-ink"}`}>
                    {slot.label}
                  </Text>
                  {isBooked && <Text className="text-xs text-blue-600 mt-0.5">Booked</Text>}
                  {isBlocked && <Text className="text-xs text-red-500 mt-0.5">Blocked · Tap to unblock</Text>}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
