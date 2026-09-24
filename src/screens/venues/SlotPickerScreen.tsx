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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBookedSlots } from "../../hooks/useBookings";
import { useCourtPriceRules } from "../../hooks/useVenues";
import { getSportIcon } from "../../lib/sportIcons";
import { colors, cardShadow } from "../../constants/theme";
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

  const sportIconInfo = getSportIcon(params.sportName ?? "");

  return (
    <View className="flex-1 bg-green-50">
      {/* Hero header — a soft tinted panel with a decorative sport-icon
          watermark, matching the card-based look used elsewhere. */}
      <View
        style={{ backgroundColor: colors.primaryLight, paddingTop: insets.top + 16, paddingBottom: 20, overflow: "hidden", position: "relative" }}
      >
        <MaterialCommunityIcons
          name={sportIconInfo.icon}
          size={150}
          color={colors.primaryDark}
          style={{ position: "absolute", right: -20, top: -10, opacity: 0.16, transform: [{ rotate: "-12deg" }] }}
        />
        <View className="px-4">
          <View className="flex-row items-start justify-between">
            <Pressable
              onPress={() => navigation.goBack()}
              className="items-center justify-center rounded-full bg-white"
              style={{ width: 40, height: 40, ...cardShadow }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.ink} />
            </Pressable>
            <View
              className="rounded-full px-3 py-2 bg-white"
              style={{ ...cardShadow }}
            >
              <Text className="text-sm" style={{ color: colors.ink }}>
                <Text className="text-muted">{minPrice === maxPrice ? "" : "From "}</Text>
                <Text className="font-extrabold" style={{ color: colors.primaryDark }}>
                  Rs {minPrice.toLocaleString()}/hr
                </Text>
              </Text>
            </View>
          </View>
          <Text className="text-ink font-extrabold mt-4" style={{ fontSize: 22 }} numberOfLines={1}>
            {params.courtName}
          </Text>
          <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
            <Ionicons name="location" size={13} color={colors.primaryDark} />
            <Text className="font-medium" style={{ color: colors.primaryDark }} numberOfLines={1}>
              {params.venueName}
            </Text>
          </View>
        </View>
      </View>

      {/* Date Strip */}
      <View className="bg-white border-b border-border">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}
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
                className="items-center justify-center rounded-2xl"
                style={{
                  width: 56,
                  height: 64,
                  backgroundColor: isSelected ? colors.primary : "white",
                  borderWidth: isSelected ? 0 : 1,
                  borderColor: colors.border,
                  ...(isSelected ? primaryShadow : cardShadow),
                }}
              >
                <Text
                  className={`text-xs font-semibold ${isSelected ? "text-white" : isToday ? "text-primary" : "text-muted"}`}
                >
                  {dayLabel}
                </Text>
                <Text className={`text-lg font-extrabold mt-0.5 ${isSelected ? "text-white" : "text-ink"}`}>
                  {dateNum}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Slot Grid */}
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 26, height: 26, backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="time" size={14} color={colors.primaryDark} />
          </View>
          <Text className="text-base font-bold text-ink">Available time slots</Text>
        </View>
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
                // A slot whose price differs from the court's base rate has
                // a special price rule applied (peak or off-peak) — flagged
                // with an amber tint so it stands out either way.
                const isSpecialPrice = !booked && price !== params.pricePerHour;

                const iconBg = booked ? "#F3F4F6" : isSelected ? "rgba(255,255,255,0.22)" : isSpecialPrice ? "#FEF3C7" : colors.primaryLight;
                const iconColor = booked ? colors.muted : isSelected ? "white" : isSpecialPrice ? "#D97706" : colors.primaryDark;

                return (
                  <Pressable
                    key={slot.start}
                    disabled={booked}
                    onPress={() => toggleSlot(slot)}
                    style={{
                      width: "47%",
                      borderWidth: 1,
                      borderColor: booked ? colors.border : isSelected ? colors.primary : isSpecialPrice ? "#FDE68A" : colors.border,
                      backgroundColor: booked ? "#FAFAFA" : isSelected ? colors.primary : isSpecialPrice ? "#FFFBEB" : "white",
                    }}
                    className="flex-row items-center rounded-2xl px-2.5 py-3"
                  >
                    <View
                      className="items-center justify-center rounded-full mr-2"
                      style={{ width: 28, height: 28, backgroundColor: iconBg, flexShrink: 0 }}
                    >
                      <Ionicons name="time-outline" size={13} color={iconColor} />
                    </View>
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <Text
                        className={`font-bold ${booked ? "text-muted" : isSelected ? "text-white" : "text-ink"}`}
                        style={{ fontSize: 12.5 }}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        {slot.label}
                      </Text>
                      {booked ? (
                        <Text className="text-xs text-muted mt-0.5">Booked</Text>
                      ) : (
                        <Text
                          className="text-xs mt-0.5"
                          style={{ color: isSelected ? "rgba(255,255,255,0.85)" : colors.muted }}
                        >
                          Rs {price.toLocaleString()}
                        </Text>
                      )}
                    </View>
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
              sportName: params.sportName,
            });
          }}
          disabled={selectedSlots.length === 0}
          className={`rounded-2xl py-4 items-center ${selectedSlots.length > 0 ? "bg-primary" : "bg-gray-200"}`}
          style={selectedSlots.length > 0 ? primaryShadow : undefined}
        >
          <Text className={`font-bold text-base ${selectedSlots.length > 0 ? "text-white" : "text-muted"}`}>
            {selectedSlots.length > 0 ? "Continue to Checkout" : "Select a time slot to continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const primaryShadow = {
  shadowColor: colors.primary,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 3,
} as const;
