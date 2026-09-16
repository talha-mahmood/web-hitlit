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
import { useCourtPriceRules } from "../../hooks/useVenues";
import { colors } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";
import {
  toLocalDateStr,
  getNext14Days,
  generateFullDaySlots,
  isSlotBooked,
  isSlotPast,
  resolveSlotPrice,
  type Slot,
} from "../../lib/slots";

type SlotPickerRoute = RouteProp<VenuesStackParamList, "SlotPicker">;
type SlotPickerNav = NativeStackNavigationProp<VenuesStackParamList, "SlotPicker">;

export default function SlotPickerScreen() {
  const { params } = useRoute<SlotPickerRoute>();
  const navigation = useNavigation<SlotPickerNav>();
  const insets = useSafeAreaInsets();

  const days = getNext14Days();
  const todayStr = toLocalDateStr(new Date());

  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);

  const slots = generateFullDaySlots();
  const { data: bookedSlots = [], isLoading } = useBookedSlots(params.courtId, selectedDate);
  const { data: priceRules = [] } = useCourtPriceRules(params.courtId);

  const slotPrice = (slot: Slot) => resolveSlotPrice(slot, params.pricePerHour, priceRules);
  const allPrices = slots.map(slotPrice);
  const minPrice = allPrices.length ? Math.min(...allPrices) : params.pricePerHour;
  const maxPrice = allPrices.length ? Math.max(...allPrices) : params.pricePerHour;
  // Kept sorted by start time regardless of tap order, so the summary and
  // the checkout screen always list slots chronologically.
  const sortedSelectedSlots = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
  const totalPrice = selectedSlots.reduce((sum, s) => sum + slotPrice(s), 0);

  const toggleSlot = (slot: Slot) => {
    setSelectedSlots((prev) =>
      prev.some((s) => s.start === slot.start)
        ? prev.filter((s) => s.start !== slot.start)
        : [...prev, slot]
    );
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlots([]);
  };

  return (
    <View className="flex-1 bg-gray-100">
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
          {minPrice === maxPrice ? `Rs ${minPrice.toLocaleString()}/hr` : `From Rs ${minPrice.toLocaleString()}/hr`}
        </Text>
      </View>

      {/* Date Strip */}
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
            {slots
              .filter((slot) => !isSlotPast(slot, selectedDate))
              .map((slot) => {
                const booked = isSlotBooked(slot, selectedDate, bookedSlots);
                const isSelected = selectedSlots.some((s) => s.start === slot.start);
                const price = slotPrice(slot);

                return (
                  <Pressable
                    key={slot.start}
                    disabled={booked}
                    onPress={() => toggleSlot(slot)}
                    style={{ width: "47%" }}
                    className={`items-center justify-center rounded-xl border px-3 py-3 ${
                      booked
                        ? "bg-gray-50 border-border"
                        : isSelected
                        ? "bg-primary border-primary"
                        : "bg-white border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium text-center ${
                        booked ? "text-muted" : isSelected ? "text-white" : "text-ink"
                      }`}
                    >
                      {slot.label}
                    </Text>
                    {booked ? (
                      <Text className="text-xs text-muted mt-0.5">Booked</Text>
                    ) : (
                      <Text
                        className={`text-xs mt-0.5 ${
                          isSelected ? "text-white" : "text-muted"
                        }`}
                      >
                        Rs {price.toLocaleString()}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-4 pb-8 pt-3">
        {selectedSlots.length > 0 && (
          <Text className="text-center text-sm text-muted mb-2" numberOfLines={2}>
            {sortedSelectedSlots.length} slot{sortedSelectedSlots.length !== 1 ? "s" : ""} ·{" "}
            {sortedSelectedSlots.map((s) => s.label.split(" – ")[0]).join(", ")} · Rs{" "}
            {totalPrice.toLocaleString()}
          </Text>
        )}
        <Pressable
          onPress={() => {
            if (selectedSlots.length === 0) return;
            navigation.navigate("BookingCheckout", {
              courtId: params.courtId,
              courtName: params.courtName,
              venueName: params.venueName,
              date: selectedDate,
              slots: sortedSelectedSlots.map((s) => ({
                startTime: s.start,
                endTime: s.end,
                price: slotPrice(s),
              })),
              forGameId: params.forGameId,
            });
          }}
          disabled={selectedSlots.length === 0}
          className={`rounded-xl py-4 items-center ${selectedSlots.length > 0 ? "bg-primary" : "bg-gray-200"}`}
        >
          <Text className={`font-semibold text-base ${selectedSlots.length > 0 ? "text-white" : "text-muted"}`}>
            {selectedSlots.length > 0 ? "Continue to Checkout" : "Select a time slot to continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
