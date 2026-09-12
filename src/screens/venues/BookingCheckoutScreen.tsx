import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCreateBooking } from "../../hooks/useBookings";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type CheckoutRoute = RouteProp<VenuesStackParamList, "BookingCheckout">;
type CheckoutNav = NativeStackNavigationProp<VenuesStackParamList, "BookingCheckout">;

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const h = parseInt(timeStr.split(":")[0], 10);
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

type RowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
};

function SummaryRow({ icon, label, value }: RowProps) {
  return (
    <View className="flex-row items-start" style={{ gap: 12 }}>
      <Ionicons name={icon} size={16} color={colors.muted} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        <Text className="text-ink text-sm font-medium mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

export default function BookingCheckoutScreen() {
  const { params } = useRoute<CheckoutRoute>();
  const navigation = useNavigation<CheckoutNav>();
  const session = useAuthStore((s) => s.session);
  const createBooking = useCreateBooking();
  const insets = useSafeAreaInsets();

  const { courtId, courtName, venueName, date, slots } = params;
  const totalAmount = slots.reduce((sum, s) => sum + s.price, 0);
  const sortedSlots = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleConfirm = async () => {
    if (!session?.user.id) return;
    try {
      const bookings = await createBooking.mutateAsync({
        courtId,
        userId: session.user.id,
        date,
        slots,
      });
      navigation.replace("BookingConfirmation", {
        bookingIds: bookings.map((b) => b.id),
        venueName,
        courtName,
        date,
        slots: sortedSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
        totalAmount: bookings.reduce((sum, b) => sum + b.total_amount, 0),
      });
    } catch (err) {
      Alert.alert(
        "Booking Failed",
        err instanceof Error ? err.message : "Could not complete your booking. Please try again."
      );
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink">Confirm Booking</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Booking Summary — shadow lives on this outer, non-clipping
            wrapper since a shadow doesn't render on a view with
            overflow:hidden (needed to clip the header band's corners). */}
        <View className="rounded-2xl mb-5" style={cardShadow}>
          <View className="border border-border rounded-2xl overflow-hidden">
            <View className="bg-primary-light px-4 py-3">
              <Text className="text-primary-dark font-semibold text-sm">Booking Summary</Text>
            </View>
            <View className="px-4 py-4" style={{ gap: 12 }}>
              <SummaryRow icon="business-outline" label="Venue" value={venueName} />
              <SummaryRow icon="tennisball-outline" label="Court" value={courtName} />
              <View className="h-px bg-border" />
              <SummaryRow icon="calendar-outline" label="Date" value={formatDateFull(date)} />
              <View className="flex-row items-start" style={{ gap: 12 }}>
                <Ionicons name="time-outline" size={16} color={colors.muted} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-muted text-xs mb-1">
                    {sortedSlots.length} time slot{sortedSlots.length !== 1 ? "s" : ""}
                  </Text>
                  {sortedSlots.map((s) => (
                    <View key={s.startTime} className="flex-row items-center justify-between mt-0.5">
                      <Text className="text-ink text-sm font-medium">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </Text>
                      <Text className="text-muted text-sm">Rs {s.price.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className="h-px bg-border" />
              <View className="flex-row items-center justify-between">
                <Text className="text-muted text-sm">Total Amount</Text>
                <Text className="text-ink font-bold text-xl">Rs {totalAmount.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View
          className="border border-border rounded-2xl bg-white px-4 py-4 flex-row items-center"
          style={{ gap: 12, ...cardShadow }}
        >
          <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-ink font-medium">Pay at Venue</Text>
            <Text className="text-muted text-xs mt-0.5">
              Cash on arrival · Online payment coming soon
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-4 pb-8 pt-3">
        <Pressable
          onPress={handleConfirm}
          disabled={createBooking.isPending}
          className="bg-primary rounded-xl py-4 items-center"
          style={primaryButtonShadow}
        >
          {createBooking.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Confirm Booking · Rs {totalAmount.toLocaleString()}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
