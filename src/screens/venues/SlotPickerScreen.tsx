import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useBookedSlots } from "../../hooks/useBookings";
import { colors } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type SlotPickerRoute = RouteProp<VenuesStackParamList, "SlotPicker">;
type SlotPickerNav = NativeStackNavigationProp<VenuesStackParamList, "SlotPicker">;

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function getNext14Days(): string[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return toLocalDateStr(d);
  });
}

type Slot = { start: string; end: string; label: string };

function generateSlots(venueStart: string, venueEnd: string): Slot[] {
  const startHour = parseInt(venueStart.split(":")[0], 10);
  const endHour = Math.min(parseInt(venueEnd.split(":")[0], 10), 23);
  return Array.from({ length: endHour - startHour }, (_, i) => {
    const h = startHour + i;
    const nh = h + 1;
    const startStr = `${String(h).padStart(2, "0")}:00`;
    const endStr = `${String(nh).padStart(2, "0")}:00`;
    const fmt = (hr: number) =>
      hr === 0 ? "12:00 AM" : hr < 12 ? `${hr}:00 AM` : hr === 12 ? "12:00 PM" : `${hr - 12}:00 PM`;
    return { start: startStr, end: endStr, label: `${fmt(h)} – ${fmt(nh)}` };
  });
}

function isSlotBooked(slot: Slot, date: string, booked: Array<{ start_time: string; end_time: string }>): boolean {
  const s = new Date(`${date}T${slot.start}:00+05:00`).getTime();
  const e = new Date(`${date}T${slot.end}:00+05:00`).getTime();
  return booked.some((b) => {
    const bs = new Date(b.start_time).getTime();
    const be = new Date(b.end_time).getTime();
    return s < be && e > bs;
  });
}

function isSlotPast(slot: Slot, date: string): boolean {
  return new Date(`${date}T${slot.start}:00+05:00`) < new Date();
}

export default function SlotPickerScreen() {
  const { params } = useRoute<SlotPickerRoute>();
  const navigation = useNavigation<SlotPickerNav>();
  const insets = useSafeAreaInsets();

  const days = getNext14Days();
  const todayStr = toLocalDateStr(new Date());

  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const slots = generateSlots(params.venueStartTime, params.venueEndTime);
  const { data: bookedSlots = [], isLoading } = useBookedSlots(params.courtId, selectedDate);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>{params.courtName}</Text>
          <Text className="text-muted text-sm" numberOfLines={1}>{params.venueName}</Text>
        </View>
        <Text className="text-primary font-semibold text-sm ml-2">
          Rs {params.pricePerHour.toLocaleString()}/hr
        </Text>
      </View>

      {/* Date Strip */}
      <View className="border-b border-border bg-white">
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
            const dateNum = d.getDate().toString();
            return (
              <Pressable
                key={day}
                onPress={() => handleDateChange(day)}
                className={`items-center justify-center w-14 h-16 rounded-xl ${
                  isSelected ? "bg-primary" : "bg-white border border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isSelected ? "text-white" : isToday ? "text-primary" : "text-muted"
                  }`}
                >
                  {dayLabel}
                </Text>
                <Text
                  className={`text-lg font-bold mt-0.5 ${isSelected ? "text-white" : "text-ink"}`}
                >
                  {dateNum}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Slot Grid */}
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
        <Text className="text-sm font-semibold text-ink mb-3">Available time slots</Text>
        {isLoading ? (
          <View className="items-center mt-12">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {slots.map((slot) => {
              const booked = isSlotBooked(slot, selectedDate, bookedSlots);
              const past = isSlotPast(slot, selectedDate);
              const unavailable = booked || past;
              const isSelected = selectedSlot?.start === slot.start;

              return (
                <Pressable
                  key={slot.start}
                  disabled={unavailable}
                  onPress={() => setSelectedSlot(isSelected ? null : slot)}
                  style={{ width: "47%" }}
                  className={`items-center justify-center rounded-xl border px-3 py-3 ${
                    unavailable
                      ? "bg-gray-50 border-border"
                      : isSelected
                      ? "bg-primary border-primary"
                      : "bg-white border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium text-center ${
                      unavailable ? "text-muted" : isSelected ? "text-white" : "text-ink"
                    } ${past ? "line-through" : ""}`}
                  >
                    {slot.label}
                  </Text>
                  {booked && !past && (
                    <Text className="text-xs text-muted mt-0.5">Booked</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-4 pb-8 pt-3">
        {selectedSlot && (
          <Text className="text-center text-sm text-muted mb-2">
            {selectedSlot.label} · Rs {params.pricePerHour.toLocaleString()}
          </Text>
        )}
        <Pressable
          onPress={() => {
            if (!selectedSlot) return;
            navigation.navigate("BookingCheckout", {
              courtId: params.courtId,
              courtName: params.courtName,
              pricePerHour: params.pricePerHour,
              venueName: params.venueName,
              date: selectedDate,
              startTime: selectedSlot.start,
              endTime: selectedSlot.end,
            });
          }}
          disabled={!selectedSlot}
          className={`rounded-xl py-4 items-center ${selectedSlot ? "bg-primary" : "bg-gray-200"}`}
        >
          <Text className={`font-semibold text-base ${selectedSlot ? "text-white" : "text-muted"}`}>
            {selectedSlot ? "Continue to Checkout" : "Select a time slot to continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
