import { View, Text, Pressable, ScrollView } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../../constants/theme";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type ConfirmRoute = RouteProp<VenuesStackParamList, "BookingConfirmation">;
type ConfirmNav = NativeStackNavigationProp<VenuesStackParamList, "BookingConfirmation">;

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-PK", {
    weekday: "short",
    year: "numeric",
    month: "short",
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

function InfoRow({
  label,
  value,
  valueClassName = "text-ink font-medium",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-muted text-sm">{label}</Text>
      <Text className={`text-sm ${valueClassName}`}>{value}</Text>
    </View>
  );
}

export default function BookingConfirmationScreen() {
  const { params } = useRoute<ConfirmRoute>();
  const navigation = useNavigation<ConfirmNav>();

  const { bookingId, venueName, courtName, date, startTime, endTime, totalAmount } = params;

  const goToMyBookings = () => {
    // Navigate to the Profile tab → MyBookings nested screen
    navigation.dispatch(
      CommonActions.navigate({ name: "Profile", params: { screen: "MyBookings" } })
    );
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 }}
      >
        {/* Success Icon */}
        <View className="w-28 h-28 rounded-full bg-primary-light items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={72} color={colors.primary} />
        </View>

        <Text className="text-2xl font-bold text-ink mb-2 text-center">Booking Confirmed!</Text>
        <Text className="text-muted text-center mb-8 text-base leading-6">
          Your court is reserved.{"\n"}We'll see you on the field!
        </Text>

        {/* Details Card — shadow lives on this outer, non-clipping wrapper
            since a shadow doesn't render on a view with overflow:hidden
            (needed to clip the header band's corners). */}
        <View className="w-full rounded-2xl" style={heroShadow}>
        <View className="w-full border border-border rounded-2xl overflow-hidden">
          <View className="bg-primary-light px-4 py-3 flex-row items-center justify-between">
            <Text className="text-primary-dark font-semibold text-sm">Booking Reference</Text>
            <Text className="text-primary font-bold text-xs tracking-widest">
              {bookingId.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View className="px-4 py-4" style={{ gap: 10 }}>
            <InfoRow label="Venue" value={venueName} />
            <InfoRow label="Court" value={courtName} />
            <View className="h-px bg-border" />
            <InfoRow label="Date" value={formatDateFull(date)} />
            <InfoRow label="Time" value={`${formatTime(startTime)} – ${formatTime(endTime)}`} />
            <View className="h-px bg-border" />
            <InfoRow
              label="Total"
              value={`Rs ${totalAmount.toLocaleString()}`}
              valueClassName="text-ink font-bold text-base"
            />
            <InfoRow
              label="Payment"
              value="Pay at venue"
              valueClassName="text-warning font-medium"
            />
          </View>
        </View>
        </View>
      </ScrollView>

      <View className="px-4 pb-8 pt-3 border-t border-border" style={{ gap: 10 }}>
        <Pressable
          onPress={goToMyBookings}
          className="bg-primary rounded-xl py-4 items-center"
          style={primaryButtonShadow}
        >
          <Text className="text-white font-semibold text-base">View My Bookings</Text>
        </Pressable>
        <Pressable onPress={() => navigation.popToTop()} className="items-center py-3">
          <Text className="text-muted font-medium">Back to Venues</Text>
        </Pressable>
      </View>
    </View>
  );
}
