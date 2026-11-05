import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useCourtPriceRules } from "../../hooks/useVenuesAdmin";
import { useCourtBookingsForDate, useBlockSlot, useUnblockSlot } from "../../hooks/useAdminSlots";
import { useAuthStore } from "../../store/authStore";
import {
  toLocalDateStr,
  getNext14Days,
  generateFullDaySlots,
  isSlotPast,
  slotBoundaryDateTime,
  resolveSlotPrice,
  type Slot,
} from "../../lib/slots";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import GradientFill from "../../components/GradientFill";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { SkeletonBlock } from "../../components/Skeleton";

type Route = RouteProp<VenueEditingParamList, "AdminSlots">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "AdminSlots">;

function findBooking(
  slot: Slot,
  date: string,
  bookings: Array<{ id: string; start_time: string; end_time: string; status: string; profiles: { full_name: string | null } | null }>
) {
  const s = slotBoundaryDateTime(date, slot.start, false).getTime();
  const e = slotBoundaryDateTime(date, slot.end, true).getTime();
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

  const { data: bookings = [], isLoading, refetch, isRefetching } = useCourtBookingsForDate(params.courtId, selectedDate);
  const { data: priceRules = [] } = useCourtPriceRules(params.courtId);
  const blockSlot = useBlockSlot(params.courtId, selectedDate);
  const unblockSlot = useUnblockSlot(params.courtId, selectedDate);

  const court = venue?.court.find((c) => c.id === params.courtId);
  const slots = generateFullDaySlots();
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
              { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not block slot.")) }
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
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not unblock slot.")),
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
              <Pressable key={day} onPress={() => setSelectedDate(day)}>
                {isSelected ? (
                  <GradientFill className="items-center justify-center w-14 h-16 rounded-xl">
                    <Text className="text-xs font-medium text-jazba-white">{dayLabel}</Text>
                    <Text className="text-lg font-bold mt-0.5 text-jazba-white">{d.getDate()}</Text>
                  </GradientFill>
                ) : (
                  <View className="items-center justify-center w-14 h-16 rounded-xl bg-surface border border-border">
                    <Text className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted"}`}>{dayLabel}</Text>
                    <Text className="text-lg font-bold mt-0.5 text-ink">{d.getDate()}</Text>
                  </View>
                )}
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
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#351419" }} />
          <Text className="text-muted text-xs">Blocked</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isLoading ? (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <SkeletonBlock key={i} width="47%" height={58} borderRadius={12} />
            ))}
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {slots
              .filter((slot) => !isSlotPast(slot, selectedDate))
              .map((slot) => {
                const booking = findBooking(slot, selectedDate, bookings);
                const isBlocked = booking?.status === "BLOCKED";
                const isBooked = !!booking && !isBlocked;
                const price = court ? resolveSlotPrice(slot, court.price_per_hour, priceRules) : null;

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
                          : "bg-surface border-border"
                    }`}
                  >
                    <Text className="text-sm font-medium text-center text-ink">{slot.label}</Text>
                    {isBooked && <Text className="text-xs text-blue-600 mt-0.5">Booked</Text>}
                    {isBlocked && <Text className="text-xs text-red-500 mt-0.5">Blocked · Tap to unblock</Text>}
                    {!isBooked && !isBlocked && price !== null && (
                      <Text className="text-xs text-muted mt-0.5">Rs {price.toLocaleString()}</Text>
                    )}
                  </Pressable>
                );
              })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
