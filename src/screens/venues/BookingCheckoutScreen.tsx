import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCreateBooking } from "../../hooks/useBookings";
import { useLinkGameBooking } from "../../hooks/useGames";
import { useAuthStore } from "../../store/authStore";
import { getSportIcon } from "../../lib/sportIcons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

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
  divider?: boolean;
};

function SummaryRow({ icon, label, value, divider = true }: RowProps) {
  return (
    <View
      className="flex-row items-center py-3"
      style={{ gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: colors.border }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
      >
        <Ionicons name={icon} size={17} color={colors.primaryDark} />
      </View>
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        <Text className="text-ink text-base font-bold mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

export default function BookingCheckoutScreen() {
  const { params } = useRoute<CheckoutRoute>();
  const navigation = useNavigation<CheckoutNav>();
  const session = useAuthStore((s) => s.session);
  const createBooking = useCreateBooking();
  const linkGameBooking = useLinkGameBooking();
  const insets = useSafeAreaInsets();

  const { courtId, courtName, venueName, date, slots, forGameId } = params;
  const totalAmount = slots.reduce((sum, s) => sum + s.price, 0);
  const sortedSlots = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const sportIconInfo = getSportIcon(params.sportName ?? "");

  const handleConfirm = async () => {
    if (!session?.user.id) return;
    try {
      const bookings = await createBooking.mutateAsync({
        courtId,
        userId: session.user.id,
        date,
        slots,
        gameId: forGameId,
      });

      // Launched from a tournament's "Book Venue" button — link the booking
      // back to that game and return straight to its detail screen (where
      // the button now reads "Venue Booked") instead of the normal
      // standalone confirmation screen.
      if (forGameId) {
        await linkGameBooking.mutateAsync({ gameId: forGameId, bookingId: bookings[0].id });
        Alert.alert("Venue Booked", "Your venue has been booked for this tournament.", [
          { text: "OK", onPress: () => navigation.navigate("GameDetail", { gameId: forGameId }) },
        ]);
        return;
      }

      navigation.replace("BookingConfirmation", {
        bookingIds: bookings.map((b) => b.id),
        venueName,
        courtName,
        date,
        slots: sortedSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
        totalAmount: bookings.reduce((sum, b) => sum + b.total_amount, 0),
        sportName: params.sportName,
      });
    } catch (err) {
      Alert.alert(
        "Booking Failed",
        getFriendlyErrorMessage(err, "Could not complete your booking. Please try again.")
      );
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Hero header — same tinted-panel + watermark language as the slot
          picker screen this flow comes from. */}
      <View
        style={{ backgroundColor: colors.primaryLight, paddingTop: insets.top + 16, paddingBottom: 24, overflow: "hidden", position: "relative" }}
      >
        <MaterialCommunityIcons
          name={sportIconInfo.icon}
          size={150}
          color={colors.primaryDark}
          style={{ position: "absolute", right: -20, top: -10, opacity: 0.16, transform: [{ rotate: "-12deg" }] }}
        />
        <View className="px-4 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="items-center justify-center rounded-full bg-white mr-3"
            style={{ width: 40, height: 40, ...cardShadow }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-ink font-extrabold" style={{ fontSize: 22 }} numberOfLines={1}>
              Confirm Booking
            </Text>
            <Text className="text-muted text-sm mt-0.5">Review your booking details</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-5" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Booking Summary — shadow lives on this outer, non-clipping
            wrapper since a shadow doesn't render on a view with
            overflow:hidden (needed to clip the header band's corners). */}
        <View className="rounded-2xl mb-5" style={{ ...cardShadow, backgroundColor: "white" }}>
          <View className="rounded-2xl overflow-hidden">
            <View className="flex-row items-center" style={{ backgroundColor: colors.primaryLight, gap: 12, padding: 16 }}>
              <View
                className="items-center justify-center rounded-full bg-white"
                style={{ width: 44, height: 44 }}
              >
                <Ionicons name="checkmark-done" size={20} color={colors.primaryDark} />
              </View>
              <View className="flex-1">
                <Text className="text-ink font-bold text-base">Booking Summary</Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.primaryDark }}>
                  Please review your booking details before confirming
                </Text>
              </View>
            </View>
            <View className="px-4">
              <SummaryRow icon="business-outline" label="Venue" value={venueName} />
              <SummaryRow icon="tennisball-outline" label="Court" value={courtName} />
              <SummaryRow icon="calendar-outline" label="Date" value={formatDateFull(date)} divider={false} />
              <View className="flex-row items-start py-3" style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
                >
                  <Ionicons name="time-outline" size={17} color={colors.primaryDark} />
                </View>
                <View className="flex-1">
                  <Text className="text-muted text-xs mb-2">
                    Time Slots ({sortedSlots.length})
                  </Text>
                  <View className="rounded-xl overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
                    {sortedSlots.map((s, i) => (
                      <View
                        key={s.startTime}
                        className="flex-row items-center justify-between px-3 py-2.5"
                        style={{
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: "white",
                        }}
                      >
                        <Text className="text-ink text-sm font-bold">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        </Text>
                        <Text className="text-muted text-sm">Rs {s.price.toLocaleString()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
            <View
              className="flex-row items-center justify-between mx-4 mb-4 rounded-xl px-4 py-3.5"
              style={{ backgroundColor: colors.primaryLight, gap: 12 }}
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center rounded-full bg-white" style={{ width: 36, height: 36 }}>
                  <Ionicons name="wallet-outline" size={17} color={colors.primaryDark} />
                </View>
                <Text className="text-ink font-medium">Total Amount</Text>
              </View>
              <Text className="font-extrabold text-xl" style={{ color: colors.primaryDark }}>
                Rs {totalAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View
          className="border border-border rounded-2xl bg-white px-4 py-4 flex-row items-center"
          style={{ gap: 12, ...cardShadow }}
        >
          <View className="w-11 h-11 rounded-full bg-primary-light items-center justify-center">
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-ink font-bold text-base">Pay at Venue</Text>
            <Text className="text-muted text-xs mt-0.5">
              Cash on arrival · Online payment coming soon
            </Text>
          </View>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 26, height: 26, backgroundColor: colors.primary }}
          >
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-4 pb-8 pt-3">
        <Pressable
          onPress={handleConfirm}
          disabled={createBooking.isPending}
          className="bg-primary rounded-2xl py-4 flex-row items-center justify-center"
          style={{ gap: 8, ...primaryButtonShadow }}
        >
          {createBooking.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text className="text-white font-bold text-base">
                Confirm Booking · Rs {totalAmount.toLocaleString()}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
