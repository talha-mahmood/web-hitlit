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
  generateSlots,
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
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const slots = generateSlots(params.venueStartTime, params.venueEndTime);
  const { data: bookedSlots = [], isLoading } = useBookedSlots(params.courtId, selectedDate);
  const { data: priceRules = [] } = useCourtPriceRules(params.courtId);

  const slotPrice = (slot: Slot) => resolveSlotPrice(slot, params.pricePerHour, priceRules);
  const allPrices = slots.map(slotPrice);
  const minPrice = allPrices.length ? Math.min(...allPrices) : params.pricePerHour;
  const maxPrice = allPrices.length ? Math.max(...allPrices) : params.pricePerHour;
  const selectedPrice = selectedSlot ? slotPrice(selectedSlot) : null;

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
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
            {slots.map((slot) => {
              const booked = isSlotBooked(slot, selectedDate, bookedSlots);
              const past = isSlotPast(slot, selectedDate);
              const unavailable = booked || past;
              const isSelected = selectedSlot?.start === slot.start;
              const price = slotPrice(slot);

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
                  {booked && !past ? (
                    <Text className="text-xs text-muted mt-0.5">Booked</Text>
                  ) : (
                    <Text
                      className={`text-xs mt-0.5 ${
                        unavailable ? "text-muted" : isSelected ? "text-white" : "text-muted"
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
        {selectedSlot && selectedPrice !== null && (
          <Text className="text-center text-sm text-muted mb-2">
            {selectedSlot.label} · Rs {selectedPrice.toLocaleString()}
          </Text>
        )}
        <Pressable
          onPress={() => {
            if (!selectedSlot || selectedPrice === null) return;
            navigation.navigate("BookingCheckout", {
              courtId: params.courtId,
              courtName: params.courtName,
              pricePerHour: selectedPrice,
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
